import { create, local, select } from "d3"
const d3: any = { create, local, select }
import tippy, { delegate, hideAll } from "tippy.js"

// -----------------------------------------------------------------------------
// Tooltips
// -----------------------------------------------------------------------------

let textTooltipDelegate = null
let tooltipRegistry = new Set<any>()

function tooltipProps() {
  return {
    appendTo: () => document.body,
    arrow: false,
    delay: [100, 0] as [number, number],
    duration: [120, 80] as [number, number],
    maxWidth: 420,
    offset: [0, 4] as [number, number],
    theme: "factorio",
  }
}

export function initializeTooltips() {
  if (textTooltipDelegate !== null) {
    return
  }
  textTooltipDelegate = delegate(document.body, {
    ...tooltipProps(),
    target: "[data-tooltip]",
    content: (reference) => reference.getAttribute("data-tooltip") ?? "",
    onTrigger(instance) {
      instance.setContent(instance.reference.getAttribute("data-tooltip") ?? "")
    },
  })
}

export function makePopover(reference, content, props: any = {}) {
  let { onShow, ...popoverProps } = props
  let instance = tippy(reference, {
    ...tooltipProps(),
    content,
    interactive: true,
    trigger: "click",
    ...popoverProps,
    onShow(instance) {
      hideAll({ exclude: instance })
      return onShow?.(instance)
    },
  })
  tooltipRegistry.add(instance)
  return instance
}

export class Tooltip {
  [key: string]: any
  private instance: any = null
  private content: any = null
  private removed = false
  private readonly activate: () => void

  constructor(
    readonly reference: HTMLElement,
    private readonly callback: () => HTMLElement,
    private readonly target: HTMLElement = reference,
  ) {
    this.activate = () => {
      this.ensureInstance()?.show()
    }
    reference.addEventListener("pointerenter", this.activate)
    reference.addEventListener("focus", this.activate)
    reference.addEventListener("touchstart", this.activate, { passive: true })
    tooltipRegistry.add(this)
  }

  private ensureInstance(): any {
    if (this.removed) {
      return null
    }
    if (this.instance !== null) {
      return this.instance
    }
    this.reference.removeEventListener("pointerenter", this.activate)
    this.reference.removeEventListener("focus", this.activate)
    this.reference.removeEventListener("touchstart", this.activate)
    this.instance = tippy(this.reference, {
      ...tooltipProps(),
      content: " ",
      getReferenceClientRect:
        this.target === this.reference ? undefined : () => this.target.getBoundingClientRect(),
      placement: "right-start",
      onShow: (instance) => {
        if (this.content === null) {
          this.content = this.callback()
          instance.setContent(this.content)
        }
      },
    })
    return this.instance
  }

  destroy(): void {
    if (this.removed) {
      return
    }
    this.removed = true
    tooltipRegistry.delete(this)
    this.reference.removeEventListener("pointerenter", this.activate)
    this.reference.removeEventListener("focus", this.activate)
    this.reference.removeEventListener("touchstart", this.activate)
    this.instance?.destroy()
    this.instance = null
  }

  remove(): void {
    this.destroy()
  }
}

export function reapTooltips() {
  for (let instance of tooltipRegistry) {
    if (!document.body.contains(instance.reference)) {
      tooltipRegistry.delete(instance)
      instance.destroy()
    }
  }
}

// -----------------------------------------------------------------------------
// Icons and sprite sheet
// -----------------------------------------------------------------------------

export const PX_WIDTH = 32
export const PX_HEIGHT = 32

// An object representing an icon of an item, recipe, belt, building, or
// whatever else.
//
// Args:
//   obj: The object which this icon will represent. If it provides a
//        renderTooltip() method, this will be used to make a tooltip on the
//        icon available.
//   name: The filename of the image to use. If not provided, defaults to
//         obj.name.
export class Icon {
  [key: string]: any
  constructor(obj, name = undefined) {
    if (name === undefined) {
      this.name = obj.name
    } else {
      this.name = name
    }
    this.obj = obj
  }
  // Creates a new <img> node.
  //
  // Args:
  //   size: The width and height of the (square) image, in pixels. If null
  //         or not given, the size will not be set in the markup (and should
  //         probably be set in the style sheet).
  //   suppressTooltip: If true, a tooltip will not be added to this image.
  //   target: The reference node next to which any tooltip will be rendered.
  //           If not provided, defaults to the image itself.
  make(size, suppressTooltip, target) {
    let x = -this.obj.icon_col * PX_WIDTH
    let y = -this.obj.icon_row * PX_HEIGHT
    let img = d3
      .select(makeEmptyIcon(size))
      .classed("icon", true)
      .style("background", "url(images/sprite-sheet-" + sheetHash + ".webp)")
    if (size !== 32) {
      let ratio = size / 32
      x *= ratio
      y *= ratio
      let width = sheetWidth * ratio
      let height = sheetHeight * ratio
      img.style("background-size", `${width}px ${height}px`)
    }
    img.style("background-position", `${x}px ${y}px`)
    if (!suppressTooltip) {
      if (this.obj.renderTooltip) {
        let self = this
        new Tooltip(img.node(), () => self.obj.renderTooltip(), target)
      } else {
        img.attr("data-tooltip", this.obj.name)
      }
    }
    img.attr("alt", this.name)
    return img.node()
  }
}

export function makeEmptyIcon(size) {
  let img = d3
    .create("img")
    .classed("icon", true)
    // Chrome wants the <img> element to have a src attribute, or it will
    // draw a border around it. Cram in this transparent 1x1 pixel image.
    .attr("src", "images/pixel.gif")
  if (size) {
    img.attr("width", size).attr("height", size)
  }
  return img.node()
}

class Sprite {
  [key: string]: any
  constructor(name, col, row) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
}

export let sprites
export let sheetHash
export let sheetWidth
export let sheetHeight

export function getSprites(data) {
  sheetHash = data.sprites.hash
  sheetWidth = data.sprites.width
  sheetHeight = data.sprites.height
  sprites = new Map()
  for (var name in data.sprites.extra) {
    var d = data.sprites.extra[name]
    sprites.set(name, new Sprite(d.name, d.icon_col, d.icon_row))
  }
}

// -----------------------------------------------------------------------------
// Dropdown primitives
// -----------------------------------------------------------------------------

let dropdownLocal = d3.local()

function toggleDropdown(this: HTMLElement) {
  let { instance } = dropdownLocal.get(this)
  if (instance.state.isVisible) {
    instance.hide()
  } else {
    instance.show()
  }
}

// Appends a dropdown to the selection, and returns a selection over the div
// for the content of the dropdown.
export function makeDropdown(selector, onOpen = null, onClose = null) {
  let wrapper = selector
    .append("div")
    .classed("dropdownWrapper", true)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-haspopup", "listbox")
    .attr("aria-expanded", "false")
  let dropdownInner = wrapper.append("div").classed("dropdown tippy-dropdown-menu", true)
  let spacer = wrapper.append("div").classed("spacer", true)
  let wrapperNode = wrapper.node() as HTMLElement
  let dropdownNode = dropdownInner.node() as HTMLElement
  let spacerNode = spacer.node() as HTMLElement
  let escapeHandler = null
  let tippyInstance: any = null
  let destroyed = false
  const hiddenState = { isVisible: false }
  const instance = {
    reference: wrapperNode,
    get state() {
      return tippyInstance?.state ?? hiddenState
    },
    show() {
      if (destroyed) {
        return
      }
      tippyInstance ??= tippy(wrapperNode, {
        ...tooltipProps(),
        animation: false,
        arrow: false,
        content: " ",
        duration: 0,
        hideOnClick: true,
        interactive: true,
        maxWidth: "none",
        offset: [0, 4],
        placement: "bottom-start",
        theme: "factorio-dropdown",
        trigger: "manual",
        onShow(realInstance) {
          hideAll({ exclude: realInstance })
          let selected = dropdownNode.querySelector("input:checked + label")
          if (selected instanceof HTMLElement) {
            let bounds = selected.getBoundingClientRect()
            spacer.style("width", `${bounds.width}px`).style("height", `${bounds.height}px`)
          }
          wrapperNode.classList.add("open")
          dropdownNode.classList.add("open")
          wrapper.attr("aria-expanded", "true")
          realInstance.setContent(dropdownNode)
        },
        onMount() {
          escapeHandler = (event) => {
            if (event.key === "Escape") {
              instance.hide()
              wrapperNode.focus()
            }
          }
          document.addEventListener("keydown", escapeHandler)
          onOpen?.(d3.select(dropdownNode))
        },
        onClickOutside(realInstance) {
          realInstance.hide()
        },
        onHidden(realInstance) {
          if (escapeHandler !== null) {
            document.removeEventListener("keydown", escapeHandler)
            escapeHandler = null
          }
          wrapperNode.insertBefore(dropdownNode, spacerNode)
          realInstance.setContent(" ")
          wrapperNode.classList.remove("open")
          dropdownNode.classList.remove("open")
          wrapper.attr("aria-expanded", "false")
          onClose?.(d3.select(dropdownNode))
        },
      })
      tippyInstance.show()
    },
    hide() {
      tippyInstance?.hide()
    },
    destroy() {
      if (destroyed) {
        return
      }
      destroyed = true
      if (escapeHandler !== null) {
        document.removeEventListener("keydown", escapeHandler)
        escapeHandler = null
      }
      tippyInstance?.destroy()
      tippyInstance = null
    },
  }
  let dropdownState = { dropdownNode, instance, onClose, onOpen, spacerNode, wrapperNode }
  dropdownLocal.set(wrapperNode, dropdownState)
  dropdownLocal.set(dropdownNode, dropdownState)
  tooltipRegistry.add(instance)
  wrapper.on("click", toggleDropdown).on("keydown", function (this: HTMLElement, event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      toggleDropdown.call(this)
    }
  })
  return dropdownInner
}

let inputId = 0
let labelFor = 0

// Appends a dropdown input to the selection.
//
// Args:
//   name: Should be unique to the dropdown.
//   checked: Should be true when a given input is the selected one.
//   callback: Called when the selected item is changed.
//
// Returns:
//   Selection with the input's label.
export function addInputs(selector, name, checked, callback) {
  selector
    .append("input")
    .on("change", function (this: HTMLInputElement, event, d) {
      toggleDropdown.call(this)
      callback.call(this, d)
    })
    .attr("id", () => "input-" + inputId++)
    .attr("name", name)
    .attr("type", "radio")
    .property("checked", checked)
  let label = selector.append("label").attr("for", () => "input-" + labelFor++)
  return label
}

// Wrapper around makeDropdown/addInputs to create an input for each item in
// data.
export function dropdown(selector, data, name, checked, callback) {
  let dd = makeDropdown(selector).selectAll("div").data(data).join("div")
  return addInputs(dd, name, checked, callback)
}

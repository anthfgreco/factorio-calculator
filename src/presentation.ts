import tippy, { delegate, hideAll } from "tippy.js"

// -----------------------------------------------------------------------------
// Tooltips
// -----------------------------------------------------------------------------

let textTooltipDelegate = null
let tooltipRegistry = new Set<any>()

function tooltipProps() {
  return {
    appendTo: () => document.body,
    delay: [100, 0] as [number, number],
    duration: [120, 80] as [number, number],
    maxWidth: 420,
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
  constructor(reference, callback, target) {
    if (!target) {
      target = reference
    }
    this.reference = reference
    let content = null
    this.instance = tippy(reference, {
      ...tooltipProps(),
      content: " ",
      getReferenceClientRect: target === reference ? undefined : () => target.getBoundingClientRect(),
      offset: [0, 12],
      placement: "right-start",
      onShow(instance) {
        if (content === null) {
          content = callback()
          instance.setContent(content)
        }
      },
    })
    tooltipRegistry.add(this.instance)
  }
  remove() {
    tooltipRegistry.delete(this.instance)
    this.instance.destroy()
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
      .style("background", "url(images/sprite-sheet-" + sheetHash + ".png)")
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
  let { dropdownNode, onOpen, onClose } = dropdownLocal.get(this)
  let dropdown = d3.select(dropdownNode)
  let classes = dropdownNode.classList
  if (classes.contains("open")) {
    classes.remove("open")
    if (onClose) {
      onClose(dropdown)
    }
  } else {
    let selected = dropdown.select("input:checked + label")
    dropdown.select(".spacer").style("width", selected.style("width")).style("height", selected.style("height"))
    classes.add("open")
    if (onOpen) {
      onOpen(dropdown)
    }
  }
}

// Appends a dropdown to the selection, and returns a selection over the div
// for the content of the dropdown.
export function makeDropdown(selector, onOpen = null, onClose = null) {
  let dropdown = selector
    .append("div")
    .classed("dropdownWrapper", true)
    .each(function (this: HTMLElement) {
      let dropdownNode = this
      dropdownLocal.set(this, { dropdownNode, onOpen, onClose })
    })
  dropdown.append("div").classed("clicker", true).on("click", toggleDropdown)
  let dropdownInner = dropdown.append("div").classed("dropdown", true).on("click", toggleDropdown)
  dropdown.append("div").classed("spacer", true)
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

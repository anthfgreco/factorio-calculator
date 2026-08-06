import { create, local, select, type BaseType, type Selection, type ValueFn } from "d3"
import tippy, { delegate, hideAll, type DelegateInstance, type Instance, type Props } from "tippy.js"
import type { CalculatorData } from "./data.js"

// -----------------------------------------------------------------------------
// Tooltips
// -----------------------------------------------------------------------------

interface TooltipRegistryEntry {
  readonly reference: Element
  destroy(): void
}

let textTooltipDelegate: DelegateInstance | null = null
const tooltipRegistry = new Set<TooltipRegistryEntry>()

function tooltipProps(): Partial<Props> {
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

export function initializeTooltips(): void {
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

export function makePopover(reference: HTMLElement, content: string | Element, props: Partial<Props> = {}): Instance {
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

export class Tooltip implements TooltipRegistryEntry {
  private instance: Instance | null = null
  private content: HTMLElement | null = null
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

  private ensureInstance(): Instance | null {
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
      ...(this.target === this.reference ? {} : { getReferenceClientRect: () => this.target.getBoundingClientRect() }),
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

export function reapTooltips(): void {
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
export interface IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  renderTooltip?(): HTMLElement
}

export class Icon {
  readonly name: string

  constructor(
    readonly obj: IconObject,
    name?: string,
  ) {
    this.name = name ?? obj.name
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
  make(size = 32, suppressTooltip = false, target?: HTMLElement): HTMLImageElement {
    let x = -this.obj.icon_col * PX_WIDTH
    let y = -this.obj.icon_row * PX_HEIGHT
    let img = select(makeEmptyIcon(size))
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
        const image = requireNode(img.node(), "icon image")
        new Tooltip(image, () => self.obj.renderTooltip!(), target ?? image)
      } else {
        img.attr("data-tooltip", this.obj.name)
      }
    }
    img.attr("alt", this.name)
    return requireNode(img.node(), "icon image") as HTMLImageElement
  }
}

export function makeEmptyIcon(size?: number): HTMLImageElement {
  let img = create("img")
    .classed("icon", true)
    // Chrome wants the <img> element to have a src attribute, or it will
    // draw a border around it. Cram in this transparent 1x1 pixel image.
    .attr("src", "images/pixel.gif")
  if (size) {
    img.attr("width", size).attr("height", size)
  }
  return requireNode(img.node(), "empty icon") as HTMLImageElement
}

export class Sprite implements IconObject {
  readonly icon: Icon
  constructor(
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
  ) {
    this.icon = new Icon(this)
  }
}

export let sprites = new Map<string, Sprite>()
export let sheetHash = ""
export let sheetWidth = 0
export let sheetHeight = 0

export function getSprites(data: CalculatorData): void {
  sheetHash = data.sprites.hash
  sheetWidth = data.sprites.width
  sheetHeight = data.sprites.height
  sprites = new Map<string, Sprite>()
  for (const [name, d] of Object.entries(data.sprites.extra)) {
    sprites.set(name, new Sprite(d.name, d.icon_col, d.icon_row))
  }
}

// -----------------------------------------------------------------------------
// Dropdown primitives
// -----------------------------------------------------------------------------

interface DropdownInstance extends TooltipRegistryEntry {
  readonly state: { readonly isVisible: boolean }
  show(): void
  hide(): void
}

interface DropdownState {
  readonly dropdownNode: HTMLElement
  readonly instance: DropdownInstance
  readonly spacerNode: HTMLElement
  readonly wrapperNode: HTMLElement
}

type D3Selection = Selection<HTMLElement, unknown, null, undefined>
type DropdownLifecycle = ((selection: D3Selection) => void) | null
const dropdownLocal = local<DropdownState>()

function toggleDropdown(this: HTMLElement): void {
  const state = dropdownLocal.get(this)
  if (state === undefined) return
  const { instance } = state
  if (instance.state.isVisible) {
    instance.hide()
  } else {
    instance.show()
  }
}

// Appends a dropdown to the selection, and returns a selection over the div
// for the content of the dropdown.
export function makeDropdown<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  onOpen: DropdownLifecycle = null,
  onClose: DropdownLifecycle = null,
) {
  let wrapper = selector
    .append("div")
    .classed("dropdownWrapper", true)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-haspopup", "listbox")
    .attr("aria-expanded", "false")
  let dropdownInner = wrapper.append("div").classed("dropdown tippy-dropdown-menu", true)
  let spacer = wrapper.append("div").classed("spacer", true)
  const wrapperNode = requireNode(wrapper.node() as HTMLElement | null, "dropdown wrapper")
  const dropdownNode = requireNode(dropdownInner.node() as HTMLElement | null, "dropdown content")
  const spacerNode = requireNode(spacer.node() as HTMLElement | null, "dropdown spacer")
  let escapeHandler: ((event: KeyboardEvent) => void) | null = null
  let tippyInstance: Instance | null = null
  let destroyed = false
  const hiddenState = { isVisible: false }
  const clearStableWrapperSize = (): void => {
    wrapperNode.style.removeProperty("width")
    wrapperNode.style.removeProperty("height")
  }
  const instance = {
    reference: wrapperNode,
    get state() {
      return tippyInstance?.state ?? hiddenState
    },
    show() {
      if (destroyed) {
        return
      }
      const wrapperBounds = wrapperNode.getBoundingClientRect()
      wrapperNode.style.width = `${wrapperBounds.width}px`
      wrapperNode.style.height = `${wrapperBounds.height}px`
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
          escapeHandler = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
              instance.hide()
              wrapperNode.focus()
            }
          }
          document.addEventListener("keydown", escapeHandler)
          onOpen?.(select(dropdownNode))
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
          clearStableWrapperSize()
          onClose?.(select(dropdownNode))
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
      clearStableWrapperSize()
      if (escapeHandler !== null) {
        document.removeEventListener("keydown", escapeHandler)
        escapeHandler = null
      }
      tippyInstance?.destroy()
      tippyInstance = null
    },
  }
  const dropdownState: DropdownState = { dropdownNode, instance, spacerNode, wrapperNode }
  dropdownLocal.set(wrapperNode, dropdownState)
  dropdownLocal.set(dropdownNode, dropdownState)
  tooltipRegistry.add(instance)
  wrapper
    .on("click", function (this: Element) {
      if (this instanceof HTMLElement) toggleDropdown.call(this)
    })
    .on("keydown", function (this: Element, event: KeyboardEvent) {
      if (!(this instanceof HTMLElement)) return
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
export function addInputs<
  TDatum,
  GElement extends BaseType = BaseType,
  PElement extends BaseType = BaseType,
  PDatum = unknown,
>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  name: string | ((datum: TDatum) => string),
  checked: ValueFn<GElement, TDatum, boolean>,
  callback: (this: HTMLInputElement, datum: TDatum) => void,
) {
  selector
    .append("input")
    .on("change", function (this: Element, _event: Event, d: TDatum) {
      if (!(this instanceof HTMLInputElement)) return
      toggleDropdown.call(this)
      callback.call(this, d)
    })
    .attr("id", () => "input-" + inputId++)
    .attr("name", typeof name === "string" ? name : (datum: TDatum) => name(datum))
    .attr("type", "radio")
    .property("checked", checked)
  let label = selector.append("label").attr("for", () => "input-" + labelFor++)
  return label
}

// Wrapper around makeDropdown/addInputs to create an input for each item in
// data.
export function dropdown<
  TDatum,
  GElement extends BaseType = BaseType,
  PElement extends BaseType = BaseType,
  PDatum = unknown,
>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  data: readonly TDatum[],
  name: string,
  checked: (datum: TDatum) => boolean,
  callback: (this: HTMLInputElement, datum: TDatum) => void,
) {
  let dd = makeDropdown(selector).selectAll("div").data(data).join("div")
  return addInputs(dd, name, checked, callback)
}

function requireNode<T extends Node>(node: T | null, label: string): T {
  if (node === null) throw new Error(`Unable to create ${label}`)
  return node
}

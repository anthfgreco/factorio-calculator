let currentTooltip = null

let tooltipRegistry = new Set()

export class Tooltip {
  [key: string]: any
  constructor(reference, callback, target) {
    if (!target) {
      target = reference
    }
    this.reference = reference
    this.callback = callback
    this.target = target
    this.isOpen = false
    this.node = null
    this.popper = null
    this.addEventListeners()
  }
  show() {
    if (this.isOpen) {
      return
    }
    if (currentTooltip) {
      currentTooltip.hide()
    }
    this.isOpen = true
    if (this.node) {
      this.node.style.display = "block"
      this.popper.setOptions((options) => ({
        ...options,
        modifiers: [...options.modifiers, { name: "eventListeners", enabled: true }],
      }))
      this.popper.update()
      return
    }
    let node = this.create()
    document.getElementById("tooltip_container").appendChild(node)
    this.popper = Popper.createPopper(this.target, node, {
      placement: "right",
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [0, 20],
          },
        },
      ],
    })
    this.node = node
    tooltipRegistry.add(this)
    currentTooltip = this
  }
  hide() {
    if (!this.isOpen) {
      return
    }
    this.isOpen = false
    this.node.style.display = "none"
    this.popper.setOptions((options) => ({
      ...options,
      modifiers: [...options.modifiers, { name: "eventListeners", enabled: false }],
    }))
    currentTooltip = null
  }
  create() {
    let node = document.createElement("div")
    node.classList.add("tooltip")
    node.appendChild(this.callback())
    return node
  }
  remove() {
    if (this.popper) {
      this.popper.destroy()
    }
    if (this.node) {
      d3.select(this.node).remove()
    }
  }
  addEventListeners() {
    let self = this
    this.reference.addEventListener("mouseenter", function () {
      self.show()
    })
    this.reference.addEventListener("mouseleave", function () {
      self.hide()
    })
  }
}

export function reapTooltips() {
  let toReap = []
  for (let tooltip of tooltipRegistry as Set<any>) {
    if (!document.body.contains(tooltip.reference)) {
      toReap.push(tooltip)
    }
  }
  for (let tooltip of toReap) {
    tooltipRegistry.delete(tooltip)
    tooltip.remove()
  }
}

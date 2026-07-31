import { Rational } from "../../core/math/rational.js"
import type {
  PriorityLevel,
  PriorityList,
  PriorityResource,
} from "../../application/calculator/priority-model.js"

let unsubscribe: (() => void) | null = null
let mountedPriority: PriorityList | null = null
let onCalculationChange: (() => void) | null = null
let draggedResource: PriorityResource | null = null

export function renderResourcePriorityEditor(priority: PriorityList, onChange: () => void) {
  if (mountedPriority !== priority) {
    unsubscribe?.()
    mountedPriority = priority
    unsubscribe = priority.subscribe(render)
  }
  onCalculationChange = onChange
  render()
}

function render() {
  if (mountedPriority === null) {
    return
  }

  const container = d3.select("#resource_settings")
  container.selectAll("*").remove()

  renderBookend(container, "less valuable", () => mountedPriority!.getFirstLevel())

  mountedPriority.priorities.forEach((level, index) => {
    if (index > 0) {
      renderDropTarget(container, "middle", () => level)
    }
    renderLevel(container, level)
  })

  renderBookend(container, "more valuable", () => null)
}

function renderLevel(container: any, level: PriorityLevel) {
  const levelElement = container.append("div").classed("resource-tier", true)
  installDropTarget(levelElement, () => level)

  for (const resource of level.resources) {
    const resourceElement = levelElement
      .append("div")
      .classed("resource", true)
      .attr("draggable", "true")
      .on("dragstart", function (this: HTMLElement, event: DragEvent) {
        draggedResource = resource
        event.dataTransfer?.setData("text/plain", resource.recipe.key ?? "resource")
        event.dataTransfer?.setDragImage(this, 24, 24)
        container.classed("dragging", true)
      })
      .on("dragend", () => {
        draggedResource = null
        container.classed("dragging", false)
      })

    resourceElement.append(() => resource.recipe.icon.make(48))
    resourceElement
      .append("input")
      .attr("type", "text")
      .attr("size", 4)
      .attr("value", resource.weight.toString())
      .on("change", function (this: HTMLInputElement) {
        mountedPriority!.setWeight(resource, Rational.from_string(this.value))
        onCalculationChange?.()
      })
  }
}

function renderBookend(container: any, label: string, level: () => PriorityLevel | null) {
  const element = container.append("div").classed("resource-tier bookend", true)
  installDropTarget(element, level)
  element.append("span").text(label)
}

function renderDropTarget(container: any, className: string, level: () => PriorityLevel | null) {
  const element = container.append("div").classed(className, true)
  installDropTarget(element, level)
}

function installDropTarget(element: any, targetLevel: () => PriorityLevel | null) {
  element
    .on("dragover", (event: DragEvent) => event.preventDefault())
    .on("dragenter", function (this: HTMLElement, event: DragEvent) {
      event.preventDefault()
      this.classList.add("highlight")
    })
    .on("dragleave", function (this: HTMLElement, event: DragEvent) {
      if (event.target === this) {
        this.classList.remove("highlight")
      }
    })
    .on("drop", function (this: HTMLElement, event: DragEvent) {
      event.preventDefault()
      this.classList.remove("highlight")
      if (draggedResource === null || mountedPriority === null) {
        return
      }
      let level = targetLevel()
      if (level === null) {
        level = mountedPriority.addPriorityBefore(null)
      } else if (element.classed("middle") || element.classed("bookend") && level === mountedPriority.getFirstLevel()) {
        level = mountedPriority.addPriorityBefore(level)
      }
      mountedPriority.setPriority(draggedResource, level)
      draggedResource = null
      onCalculationChange?.()
    })
}

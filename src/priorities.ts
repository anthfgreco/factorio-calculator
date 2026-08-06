import { select, type BaseType, type Selection } from "d3"
import { Rational } from "./math.js"
import type { DisabledRecipe, Item, Recipe } from "./recipes.js"

export type PrioritizedRecipe = Recipe | DisabledRecipe

// -----------------------------------------------------------------------------
// Priority model
// -----------------------------------------------------------------------------

export interface PrioritySpecification {
  priority: PriorityList
  readonly defaultPriority: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]
  readonly recipes: Map<string, Recipe>
  readonly items: Map<string, Item>
  isItemDisabled(item: Item): boolean
}

export class PriorityResource {
  level: PriorityLevel | null = null

  constructor(
    public readonly recipe: PrioritizedRecipe,
    public weight: Rational,
  ) {}
}

export class PriorityLevel implements Iterable<PriorityResource> {
  readonly resources: PriorityResource[] = []

  constructor(readonly list: PriorityList) {}

  [Symbol.iterator](): ArrayIterator<PriorityResource> {
    return this.resources[Symbol.iterator]()
  }

  equalMap(expected: ReadonlyMap<PrioritizedRecipe, Rational>): boolean {
    if (expected.size !== this.resources.length) {
      return false
    }
    return this.resources.every(({ recipe, weight }) => expected.get(recipe)?.equal(weight) === true)
  }

  has(resource: PriorityResource): boolean {
    return resource.level === this
  }

  isEmpty(): boolean {
    return this.resources.length === 0
  }

  insertSorted(resource: PriorityResource): void {
    this.list.moveResource(resource, this)
  }
}

export class PriorityList implements Iterable<PriorityLevel> {
  readonly priorities: PriorityLevel[] = []
  private readonly listeners = new Set<() => void>()
  private notificationDepth = 0
  private notificationPending = false;

  [Symbol.iterator](): ArrayIterator<PriorityLevel> {
    return this.priorities[Symbol.iterator]()
  }

  static getDefaultArray(recipes: ReadonlyMap<string, Recipe>): Map<PrioritizedRecipe, Rational>[] {
    const levels: Map<PrioritizedRecipe, Rational>[] = []
    for (const recipe of recipes.values()) {
      if (!recipe.isResource()) {
        continue
      }
      const priority = recipe.defaultPriority ?? 0
      while (levels.length <= priority) {
        levels.push(new Map())
      }
      const level = levels[priority]
      if (level === undefined || recipe.defaultWeight === undefined) {
        throw new Error(`Resource recipe ${recipe.key} is missing a default priority weight`)
      }
      level.set(recipe, recipe.defaultWeight)
    }
    return levels
  }

  static fromArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): PriorityList {
    const priority = new PriorityList()
    priority.batch(() => {
      for (const recipes of levels) {
        const level = priority.addPriorityBefore(null)
        for (const [recipe, weight] of recipes) {
          priority.addRecipe(recipe, weight, level)
        }
      }
    })
    return priority
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  batch(operation: () => void): void {
    this.notificationDepth++
    try {
      operation()
    } finally {
      this.notificationDepth--
      if (this.notificationDepth === 0 && this.notificationPending) {
        this.notificationPending = false
        this.notify()
      }
    }
  }

  applyArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): void {
    this.batch(() => {
      for (let index = 0; index < levels.length; index++) {
        while (this.priorities.length <= index) {
          this.addPriorityBefore(null)
        }
        const level = this.priorities[index]
        const recipes = levels[index]
        if (level === undefined || recipes === undefined) continue
        for (const [recipe, weight] of recipes) {
          const resource = this.getResource(recipe)
          if (resource === null) {
            this.addRecipe(recipe, weight, level)
          } else {
            resource.weight = weight
            this.moveResource(resource, level)
          }
        }
      }
    })
  }

  equalArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): boolean {
    return (
      levels.length === this.priorities.length &&
      levels.every((level, index) => this.priorities[index]?.equalMap(level) === true)
    )
  }

  addPriorityBefore(level: PriorityLevel | null): PriorityLevel {
    const newLevel = new PriorityLevel(this)
    if (level === null) {
      this.priorities.push(newLevel)
    } else {
      const index = this.priorities.indexOf(level)
      if (index === -1) {
        throw new Error("Cannot insert a priority before a level that is not in this list")
      }
      this.priorities.splice(index, 0, newLevel)
    }
    this.changed()
    return newLevel
  }

  getFirstLevel(): PriorityLevel | null {
    return this.priorities[0] ?? null
  }

  getLastLevel(): PriorityLevel | null {
    return this.priorities.at(-1) ?? null
  }

  setPriority(resource: PriorityResource, level: PriorityLevel): void {
    this.moveResource(resource, level)
  }

  setWeight(resource: PriorityResource, weight: Rational): void {
    resource.weight = weight
    if (resource.level !== null) {
      this.moveResource(resource, resource.level)
    } else {
      this.changed()
    }
  }

  addRecipe(recipe: PrioritizedRecipe, weight: Rational, level: PriorityLevel): PriorityResource {
    const existing = this.getResource(recipe)
    if (existing !== null) {
      existing.weight = weight
      this.moveResource(existing, level)
      return existing
    }
    const resource = new PriorityResource(recipe, weight)
    this.insertIntoLevel(resource, level)
    this.changed()
    return resource
  }

  getResource(recipe: PrioritizedRecipe): PriorityResource | null {
    for (const level of this.priorities) {
      const resource = level.resources.find((candidate) => candidate.recipe === recipe)
      if (resource !== undefined) {
        return resource
      }
    }
    return null
  }

  getWeight(recipe: PrioritizedRecipe): Rational {
    const resource = this.getResource(recipe)
    if (resource === null) {
      throw new Error(`Recipe ${recipe?.key ?? "<unknown>"} is missing from resource priorities`)
    }
    return resource.weight
  }

  removeRecipe(recipe: PrioritizedRecipe): void {
    const resource = this.getResource(recipe)
    if (resource !== null) {
      this.removeResource(resource)
    }
  }

  removeResource(resource: PriorityResource): void {
    const level = resource.level
    if (level === null) {
      return
    }
    const index = level.resources.indexOf(resource)
    if (index !== -1) {
      level.resources.splice(index, 1)
    }
    resource.level = null
    this.removeEmptyLevels()
    this.changed()
  }

  moveResource(resource: PriorityResource, level: PriorityLevel): void {
    if (level.list !== this) {
      throw new Error("Cannot move a resource to a priority level from another list")
    }
    const currentLevel = resource.level
    if (currentLevel !== null) {
      const index = currentLevel.resources.indexOf(resource)
      if (index !== -1) {
        currentLevel.resources.splice(index, 1)
      }
    }
    this.insertIntoLevel(resource, level)
    this.removeEmptyLevels()
    this.changed()
  }

  private insertIntoLevel(resource: PriorityResource, level: PriorityLevel): void {
    resource.level = level
    const index = level.resources.findIndex((candidate) => resource.weight.less(candidate.weight))
    if (index === -1) {
      level.resources.push(resource)
    } else {
      level.resources.splice(index, 0, resource)
    }
  }

  private removeEmptyLevels(): void {
    for (let index = this.priorities.length - 1; index >= 0; index--) {
      const level = this.priorities[index]
      if (level !== undefined && level.isEmpty()) this.priorities.splice(index, 1)
    }
  }

  private changed(): void {
    if (this.notificationDepth > 0) {
      this.notificationPending = true
      return
    }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

// -----------------------------------------------------------------------------
// Priority policy
// -----------------------------------------------------------------------------

export interface PriorityMutationList {
  getResource(recipe: PrioritizedRecipe): PriorityResource | null
  getLastLevel(): PriorityLevel | null
  addPriorityBefore(level: PriorityLevel | null): PriorityLevel
  addRecipe(recipe: PrioritizedRecipe, weight: Rational, level: PriorityLevel): PriorityResource
  removeRecipe(recipe: PrioritizedRecipe): void
}

export const DISABLED_RECIPE_PREFIX = "D-"

export function addItemToMaximumPriority(specification: { readonly priority: PriorityMutationList }, item: Item): void {
  if (specification.priority.getResource(item.disableRecipe) !== null) {
    return
  }
  let level = specification.priority.getLastLevel()
  if (level === null || ![...level].some((resource) => resource.recipe.isDisable())) {
    level = specification.priority.addPriorityBefore(null)
  }
  specification.priority.addRecipe(item.disableRecipe, Rational.from_float(100), level)
}

export function buildDefaultPriorityArray(specification: PrioritySpecification): Map<PrioritizedRecipe, Rational>[] {
  const levels: Map<PrioritizedRecipe, Rational>[] = []
  for (let recipe of specification.recipes.values()) {
    if (recipe.defaultPriority === undefined) {
      continue
    }
    while (levels.length <= recipe.defaultPriority) {
      levels.push(new Map())
    }
    let weight = recipe.defaultWeight
    const product = recipe.products[0]
    const level = levels[recipe.defaultPriority]
    if (weight === undefined || product === undefined || level === undefined) {
      throw new Error(`Recipe ${recipe.key} has incomplete priority metadata`)
    }
    if (product.item.phase === "fluid") weight = weight.div(Rational.from_float(10))
    level.set(recipe, weight)
  }
  return levels
}

export function restoreDefaultPriorities(specification: PrioritySpecification): void {
  specification.priority = PriorityList.fromArray(specification.defaultPriority)
  for (let item of specification.items.values()) {
    if (specification.isItemDisabled(item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
}

export function isValidPriorityKey(specification: PrioritySpecification, key: string): boolean {
  if (key.startsWith(DISABLED_RECIPE_PREFIX)) {
    return specification.items.has(key.slice(DISABLED_RECIPE_PREFIX.length))
  }
  return specification.recipes.get(key)?.defaultPriority !== undefined
}

export function applyPriorities(
  specification: PrioritySpecification,
  tiers: readonly (readonly (readonly [string, Rational])[])[],
): void {
  let levels = tiers.map((tier) => {
    let level = new Map()
    for (let [recipeKey, weight] of tier) {
      let recipe: PrioritizedRecipe | undefined = specification.recipes.get(recipeKey)
      if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
        recipe = specification.items.get(recipeKey.slice(DISABLED_RECIPE_PREFIX.length))?.disableRecipe
      }
      if (recipe === undefined) throw new Error(`Unknown priority recipe: ${recipeKey}`)
      level.set(recipe, weight)
    }
    return level
  })
  specification.priority.applyArray(levels)
}

// -----------------------------------------------------------------------------
// Resource-priority editor
// -----------------------------------------------------------------------------

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

export function unmountResourcePriorityEditor(): void {
  unsubscribe?.()
  unsubscribe = null
  mountedPriority = null
  onCalculationChange = null
  document.getElementById("resource_settings")?.replaceChildren()
}

function render(): void {
  if (mountedPriority === null) {
    return
  }

  const container = select<HTMLElement, unknown>("#resource_settings")
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

function renderLevel<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  level: PriorityLevel,
): void {
  const levelElement = container.append("div").classed("resource-tier", true)
  installDropTarget(levelElement, () => level)

  for (const resource of level.resources) {
    const resourceElement = levelElement
      .append("div")
      .classed("resource", true)
      .attr("draggable", "true")
      .on("dragstart", function (this: Element, event: DragEvent) {
        if (!(this instanceof HTMLElement)) return
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
      .on("change", function (this: Element) {
        if (!(this instanceof HTMLInputElement)) return
        mountedPriority!.setWeight(resource, Rational.from_string(this.value))
        onCalculationChange?.()
      })
  }
}

function renderBookend<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  label: string,
  level: () => PriorityLevel | null,
): void {
  const element = container.append("div").classed("resource-tier bookend", true)
  installDropTarget(element, level)
  element.append("span").text(label)
}

function renderDropTarget<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  className: string,
  level: () => PriorityLevel | null,
): void {
  const element = container.append("div").classed(className, true)
  installDropTarget(element, level)
}

function installDropTarget<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  element: Selection<GElement, TDatum, PElement, PDatum>,
  targetLevel: () => PriorityLevel | null,
): void {
  element
    .on("dragover", (event: DragEvent) => event.preventDefault())
    .on("dragenter", function (this: Element, event: DragEvent) {
      if (!(this instanceof HTMLElement)) return
      event.preventDefault()
      this.classList.add("highlight")
    })
    .on("dragleave", function (this: Element, event: DragEvent) {
      if (!(this instanceof HTMLElement)) return
      if (event.target === this) {
        this.classList.remove("highlight")
      }
    })
    .on("drop", function (this: Element, event: DragEvent) {
      if (!(this instanceof HTMLElement)) return
      event.preventDefault()
      this.classList.remove("highlight")
      if (draggedResource === null || mountedPriority === null) {
        return
      }
      let level = targetLevel()
      if (level === null) {
        level = mountedPriority.addPriorityBefore(null)
      } else if (
        element.classed("middle") ||
        (element.classed("bookend") && level === mountedPriority.getFirstLevel())
      ) {
        level = mountedPriority.addPriorityBefore(level)
      }
      mountedPriority.setPriority(draggedResource, level)
      draggedResource = null
      onCalculationChange?.()
    })
}

import type { Rational } from "../../core/math/rational.js"

export type PriorityRecipe = {
  defaultPriority?: number
  defaultWeight?: Rational
  isResource(): boolean
}

export class PriorityResource {
  level: PriorityLevel | null = null

  constructor(
    public readonly recipe: any,
    public weight: Rational,
  ) {}
}

export class PriorityLevel implements Iterable<PriorityResource> {
  readonly resources: PriorityResource[] = []

  constructor(readonly list: PriorityList) {}

  [Symbol.iterator]() {
    return this.resources[Symbol.iterator]()
  }

  equalMap(expected: Map<any, Rational>) {
    if (expected.size !== this.resources.length) {
      return false
    }
    return this.resources.every(({ recipe, weight }) => expected.get(recipe)?.equal(weight) === true)
  }

  has(resource: PriorityResource) {
    return resource.level === this
  }

  isEmpty() {
    return this.resources.length === 0
  }

  insertSorted(resource: PriorityResource) {
    this.list.moveResource(resource, this)
  }
}

export class PriorityList implements Iterable<PriorityLevel> {
  readonly priorities: PriorityLevel[] = []
  private readonly listeners = new Set<() => void>()
  private notificationDepth = 0
  private notificationPending = false;

  [Symbol.iterator]() {
    return this.priorities[Symbol.iterator]()
  }

  static getDefaultArray(recipes: Map<any, PriorityRecipe>) {
    const levels: Map<any, Rational>[] = []
    for (const recipe of recipes.values()) {
      if (!recipe.isResource()) {
        continue
      }
      const priority = recipe.defaultPriority ?? 0
      while (levels.length <= priority) {
        levels.push(new Map())
      }
      levels[priority].set(recipe, recipe.defaultWeight!)
    }
    return levels
  }

  static fromArray(levels: Map<any, Rational>[]) {
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

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  batch(operation: () => void) {
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

  applyArray(levels: Map<any, Rational>[]) {
    this.batch(() => {
      for (let index = 0; index < levels.length; index++) {
        while (this.priorities.length <= index) {
          this.addPriorityBefore(null)
        }
        const level = this.priorities[index]
        for (const [recipe, weight] of levels[index]) {
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

  equalArray(levels: Map<any, Rational>[]) {
    return levels.length === this.priorities.length && levels.every((level, index) => this.priorities[index].equalMap(level))
  }

  addPriorityBefore(level: PriorityLevel | null) {
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

  getFirstLevel() {
    return this.priorities[0] ?? null
  }

  getLastLevel() {
    return this.priorities.at(-1) ?? null
  }

  setPriority(resource: PriorityResource, level: PriorityLevel) {
    this.moveResource(resource, level)
  }

  setWeight(resource: PriorityResource, weight: Rational) {
    resource.weight = weight
    if (resource.level !== null) {
      this.moveResource(resource, resource.level)
    } else {
      this.changed()
    }
  }

  addRecipe(recipe: any, weight: Rational, level: PriorityLevel) {
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

  getResource(recipe: any) {
    for (const level of this.priorities) {
      const resource = level.resources.find((candidate) => candidate.recipe === recipe)
      if (resource !== undefined) {
        return resource
      }
    }
    return null
  }

  getWeight(recipe: any) {
    const resource = this.getResource(recipe)
    if (resource === null) {
      throw new Error(`Recipe ${recipe?.key ?? "<unknown>"} is missing from resource priorities`)
    }
    return resource.weight
  }

  removeRecipe(recipe: any) {
    const resource = this.getResource(recipe)
    if (resource !== null) {
      this.removeResource(resource)
    }
  }

  removeResource(resource: PriorityResource) {
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

  moveResource(resource: PriorityResource, level: PriorityLevel) {
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

  private insertIntoLevel(resource: PriorityResource, level: PriorityLevel) {
    resource.level = level
    const index = level.resources.findIndex((candidate) => resource.weight.less(candidate.weight))
    if (index === -1) {
      level.resources.push(resource)
    } else {
      level.resources.splice(index, 0, resource)
    }
  }

  private removeEmptyLevels() {
    for (let index = this.priorities.length - 1; index >= 0; index--) {
      if (this.priorities[index].isEmpty()) {
        this.priorities.splice(index, 1)
      }
    }
  }

  private changed() {
    if (this.notificationDepth > 0) {
      this.notificationPending = true
      return
    }
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

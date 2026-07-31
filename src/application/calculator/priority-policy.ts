import { Rational } from "../../core/math/rational.js"
import { DISABLED_RECIPE_PREFIX } from "../../runtime/recipe.js"
import { PriorityList } from "./priority-model.js"

export function addItemToMaximumPriority(specification, item): void {
  if (specification.priority.getResource(item.disableRecipe) !== null) {
    return
  }
  let level = specification.priority.getLastLevel()
  if (![...level].some((resource) => resource.recipe.isDisable())) {
    level = specification.priority.addPriorityBefore(null)
  }
  specification.priority.addRecipe(item.disableRecipe, Rational.from_float(100), level)
}

export function buildDefaultPriorityArray(specification) {
  let levels = []
  for (let recipe of specification.recipes.values()) {
    if (recipe.defaultPriority === undefined) {
      continue
    }
    while (levels.length <= recipe.defaultPriority) {
      levels.push(new Map())
    }
    let weight = recipe.defaultWeight
    if (recipe.products[0].item.phase === "fluid") {
      weight = weight.div(Rational.from_float(10))
    }
    levels[recipe.defaultPriority].set(recipe, weight)
  }
  return levels
}

export function restoreDefaultPriorities(specification): void {
  specification.priority = PriorityList.fromArray(specification.defaultPriority)
  for (let item of specification.items.values()) {
    if (specification.isItemDisabled(item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
}

export function isValidPriorityKey(specification, key: string): boolean {
  if (key.startsWith(DISABLED_RECIPE_PREFIX)) {
    return specification.items.has(key.slice(DISABLED_RECIPE_PREFIX.length))
  }
  return specification.recipes.get(key)?.defaultPriority !== undefined
}

export function applyPriorities(specification, tiers): void {
  let levels = tiers.map((tier) => {
    let level = new Map()
    for (let [recipeKey, weight] of tier) {
      let recipe = specification.recipes.get(recipeKey)
      if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
        recipe = specification.items.get(recipeKey.slice(DISABLED_RECIPE_PREFIX.length)).disableRecipe
      }
      level.set(recipe, weight)
    }
    return level
  })
  specification.priority.applyArray(levels)
}

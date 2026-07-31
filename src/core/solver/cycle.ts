import type { SolverItem, SolverRecipe, SolverSpec } from "./contracts.js"

function fuelConsumers(spec: SolverSpec, recipes: Set<SolverRecipe>): SolverRecipe[] {
  return [...recipes].filter((recipe) => spec.getBuilding(recipe)?.fuel === "chemical")
}

function neighboringRecipes(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  invert: boolean,
): Set<SolverRecipe> {
  let result = new Set<SolverRecipe>()
  let itemAmounts = invert ? recipe.products : recipe.getIngredients()
  for (let { item } of itemAmounts) {
    let candidates: SolverRecipe[] = invert ? item.uses : item.recipes
    if (invert && item === spec.fuel.item) {
      candidates = candidates.concat(fuelConsumers(spec, recipes))
    }
    for (let candidate of candidates) {
      if (recipes.has(candidate)) {
        result.add(candidate)
      }
    }
  }
  return result
}

function visit(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  seen: Set<SolverRecipe>,
  invert: boolean,
): SolverRecipe[] {
  if (seen.has(recipe)) {
    return []
  }
  seen.add(recipe)
  let result: SolverRecipe[] = []
  for (let neighbor of neighboringRecipes(spec, recipes, recipe, invert)) {
    result.push(...visit(spec, recipes, neighbor, seen, invert))
  }
  result.push(recipe)
  return result
}

function isSelfCycle(component: readonly SolverRecipe[]): boolean {
  let recipe = component[0]
  let products = new Set<SolverItem>(recipe.products.map(({ item }) => item))
  return recipe.getIngredients().some(({ item }) => products.has(item))
}

export function getCycleRecipes(spec: SolverSpec, recipes: Set<SolverRecipe>): Set<SolverRecipe> {
  let seen = new Set<SolverRecipe>()
  let ordered: SolverRecipe[] = []
  for (let recipe of recipes) {
    ordered.push(...visit(spec, recipes, recipe, seen, false))
  }

  let result = new Set<SolverRecipe>()
  seen = new Set<SolverRecipe>()
  for (let index = ordered.length - 1; index >= 0; index--) {
    let root = ordered[index]
    if (seen.has(root)) {
      continue
    }
    let component = visit(spec, recipes, root, seen, true)
    if (component.length > 1 || isSelfCycle(component)) {
      for (let recipe of component) {
        result.add(recipe)
      }
    }
  }
  return result
}

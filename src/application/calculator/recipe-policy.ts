import { addItemToMaximumPriority } from "./priority-policy.js"

function refreshTargetsForItems(specification, items: Set<any>): void {
  for (let target of specification.buildTargets) {
    if (items.has(target.item)) {
      target.displayRecipes()
    }
  }
}

export function disableRecipe(specification, recipe): void {
  if (specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<any>()
  let affectedItems = new Set<any>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.add(recipe)
  for (let item of candidateItems) {
    if (isItemDisabled(specification, item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function enableRecipe(specification, recipe): void {
  if (!specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<any>()
  let affectedItems = new Set<any>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.delete(recipe)
  for (let item of candidateItems) {
    if (!isItemDisabled(specification, item)) {
      specification.priority.removeRecipe(item.disableRecipe)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function getEnabledUses(specification, item) {
  return item.uses.filter((recipe) => !specification.disable.has(recipe))
}

export function isItemDisabled(specification, item): boolean {
  return !item.recipes.some(
    (recipe) => !specification.disable.has(recipe) && recipe.isNetProducer(item),
  )
}

export function getEnabledRecipes(specification, item) {
  let enabled = item.recipes.filter((recipe) => !specification.disable.has(recipe))
  if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
    return enabled
  }
  return [
    item.disableRecipe,
    ...enabled.filter((recipe) => recipe.products.some((product) => !specification.ignore.has(product.item))),
  ]
}

function addItemGraph(specification, item, graph: Set<any>): void {
  for (let recipe of getEnabledRecipes(specification, item)) {
    if (graph.has(recipe)) {
      continue
    }
    graph.add(recipe)
    for (let ingredient of recipe.getIngredients()) {
      addItemGraph(specification, ingredient.item, graph)
    }
  }
}

export function getRecipeGraph(specification, items): Set<any> {
  let graph = new Set<any>()
  for (let item of items.keys()) {
    addItemGraph(specification, item, graph)
  }
  return graph
}

export function isFactoryTarget(specification, recipe): boolean {
  return specification.buildTargets.some(
    (target) => target.recipe === recipe && target.changedBuilding,
  )
}

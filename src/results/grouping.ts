import { DisabledRecipe, Item, Recipe } from "../recipes.js"
import type { SolverItem, SolverRecipe } from "../solver.js"

export type FactoryRecipe = Recipe | DisabledRecipe
export type RecipeGroup = Set<FactoryRecipe>
type RecipeGroupMap = Map<FactoryRecipe, RecipeGroup>

export function isFactoryRecipe(recipe: SolverRecipe): recipe is FactoryRecipe {
  return recipe instanceof Recipe || recipe instanceof DisabledRecipe
}

export function isItem(item: SolverItem): item is Item {
  return item instanceof Item
}

function neighbors(groupMap: RecipeGroupMap, group: RecipeGroup): Set<RecipeGroup> {
  const result = new Set<RecipeGroup>()
  for (const recipe of group) {
    const ingredients = [...recipe.getIngredients()].reverse()
    for (const ingredient of ingredients) {
      if (!isItem(ingredient.item)) continue
      for (const subRecipe of ingredient.item.allRecipes()) {
        const neighbor = groupMap.get(subRecipe)
        if (neighbor !== undefined) result.add(neighbor)
      }
    }
  }
  result.delete(group)
  return result
}

function visit(groupMap: RecipeGroupMap, group: RecipeGroup, result: Set<RecipeGroup>, seen: Set<RecipeGroup>): void {
  if (result.has(group) || seen.has(group)) return
  seen.add(group)
  for (const neighbor of neighbors(groupMap, group)) visit(groupMap, neighbor, result, seen)
  seen.delete(group)
  result.add(group)
}

export function topoSort(groups: ReadonlySet<RecipeGroup>): RecipeGroup[] {
  const groupMap: RecipeGroupMap = new Map()
  for (const group of groups) {
    for (const recipe of group) groupMap.set(recipe, group)
  }
  const result = new Set<RecipeGroup>()
  const seen = new Set<RecipeGroup>()
  for (const group of groups) {
    if (!result.has(group) && !seen.has(group)) visit(groupMap, group, result, seen)
  }
  return [...result].reverse()
}

export function getRecipeGroups(recipes: ReadonlySet<FactoryRecipe>): Set<RecipeGroup> {
  const groups = new Map<FactoryRecipe, RecipeGroup>()
  const items = new Set<Item>()
  for (const recipe of recipes) {
    if (recipe.products.length === 0) continue
    groups.set(recipe, new Set([recipe]))
    for (const product of recipe.products) {
      if (isItem(product.item)) items.add(product.item)
    }
  }
  for (const item of items) {
    const itemRecipes = item.allRecipes().filter((recipe) => recipes.has(recipe))
    if (itemRecipes.length <= 1) continue
    const combined = new Set<FactoryRecipe>()
    for (const recipe of itemRecipes) {
      for (const groupedRecipe of groups.get(recipe) ?? []) combined.add(groupedRecipe)
    }
    for (const recipe of combined) groups.set(recipe, combined)
  }
  return new Set(groups.values())
}

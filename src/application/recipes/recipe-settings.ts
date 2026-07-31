import { normalizeSearchText } from "../search/search.js"
import { sorted } from "../../shared/sort.js"

const CATEGORY_ORDER = new Map([
  ["resources", 0],
  ["crafting", 10],
  ["advanced-crafting", 11],
  ["crafting-with-fluid", 12],
  ["smelting", 20],
  ["metallurgy", 21],
  ["chemistry", 30],
  ["oil-processing", 31],
  ["organic", 40],
  ["captive-spawner-process", 41],
  ["electromagnetics", 50],
  ["cryogenics", 60],
  ["crushing", 70],
  ["centrifuging", 80],
  ["rocket-building", 90],
  ["hand-crafting", 100],
  ["other", 1000],
])

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function humanizeRecipeCategory(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function isRecyclingRecipe(recipe: any) {
  return recipe.categories?.has("recycling") || recipe.category === "recycling" || recipe.key.endsWith("-recycling")
}

export function getRecipeSelectorGroups(recipes: any[], activeRecipe: any) {
  function orderGroup(groupRecipes: any[]) {
    return [...groupRecipes].sort((recipeA, recipeB) => {
      if (recipeA === activeRecipe) {
        return -1
      }
      if (recipeB === activeRecipe) {
        return 1
      }
      const nameOrder = recipeA.name.localeCompare(recipeB.name)
      return nameOrder === 0 ? recipeA.key.localeCompare(recipeB.key) : nameOrder
    })
  }

  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  return [
    { key: "production", name: "Production", recipes: orderGroup(productionRecipes) },
    { key: "recycling", name: "Recycling", recipes: orderGroup(recyclingRecipes) },
  ].filter((group) => group.recipes.length > 0)
}

export function getRecipeSettingsCategory(recipe: any) {
  if (recipe.isResource?.()) {
    return "resources"
  }
  return recipe.category ?? recipe.categories?.values().next().value ?? "other"
}

function getCompatibleBuildingNames(spec: any, recipe: any) {
  const names = []
  for (const building of spec.buildingKeys?.values?.() ?? []) {
    if (building.canCraft?.(recipe)) {
      names.push(building.name)
    }
  }
  return names
}

export function recipeMatchesSettingsSearch(spec: any, recipe: any, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const values = [
    recipe.name,
    recipe.key,
    humanizeRecipeCategory(getRecipeSettingsCategory(recipe)),
    ...recipe.products.map(({ item }: any) => item.name),
    ...recipe.products.map(({ item }: any) => item.key),
    ...recipe.getIngredients().map(({ item }: any) => item.name),
    ...recipe.getIngredients().map(({ item }: any) => item.key),
    ...getCompatibleBuildingNames(spec, recipe),
  ]
  const normalizedValues = values.map(normalizeSearchText)
  const compactQuery = compactSearchText(normalizedQuery)

  if (normalizedValues.some((value) => compactSearchText(value).includes(compactQuery))) {
    return true
  }

  return normalizedQuery.split(" ").every((token) => normalizedValues.some((value) => value.includes(token)))
}

export function getConfigurableRecipes(spec: any) {
  return [...spec.recipes.values()].filter((recipe: any) => recipe.isReal?.() && !recipe.isDisable?.())
}

export function isRecipeUnavailable(spec: any, recipe: any) {
  return spec.planetaryBaseline?.has(recipe) ?? false
}

export function recipeVisibleInSettings(
  spec: any,
  recipe: any,
  options: {
    searchText: string
    showUnavailable: boolean
  },
) {
  return (
    (options.showUnavailable || !isRecipeUnavailable(spec, recipe)) &&
    recipeMatchesSettingsSearch(spec, recipe, options.searchText)
  )
}

function categorySortKey(category: string) {
  return CATEGORY_ORDER.get(category) ?? 500
}

export function groupRecipesForSettings(recipes: any[]) {
  const groups = new Map<string, any[]>()
  for (const recipe of recipes) {
    const category = getRecipeSettingsCategory(recipe)
    const group = groups.get(category) ?? []
    group.push(recipe)
    groups.set(category, group)
  }

  return [...groups.entries()]
    .sort(([categoryA], [categoryB]) => {
      const order = categorySortKey(categoryA) - categorySortKey(categoryB)
      return order === 0 ? categoryA.localeCompare(categoryB) : order
    })
    .map(([category, categoryRecipes]) => ({
      category,
      name: humanizeRecipeCategory(category),
      recipes: sorted(categoryRecipes, (recipe) => recipe.order ?? recipe.name),
    }))
}

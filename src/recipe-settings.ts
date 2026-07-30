import { normalizeSearchText } from "./search.js"
import { setRecipeEnabled } from "./recipe-selection.js"
import { sorted } from "./sort.js"

let searchText = ""
let showUnavailable = false

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

function humanize(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function isRecyclingRecipe(recipe) {
  return recipe.categories?.has("recycling") || recipe.category === "recycling" || recipe.key.endsWith("-recycling")
}

export function getRecipeSettingsCategory(recipe) {
  if (recipe.isResource?.()) {
    return "resources"
  }
  return recipe.category ?? recipe.categories?.values().next().value ?? "other"
}

function getCompatibleBuildingNames(spec, recipe) {
  let names = []
  for (let building of spec.buildingKeys?.values?.() ?? []) {
    if (building.canCraft?.(recipe)) {
      names.push(building.name)
    }
  }
  return names
}

export function recipeMatchesSettingsSearch(spec, recipe, query: string) {
  let normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  let values = [
    recipe.name,
    recipe.key,
    humanize(getRecipeSettingsCategory(recipe)),
    ...recipe.products.map(({ item }) => item.name),
    ...recipe.products.map(({ item }) => item.key),
    ...recipe.getIngredients().map(({ item }) => item.name),
    ...recipe.getIngredients().map(({ item }) => item.key),
    ...getCompatibleBuildingNames(spec, recipe),
  ]
  let normalizedValues = values.map(normalizeSearchText)
  let compactQuery = compactSearchText(normalizedQuery)

  if (normalizedValues.some((value) => compactSearchText(value).includes(compactQuery))) {
    return true
  }

  let tokens = normalizedQuery.split(" ")
  return tokens.every((token) => normalizedValues.some((value) => value.includes(token)))
}

function getConfigurableRecipes(spec) {
  return [...spec.recipes.values()].filter((recipe) => recipe.isReal?.() && !recipe.isDisable?.())
}

export function isRecipeUnavailable(spec, recipe) {
  return spec.planetaryBaseline?.has(recipe) ?? false
}

export function recipeVisibleInSettings(
  spec,
  recipe,
  options: {
    searchText: string
    showUnavailable: boolean
  },
) {
  if (!options.showUnavailable && isRecipeUnavailable(spec, recipe)) {
    return false
  }
  return recipeMatchesSettingsSearch(spec, recipe, options.searchText)
}

function categorySortKey(category: string) {
  return CATEGORY_ORDER.get(category) ?? 500
}

function groupRecipes(recipes) {
  let groups = new Map<string, any[]>()
  for (let recipe of recipes) {
    let category = getRecipeSettingsCategory(recipe)
    let group = groups.get(category)
    if (group === undefined) {
      group = []
      groups.set(category, group)
    }
    group.push(recipe)
  }

  return [...groups.entries()]
    .sort(([categoryA], [categoryB]) => {
      let order = categorySortKey(categoryA) - categorySortKey(categoryB)
      return order === 0 ? categoryA.localeCompare(categoryB) : order
    })
    .map(([category, categoryRecipes]) => ({
      category: category,
      name: humanize(category),
      recipes: sorted(categoryRecipes, (recipe) => recipe.order ?? recipe.name),
    }))
}

function updateRecipeToggleState(spec, element: HTMLButtonElement, recipe) {
  let unavailable = isRecipeUnavailable(spec, recipe)
  let enabled = !spec.disable.has(recipe)

  element.classList.toggle("selected", enabled && !unavailable)
  element.classList.toggle("disabled-recipe", !enabled && !unavailable)
  element.classList.toggle("unavailable", unavailable)
  element.disabled = unavailable

  if (unavailable) {
    let status = "unavailable on the selected planets or compatible machines"
    element.setAttribute("title", `${recipe.name} (${status})`)
    element.setAttribute("aria-label", `${recipe.name}: ${status}.`)
    element.setAttribute("aria-disabled", "true")
    element.removeAttribute("aria-pressed")
    return
  }

  let status = enabled ? "enabled" : "disabled"
  element.setAttribute("title", `${recipe.name} (${status})`)
  element.setAttribute("aria-label", `${recipe.name}: ${status}. Click to ${enabled ? "disable" : "enable"}.`)
  element.setAttribute("aria-disabled", "false")
  element.setAttribute("aria-pressed", String(enabled))
}

function makeRecipeToggles(container, recipes, spec) {
  let toggles = container
    .selectAll("button.recipe-setting-toggle")
    .data(recipes)
    .join("button")
    .attr("type", "button")
    .classed("toggle recipe recipe-setting-toggle", true)
    .on("click", function (event, recipe) {
      event.preventDefault()
      if (isRecipeUnavailable(spec, recipe)) {
        return
      }
      setRecipeEnabled(spec, recipe, spec.disable.has(recipe))
      spec.updateSolution()
    })

  toggles.each(function (recipe) {
    updateRecipeToggleState(spec, this, recipe)
  })
  toggles.selectAll("*").remove()
  toggles.append((recipe) => recipe.icon.make(32))
}

function makeRecipeGroups(container, groups, spec) {
  let group = container
    .selectAll("section.recipe-settings-category")
    .data(groups, (entry) => entry.category)
    .join("section")
    .classed("recipe-settings-category", true)
    .attr("data-category", (entry) => entry.category)

  group.selectAll("h5").data((entry) => [entry]).join("h5").text((entry) => entry.name)
  let toggles = group
    .selectAll("div.recipe-settings-toggle-row")
    .data((entry) => [entry])
    .join("div")
    .classed("toggle-list recipe-settings-toggle-row", true)
  toggles.each(function (entry) {
    makeRecipeToggles(d3.select(this), entry.recipes, spec)
  })
}

function disableAllRecycling(spec, recyclingRecipes) {
  let changed = false
  for (let recipe of recyclingRecipes) {
    if (!spec.disable.has(recipe)) {
      spec.setDisable(recipe)
      changed = true
    }
  }
  if (changed) {
    spec.updateSolution()
  } else {
    refreshRecipeSettings(spec)
  }
}

export function renderRecipeSettings(spec) {
  searchText = ""
  showUnavailable = false

  let recipes = getConfigurableRecipes(spec)
  let productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  let recyclingRecipes = recipes.filter(isRecyclingRecipe)
  let root = d3.select("#recipe_toggles")
  root.selectAll("*").remove()
  root.classed("recipe-settings-browser", true)

  let toolbar = root.append("div").classed("recipe-settings-toolbar", true)
  toolbar
    .append("input")
    .attr("id", "recipe_search")
    .attr("type", "search")
    .attr("placeholder", "Search recipes, items, ingredients, or machines")
    .attr("aria-label", "Search recipes")
    .on("input", function () {
      searchText = this.value
      refreshRecipeSettings(spec)
    })

  let unavailableLabel = toolbar.append("label").classed("recipe-settings-unavailable", true)
  unavailableLabel
    .append("input")
    .attr("type", "checkbox")
    .on("change", function () {
      showUnavailable = this.checked
      refreshRecipeSettings(spec)
    })
  unavailableLabel
    .attr("title", "Show recipes blocked by the selected planets or compatible machines.")
    .append("span")
    .text("Show unavailable recipes")

  root
    .append("div")
    .attr("id", "recipe_settings_help")
    .classed("recipe-settings-help", true)

  root.append("div").classed("recipe-settings-summary", true).attr("aria-live", "polite")

  let production = root.append("section").classed("recipe-settings-section production-recipes", true)
  production.append("h4").text("Production recipes")
  let productionGroups = production.append("div").classed("recipe-settings-groups", true)
  makeRecipeGroups(productionGroups, groupRecipes(productionRecipes), spec)

  let recycling = root.append("details").classed("recipe-settings-section recycling-recipes", true)
  recycling.append("summary").append("span").classed("recycling-recipes-title", true).text("Recycling recipes")
  let recyclingBody = recycling.append("div").classed("recycling-recipes-body", true)
  recyclingBody
    .append("button")
    .attr("type", "button")
    .classed("ui disable-recycling-recipes", true)
    .text("Disable all recycling recipes")
    .on("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      disableAllRecycling(spec, recyclingRecipes)
    })
  let recyclingToggles = recyclingBody
    .append("div")
    .classed("toggle-list recipe-settings-toggle-row", true)
  makeRecipeToggles(recyclingToggles, recyclingRecipes, spec)

  root.append("div").classed("recipe-settings-empty", true).text("No recipes match your search.")
  refreshRecipeSettings(spec)
}

export function refreshRecipeSettings(spec) {
  let root = d3.select("#recipe_toggles")
  if (root.empty()) {
    return
  }

  let normalizedSearch = normalizeSearchText(searchText)
  let visibleCount = 0

  root.selectAll("button.recipe-setting-toggle").each(function (recipe) {
    let visible = recipeVisibleInSettings(spec, recipe, {
      searchText: searchText,
      showUnavailable: showUnavailable,
    })
    this.hidden = !visible
    if (visible) {
      visibleCount++
    }
    updateRecipeToggleState(spec, this, recipe)
  })

  root.selectAll("section.recipe-settings-category").each(function () {
    this.hidden = this.querySelector("button.recipe-setting-toggle:not([hidden])") === null
  })

  let production = root.select(".production-recipes")
  production.property("hidden", production.select("button.recipe-setting-toggle:not([hidden])").empty())
  let recycling = root.select("details.recycling-recipes")
  let visibleRecyclingCount = recycling.selectAll("button.recipe-setting-toggle:not([hidden])").size()
  recycling.property("hidden", visibleRecyclingCount === 0)
  if (normalizedSearch !== "" && visibleRecyclingCount > 0) {
    recycling.property("open", true)
  }
  recycling
    .select(".recycling-recipes-title")
    .text(`Recycling recipes${visibleRecyclingCount > 0 ? ` (${visibleRecyclingCount})` : ""}`)

  let recyclingRecipes = recycling.selectAll("button.recipe-setting-toggle").data()
  recycling
    .select("button.disable-recycling-recipes")
    .property("disabled", recyclingRecipes.length === 0 || recyclingRecipes.every((recipe) => spec.disable.has(recipe)))

  let helpText = "Orange recipes are enabled. Dimmed recipes are disabled. Click a recipe to change it."
  if (showUnavailable) {
    helpText += " Locked recipes are unavailable on the selected planets or machines."
  }
  root.select(".recipe-settings-help").text(helpText)

  let summaryText =
    normalizedSearch === ""
      ? `${visibleCount} recipe${visibleCount === 1 ? "" : "s"}`
      : `${visibleCount} matching recipe${visibleCount === 1 ? "" : "s"}`
  root.select(".recipe-settings-summary").text(summaryText)
  root.select(".recipe-settings-empty").property("hidden", visibleCount !== 0)
}

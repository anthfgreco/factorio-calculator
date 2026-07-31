import {
  getConfigurableRecipes,
  groupRecipesForSettings,
  isRecipeUnavailable,
  isRecyclingRecipe,
  recipeVisibleInSettings,
} from "../../application/recipes/recipe-settings.js"
import { setRecipeEnabled } from "../../application/recipes/recipe-selection.js"
import { normalizeSearchText } from "../../application/search/search.js"

let searchText = ""
let showUnavailable = false

function updateRecipeToggleState(spec: any, element: HTMLButtonElement, recipe: any) {
  const unavailable = isRecipeUnavailable(spec, recipe)
  const enabled = !spec.disable.has(recipe)

  element.classList.toggle("selected", enabled && !unavailable)
  element.classList.toggle("disabled-recipe", !enabled && !unavailable)
  element.classList.toggle("unavailable", unavailable)
  element.disabled = unavailable

  if (unavailable) {
    const status = "unavailable on the selected planets or compatible machines"
    element.setAttribute("title", `${recipe.name} (${status})`)
    element.setAttribute("aria-label", `${recipe.name}: ${status}.`)
    element.setAttribute("aria-disabled", "true")
    element.removeAttribute("aria-pressed")
    return
  }

  const status = enabled ? "enabled" : "disabled"
  element.setAttribute("title", `${recipe.name} (${status})`)
  element.setAttribute("aria-label", `${recipe.name}: ${status}. Click to ${enabled ? "disable" : "enable"}.`)
  element.setAttribute("aria-disabled", "false")
  element.setAttribute("aria-pressed", String(enabled))
}

function makeRecipeToggles(container: any, recipes: any[], spec: any) {
  const toggles = container
    .selectAll("button.recipe-setting-toggle")
    .data(recipes)
    .join("button")
    .attr("type", "button")
    .classed("toggle recipe recipe-setting-toggle", true)
    .on("click", function (this: HTMLButtonElement, event: Event, recipe: any) {
      event.preventDefault()
      if (isRecipeUnavailable(spec, recipe)) {
        return
      }
      setRecipeEnabled(spec, recipe, spec.disable.has(recipe))
      spec.updateSolution()
    })

  toggles.each(function (this: HTMLButtonElement, recipe: any) {
    updateRecipeToggleState(spec, this, recipe)
  })
  toggles.selectAll("*").remove()
  toggles.append((recipe: any) => recipe.icon.make(32))
}

function makeRecipeGroups(container: any, groups: any[], spec: any) {
  const group = container
    .selectAll("section.recipe-settings-category")
    .data(groups, (entry: any) => entry.category)
    .join("section")
    .classed("recipe-settings-category", true)
    .attr("data-category", (entry: any) => entry.category)

  group.selectAll("h5").data((entry: any) => [entry]).join("h5").text((entry: any) => entry.name)
  group
    .selectAll("div.recipe-settings-toggle-row")
    .data((entry: any) => [entry])
    .join("div")
    .classed("toggle-list recipe-settings-toggle-row", true)
    .each(function (this: HTMLDivElement, entry: any) {
      makeRecipeToggles(d3.select(this), entry.recipes, spec)
    })
}

function disableAllRecycling(spec: any, recyclingRecipes: any[]) {
  let changed = false
  for (const recipe of recyclingRecipes) {
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

export function renderRecipeSettings(spec: any) {
  searchText = ""
  showUnavailable = false

  const recipes = getConfigurableRecipes(spec)
  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  const root = d3.select("#recipe_toggles")
  root.selectAll("*").remove()
  root.classed("recipe-settings-browser", true)

  const toolbar = root.append("div").classed("recipe-settings-toolbar", true)
  toolbar
    .append("input")
    .attr("id", "recipe_search")
    .attr("type", "search")
    .attr("placeholder", "Search recipes, items, ingredients, or machines")
    .attr("aria-label", "Search recipes")
    .on("input", function (this: HTMLInputElement) {
      searchText = this.value
      refreshRecipeSettings(spec)
    })

  const unavailableLabel = toolbar.append("label").classed("recipe-settings-unavailable", true)
  unavailableLabel
    .append("input")
    .attr("type", "checkbox")
    .on("change", function (this: HTMLInputElement) {
      showUnavailable = this.checked
      refreshRecipeSettings(spec)
    })
  unavailableLabel
    .attr("title", "Show recipes blocked by the selected planets or compatible machines.")
    .append("span")
    .text("Show unavailable recipes")

  root.append("div").attr("id", "recipe_settings_help").classed("recipe-settings-help", true)
  root.append("div").classed("recipe-settings-summary", true).attr("aria-live", "polite")

  const production = root.append("section").classed("recipe-settings-section production-recipes", true)
  production.append("h4").text("Production recipes")
  makeRecipeGroups(
    production.append("div").classed("recipe-settings-groups", true),
    groupRecipesForSettings(productionRecipes),
    spec,
  )

  const recycling = root.append("details").classed("recipe-settings-section recycling-recipes", true)
  recycling.append("summary").append("span").classed("recycling-recipes-title", true).text("Recycling recipes")
  const recyclingBody = recycling.append("div").classed("recycling-recipes-body", true)
  recyclingBody
    .append("button")
    .attr("type", "button")
    .classed("ui disable-recycling-recipes", true)
    .text("Disable all recycling recipes")
    .on("click", (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      disableAllRecycling(spec, recyclingRecipes)
    })
  makeRecipeToggles(
    recyclingBody.append("div").classed("toggle-list recipe-settings-toggle-row", true),
    recyclingRecipes,
    spec,
  )

  root.append("div").classed("recipe-settings-empty", true).text("No recipes match your search.")
  refreshRecipeSettings(spec)
}

export function refreshRecipeSettings(spec: any) {
  const root = d3.select("#recipe_toggles")
  if (root.empty()) {
    return
  }

  const normalizedSearch = normalizeSearchText(searchText)
  let visibleCount = 0

  root.selectAll("button.recipe-setting-toggle").each(function (this: HTMLButtonElement, recipe: any) {
    const visible = recipeVisibleInSettings(spec, recipe, { searchText, showUnavailable })
    this.hidden = !visible
    visibleCount += Number(visible)
    updateRecipeToggleState(spec, this, recipe)
  })

  root.selectAll("section.recipe-settings-category").each(function (this: HTMLElement) {
    this.hidden = this.querySelector("button.recipe-setting-toggle:not([hidden])") === null
  })

  const production = root.select(".production-recipes")
  production.property("hidden", production.select("button.recipe-setting-toggle:not([hidden])").empty())
  const recycling = root.select("details.recycling-recipes")
  const visibleRecyclingCount = recycling.selectAll("button.recipe-setting-toggle:not([hidden])").size()
  recycling.property("hidden", visibleRecyclingCount === 0)
  if (normalizedSearch !== "" && visibleRecyclingCount > 0) {
    recycling.property("open", true)
  }
  recycling
    .select(".recycling-recipes-title")
    .text(`Recycling recipes${visibleRecyclingCount > 0 ? ` (${visibleRecyclingCount})` : ""}`)

  const recyclingRecipes = recycling.selectAll("button.recipe-setting-toggle").data()
  recycling
    .select("button.disable-recycling-recipes")
    .property("disabled", recyclingRecipes.length === 0 || recyclingRecipes.every((recipe: any) => spec.disable.has(recipe)))

  let helpText = "Orange recipes are enabled. Dimmed recipes are disabled. Click a recipe to change it."
  if (showUnavailable) {
    helpText += " Locked recipes are unavailable on the selected planets or machines."
  }
  root.select(".recipe-settings-help").text(helpText)

  root
    .select(".recipe-settings-summary")
    .text(
      normalizedSearch === ""
        ? `${visibleCount} recipe${visibleCount === 1 ? "" : "s"}`
        : `${visibleCount} matching recipe${visibleCount === 1 ? "" : "s"}`,
    )
  root.select(".recipe-settings-empty").property("hidden", visibleCount !== 0)
}

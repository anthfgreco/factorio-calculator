import { DEFAULT_PLANET, spec } from "../../application/calculator/index.js"
import { refreshRecipeSettings, renderRecipeSettings } from "./recipe-settings-browser.js"
import { sorted } from "../../shared/sort.js"

function applyLocationSettings(settings): boolean {
  let hasMultipleLocations = spec.planets && spec.planets.size > 1
  let row = d3.select("#planet_setting_row")
  row.style("display", hasMultipleLocations ? null : "none")
  if (!hasMultipleLocations) {
    return false
  }

  let keys = settings.has("planet")
    ? settings.get("planet").split(",").filter(Boolean)
    : [DEFAULT_PLANET]
  for (let key of keys) {
    let location = spec.planets.get(key)
    if (location !== undefined) {
      spec.selectPlanet(location)
    }
  }
  return true
}

function applyRecipeOverrides(settings, hasMultipleLocations: boolean): void {
  if (!settings.has("disable") && !settings.has("enable")) {
    if (!hasMultipleLocations) {
      spec.setDefaultDisable()
    }
    return
  }

  for (let key of settings.get("disable")?.split(",") ?? []) {
    let recipe = spec.recipes.get(key)
    if (recipe !== undefined) {
      spec.setDisable(recipe)
    }
  }
  for (let key of settings.get("enable")?.split(",") ?? []) {
    let recipe = spec.recipes.get(key)
    if (recipe !== undefined) {
      spec.setEnable(recipe)
    }
  }
}

function renderLocationSelector(hasMultipleLocations: boolean): void {
  let selector = d3.select("#planet_selector").classed("toggle-list", true)
  selector.selectAll("*").remove()
  if (!hasMultipleLocations) {
    return
  }

  selector
    .selectAll("div")
    .data(sorted(spec.planets.values(), (location) => location.order))
    .join("div")
    .classed("toggle", true)
    .classed("selected", (location) => spec.selectedPlanets.has(location))
    .on("click", function (event, location) {
      if (event.shiftKey) {
        event.preventDefault()
        if (spec.selectedPlanets.has(location)) {
          spec.unselectPlanet(location)
        } else {
          spec.selectPlanet(location)
        }
      } else {
        spec.selectOnePlanet(location)
      }
      d3.selectAll("#planet_selector .toggle").classed("selected", (candidate) =>
        spec.selectedPlanets.has(candidate),
      )
      refreshRecipeSettings(spec)
      spec.updateSolution()
    })
    .append((location) => location.icon.make(32))
}

export function renderRecipeAndLocationSettings(settings): void {
  let hasMultipleLocations = applyLocationSettings(settings)
  applyRecipeOverrides(settings, hasMultipleLocations)
  renderLocationSelector(hasMultipleLocations)
  renderRecipeSettings(spec)
}

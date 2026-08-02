import { normalizeSearchText, sorted } from "./data.js"
import { buildingSort, DEFAULT_BELT, DEFAULT_FUEL, DEFAULT_PLANET, setRecipeEnabled, spec } from "./factory.js"
import { colorSchemes } from "./graph.js"
import type { DisplayFormat, DisplayRate } from "./math.js"
import { DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_RATE, DEFAULT_RATE_PRECISION, longRateNames, Rational, zero } from "./math.js"
import { moduleDropdown, moduleRows, shortModules } from "./models.js"
import { renderResourcePriorityEditor } from "./priorities.js"
import { getConfigurableRecipes, groupRecipesForSettings, isRecipeUnavailable, isRecyclingRecipe, recipeVisibleInSettings } from "./recipes.js"
import { DEFAULT_RENDER, DEFAULT_TAB, DEFAULT_VISUALIZER, clickTab, getDefaultVisualizerDirection, setTitle, setVisualizerDirection, setVisualizerRender, setVisualizerType, visualizerDirection, visualizerRender, visualizerType } from "./state.js"

// -----------------------------------------------------------------------------
// Recipe browser
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Recipe and location panel
// -----------------------------------------------------------------------------

function applyLocationSettings(settings): boolean {
  let hasMultipleLocations = spec.planets && spec.planets.size > 1
  d3.select("#location_toolbar").property("hidden", !hasMultipleLocations)
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

  let toggles = selector
    .selectAll("button")
    .data(sorted(spec.planets.values(), (location) => location.order))
    .join("button")
    .attr("type", "button")
    .classed("toggle location-toggle", true)
    .classed("selected", (location) => spec.selectedPlanets.has(location))
    .attr("aria-pressed", (location) => String(spec.selectedPlanets.has(location)))
    .attr("title", (location) => location.name)
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
      d3.selectAll("#planet_selector .toggle")
        .classed("selected", (candidate) => spec.selectedPlanets.has(candidate))
        .attr("aria-pressed", (candidate) => String(spec.selectedPlanets.has(candidate)))
      refreshRecipeSettings(spec)
      spec.updateSolution()
    })

  toggles.selectAll("*").remove()
  toggles.append((location) => location.icon.make(24))
  toggles.append("span").classed("location-name", true).text((location) => location.name)
}

export function renderRecipeAndLocationSettings(settings): void {
  let hasMultipleLocations = applyLocationSettings(settings)
  applyRecipeOverrides(settings, hasMultipleLocations)
  renderLocationSelector(hasMultipleLocations)
  renderRecipeSettings(spec)
}

// -----------------------------------------------------------------------------
// Settings form
// -----------------------------------------------------------------------------

// There are several things going on with this control flow. Settings should
// work like this:
// 1) Settings are parsed from the URL fragment into the settings Map.
// 2) Each setting's `render` function is called.
// 3) If the setting is not present in the map, a default value is used.
// 4) The setting is applied.
// 5) The setting's GUI is placed into a consistent state.
// Remember to add the setting to fragment.js, too!

// tab

function renderTab(settings) {
  let tabName = DEFAULT_TAB
  if (settings.has("tab")) {
    tabName = settings.get("tab")
  }
  clickTab(tabName)
}

// build targets

function renderTargets(settings) {
  spec.buildTargets = []
  d3.selectAll("#targets li.target").remove()

  let targetSetting = settings.get("items")
  if (targetSetting !== undefined && targetSetting !== "") {
    let targets = targetSetting.split(",")
    for (let targetString of targets) {
      let parts = targetString.split(":")
      let itemKey = parts[0]
      if (!spec.items.has(itemKey)) {
        console.log("unknown item:", itemKey)
        continue
      }
      let target = spec.addTarget(itemKey)
      let type = parts[1]
      if (type === "f") {
        let recipe = null
        if (parts.length > 3) {
          let recipeKey = parts[3]
          if (!spec.recipes.has(recipeKey)) {
            console.log("unknown recipe:", recipeKey)
            continue
          }
          recipe = spec.recipes.get(recipeKey)
        }
        target.setBuildings(parts[2], recipe)
        target.displayRecipes()
      } else if (type === "r") {
        target.setRate(parts[2])
      } else {
        throw new Error("unknown target type")
      }
    }
  } else {
    spec.addTarget()
  }
}

// modules

function getModule(moduleKey) {
  let module
  if (spec.modules.has(moduleKey)) {
    module = spec.modules.get(moduleKey)
  } else if (shortModules.has(moduleKey)) {
    module = shortModules.get(moduleKey)
  } else if (moduleKey === "null") {
    module = null
  }
  if (module === undefined) {
    console.log("unknown module:", moduleKey)
    return null
  }
  return module
}

// NOTE: Buildings must be configured before modules!
function renderModules(settings) {
  let two = Rational.from_float(2)
  let moduleString = settings.get("modules")
  if (moduleString !== undefined && moduleString !== "") {
    for (let recipeSetting of moduleString.split(",")) {
      let [buildingModuleSettings, beaconSettings] = recipeSetting.split(";")
      let [recipeKey, ...moduleKeyList] = buildingModuleSettings.split(":")
      let recipe = spec.recipes.get(recipeKey)
      if (recipe === undefined) {
        console.log("unknown recipe:", recipeKey)
        continue
      }
      let moduleSpec = spec.getModuleSpec(recipe)
      for (let i = 0; i < moduleKeyList.length; i++) {
        let moduleKey = moduleKeyList[i]
        if (moduleKey === "") {
          continue
        }
        let module = getModule(moduleKey)
        if (module !== undefined) {
          moduleSpec.setModule(i, module)
        }
      }
      if (beaconSettings !== undefined) {
        let beaconParts = beaconSettings.split(":")
        // The legacy beacon config was simply in the form
        // "module:module count". If the count is even, then it is
        // adapted to the new format by dividing it by two and placing
        // the specified module in both slots. Otherwise, a single slot
        // is filled and the count is used as the beacon count.
        let module1
        let module2
        let count
        if (beaconParts.length === 2) {
          let module = getModule(beaconParts[0])
          count = Rational.from_string(beaconParts[1])
          let divmod = count.divmod(two)
          if (divmod.remainder.isZero()) {
            module1 = module
            module2 = module
            count = divmod.quotient
          } else {
            module1 = module
            module2 = null
          }
        } else {
          module1 = getModule(beaconParts[0])
          module2 = getModule(beaconParts[1])
          count = Rational.from_string(beaconParts[2])
        }
        moduleSpec.setBeaconModule(module1, 0)
        moduleSpec.setBeaconModule(module2, 1)
        moduleSpec.setBeaconCount(count)
      }
    }
  }
}

// ignore

function renderIgnore(settings) {
  spec.ignore.clear()
  // UI will be rendered later, as part of the solution.
  let ignoreSetting = settings.get("ignore")
  if (ignoreSetting !== undefined && ignoreSetting !== "") {
    let ignore = ignoreSetting.split(",")
    for (let itemKey of ignore) {
      let item = spec.items.get(itemKey)
      if (item === undefined) {
        console.log("unknown item:", itemKey)
        continue
      }
      spec.ignore.add(item)
    }
  }
}

// title

function renderTitle(settings) {
  let input = d3.select("#title_setting").node()
  let title = ""
  if (settings.has("title")) {
    title = decodeURIComponent(settings.get("title"))
  }
  input.value = title
  setTitle(title)
}

// display rate

function rateHandler(this: HTMLInputElement) {
  spec.format.setDisplayRate(this.value as DisplayRate)
  spec.display()
}

function renderRateOptions(settings) {
  let rateName = DEFAULT_RATE
  if (settings.has("rate")) {
    rateName = settings.get("rate")
  }
  spec.format.setDisplayRate(rateName as DisplayRate)
  let rates = []
  for (let [rateName, longRateName] of longRateNames) {
    rates.push({ rateName, longRateName })
  }
  let form = d3.select("#display_rate")
  form.selectAll("*").remove()
  let rateOption = form.selectAll("span").data(rates).join("span")
  rateOption
    .append("input")
    .attr("id", (d) => d.rateName + "_rate")
    .attr("type", "radio")
    .attr("name", "rate")
    .attr("value", (d) => d.rateName)
    .property("checked", (d) => d.rateName === rateName)
    .on("change", rateHandler)
  rateOption
    .append("label")
    .attr("for", (d) => d.rateName + "_rate")
    .text((d) => "items/" + d.longRateName)
  rateOption.append("br")
}

// precisions

function renderPrecisions(settings) {
  spec.format.ratePrecision = DEFAULT_RATE_PRECISION
  if (settings.has("rp")) {
    spec.format.ratePrecision = Number(settings.get("rp"))
  }
  d3.select("#rprec").attr("value", spec.format.ratePrecision)
  spec.format.countPrecision = DEFAULT_COUNT_PRECISION
  if (settings.has("cp")) {
    spec.format.countPrecision = Number(settings.get("cp"))
  }
  d3.select("#cprec").attr("value", spec.format.countPrecision)
}

// value format

let displayFormats = new Map<string, DisplayFormat>([
  ["d", "decimal"],
  ["r", "rational"],
])

function renderValueFormat(settings) {
  spec.format.displayFormat = DEFAULT_FORMAT
  if (settings.has("vf")) {
    spec.format.displayFormat = displayFormats.get(settings.get("vf")) ?? DEFAULT_FORMAT
  }
  let input = document.getElementById(spec.format.displayFormat + "_format") as HTMLInputElement
  input.checked = true
}

// mining productivity

function renderMiningProd(settings) {
  let mprod = "0"
  if (settings.has("mprod")) {
    mprod = settings.get("mprod")
  }
  let mprodInput = document.getElementById("mprod") as HTMLInputElement
  mprodInput.value = mprod
  spec.miningProd = Rational.from_string(mprod).div(Rational.from_float(100))
}

// color scheme
export const DEFAULT_COLOR_SCHEME = "default"

export let colorScheme

function renderColorScheme(settings) {
  let color = DEFAULT_COLOR_SCHEME
  if (settings.has("c")) {
    color = settings.get("c")
  }
  setColorScheme(color)
  d3.select("#color_scheme")
    .on("change", function (event, d) {
      setColorScheme(event.target.value)
      spec.display()
    })
    .selectAll("option")
    .data(colorSchemes)
    .join("option")
    .attr("value", (d) => d.key)
    .property("selected", (d) => d.key === color)
    .text((d) => d.name)
}

function setColorScheme(schemeKey) {
  for (let scheme of colorSchemes) {
    if (scheme.key === schemeKey) {
      colorScheme = scheme
      colorScheme.apply()
      return
    }
  }
}

// buildings

function renderBuildings(settings) {
  let groupSet = new Set<any>()
  for (let [cat, group] of spec.buildings) {
    if (group.buildings.length > 1) {
      groupSet.add(group)
    }
  }
  for (let group of groupSet) {
    spec.setMinimumBuilding(group.getDefault())
  }
  if (settings.has("buildings")) {
    let buildingKeys = settings.get("buildings").split(",")
    let selections = new Map<any, any[]>()
    for (let key of buildingKeys) {
      let building = spec.buildingKeys.get(key)
      if (building === undefined) {
        console.log("unknown building:", key)
        continue
      }
      let group = spec.getBuildingGroup(building)
      if (!selections.has(group)) {
        selections.set(group, [])
      }
      selections.get(group).push(building)
    }
    for (let selectedBuildings of selections.values()) {
      spec.setMinimumBuilding(selectedBuildings[0])
      for (let building of selectedBuildings.slice(1)) {
        spec.setAutomaticBuildingEnabled(building, true)
      }
    }
  }

  // It doesn't really matter how we order these, but pick something just to
  // make it consistent.
  let groups = sorted(groupSet, (g) => g.getDefault().name)
  let groupIndex = new Map()
  for (let [i, g] of groups.entries()) {
    for (let building of g.buildings) {
      groupIndex.set(building, i)
    }
  }
  let div = d3.select("#building_selector")
  div.selectAll("*").remove()
  let set = div.selectAll("div").data(groups).join("div").classed("machine-setting", true)
  let options = set.selectAll("span").data((group) => group.buildings).join("span")
  options
    .append("input")
    .attr("id", (building) => `building-input-${groupIndex.get(building)}-${building.key}`)
    .attr("type", "checkbox")
    .property("checked", (building) => spec.isAutomaticBuildingEnabled(building))
    .on("change", function (this: HTMLInputElement, event, building) {
      if (!spec.setAutomaticBuildingEnabled(building, event.target.checked)) {
        d3.select(this).property("checked", true)
        return
      }
      spec.updateSolution()
    })
  options
    .append("label")
    .attr("for", (building) => `building-input-${groupIndex.get(building)}-${building.key}`)
    .append((building) => building.icon.make(32))
}

function renderBuildingOverrides(settings) {
  for (let recipe of [...spec.buildingOverrides.keys()]) {
    spec.setBuildingOverride(recipe, null)
  }

  let machineString = settings.get("machines")
  if (machineString === undefined || machineString === "") {
    return
  }

  for (let machineSetting of machineString.split(",")) {
    let [recipeKey, buildingKey] = machineSetting.split(":")
    let recipe = spec.recipes.get(recipeKey)
    let building = spec.buildingKeys.get(buildingKey)
    if (recipe === undefined || building === undefined || !spec.setBuildingOverride(recipe, building)) {
      console.log("unknown or unavailable recipe machine:", machineSetting)
    }
  }
}

// belt

function beltHandler(event, belt) {
  spec.belt = belt
  spec.display()
}

let radioInput = 0
let radioLabel = 0
function radioSetting(form, name, data, checked, onchange) {
  let option = form.selectAll("span").data(data).join("span")
  option
    .append("input")
    .attr("id", (d) => `radio-input-${radioInput++}`)
    .attr("type", "radio")
    .attr("name", name)
    .attr("value", (d) => d.key)
    .property("checked", (d) => checked(d))
    .on("change", onchange)
  option
    .append("label")
    .attr("for", (d) => `radio-input-${radioLabel++}`)
    .append((d) => d.icon.make(32))
}

function renderBelts(settings) {
  let beltKey = DEFAULT_BELT
  if (settings.has("belt")) {
    let b = settings.get("belt")
    if (spec.belts.has(b)) {
      beltKey = b
    } else {
      console.log("unknown belt:", b)
    }
  }
  spec.belt = spec.belts.get(beltKey)

  let belts = []
  for (let [beltKey, belt] of spec.belts) {
    belts.push(belt)
  }
  let form = d3.select("#belt_selector")
  form.selectAll("*").remove()
  radioSetting(form, "belt", belts, (d) => d === spec.belt, beltHandler)
}

// fuel

function fuelHandler(event, fuel) {
  spec.fuel = fuel
  spec.updateSolution()
}

function renderFuel(settings) {
  let fuelKey = DEFAULT_FUEL
  if (settings.has("fuel")) {
    let f = settings.get("fuel")
    if (spec.fuels.has(f)) {
      fuelKey = f
    } else {
      console.log("unknown fuel:", f)
    }
  }
  spec.fuel = spec.fuels.get(fuelKey)

  let fuels = Array.from(spec.fuels.values())
  let form = d3.select("#fuel_selector")
  form.selectAll("*").remove()
  radioSetting(form, "fuel", fuels, (d) => d === spec.fuel, fuelHandler)
}

// visualizer

function renderVisualizer(settings) {
  if (settings.has("vt")) {
    setVisualizerType(settings.get("vt"))
  } else {
    setVisualizerType(DEFAULT_VISUALIZER)
  }
  d3.select(`#${visualizerType}_type`).property("checked", true)
  if (settings.has("vr")) {
    setVisualizerRender(settings.get("vr"))
  } else {
    setVisualizerRender(DEFAULT_RENDER)
  }
  d3.select(`#${visualizerRender}_render`).property("checked", true)
  if (settings.has("vd")) {
    setVisualizerDirection(settings.get("vd"))
  } else {
    setVisualizerDirection(getDefaultVisualizerDirection())
  }
  d3.select(`#${visualizerDirection}_direction`).property("checked", true)
}

// default module

class DefaultModuleInput {
  [key: string]: any
  constructor(cell, module) {
    this.cell = cell
    this.module = module
  }
  checked() {
    return this.module === spec.defaultModule
  }
  choose() {
    spec.setDefaultModule(this.module)
    spec.updateSolution()
  }
}
class DefaultModuleCell {
  [key: string]: any
  constructor() {
    this.name = "default_module_dropdown"
    this.inputRows = []
    for (let row of moduleRows) {
      let inputRow = []
      for (let module of row) {
        inputRow.push(new DefaultModuleInput(this, module))
      }
      this.inputRows.push(inputRow)
    }
  }
}
class SecondaryModuleInput {
  [key: string]: any
  constructor(cell, module) {
    this.cell = cell
    this.module = module
  }
  checked() {
    return this.module === spec.secondaryDefaultModule
  }
  choose() {
    spec.setSecondaryDefaultModule(this.module)
    spec.updateSolution()
  }
}
class SecondaryModuleCell {
  [key: string]: any
  constructor() {
    this.name = "secondary_module_dropdown"
    this.inputRows = []
    for (let row of moduleRows) {
      let inputRow = []
      for (let module of row) {
        inputRow.push(new SecondaryModuleInput(this, module))
      }
      this.inputRows.push(inputRow)
    }
  }
}

function renderDefaultModule(settings) {
  let defaultModule = null
  if (settings.has("dm")) {
    defaultModule = getModule(settings.get("dm"))
  }
  spec.setDefaultModule(defaultModule)
  let secondaryModule = null
  if (settings.has("dm2")) {
    secondaryModule = getModule(settings.get("dm2"))
  }
  spec.setSecondaryDefaultModule(secondaryModule)

  let cell = new DefaultModuleCell()
  let select = d3.select("#default_module")
  select.selectAll("*").remove()
  moduleDropdown(select, [cell])
  cell = new SecondaryModuleCell()
  select = d3.select("#secondary_module")
  select.selectAll("*").remove()
  moduleDropdown(select, [cell])
}

// default beacon

class DefaultBeaconInput {
  [key: string]: any
  constructor(cell, module) {
    this.cell = cell
    this.module = module
  }
  checked() {
    return this.module === spec.defaultBeacon[this.cell.index]
  }
  choose() {
    let self = this
    let oldModule = spec.defaultBeacon[this.cell.index]
    spec.setDefaultBeacon(this.module, this.cell.index)
    if (this.cell.index === 0) {
      let modules = spec.defaultBeacon
      if (oldModule === modules[1]) {
        spec.setDefaultBeacon(this.module, 1)
        d3.selectAll("#default_beacon span.module-wrapper:nth-child(2) input").property(
          "checked",
          (d) => self.module === d.module,
        )
      }
    }
    spec.updateSolution()
  }
}
class DefaultBeaconCell {
  [key: string]: any
  constructor(index) {
    this.name = `default_beacon_dropdown_${index}`
    this.index = index
    this.inputRows = []
    for (let row of moduleRows) {
      let inputRow = []
      for (let module of row) {
        if (module === null || module.canBeacon()) {
          inputRow.push(new DefaultBeaconInput(this, module))
        }
      }
      this.inputRows.push(inputRow)
    }
  }
}

function renderDefaultBeacon(settings) {
  let defaultBeacon = [null, null]
  let defaultCount = zero
  let legacy = false
  if (settings.has("db")) {
    let keys = settings.get("db").split(":")
    if (keys.length === 1) {
      legacy = true
    }
    for (let i = 0; i < keys.length; i++) {
      defaultBeacon[i] = getModule(keys[i])
    }
  }
  if (settings.has("dbc")) {
    defaultCount = Rational.from_string(settings.get("dbc"))
  }
  if (legacy) {
    let two = Rational.from_float(2)
    let divmod = defaultCount.divmod(two)
    if (divmod.remainder.isZero()) {
      defaultBeacon = [defaultBeacon[0], defaultBeacon[0]]
      defaultCount = divmod.quotient
    }
  }
  for (let i = 0; i < defaultBeacon.length; i++) {
    spec.setDefaultBeacon(defaultBeacon[i], i)
  }
  spec.setDefaultBeaconCount(defaultCount)

  let cells = [new DefaultBeaconCell(0), new DefaultBeaconCell(1)]
  let select = d3.select("#default_beacon")
  select.selectAll("*").remove()
  moduleDropdown(select, cells)
  d3.select("#default_beacon_count")
    .attr("value", defaultCount.toDecimal())
    .on("change", (event) => {
      spec.setDefaultBeaconCount(Rational.from_string(event.target.value))
      spec.updateSolution()
    })
}

// Recipe and production-location settings are rendered by the panel above.

// resource priority

function renderResourcePriorities(settings) {
  spec.setDefaultPriority()
  if (settings.has("priority")) {
    let tiers = []
    let keys = settings.get("priority").split(";")
    outer: for (let tierStr of keys) {
      let tier = []
      for (let pair of tierStr.split(",")) {
        // Backward compatibility: If this is using the old format,
        // ignore the whole thing and bail.
        if (pair.indexOf("=") === -1) {
          console.log("bailing:", pair)
          tiers = null
          break outer
        }
        let [key, weightStr] = pair.split("=")
        if (!spec.isValidPriorityKey(key)) {
          console.log("invalid priority key:", key)
          continue
        }
        tier.push([key, Rational.from_string(weightStr)])
      }
      tiers.push(tier)
    }
    if (tiers !== null) {
      spec.setPriorities(tiers)
    }
  }
  renderResourcePriorityEditor(spec.priority, () => spec.updateSolution())
}

// debug

function renderDebugCheckbox(settings) {
  spec.debug = settings.has("debug")
  d3.select("#render_debug").property("checked", spec.debug)
}

export function renderSettings(settings) {
  renderTitle(settings)
  renderIgnore(settings)
  renderRateOptions(settings)
  renderPrecisions(settings)
  renderValueFormat(settings)
  renderMiningProd(settings)
  renderColorScheme(settings)
  renderBuildings(settings)
  renderBelts(settings)
  renderFuel(settings)
  renderVisualizer(settings)
  renderDefaultModule(settings)
  renderDefaultBeacon(settings)
  renderResourcePriorities(settings)
  renderRecipeAndLocationSettings(settings)
  renderBuildingOverrides(settings)
  renderTargets(settings)
  renderModules(settings)
  renderDebugCheckbox(settings)
  renderTab(settings)
}

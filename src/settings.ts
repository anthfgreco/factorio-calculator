import { select, selectAll, type BaseType, type Selection } from "d3"
import { normalizeSearchText, sorted } from "./data.js"
import {
  BuildingGroup,
  buildingSort,
  DEFAULT_BELT,
  DEFAULT_FUEL,
  DEFAULT_PLANET,
  FactorySpecification,
  setRecipeEnabled,
  spec,
} from "./factory.js"
import { ColorScheme, colorSchemes } from "./color-schemes.js"
import type { Icon } from "./presentation.js"
import type { DisplayFormat, DisplayRate } from "./math.js"
import {
  DEFAULT_COUNT_PRECISION,
  DEFAULT_FORMAT,
  DEFAULT_RATE,
  DEFAULT_RATE_PRECISION,
  formatCanadianNumber,
  longRateNames,
  one,
  Rational,
  zero,
} from "./math.js"
import {
  Belt,
  Building,
  Fuel,
  Module,
  type ModuleDropdownCell,
  type ModuleDropdownOption,
  moduleDropdown,
  moduleRows,
  type Planet,
  type Quality,
  type RecipeProductivityResearch,
  shortModules,
} from "./models.js"
import { renderResourcePriorityEditor, unmountResourcePriorityEditor } from "./priorities.js"
import {
  getConfigurableRecipes,
  groupRecipesForSettings,
  isRecipeUnavailable,
  isRecyclingRecipe,
  recipeVisibleInSettings,
  type Recipe,
  type RecipeSettingsGroup,
} from "./recipes.js"
import {
  recipeProductivityLevelFromPercent,
  recipeProductivityPercent,
  recipeProductivityPercentPerLevel,
} from "./settings/productivity-research.js"
import {
  DEFAULT_RENDER,
  DEFAULT_TAB,
  DEFAULT_VISUALIZER,
  clickTab,
  getDefaultVisualizerDirection,
  setTitle,
  setVisualizerDirection,
  setVisualizerRender,
  setVisualizerType,
  syncMiningProductivityControls,
  visualizerDirection,
  visualizerRender,
  visualizerType,
} from "./state.js"
import { parseBeltStackItemSettings, parseBeltStackSettingPolicy, parseTargetSetting } from "./url/codec.js"

type SettingsMap = ReadonlyMap<string, string>
type RadioOption = Belt | Fuel

function requirePlanets(): Map<string, Planet> {
  if (spec.planets === null) throw new Error("Planet data has not been loaded")
  return spec.planets
}

function requireFuels() {
  if (spec.fuels === null) throw new Error("Fuel data has not been loaded")
  return spec.fuels
}

function requireElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}`)
  return element as TElement
}

// -----------------------------------------------------------------------------
// Recipe browser
// -----------------------------------------------------------------------------

let searchText = ""
let showUnavailable = false
let showChangedOnly = false
let recipeSettingsRendered = false
let resourcePrioritiesRendered = false

function recipeCategoryId(category: string): string {
  return `recipe-category-${category.replace(/[^a-z0-9_-]+/gi, "-")}`
}

function updateRecipeToggleState(
  specification: FactorySpecification,
  element: HTMLButtonElement,
  recipe: Recipe,
): void {
  const unavailable = isRecipeUnavailable(specification, recipe)
  const enabled = !specification.disable.has(recipe)

  element.classList.toggle("selected", enabled && !unavailable)
  element.classList.toggle("disabled-recipe", !enabled && !unavailable)
  element.classList.toggle("unavailable", unavailable)
  element.disabled = unavailable

  if (unavailable) {
    const status = "unavailable on the selected planets or compatible machines"
    element.setAttribute("data-tooltip", `${recipe.name} (${status})`)
    element.setAttribute("aria-label", `${recipe.name}: ${status}.`)
    element.setAttribute("aria-disabled", "true")
    element.removeAttribute("aria-pressed")
    return
  }

  const status = enabled ? "enabled" : "disabled"
  element.setAttribute("data-tooltip", `${recipe.name} (${status})`)
  element.setAttribute("aria-label", `${recipe.name}: ${status}. Click to ${enabled ? "disable" : "enable"}.`)
  element.setAttribute("aria-disabled", "false")
  element.setAttribute("aria-pressed", String(enabled))
}

function makeRecipeToggles<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  recipes: readonly Recipe[],
  specification: FactorySpecification,
): void {
  const toggles = container
    .selectAll("button.recipe-setting-toggle")
    .data(recipes)
    .join("button")
    .attr("type", "button")
    .classed("toggle recipe recipe-setting-toggle", true)
    .on("click", function (event: Event, recipe: Recipe) {
      event.preventDefault()
      if (isRecipeUnavailable(specification, recipe)) {
        return
      }
      setRecipeEnabled(specification, recipe, specification.disable.has(recipe))
      specification.updateSolution()
    })

  toggles.each(function (recipe: Recipe) {
    updateRecipeToggleState(specification, this as HTMLButtonElement, recipe)
  })
  toggles.selectAll("*").remove()
  toggles.append((recipe: Recipe) => recipe.icon.make(32))
}

function makeRecipeGroups<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  container: Selection<GElement, TDatum, PElement, PDatum>,
  groups: readonly RecipeSettingsGroup[],
  specification: FactorySpecification,
): void {
  const group = container
    .selectAll<HTMLDetailsElement, RecipeSettingsGroup>("details.recipe-settings-category")
    .data(groups, (entry: RecipeSettingsGroup) => entry.category)
    .join("details")
    .classed("recipe-settings-category", true)
    .property("open", true)
    .attr("id", (entry: RecipeSettingsGroup) => recipeCategoryId(entry.category))
    .attr("data-category", (entry: RecipeSettingsGroup) => entry.category)

  group
    .selectAll<HTMLElement, RecipeSettingsGroup>("summary")
    .data((entry: RecipeSettingsGroup) => [entry])
    .join("summary")
    .text((entry: RecipeSettingsGroup) => entry.name)
  group
    .selectAll("div.recipe-settings-toggle-row")
    .data((entry: RecipeSettingsGroup) => [entry])
    .join("div")
    .classed("toggle-list recipe-settings-toggle-row", true)
    .each(function (entry: RecipeSettingsGroup) {
      makeRecipeToggles(select(this as HTMLDivElement), entry.recipes, specification)
    })
}

function disableAllRecycling(specification: FactorySpecification, recyclingRecipes: readonly Recipe[]): void {
  let changed = false
  for (const recipe of recyclingRecipes) {
    if (!specification.disable.has(recipe)) {
      specification.setDisable(recipe)
      changed = true
    }
  }
  if (changed) {
    specification.updateSolution()
  } else {
    refreshRecipeSettings(specification)
  }
}

function resetRecipeChanges(specification: FactorySpecification): void {
  const overrides = specification.getNetDisable()
  for (const recipe of overrides.disable) {
    specification.setEnable(recipe)
  }
  for (const recipe of overrides.enable) {
    specification.setDisable(recipe)
  }
  specification.updateSolution()
}

export function renderRecipeSettings(specification: FactorySpecification): void {
  searchText = ""
  showUnavailable = false
  showChangedOnly = false

  const recipes = getConfigurableRecipes(specification)
  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  const productionGroups = groupRecipesForSettings(productionRecipes)
  const root = select("#recipe_toggles")
  root.selectAll("*").remove()
  root.classed("recipe-settings-browser", true)

  const toolbar = root.append("div").classed("recipe-settings-toolbar", true)
  toolbar
    .append("input")
    .attr("id", "recipe_search")
    .attr("type", "search")
    .attr("placeholder", "Search recipes, items, ingredients, or machines")
    .attr("aria-label", "Search recipes")
    .on("input", function () {
      searchText = (this as HTMLInputElement).value
      refreshRecipeSettings(specification)
    })

  const unavailableLabel = toolbar.append("label").classed("recipe-settings-unavailable", true)
  unavailableLabel
    .append("input")
    .attr("type", "checkbox")
    .on("change", function () {
      showUnavailable = (this as HTMLInputElement).checked
      refreshRecipeSettings(specification)
    })
  unavailableLabel
    .attr("data-tooltip", "Show recipes blocked by the selected planets or compatible machines.")
    .append("span")
    .text("Show unavailable recipes")

  const changedLabel = toolbar.append("label").classed("recipe-settings-changed", true)
  changedLabel
    .append("input")
    .attr("type", "checkbox")
    .on("change", function (this: HTMLInputElement) {
      showChangedOnly = this.checked
      refreshRecipeSettings(specification)
    })
  changedLabel.append("span").text("Changed only")

  toolbar
    .append("button")
    .attr("type", "button")
    .classed("ui reset-recipe-changes", true)
    .text("Reset recipe changes")
    .on("click", () => resetRecipeChanges(specification))

  const categoryNav = root.append("nav").classed("recipe-category-nav", true).attr("aria-label", "Recipe categories")
  categoryNav.append("span").text("Jump to")
  categoryNav
    .selectAll<HTMLAnchorElement, RecipeSettingsGroup>("a")
    .data(productionGroups)
    .join("a")
    .attr("href", (entry: RecipeSettingsGroup) => `#${recipeCategoryId(entry.category)}`)
    .text((entry: RecipeSettingsGroup) => entry.name)
    .on("click", function (_event: Event, entry: RecipeSettingsGroup) {
      const category = document.getElementById(recipeCategoryId(entry.category)) as HTMLDetailsElement | null
      if (category !== null) category.open = true
    })

  root.append("div").attr("id", "recipe_settings_help").classed("recipe-settings-help", true)
  root.append("div").classed("recipe-settings-summary", true).attr("aria-live", "polite")

  const production = root.append("section").classed("recipe-settings-section production-recipes", true)
  production.append("h4").text("Production recipes")
  makeRecipeGroups(production.append("div").classed("recipe-settings-groups", true), productionGroups, specification)

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
      disableAllRecycling(specification, recyclingRecipes)
    })
  makeRecipeToggles(
    recyclingBody.append("div").classed("toggle-list recipe-settings-toggle-row", true),
    recyclingRecipes,
    specification,
  )

  root.append("div").classed("recipe-settings-empty", true).text("No recipes match your search.")
  refreshRecipeSettings(specification)
}

export function refreshRecipeSettings(specification: FactorySpecification): void {
  if (!recipeSettingsRendered) {
    return
  }
  const root = select("#recipe_toggles")
  if (root.empty()) {
    return
  }

  const normalizedSearch = normalizeSearchText(searchText)
  const overrides = specification.getNetDisable()
  const changedRecipes = new Set([...overrides.disable, ...overrides.enable])
  let visibleCount = 0

  root.selectAll<HTMLButtonElement, Recipe>("button.recipe-setting-toggle").each(function (recipe: Recipe) {
    const visible =
      recipeVisibleInSettings(specification, recipe, {
        searchText,
        showUnavailable,
      }) &&
      (!showChangedOnly || changedRecipes.has(recipe))
    const element = this as HTMLButtonElement
    element.hidden = !visible
    visibleCount += Number(visible)
    updateRecipeToggleState(specification, element, recipe)
  })

  root.selectAll<HTMLDetailsElement, unknown>("details.recipe-settings-category").each(function () {
    const element = this as HTMLDetailsElement
    element.hidden = element.querySelector("button.recipe-setting-toggle:not([hidden])") === null
    if (normalizedSearch !== "" && !element.hidden) element.open = true
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

  const recyclingRecipes = recycling.selectAll<HTMLButtonElement, Recipe>("button.recipe-setting-toggle").data()
  recycling
    .select("button.disable-recycling-recipes")
    .property(
      "disabled",
      recyclingRecipes.length === 0 || recyclingRecipes.every((recipe) => specification.disable.has(recipe)),
    )

  let helpText = "Orange: enabled · Dimmed: disabled · Click to toggle"
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
  root.select("button.reset-recipe-changes").property("disabled", changedRecipes.size === 0)
  root.select(".recipe-settings-empty").property("hidden", visibleCount !== 0)
}

// -----------------------------------------------------------------------------
// Recipe and location panel
// -----------------------------------------------------------------------------

function applyLocationSettings(settings: SettingsMap): boolean {
  const planets = requirePlanets()
  const hasMultipleLocations = planets.size > 1
  select("#location_toolbar").property("hidden", !hasMultipleLocations)
  if (!hasMultipleLocations) {
    return false
  }

  let keys = settings.has("planet") ? (settings.get("planet") ?? "").split(",").filter(Boolean) : [DEFAULT_PLANET]
  for (let key of keys) {
    const location = planets.get(key)
    if (location !== undefined) {
      spec.selectPlanet(location)
    }
  }
  return true
}

function applyRecipeOverrides(settings: SettingsMap, hasMultipleLocations: boolean): void {
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
  let selector = select("#planet_selector").classed("toggle-list", true)
  selector.selectAll("*").remove()
  if (!hasMultipleLocations) {
    return
  }

  let toggles = selector
    .selectAll("button")
    .data(sorted(requirePlanets().values(), (location: Planet) => location.order))
    .join("button")
    .attr("type", "button")
    .classed("toggle location-toggle", true)
    .classed("selected", (location: Planet) => spec.selectedPlanets.has(location))
    .attr("aria-pressed", (location: Planet) => String(spec.selectedPlanets.has(location)))
    .attr("data-tooltip", (location: Planet) => location.name)
    .on("click", function (event: MouseEvent, location: Planet) {
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
      selectAll<HTMLButtonElement, Planet>("#planet_selector .toggle")
        .classed("selected", (candidate: Planet) => spec.selectedPlanets.has(candidate))
        .attr("aria-pressed", (candidate: Planet) => String(spec.selectedPlanets.has(candidate)))
      refreshRecipeSettings(spec)
      spec.updateSolution()
    })

  toggles.selectAll("*").remove()
  toggles.append((location: Planet) => location.icon.make(24))
  toggles
    .append("span")
    .classed("location-name", true)
    .text((location: Planet) => location.name)
}

export function renderRecipeAndLocationSettings(settings: SettingsMap): void {
  let hasMultipleLocations = applyLocationSettings(settings)
  applyRecipeOverrides(settings, hasMultipleLocations)
  renderLocationSelector(hasMultipleLocations)
  recipeSettingsRendered = false
  document.getElementById("recipe_toggles")?.replaceChildren()
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

function renderTab(settings: SettingsMap) {
  let tabName: string = DEFAULT_TAB
  if (settings.has("tab")) {
    tabName = settings.get("tab") ?? DEFAULT_TAB
  }
  clickTab(tabName)
}

// build targets

function renderTargets(settings: SettingsMap) {
  spec.buildTargets.splice(0, spec.buildTargets.length)
  selectAll("#targets li.target").remove()

  let targetSetting = settings.get("items")
  if (targetSetting !== undefined && targetSetting !== "") {
    let targets = targetSetting.split(",")
    for (let targetString of targets) {
      const parsed = parseTargetSetting(targetString)
      if (parsed === null) {
        console.log("invalid target:", targetString)
        continue
      }
      if (!spec.items.has(parsed.itemKey)) {
        console.log("unknown item:", parsed.itemKey)
        continue
      }

      let recipe = null
      if (parsed.recipeKey !== null) {
        if (!spec.recipes.has(parsed.recipeKey)) {
          console.log("unknown recipe:", parsed.recipeKey)
          continue
        }
        recipe = spec.recipes.get(parsed.recipeKey) ?? null
      }

      const target = spec.addTarget(parsed.itemKey)
      if (parsed.mode === "f") {
        target.setBuildings(parsed.value, recipe)
        target.displayRecipes()
      } else if (parsed.mode === "r") {
        target.setRate(parsed.value)
      } else {
        target.setBelts(parsed.value)
      }
      target.setQuality(parsed.qualityLevel)
    }
  } else {
    spec.addTarget()
  }
}

// modules

function getModule(moduleKey: string): Module | null {
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

function getAvailableQuality(qualityKey: string | undefined): Quality | null {
  if (qualityKey === undefined) return null
  const quality = spec.qualities.get(qualityKey)
  if (quality === undefined || spec.getQualityIndex(quality) > spec.maxQualityLevel) return null
  return quality
}

function getQuality(qualityKey: string | undefined): Quality {
  return getAvailableQuality(qualityKey) ?? spec.getNormalQuality()
}

function renderQualitySelect(
  containerId: string,
  label: string,
  selected: Quality,
  choose: (quality: Quality) => void,
): void {
  const container = select<HTMLElement, unknown>(`#${containerId}`)
  container.selectAll("*").remove()
  const input = container.append("select").attr("aria-label", label).classed("equipment-quality-select", true)
  input
    .selectAll("option")
    .data(spec.getAvailableQualities())
    .join("option")
    .attr("value", (quality) => quality.key)
    .text((quality) => quality.name)
  input.property("value", selected.key).on("change", (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement)) return
    choose(getQuality(target.value))
    spec.updateSolution()
  })
}

function renderEquipmentQualityDefaults(settings: SettingsMap): void {
  spec.setDefaultMachineQuality(getQuality(settings.get("dmachq")))
  spec.setDefaultModuleQuality(getQuality(settings.get("dmq")))
  spec.setDefaultBeaconQuality(getQuality(settings.get("dbq")))
  renderQualitySelect("default_machine_quality", "Default machine quality", spec.defaultMachineQuality, (quality) =>
    spec.setDefaultMachineQuality(quality),
  )
  renderQualitySelect("default_module_quality", "Default module quality", spec.defaultModuleQuality, (quality) =>
    spec.setDefaultModuleQuality(quality),
  )
  renderQualitySelect("default_beacon_quality", "Default beacon quality", spec.defaultBeaconQuality, (quality) =>
    spec.setDefaultBeaconQuality(quality),
  )
}

function renderEquipmentQualityOverrides(settings: SettingsMap): void {
  for (const entry of (settings.get("machineq") ?? "").split(",")) {
    if (!entry) continue
    const separator = entry.lastIndexOf(":")
    if (separator < 0) continue
    const recipe = spec.recipes.get(entry.slice(0, separator))
    if (recipe) spec.setMachineQuality(recipe, getQuality(entry.slice(separator + 1)), "default")
  }
  for (const entry of (settings.get("moduleq") ?? "").split(",")) {
    if (!entry) continue
    const [machinePart, beaconModulePart = "", beaconQualityKey = ""] = entry.split(";")
    if (machinePart === undefined) continue
    const [recipeKey, ...moduleQualityKeys] = machinePart.split(":")
    if (recipeKey === undefined) continue
    const recipe = spec.recipes.get(recipeKey)
    if (!recipe) continue
    const moduleSpec = spec.getModuleSpec(recipe)
    if (!moduleSpec) continue
    moduleQualityKeys.forEach((key, index) => {
      const quality = getAvailableQuality(key)
      if (quality) moduleSpec.restoreModuleQualityOverride(index, quality)
    })
    beaconModulePart.split(":").forEach((key, index) => {
      const quality = getAvailableQuality(key)
      if (quality) moduleSpec.restoreBeaconModuleQualityOverride(quality, index)
    })
    const beaconQuality = getAvailableQuality(beaconQualityKey)
    if (beaconQuality) moduleSpec.restoreBeaconQualityOverride(beaconQuality)
  }
}

// NOTE: Buildings must be configured before modules!
function renderModules(settings: SettingsMap) {
  let two = Rational.from_float(2)
  let moduleString = settings.get("modules")
  if (moduleString !== undefined && moduleString !== "") {
    for (let recipeSetting of moduleString.split(",")) {
      const [buildingModuleSettings, beaconSettings] = recipeSetting.split(";")
      if (buildingModuleSettings === undefined) continue
      const [recipeKey, ...moduleKeyList] = buildingModuleSettings.split(":")
      if (recipeKey === undefined) continue
      const recipe = spec.recipes.get(recipeKey)
      if (recipe === undefined) {
        console.log("unknown recipe:", recipeKey)
        continue
      }
      const moduleSpec = spec.getModuleSpec(recipe)
      if (moduleSpec === null) {
        console.log("recipe has no module-capable building:", recipeKey)
        continue
      }
      for (let i = 0; i < moduleKeyList.length; i++) {
        const moduleKey = moduleKeyList[i]
        if (moduleKey === undefined || moduleKey === "") {
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
          const firstBeaconKey = beaconParts[0]
          const countValue = beaconParts[1]
          if (firstBeaconKey === undefined || countValue === undefined) continue
          const module = getModule(firstBeaconKey)
          count = Rational.from_string(countValue)
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
          const firstBeaconKey = beaconParts[0]
          const secondBeaconKey = beaconParts[1]
          const countValue = beaconParts[2]
          if (firstBeaconKey === undefined || secondBeaconKey === undefined || countValue === undefined) continue
          module1 = getModule(firstBeaconKey)
          module2 = getModule(secondBeaconKey)
          count = Rational.from_string(countValue)
        }
        moduleSpec.setBeaconModule(module1, 0)
        moduleSpec.setBeaconModule(module2, 1)
        moduleSpec.setBeaconCount(count)
      }
    }
  }
}

// ignore

function renderIgnore(settings: SettingsMap) {
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

function renderTitle(settings: SettingsMap) {
  const input = requireElement<HTMLInputElement>("title_setting")
  let title = ""
  if (settings.has("title")) {
    title = decodeURIComponent(settings.get("title") ?? "")
  }
  input.value = title
  setTitle(title)
}

// display rate

function rateHandler(this: HTMLInputElement) {
  spec.format.setDisplayRate(this.value as DisplayRate)
  spec.display()
}

function renderRateOptions(settings: SettingsMap) {
  let rateName = DEFAULT_RATE
  if (settings.has("rate")) {
    rateName = settings.get("rate") ?? DEFAULT_RATE
  }
  spec.format.setDisplayRate(rateName as DisplayRate)
  const rates: { rateName: DisplayRate; longRateName: string }[] = []
  for (let [rateName, longRateName] of longRateNames) {
    rates.push({ rateName, longRateName })
  }
  let form = select("#display_rate")
  form.selectAll("*").remove()
  let rateOption = form.selectAll("span").data(rates).join("span")
  rateOption
    .append("input")
    .attr("id", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName + "_rate")
    .attr("type", "radio")
    .attr("name", "rate")
    .attr("value", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName)
    .property("checked", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName === rateName)
    .on("change", function () {
      rateHandler.call(this as HTMLInputElement)
    })
  rateOption
    .append("label")
    .attr("for", (d: { rateName: DisplayRate; longRateName: string }) => d.rateName + "_rate")
    .text((d: { rateName: DisplayRate; longRateName: string }) => "items/" + d.longRateName)
  rateOption.append("br")
}

// precisions

function renderPrecisions(settings: SettingsMap) {
  spec.format.ratePrecision = DEFAULT_RATE_PRECISION
  if (settings.has("rp")) {
    spec.format.ratePrecision = Number(settings.get("rp") ?? DEFAULT_RATE_PRECISION)
  }
  select("#rprec").attr("value", spec.format.ratePrecision)
  spec.format.countPrecision = DEFAULT_COUNT_PRECISION
  if (settings.has("cp")) {
    spec.format.countPrecision = Number(settings.get("cp") ?? DEFAULT_COUNT_PRECISION)
  }
  select("#cprec").attr("value", spec.format.countPrecision)
}

// value format

let displayFormats = new Map<string, DisplayFormat>([
  ["d", "decimal"],
  ["r", "rational"],
])

function renderValueFormat(settings: SettingsMap) {
  spec.format.displayFormat = DEFAULT_FORMAT
  if (settings.has("vf")) {
    spec.format.displayFormat = displayFormats.get(settings.get("vf") ?? "") ?? DEFAULT_FORMAT
  }
  let input = document.getElementById(spec.format.displayFormat + "_format") as HTMLInputElement
  input.checked = true
}

// mining productivity

function renderMiningProd(settings: SettingsMap) {
  let mprod = "0"
  if (settings.has("mprod")) {
    mprod = settings.get("mprod") ?? "0"
  }
  spec.miningProd = Rational.from_string(mprod).div(Rational.from_float(100))
  syncMiningProductivityControls()
}

function renderRecipeProductivityResearch(settings: SettingsMap) {
  spec.recipeProductivityLevels.clear()
  if (settings.has("rprod")) {
    for (let entry of (settings.get("rprod") ?? "").split(",")) {
      let separator = entry.lastIndexOf(":")
      if (separator === -1) continue
      let researchKey = entry.slice(0, separator)
      let level = Number(entry.slice(separator + 1))
      if (Number.isFinite(level) && level >= 0) {
        spec.setRecipeProductivityLevel(researchKey, level)
      }
    }
  }

  const research = sorted(spec.recipeProductivityResearch.values(), (entry: RecipeProductivityResearch) => entry.name)
  let container = select("#recipe_productivity_settings")
  let miner = spec.items.get("electric-mining-drill") ?? spec.items.get("burner-mining-drill")
  let miningIcon = container.select(".mining-productivity-icon")
  miningIcon.selectAll("*").remove()
  if (miner !== undefined) {
    miningIcon.append(() => miner.icon.make(24, true))
  }
  container.selectAll("label.recipe-productivity-research-setting").remove()
  let settingsRows = container
    .selectAll("label.recipe-productivity-research-setting")
    .data(research)
    .join("label")
    .classed("recipe-productivity-setting", true)
    .classed("recipe-productivity-research-setting", true)
  settingsRows
    .append((entry: RecipeProductivityResearch) => entry.icon.make(24, true))
    .classed("recipe-productivity-icon", true)
  settingsRows.append("span").text((entry: RecipeProductivityResearch) => entry.name)
  let percentageInputs = settingsRows.append("span").classed("recipe-productivity-percentage", true)
  percentageInputs
    .append("input")
    .attr("type", "number")
    .attr("min", 0)
    .attr("max", 300)
    .attr("step", (entry: RecipeProductivityResearch) => recipeProductivityPercentPerLevel(entry))
    .attr("aria-label", (entry: RecipeProductivityResearch) => `${entry.name} bonus percentage`)
    .property(
      "value",
      (entry: RecipeProductivityResearch) =>
        recipeProductivityPercent(entry, spec.getRecipeProductivityLevel(entry.key)) ?? 0,
    )
    .on("change", function (_event: Event, entry: RecipeProductivityResearch) {
      const input = this as HTMLInputElement
      spec.setRecipeProductivityLevel(entry.key, recipeProductivityLevelFromPercent(entry, input.value))
      const level = spec.getRecipeProductivityLevel(entry.key)
      input.value = recipeProductivityPercent(entry, level) ?? "0"
      spec.updateSolution()
    })
  percentageInputs.append("span").attr("aria-hidden", "true").text("%")
}

// color scheme
export const DEFAULT_COLOR_SCHEME = "default"

export let colorScheme: ColorScheme = colorSchemes[0]

function renderColorScheme(settings: SettingsMap) {
  let color = DEFAULT_COLOR_SCHEME
  if (settings.has("c")) {
    color = settings.get("c") ?? DEFAULT_COLOR_SCHEME
  }
  setColorScheme(color)
  select("#color_scheme")
    .on("change", function (event: Event) {
      const target = event.target
      if (!(target instanceof HTMLSelectElement)) return
      setColorScheme(target.value)
      spec.display()
    })
    .selectAll("option")
    .data(colorSchemes)
    .join("option")
    .attr("value", (d: ColorScheme) => d.key)
    .property("selected", (d: ColorScheme) => d.key === color)
    .text((d: ColorScheme) => d.name)
}

function setColorScheme(schemeKey: string): void {
  for (let scheme of colorSchemes) {
    if (scheme.key === schemeKey) {
      colorScheme = scheme
      colorScheme.apply()
      return
    }
  }
}

// buildings

function renderBuildings(settings: SettingsMap) {
  const groupSet = new Set<BuildingGroup>()
  for (let [cat, group] of spec.buildings) {
    if (group.buildings.length > 1) {
      groupSet.add(group)
    }
  }
  spec.resetAutomaticBuildingPreferences()
  if (settings.has("buildings")) {
    let buildingKeys = (settings.get("buildings") ?? "").split(",")
    const selections = new Map<BuildingGroup, Building[]>()
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
      selections.get(group)?.push(building)
    }
    for (let selectedBuildings of selections.values()) {
      const minimum = selectedBuildings[0]
      if (minimum === undefined) continue
      spec.setMinimumBuilding(minimum)
      for (let building of selectedBuildings.slice(1)) {
        spec.setAutomaticBuildingEnabled(building, true)
      }
    }
  }

  // It doesn't really matter how we order these, but pick something just to
  // make it consistent.
  const groups = sorted(groupSet, (g: BuildingGroup) => g.getDefault()?.name ?? "")
  const groupIndex = new Map<Building, number>()
  for (let [i, g] of groups.entries()) {
    for (let building of g.buildings) {
      groupIndex.set(building, i)
    }
  }
  let div = select("#building_selector")
  div.selectAll("*").remove()
  let set = div.selectAll("div").data(groups).join("div").classed("machine-setting", true)
  let options = set
    .selectAll("span")
    .data((group: BuildingGroup) => group.buildings)
    .join("span")
  options
    .append("input")
    .attr("id", (building: Building) => `building-input-${groupIndex.get(building)}-${building.key}`)
    .attr("type", "checkbox")
    .property("checked", (building: Building) => spec.isAutomaticBuildingEnabled(building))
    .on("change", function (event: Event, building: Building) {
      const input = this as HTMLInputElement
      if (!spec.setAutomaticBuildingEnabled(building, input.checked)) {
        select(input).property("checked", true)
        return
      }
      spec.updateSolution()
    })
  options
    .append("label")
    .attr("for", (building: Building) => `building-input-${groupIndex.get(building)}-${building.key}`)
    .append((building: Building) => building.icon.make(32))
}

function renderBuildingOverrides(settings: SettingsMap) {
  for (let recipe of [...spec.buildingOverrides.keys()]) {
    spec.setBuildingOverride(recipe, null)
  }

  let machineString = settings.get("machines")
  if (machineString === undefined || machineString === "") {
    return
  }

  for (let machineSetting of machineString.split(",")) {
    const [recipeKey, buildingKey] = machineSetting.split(":")
    if (recipeKey === undefined || buildingKey === undefined) continue
    const recipe = spec.recipes.get(recipeKey)
    const building = spec.buildingKeys.get(buildingKey)
    if (recipe === undefined || building === undefined || !spec.setBuildingOverride(recipe, building)) {
      console.log("unknown or unavailable recipe machine:", machineSetting)
    }
  }
}

// belt

function beltHandler(_event: Event, belt: Belt): void {
  spec.belt = belt
  if (spec.buildTargets.some((target) => target.basis === "belts")) spec.updateSolution()
  else spec.display()
}

let radioInput = 0
let radioLabel = 0

interface RadioSettingOption {
  readonly key: string
  readonly icon: Icon
}

function radioSetting<
  TOption extends RadioSettingOption,
  GElement extends BaseType,
  TDatum,
  PElement extends BaseType,
  PDatum,
>(
  form: Selection<GElement, TDatum, PElement, PDatum>,
  name: string,
  data: readonly TOption[],
  checked: (option: TOption) => boolean,
  onChange: (event: Event, option: TOption) => void,
): void {
  const option = form.selectAll<HTMLSpanElement, TOption>("span").data(data).join("span")
  option
    .append("input")
    .attr("id", () => `radio-input-${radioInput++}`)
    .attr("type", "radio")
    .attr("name", name)
    .attr("value", (datum: TOption) => datum.key)
    .property("checked", (datum: TOption) => checked(datum))
    .on("change", (event: Event, datum: TOption) => onChange(event, datum))
  option
    .append("label")
    .attr("for", () => `radio-input-${radioLabel++}`)
    .append((datum: TOption) => datum.icon.make(32))
}

function renderBelts(settings: SettingsMap) {
  let beltKey = DEFAULT_BELT
  if (settings.has("belt")) {
    const b = settings.get("belt")
    if (b !== undefined && spec.belts.has(b)) {
      beltKey = b
    } else {
      console.log("unknown belt:", b)
    }
  }
  spec.belt = spec.belts.get(beltKey) ?? null

  const belts = Array.from(spec.belts.values())
  let form = select("#belt_selector")
  form.selectAll("*").remove()
  radioSetting(form, "belt", belts, (belt: Belt) => belt === spec.belt, beltHandler)
}

// fuel

function fuelHandler(_event: Event, fuel: Fuel): void {
  spec.fuel = fuel
  spec.updateSolution()
}

function renderFuel(settings: SettingsMap) {
  let fuelKey = DEFAULT_FUEL
  if (settings.has("fuel")) {
    const f = settings.get("fuel")
    if (f !== undefined && requireFuels().has(f)) {
      fuelKey = f
    } else {
      console.log("unknown fuel:", f)
    }
  }
  spec.fuel = requireFuels().get(fuelKey) ?? null

  const fuels = Array.from(requireFuels().values())
  let form = select("#fuel_selector")
  form.selectAll("*").remove()
  radioSetting(form, "fuel", fuels, (fuel: Fuel) => fuel === spec.fuel, fuelHandler)
}

// visualizer

function renderVisualizer(settings: SettingsMap) {
  if (settings.has("vt")) {
    setVisualizerType(settings.get("vt") ?? DEFAULT_VISUALIZER)
  } else {
    setVisualizerType(DEFAULT_VISUALIZER)
  }
  select(`#${visualizerType}_type`).property("checked", true)
  if (settings.has("vr")) {
    setVisualizerRender(settings.get("vr") ?? DEFAULT_RENDER)
  } else {
    setVisualizerRender(DEFAULT_RENDER)
  }
  select(`#${visualizerRender}_render`).property("checked", true)
  if (settings.has("vd")) {
    setVisualizerDirection(settings.get("vd") ?? getDefaultVisualizerDirection())
  } else {
    setVisualizerDirection(getDefaultVisualizerDirection())
  }
  select(`#${visualizerDirection}_direction`).property("checked", true)
}

// default module

class DefaultModuleInput implements ModuleDropdownOption {
  constructor(
    readonly cell: DefaultModuleCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === spec.defaultModule
  }

  choose(): void {
    spec.setDefaultModule(this.module)
    spec.updateSolution()
  }
}

class DefaultModuleCell implements ModuleDropdownCell {
  readonly name = "default_module_dropdown"
  readonly inputRows: readonly (readonly DefaultModuleInput[])[]

  constructor() {
    this.inputRows = moduleRows.map((row) => row.map((module) => new DefaultModuleInput(this, module)))
  }
}

class SecondaryModuleInput implements ModuleDropdownOption {
  constructor(
    readonly cell: SecondaryModuleCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === spec.secondaryDefaultModule
  }

  choose(): void {
    spec.setSecondaryDefaultModule(this.module)
    spec.updateSolution()
  }
}

class SecondaryModuleCell implements ModuleDropdownCell {
  readonly name = "secondary_module_dropdown"
  readonly inputRows: readonly (readonly SecondaryModuleInput[])[]

  constructor() {
    this.inputRows = moduleRows.map((row) => row.map((module) => new SecondaryModuleInput(this, module)))
  }
}

function renderDefaultModule(settings: SettingsMap): void {
  const defaultModule = settings.has("dm") ? getModule(settings.get("dm") ?? "null") : null
  spec.setDefaultModule(defaultModule)
  const secondaryModule = settings.has("dm2") ? getModule(settings.get("dm2") ?? "null") : null
  spec.setSecondaryDefaultModule(secondaryModule)

  const defaultCell = new DefaultModuleCell()
  const defaultSelector = select<HTMLElement, unknown>("#default_module")
  defaultSelector.selectAll("*").remove()
  moduleDropdown(defaultSelector, [defaultCell])

  const secondaryCell = new SecondaryModuleCell()
  const secondarySelector = select<HTMLElement, unknown>("#secondary_module")
  secondarySelector.selectAll("*").remove()
  moduleDropdown(secondarySelector, [secondaryCell])
}

class DefaultBeaconInput implements ModuleDropdownOption {
  constructor(
    readonly cell: DefaultBeaconCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === spec.defaultBeacon[this.cell.index]
  }

  choose(): void {
    const oldModule = spec.defaultBeacon[this.cell.index] ?? null
    spec.setDefaultBeacon(this.module, this.cell.index)
    if (this.cell.index === 0 && oldModule === spec.defaultBeacon[1]) {
      spec.setDefaultBeacon(this.module, 1)
      selectAll<HTMLInputElement, ModuleDropdownOption>(
        "#default_beacon span.module-wrapper:nth-child(2) input",
      ).property("checked", (datum: ModuleDropdownOption) => this.module === datum.module)
    }
    spec.updateSolution()
  }
}

class DefaultBeaconCell implements ModuleDropdownCell {
  readonly name: string
  readonly inputRows: readonly (readonly DefaultBeaconInput[])[]

  constructor(readonly index: number) {
    this.name = `default_beacon_dropdown_${index}`
    this.inputRows = moduleRows.map((row) =>
      row
        .filter((module) => module === null || module.canBeacon())
        .map((module) => new DefaultBeaconInput(this, module)),
    )
  }
}

function renderDefaultBeacon(settings: SettingsMap): void {
  let defaultBeacon: [Module | null, Module | null] = [null, null]
  let defaultCount = zero
  let legacy = false
  if (settings.has("db")) {
    const keys = (settings.get("db") ?? "").split(":")
    legacy = keys.length === 1
    defaultBeacon = [getModule(keys[0] ?? "null"), getModule(keys[1] ?? "null")]
  }
  if (settings.has("dbc")) defaultCount = Rational.from_string(settings.get("dbc") ?? "0")
  if (legacy) {
    const divmod = defaultCount.divmod(Rational.from_float(2))
    if (divmod.remainder.isZero()) {
      defaultBeacon = [defaultBeacon[0], defaultBeacon[0]]
      defaultCount = divmod.quotient
    }
  }
  defaultBeacon.forEach((module, index) => spec.setDefaultBeacon(module, index))
  spec.setDefaultBeaconCount(defaultCount)

  const cells: readonly ModuleDropdownCell[] = [new DefaultBeaconCell(0), new DefaultBeaconCell(1)]
  const selector = select<HTMLElement, unknown>("#default_beacon")
  selector.selectAll("*").remove()
  moduleDropdown(selector, cells)
  select("#default_beacon_count")
    .attr("value", formatCanadianNumber(defaultCount.toDecimal()))
    .on("change", (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) return
      spec.setDefaultBeaconCount(Rational.from_string(target.value))
      spec.updateSolution()
    })
}

// Recipe and production-location settings are rendered by the panel above.

// resource priority

function renderResourcePriorities(settings: SettingsMap) {
  spec.setDefaultPriority()
  if (settings.has("priority")) {
    let tiers: [string, Rational][][] | null = []
    let keys = (settings.get("priority") ?? "").split(";")
    outer: for (let tierStr of keys) {
      const tier: [string, Rational][] = []
      for (let pair of tierStr.split(",")) {
        // Backward compatibility: If this is using the old format,
        // ignore the whole thing and bail.
        if (pair.indexOf("=") === -1) {
          console.log("bailing:", pair)
          tiers = null
          break outer
        }
        const [key, weightStr] = pair.split("=")
        if (key === undefined || weightStr === undefined) continue
        if (!spec.isValidPriorityKey(key)) {
          console.log("invalid priority key:", key)
          continue
        }
        tier.push([key, Rational.from_string(weightStr)])
      }
      tiers?.push(tier)
    }
    if (tiers !== null) {
      spec.setPriorities(tiers)
    }
  }
  resourcePrioritiesRendered = false
  unmountResourcePriorityEditor()
}

export function ensureDeferredSettingsRendered(): void {
  if (!recipeSettingsRendered) {
    recipeSettingsRendered = true
    renderRecipeSettings(spec)
  }
}

export function ensureDeferredResourcesRendered(): void {
  if (!resourcePrioritiesRendered) {
    resourcePrioritiesRendered = true
    renderResourcePriorityEditor(spec.priority, () => spec.updateSolution())
  }
}

// debug

function renderDebugCheckbox(settings: SettingsMap) {
  spec.debug = settings.has("debug")
  select("#render_debug").property("checked", spec.debug)
}

function renderPlanningSettings(settings: SettingsMap) {
  spec.beltStackSize = Rational.from_string(settings.get("bstack") ?? "1")
  const serializedStackPolicy = settings.get("bstackmode")
  spec.beltStackDefaultPolicy =
    serializedStackPolicy === undefined
      ? settings.has("bstack")
        ? "stacked"
        : "auto"
      : (parseBeltStackSettingPolicy(serializedStackPolicy) ?? "auto")
  spec.beltStackOverrides.clear()
  const stackItemSettings = parseBeltStackItemSettings(settings.get("bstackitems") ?? "")
  if (stackItemSettings !== null) {
    for (const entry of stackItemSettings) {
      const item = spec.items.get(entry.itemKey)
      if (item?.phase === "solid") spec.setBeltStackOverride(item, entry.policy)
    }
  }
  spec.bufferMinutes = Rational.from_string(settings.get("buffer") ?? "1")
  spec.freshnessDelayMinutes = Rational.from_string(settings.get("fresh") ?? "0")
  spec.setMaxQualityLevel(Number(settings.get("maxq") ?? "4"))

  spec.resourceYields.clear()
  let resourceYields = settings.get("ryield")
  if (resourceYields) {
    for (let entry of resourceYields.split(",")) {
      let split = entry.lastIndexOf(":")
      let recipe = spec.recipes.get(entry.slice(0, split))
      if (recipe && split > 0)
        spec.setResourceYield(recipe, Rational.from_string(entry.slice(split + 1)).div(Rational.from_float(100)))
    }
  }
  spec.asteroidLimits.clear()
  let caps = settings.get("astcap")
  if (caps) {
    for (let entry of caps.split(",")) {
      let split = entry.lastIndexOf(":")
      if (split > 0)
        spec.asteroidLimits.set(
          entry.slice(0, split),
          Rational.from_string(entry.slice(split + 1)).div(spec.format.rateFactor),
        )
    }
  }

  spec.recipeLocations.clear()
  let locations = settings.get("rloc")
  if (locations) {
    for (let entry of locations.split(",")) {
      const [recipeKey, locationKey] = entry.split(":")
      if (recipeKey === undefined || locationKey === undefined) continue
      const recipe = spec.recipes.get(recipeKey)
      const location = requirePlanets().get(locationKey)
      if (recipe && location) spec.setRecipeLocation(recipe, location)
    }
  }

  ;(document.getElementById("belt_stack_size") as HTMLSelectElement).value = spec.beltStackSize.toString()
  ;(document.getElementById("belt_stack_default_policy") as HTMLSelectElement).value = spec.beltStackDefaultPolicy
  ;(document.getElementById("buffer_minutes") as HTMLInputElement).value = spec.bufferMinutes.toDecimal()
  ;(document.getElementById("freshness_delay") as HTMLInputElement).value = spec.freshnessDelayMinutes.toDecimal()
  ;(document.getElementById("max_quality") as HTMLSelectElement).value = String(spec.maxQualityLevel)
  document.querySelectorAll<HTMLInputElement>("[data-resource-key]").forEach((input) => {
    let recipe = spec.recipes.get(input.dataset.resourceKey ?? "")
    let value = recipe ? spec.getResourceYield(recipe) : one
    input.value = value.mul(Rational.from_float(100)).toDecimal()
  })
  document.querySelectorAll<HTMLInputElement>("[data-item-key]").forEach((input) => {
    let value = spec.asteroidLimits.get(input.dataset.itemKey ?? "")
    input.value = value ? value.mul(spec.format.rateFactor).toDecimal() : ""
  })
}

export function renderSettings(settings: SettingsMap) {
  renderTitle(settings)
  renderIgnore(settings)
  renderRateOptions(settings)
  renderPrecisions(settings)
  renderValueFormat(settings)
  renderMiningProd(settings)
  renderRecipeProductivityResearch(settings)
  renderColorScheme(settings)
  renderBuildings(settings)
  renderBelts(settings)
  renderPlanningSettings(settings)
  renderFuel(settings)
  renderVisualizer(settings)
  renderEquipmentQualityDefaults(settings)
  renderDefaultModule(settings)
  renderDefaultBeacon(settings)
  renderResourcePriorities(settings)
  renderRecipeAndLocationSettings(settings)
  renderBuildingOverrides(settings)
  renderTargets(settings)
  renderModules(settings)
  renderEquipmentQualityOverrides(settings)
  renderDebugCheckbox(settings)
  renderTab(settings)
}

import {
  DEFAULT_RATE,
  DEFAULT_RATE_PRECISION,
  DEFAULT_COUNT_PRECISION,
  DEFAULT_FORMAT,
  longRateNames,
  type DisplayFormat,
  type DisplayRate,
} from "../../core/format/formatter.js"
import { colorSchemes } from "../../visualization/color.js"
import {
  DEFAULT_TAB,
  clickTab,
} from "../events.js"
import {
  DEFAULT_RENDER,
  DEFAULT_VISUALIZER,
  getDefaultVisualizerDirection,
  setVisualizerDirection,
  setVisualizerRender,
  setVisualizerType,
  visualizerDirection,
  visualizerRender,
  visualizerType,
} from "../../visualization/config.js"
import { spec, DEFAULT_PLANET, DEFAULT_BELT, DEFAULT_FUEL, buildingSort } from "../../application/calculator/index.js"
import { shortModules, moduleRows, moduleDropdown } from "../../runtime/module.js"
import { Rational, zero } from "../../core/math/rational.js"
import { refreshRecipeSettings, renderRecipeSettings } from "./recipe-settings-browser.js"
import { sorted } from "../../shared/sort.js"
import { renderRecipeAndLocationSettings } from "./recipe-settings-panel.js"
import { renderResourcePriorityEditor } from "./resource-priority-editor.js"
import { DEFAULT_TITLE, setTitle } from "../document-title.js"
export { currentMod, MODIFICATIONS, renderDataSetOptions } from "./dataset-settings.js"

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
    group.building = group.getDefault()
  }
  if (settings.has("buildings")) {
    let buildingKeys = settings.get("buildings").split(",")
    for (let key of buildingKeys) {
      let building = spec.buildingKeys.get(key)
      if (building === undefined) {
        console.log("unknown building:", key)
        continue
      }
      spec.setMinimumBuilding(building)
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
  let set = div.selectAll("div").data(groups).join("div").classed("radio-setting", true)
  radioSetting(
    set,
    (d) => `building_selector_${groupIndex.get(d)}`,
    (d) => d.buildings,
    (d) => d === spec.getBuildingGroup(d).building,
    (event, d) => {
      spec.setMinimumBuilding(d)
      spec.updateSolution()
    },
  )
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

// recipe and production-location settings are isolated in recipe-settings-panel.ts

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
  renderTargets(settings)
  renderModules(settings)
  renderDebugCheckbox(settings)
  renderTab(settings)
}

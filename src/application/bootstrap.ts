import { parseCalculatorData } from "../core/data/parse-calculator-data.js"
import { getBelts } from "../runtime/belt.js"
import { getBuildings } from "../runtime/building.js"
import { resetDisplay } from "../ui/results/display.js"
import { configureFactoryView, spec, resetSpec } from "./calculator/index.js"
import { formatSettings, loadSettings } from "../ui/persistence/fragment.js"
import { getFuel } from "../runtime/fuel.js"
import { getItemGroups } from "../runtime/group.js"
import { getSprites } from "../presentation/icon.js"
import { getItems } from "../runtime/item.js"
import { getModules } from "../runtime/module.js"
import { configureModelRuntime } from "../runtime/runtime-context.js"
import { getPlanets } from "../runtime/planet.js"
import { getRecipes } from "../runtime/recipe.js"
import { renderSettings } from "../ui/settings/settings.js"
import {
  configureDatasetChangeHandler,
  currentMod,
  MODIFICATIONS,
  renderDataSetOptions,
} from "../ui/settings/dataset-settings.js"
import { clearUrlHash, finishUrlInitialization, initializeUrlState } from "../infrastructure/url/url-state.js"
import { browserFactoryView } from "../ui/browser-factory-view.js"
import { setLegacyCalculation, usesLegacyCalculation } from "./calculation-mode.js"

function reset() {
  clearUrlHash()
  resetDisplay()
  resetSpec()
  window.spec = spec
}

export function changeMod() {
  let currentSettings = loadSettings("#" + formatSettings())
  currentSettings.delete("data")
  let modName = currentMod()
  reset()
  console.log("settings on reset:", currentSettings)
  loadData(modName, currentSettings)
}

let OIL_EXCLUSION = new Map([
  ["basic", ["advanced-oil-processing"]],
  ["coal", ["advanced-oil-processing", "basic-oil-processing"]],
])

function fixLegacySettings(settings) {
  if ((settings.has("use_3") || settings.has("min") || settings.has("furnace")) && !settings.has("buildings")) {
    let parts = []
    if (settings.has("min")) {
      let n = settings.get("min")
      if (n === "4") {
        n = "3"
      }
      parts.push("assembling-machine-" + n)
      settings.delete("min")
    } else if (settings.has("use_3")) {
      parts.push("assembling-machine-3")
      settings.delete("use_3")
    }
    if (settings.has("furnace")) {
      parts.push(settings.get("furnace"))
      settings.delete("furnace")
    }
    settings.set("buildings", parts.join(","))
  }
  if ((settings.has("k") || settings.has("p")) && !settings.has("disable")) {
    let parts = []
    if (settings.has("k")) {
      settings.delete("k")
      parts.push("kovarex-processing")
    }
    if (settings.has("p")) {
      let p = settings.get("p")
      for (let r of OIL_EXCLUSION.get(p)) {
        parts.push(r)
      }
      settings.delete("p")
    }
    settings.set("disable", parts.join(","))
  }
}

function loadData(modName, settings) {
  let mod = MODIFICATIONS.get(modName)
  setLegacyCalculation(mod.legacy)
  let filename = "data/" + mod.filename
  d3.json(filename, { cache: "reload" }).then(function (rawData: unknown) {
    let data = parseCalculatorData(rawData)
    let items = getItems(data)
    let recipes = getRecipes(data, items)
    let buildings = getBuildings(data, items)
    let planets = getPlanets(data, recipes, buildings)
    let modules = getModules(data, items)
    let belts = getBelts(data)
    let fuel = getFuel(data, items)
    getSprites(data)
    let itemGroups = getItemGroups(items, data)
    spec.setData(items, recipes, planets, modules, buildings, belts, fuel, itemGroups)

    fixLegacySettings(settings)
    renderSettings(settings)

    spec.updateSolution()
    finishUrlInitialization()
  })
}

export function init() {
  configureFactoryView(browserFactoryView)
  configureDatasetChangeHandler(changeMod)
  window.spec = spec
  configureModelRuntime({
    getSpecification: () => spec,
    useLegacyCalculation: usesLegacyCalculation,
  })
  initializeUrlState()
  let settings = loadSettings(window.location.hash)
  renderDataSetOptions(settings)
  loadData(currentMod(), settings)
}

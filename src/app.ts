import { parseCalculatorData } from "./data.js"
import type { FactoryViewPort } from "./factory.js"
import { configureFactoryView, resetSpec, spec } from "./factory.js"
import { configureModelRuntime, getBelts, getBuildings, getFuel, getItemGroups, getModules, getPlanets } from "./models.js"
import { getSprites, reapTooltips } from "./presentation.js"
import { getItems, getRecipes } from "./recipes.js"
import { displayCalculationError, displayItems, resetDisplay } from "./results.js"
import { renderSettings } from "./settings.js"
import {
  configureDatasetChangeHandler,
  currentMod,
  currentTab,
  initializeFactoryDensity,
  MODIFICATIONS,
  renderDataSetOptions,
  setLegacyCalculation,
  usesLegacyCalculation,
} from "./state.js"
import { BuildTarget } from "./ui.js"
import {
  clearUrlHash,
  finishUrlInitialization,
  formatSettings,
  initializeUrlState,
  loadSettings,
  syncUrlHash,
} from "./url-state.js"
import { renderTotals } from "./visualization.js"

// -----------------------------------------------------------------------------
// Debug output
// -----------------------------------------------------------------------------

function renderMatrix(d, A, m) {
  let table = d.append("table").attr("border", 1)
  let header = table.append("tr")
  header.append("th")
  for (let item of m.items) {
    let th = header.append("th")
    th.append(() => new Text("s"))
    th.append(() => item.icon.make(32)).classed("item-icon", true)
  }
  for (let t of m.targets) {
    let th = header.append("th")
    th.append(() => t.item.icon.make(32))
    th.append(() => new Text("\u21d0"))
    th.append(() => t.recipe.icon.make(32))
  }
  header.append("th").text("tax")
  for (let recipe of m.recipes) {
    header
      .append("th")
      .append(() => recipe.icon.make(32))
      .classed("item-icon", true)
  }
  header.append("th").text("answer")
  header.append("th").text("C")
  for (let r = 0; r < A.rows; r++) {
    let row = table.append("tr")
    let label = row.append("td")
    if (r < m.recipes.length) {
      label.append(() => m.recipes[r].icon.make(32)).classed("item-icon", true)
    } else if (r === A.rows - 2) {
      label.append(() => new Text("tax"))
    } else {
      label.append(() => new Text("answer"))
    }
    for (let c = 0; c < A.cols; c++) {
      let x = A.index(r, c)
      row.append("td").classed("right-align", true).append("tt").text(x.toString())
    }
  }
}

export function renderDebug() {
  let debugTab = d3.select("#debug_tab")

  let lastTableau = d3.select("#debug_tableau")
  lastTableau.selectChildren().remove()
  let lastSolution = d3.select("#debug_solution")
  lastSolution.selectChildren().remove()

  if (spec.lastTableau === null) {
    d3.select("#debug_message").text("No tableau required.")
  } else {
    d3.select("#debug_message").text("Displaying previous tableau.")
    renderMatrix(lastTableau, spec.lastTableau, spec.lastMetadata)
    renderMatrix(lastSolution, spec.lastSolution, spec.lastMetadata)
  }
}

// -----------------------------------------------------------------------------
// Browser factory view
// -----------------------------------------------------------------------------

export const browserFactoryView: FactoryViewPort = {
  createBuildTarget(index, itemKey, item, itemGroups) {
    return new BuildTarget(index, itemKey, item, itemGroups)
  },

  mountBuildTarget(target) {
    d3.select("#targets").insert(() => target.element, "#plusButton")
  },

  removeBuildTarget(target) {
    d3.select(target.element).remove()
  },

  renderSolution(specification: any, totals) {
    displayItems(specification, totals)
    if (currentTab === "graph") {
      renderTotals(totals, specification.ignore)
    }
    reapTooltips()
  },

  renderCalculationError(specification: any, error) {
    displayCalculationError(specification, error)
    reapTooltips()
  },

  persistUrlState() {
    syncUrlHash(formatSettings())
  },

  renderDebug() {
    renderDebug()
  },
}

// -----------------------------------------------------------------------------
// Application bootstrap
// -----------------------------------------------------------------------------

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
  initializeFactoryDensity()
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

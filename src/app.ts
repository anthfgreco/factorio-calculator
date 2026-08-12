import { select, type BaseType, type Selection } from "d3"
import { bindCalculatorSpecification } from "./application/store.js"
import { parseCalculatorData } from "./data.js"
import { formatCanadianNumber, Matrix } from "./math.js"
import type { FactorySpecification, FactoryViewPort } from "./factory.js"
import { configureFactoryView, resetSpec, spec } from "./factory.js"
import {
  configureModelRuntime,
  getBelts,
  getBeaconPower,
  getBuildings,
  getFuel,
  getItemGroups,
  getModules,
  getQualities,
  getPlanets,
  getRecipeProductivityResearch,
} from "./models.js"
import { getSprites, initializeTooltips, reapTooltips } from "./presentation.js"
import { Item, Recipe, getItems, getRecipes } from "./recipes.js"
import type { Totals } from "./solver.js"
import { displayCalculationError, displayItems, resetDisplay } from "./results.js"
import { ensureDeferredResourcesRendered, ensureDeferredSettingsRendered, renderSettings } from "./settings.js"
import {
  configureDatasetChangeHandler,
  configureDeferredTabHandler,
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

// -----------------------------------------------------------------------------
// Debug output
// -----------------------------------------------------------------------------

interface DebugMetadata {
  readonly items: readonly Item[]
  readonly targets: readonly { readonly item: Item; readonly recipe: Recipe }[]
  readonly recipes: readonly Recipe[]
}

function isDebugMetadata(value: unknown): value is DebugMetadata {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => item instanceof Item) &&
    Array.isArray(candidate.targets) &&
    candidate.targets.every(
      (target) =>
        typeof target === "object" &&
        target !== null &&
        (target as { item?: unknown }).item instanceof Item &&
        (target as { recipe?: unknown }).recipe instanceof Recipe,
    ) &&
    Array.isArray(candidate.recipes) &&
    candidate.recipes.every((recipe) => recipe instanceof Recipe)
  )
}

function renderMatrix<GElement extends BaseType, TDatum, PElement extends BaseType, PDatum>(
  d: Selection<GElement, TDatum, PElement, PDatum>,
  A: Matrix,
  m: DebugMetadata,
): void {
  let table = d.append("table").attr("border", 1)
  let header = table.append("tr")
  header.append("th")
  for (let item of m.items) {
    let th = header.append("th")
    th.append("span").text("s")
    th.append(() => item.icon.make(32)).classed("item-icon", true)
  }
  for (let t of m.targets) {
    let th = header.append("th")
    th.append(() => t.item.icon.make(32))
    th.append("span").text("\u21d0")
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
    const recipe = m.recipes[r]
    if (recipe !== undefined) {
      label.append(() => recipe.icon.make(32)).classed("item-icon", true)
    } else if (r === A.rows - 2) {
      label.append("span").text("tax")
    } else {
      label.append("span").text("answer")
    }
    for (let c = 0; c < A.cols; c++) {
      let x = A.index(r, c)
      row.append("td").classed("right-align", true).append("tt").text(formatCanadianNumber(x.toString()))
    }
  }
}

export function renderDebug(): void {
  let debugTab = select("#debug_tab")

  let lastTableau = select("#debug_tableau")
  lastTableau.selectChildren().remove()
  let lastSolution = select("#debug_solution")
  lastSolution.selectChildren().remove()

  if (spec.lastTableau === null || spec.lastSolution === null || !isDebugMetadata(spec.lastMetadata)) {
    select("#debug_message").text("No tableau required.")
  } else {
    select("#debug_message").text("Displaying previous tableau.")
    renderMatrix(lastTableau, spec.lastTableau, spec.lastMetadata)
    renderMatrix(lastSolution, spec.lastSolution, spec.lastMetadata)
  }
}

// -----------------------------------------------------------------------------
// Deferred visualization runtime
// -----------------------------------------------------------------------------

type VisualizationModule = typeof import("./visualization.js")

let visualizationModule: VisualizationModule | null = null
let visualizationPromise: Promise<VisualizationModule> | null = null
let pendingVisualization: { totals: Totals; ignore: Set<Item> } | null = null

function loadVisualization(): Promise<VisualizationModule> {
  if (visualizationModule !== null) {
    return Promise.resolve(visualizationModule)
  }
  visualizationPromise ??= import("./visualization.js")
    .then((module) => {
      visualizationModule = module
      return module
    })
    .catch((error) => {
      visualizationPromise = null
      throw error
    })
  return visualizationPromise
}

function renderVisualization(totals: Totals, ignore: Set<Item>): void {
  if (visualizationModule !== null) {
    visualizationModule.renderTotals(totals, ignore)
    return
  }
  pendingVisualization = { totals, ignore }
  void loadVisualization().then((module) => {
    const pending = pendingVisualization
    pendingVisualization = null
    if (pending !== null && currentTab === "graph") {
      module.renderTotals(pending.totals, pending.ignore)
    }
  })
}

// -----------------------------------------------------------------------------
// Browser factory view
// -----------------------------------------------------------------------------

function requireBrowserBuildTarget(target: ReturnType<FactoryViewPort["createBuildTarget"]>): BuildTarget {
  if (!(target instanceof BuildTarget)) {
    throw new Error("The browser renderer received a non-browser production target")
  }
  return target
}

export const browserFactoryView: FactoryViewPort = {
  createBuildTarget(index, itemKey, item, itemGroups) {
    return new BuildTarget(index, itemKey, item, itemGroups)
  },

  mountBuildTarget(target) {
    const browserTarget = requireBrowserBuildTarget(target)
    select("#targets").insert(() => browserTarget.element, "#plusButton")
  },

  removeBuildTarget(target) {
    const browserTarget = requireBrowserBuildTarget(target)
    select(browserTarget.element).remove()
  },

  renderSolution(specification: FactorySpecification, totals: Totals) {
    displayItems(specification, totals)
    if (currentTab === "graph") {
      renderVisualization(totals, specification.ignore)
    }
    reapTooltips()
  },

  renderCalculationError(specification: FactorySpecification, error: unknown) {
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

function reset(): void {
  clearUrlHash()
  resetDisplay()
  resetSpec()
  bindCalculatorSpecification(spec)
  window.spec = spec
}

export function changeMod(): void {
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

function fixLegacySettings(settings: Map<string, string>): void {
  if ((settings.has("use_3") || settings.has("min") || settings.has("furnace")) && !settings.has("buildings")) {
    const parts: string[] = []
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
    const furnace = settings.get("furnace")
    if (furnace !== undefined) {
      parts.push(furnace)
      settings.delete("furnace")
    }
    settings.set("buildings", parts.join(","))
  }
  if ((settings.has("k") || settings.has("p")) && !settings.has("disable")) {
    const parts: string[] = []
    if (settings.has("k")) {
      settings.delete("k")
      parts.push("kovarex-processing")
    }
    if (settings.has("p")) {
      let p = settings.get("p")
      for (const recipeKey of OIL_EXCLUSION.get(p ?? "") ?? []) {
        parts.push(recipeKey)
      }
      settings.delete("p")
    }
    settings.set("disable", parts.join(","))
  }
}

const dataRequests = new Map<string, Promise<unknown>>()

function fetchData(filename: string): Promise<unknown> {
  let request = dataRequests.get(filename)
  if (request !== undefined) {
    return request
  }
  request = fetch(filename, { cache: "force-cache", credentials: "same-origin" }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<unknown>
  })
  dataRequests.set(filename, request)
  return request
}

let loadGeneration = 0

function loadData(modName: string, settings: Map<string, string>): void {
  const generation = ++loadGeneration
  const mod = MODIFICATIONS.get(modName)
  if (mod === undefined) throw new Error(`Unknown dataset: ${modName}`)
  setLegacyCalculation(mod.legacy)
  const filename = "data/" + mod.filename
  void fetchData(filename)
    .then((rawData: unknown) => {
      if (generation !== loadGeneration) return
      const data = parseCalculatorData(rawData)
      const items = getItems(data)
      const recipes = getRecipes(data, items)
      const buildings = getBuildings(data, items)
      const planets = getPlanets(data, recipes, buildings)
      const modules = getModules(data, items)
      const qualities = getQualities(data)
      const belts = getBelts(data)
      const fuel = getFuel(data, items)
      const recipeProductivityResearch = getRecipeProductivityResearch(data, recipes)
      getSprites(data)
      const itemGroups = getItemGroups(items, data)
      spec.setData(
        items,
        recipes,
        planets,
        modules,
        buildings,
        belts,
        fuel,
        itemGroups,
        recipeProductivityResearch,
        getBeaconPower(data),
        qualities,
      )

      fixLegacySettings(settings)
      renderSettings(settings)

      spec.updateSolution()
      finishUrlInitialization()
    })
    .catch((error: unknown) => {
      if (generation !== loadGeneration) return
      spec.lastTotals = null
      spec.lastError = error
      spec.display()
    })
}

let initialized = false

function handleUrlHashChange(): void {
  const newHash = window.location.hash
  if (newHash === `#${formatSettings()}`) {
    return
  }
  const settings = loadSettings(newHash)
  renderDataSetOptions(settings)
  reset()
  loadData(currentMod(), settings)
}

export function init(): void {
  if (initialized) {
    return
  }
  initialized = true
  initializeFactoryDensity()
  initializeTooltips()
  configureFactoryView(browserFactoryView)
  configureDatasetChangeHandler(changeMod)
  configureDeferredTabHandler((tabName) => {
    if (tabName === "settings") {
      ensureDeferredSettingsRendered()
    } else {
      ensureDeferredResourcesRendered()
    }
  })
  window.spec = spec
  configureModelRuntime({
    getSpecification: () => spec,
    useLegacyCalculation: usesLegacyCalculation,
  })
  initializeUrlState()
  let settings = loadSettings(window.location.hash)
  renderDataSetOptions(settings)
  loadData(currentMod(), settings)

  window.addEventListener("hashchange", handleUrlHashChange)
  window.addEventListener("popstate", handleUrlHashChange)
}

export function dispose(): void {
  if (!initialized) return
  initialized = false
  loadGeneration++
  window.removeEventListener("hashchange", handleUrlHashChange)
  window.removeEventListener("popstate", handleUrlHashChange)
}

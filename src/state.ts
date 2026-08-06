import { select, selectAll } from "d3"
import {
  isProgressionPreset,
  type CalculatorTab,
  type FactoryDensity,
  type PlanningSettingValue,
  type ProgressionPreset,
} from "./application/contracts.js"
import { spec } from "./factory.js"
import { type DisplayFormat, Rational } from "./math.js"
import { Building, Planet } from "./models.js"
import type { Item } from "./recipes.js"

// -----------------------------------------------------------------------------
// Document title
// -----------------------------------------------------------------------------

export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(title: string) {
  document.title = title === "" ? DEFAULT_TITLE : title
}

export type { FactoryDensity } from "./application/contracts.js"

const FACTORY_DENSITY_STORAGE_KEY = "factorio-calculator-factory-density"
const DEFAULT_FACTORY_DENSITY: FactoryDensity = "compact"

export let factoryDensity: FactoryDensity = DEFAULT_FACTORY_DENSITY

function isFactoryDensity(value: string | null): value is FactoryDensity {
  return value === "comfortable" || value === "compact"
}

export function setFactoryDensity(value: FactoryDensity): void {
  factoryDensity = value
  document.documentElement.dataset.factoryDensity = value
  document.querySelectorAll<HTMLInputElement>('input[name="factory_density"]').forEach((input) => {
    input.checked = input.value === value
  })
  try {
    window.localStorage.setItem(FACTORY_DENSITY_STORAGE_KEY, value)
  } catch {
    // Storage may be disabled. The selected density still applies immediately.
  }
}

export function initializeFactoryDensity() {
  let storedDensity: string | null = null
  try {
    storedDensity = window.localStorage.getItem(FACTORY_DENSITY_STORAGE_KEY)
  } catch {
    // Storage may be disabled. The control still works for the current page.
  }
  setFactoryDensity(isFactoryDensity(storedDensity) ? storedDensity : DEFAULT_FACTORY_DENSITY)
}

export function changeFactoryDensity(event: Event) {
  let input = event.target
  if (!(input instanceof HTMLInputElement) || !isFactoryDensity(input.value)) {
    return
  }
  setFactoryDensity(input.value)
}

export type { ProgressionPreset } from "./application/contracts.js"

type PresetDefinition = {
  planets: string[]
  miningProductivity: number
  belt: string
  beltStackSize: number
  maxQualityLevel: number
  defaultMachines: string[]
}

const PROGRESSION_PRESETS: Record<ProgressionPreset, PresetDefinition> = {
  early: {
    planets: ["nauvis"],
    miningProductivity: 0,
    belt: "transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 0,
    defaultMachines: ["assembling-machine-1", "chemical-plant", "stone-furnace", "electric-mining-drill"],
  },
  "pre-rocket": {
    planets: ["nauvis"],
    miningProductivity: 20,
    belt: "fast-transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 0,
    defaultMachines: ["assembling-machine-2", "chemical-plant", "steel-furnace", "electric-mining-drill"],
  },
  "first-planets": {
    planets: ["nauvis", "space-platform"],
    miningProductivity: 30,
    belt: "express-transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 2,
    defaultMachines: [
      "assembling-machine-3",
      "chemical-plant",
      "foundry",
      "electromagnetic-plant",
      "biochamber",
      "electric-furnace",
      "electric-mining-drill",
    ],
  },
  "late-space-age": {
    planets: ["nauvis", "vulcanus", "fulgora", "gleba", "aquilo", "space-platform"],
    miningProductivity: 100,
    belt: "turbo-transport-belt",
    beltStackSize: 4,
    maxQualityLevel: 4,
    defaultMachines: [
      "assembling-machine-3",
      "chemical-plant",
      "foundry",
      "electromagnetic-plant",
      "biochamber",
      "cryogenic-plant",
      "electric-furnace",
      "big-mining-drill",
    ],
  },
  megabase: {
    planets: ["nauvis", "vulcanus", "fulgora", "gleba", "aquilo", "space-platform"],
    miningProductivity: 300,
    belt: "turbo-transport-belt",
    beltStackSize: 4,
    maxQualityLevel: 4,
    defaultMachines: [
      "assembling-machine-3",
      "chemical-plant",
      "foundry",
      "electromagnetic-plant",
      "biochamber",
      "cryogenic-plant",
      "electric-furnace",
      "big-mining-drill",
    ],
  },
}

function getByKey<TKey, TValue>(collection: ReadonlyMap<TKey, TValue> | null, key: TKey | null): TValue | null {
  if (collection === null || key === null) return null
  return collection.get(key) ?? null
}

function getBoundDatum(element: Element): unknown {
  return (element as Element & { readonly __data__?: unknown }).__data__
}

function getEventInput(event: Event): HTMLInputElement | null {
  return event.target instanceof HTMLInputElement ? event.target : null
}

function getEventSelect(event: Event): HTMLSelectElement | null {
  return event.target instanceof HTMLSelectElement ? event.target : null
}

function getEventControl(event: Event): HTMLInputElement | HTMLSelectElement | null {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement ? event.target : null
}

function syncProgressionControls(): void {
  document.querySelectorAll<HTMLInputElement>('#belt_selector input[type="radio"]').forEach((input) => {
    input.checked = input.value === spec.belt?.key
  })

  let beltStack = document.getElementById("belt_stack_size") as HTMLSelectElement | null
  if (beltStack !== null) beltStack.value = spec.beltStackSize.toString()
  let maxQuality = document.getElementById("max_quality") as HTMLSelectElement | null
  if (maxQuality !== null) maxQuality.value = String(spec.maxQualityLevel)

  document.querySelectorAll<HTMLInputElement>('#building_selector input[type="checkbox"]').forEach((input) => {
    const building = getBoundDatum(input)
    input.checked = building instanceof Building && spec.isAutomaticBuildingEnabled(building)
  })
}

export function applyProgressionPresetValue(value: ProgressionPreset): void {
  const preset = PROGRESSION_PRESETS[value]

  spec.selectedPlanets.clear()
  for (let key of preset.planets) {
    let planet = getByKey(spec.planets, key)
    if (planet !== null) spec.selectPlanet(planet)
  }
  if (spec.selectedPlanets.size === 0 && spec.planets !== null && spec.planets.size > 0) {
    const firstPlanet = spec.planets.values().next().value
    if (firstPlanet !== undefined) spec.selectPlanet(firstPlanet)
  }

  spec.miningProd = Rational.from_float(preset.miningProductivity / 100)
  let belt = getByKey(spec.belts, preset.belt)
  if (belt !== null) spec.belt = belt
  spec.beltStackSize = Rational.from_float(preset.beltStackSize)
  spec.maxQualityLevel = preset.maxQualityLevel
  for (let target of spec.buildTargets) {
    target.setQuality(target.qualityLevel)
  }

  spec.clearBuildingOverrides()
  spec.setAutomaticBuildingPreferences(
    preset.defaultMachines.map((key) => getByKey(spec.buildingKeys, key)).filter((building) => building !== null),
  )

  document.querySelectorAll<HTMLElement>("#planet_selector .toggle").forEach((toggle) => {
    const location = getBoundDatum(toggle)
    const selected = location instanceof Planet && spec.selectedPlanets.has(location)
    toggle.classList.toggle("selected", selected)
    toggle.setAttribute("aria-pressed", String(selected))
  })

  syncMiningProductivityControls()
  syncProgressionControls()
  spec.updateSolution()
}

export function applyProgressionPreset(event: Event): void {
  const select = event.target
  if (!(select instanceof HTMLSelectElement) || !isProgressionPreset(select.value)) return
  applyProgressionPresetValue(select.value)
}

export type { PlanningSettingValue } from "./application/contracts.js"

export function setPlanningSetting(input: PlanningSettingValue): void {
  switch (input.id) {
    case "belt_stack_size":
      spec.beltStackSize = Rational.from_string(input.value)
      break
    case "buffer_minutes":
      spec.bufferMinutes = Rational.max(Rational.from_float(0), Rational.from_string(input.value || "0"))
      break
    case "freshness_delay":
      spec.freshnessDelayMinutes = Rational.max(Rational.from_float(0), Rational.from_string(input.value || "0"))
      break
    case "max_quality":
      spec.maxQualityLevel = Number(input.value)
      for (let target of spec.buildTargets) {
        target.setQuality(target.qualityLevel)
      }
      break
    default: {
      const resourceKey = input.resourceKey
      if (resourceKey) {
        let recipe = spec.recipes.get(resourceKey)
        if (recipe)
          spec.setResourceYield(recipe, Rational.from_string(input.value || "100").div(Rational.from_float(100)))
        break
      }
      const itemKey = input.itemKey
      if (!itemKey) return
      if (input.value === "") spec.asteroidLimits.delete(itemKey)
      else spec.asteroidLimits.set(itemKey, Rational.from_string(input.value).div(spec.format.rateFactor))
    }
  }
  spec.updateSolution()
}

export function changePlanningSetting(event: Event): void {
  const input = getEventControl(event)
  if (input === null) return
  setPlanningSetting({
    id: input.id,
    value: input.value,
    resourceKey: input.dataset.resourceKey,
    itemKey: input.dataset.itemKey,
  })
}

// -----------------------------------------------------------------------------
// UI actions
// -----------------------------------------------------------------------------

// build target events

export function plusHandler(): void {
  spec.addTarget()
  spec.updateSolution()
}

let shareStatusTimer: ReturnType<typeof setTimeout> | null = null

function setShareStatus(message: string): void {
  let status = document.getElementById("share_status")
  if (status === null) {
    return
  }
  status.textContent = message
  if (shareStatusTimer !== null) {
    clearTimeout(shareStatusTimer)
  }
  shareStatusTimer = setTimeout(() => {
    status.textContent = ""
    shareStatusTimer = null
  }, 2500)
}

function fallbackCopyText(text: string): void {
  let input = document.createElement("textarea")
  input.value = text
  input.setAttribute("readonly", "")
  input.style.position = "fixed"
  input.style.opacity = "0"
  document.body.appendChild(input)
  input.select()
  let copied = document.execCommand("copy")
  input.remove()
  if (!copied) {
    throw new Error("The browser did not allow clipboard access.")
  }
}

export async function copyShareLink(): Promise<void> {
  spec.persistUrlState()
  let url = window.location.href
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      fallbackCopyText(url)
    }
    setShareStatus("Plan link copied.")
  } catch {
    setShareStatus("Could not copy automatically. Copy the URL from the address bar.")
  }
}

// tab events

export type { CalculatorTab } from "./application/contracts.js"

export const DEFAULT_TAB: CalculatorTab = "totals"

export let currentTab: CalculatorTab = DEFAULT_TAB

function isCalculatorTab(value: string): value is CalculatorTab {
  return (
    value === "totals" ||
    value === "graph" ||
    value === "settings" ||
    value === "resources" ||
    value === "debug" ||
    value === "help"
  )
}

let onDeferredTabOpened: (tabName: string) => void = () => undefined

export function configureDeferredTabHandler(handler: (tabName: string) => void): void {
  onDeferredTabOpened = handler
}

export function clickTab(requestedTab: string): void {
  const candidate =
    requestedTab === "about" || requestedTab === "faq" || requestedTab === "changelog" ? "help" : requestedTab
  const tabName: CalculatorTab =
    isCalculatorTab(candidate) && document.getElementById(candidate + "_tab") !== null ? candidate : DEFAULT_TAB
  currentTab = tabName
  selectAll(".tab").style("display", "none")
  selectAll(".tab_button, .toolbar-tab-button").classed("active", false)
  select("#" + tabName + "_tab").style("display", "block")
  select("#" + tabName + "_button").classed("active", true)
  document.getElementById("factory_tab_tools")?.toggleAttribute("hidden", tabName !== "totals")
  if (tabName === "settings" || tabName === "resources") {
    onDeferredTabOpened(tabName)
  }
  spec.setHash()
  spec.notifyStateChanged()
}

export function clickVisualize(): void {
  clickTab("graph")
  spec.display()
}

// shared events

export function toggleIgnoreHandler(_event: Event, datum: { readonly item: Item }): void {
  spec.toggleIgnore(datum.item)
  spec.updateSolution()
}

// setting events

export function setCalculatorTitle(value: string): void {
  setTitle(value)
  spec.setHash()
  spec.notifyStateChanged()
}

export function changeTitle(event: Event): void {
  const input = getEventInput(event)
  if (input !== null) setCalculatorTitle(input.value)
}

export function setRatePrecision(value: number): void {
  if (!Number.isInteger(value) || value < 0) return
  spec.format.ratePrecision = value
  spec.display()
}

export function changeRatePrecision(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) setRatePrecision(Number(input.value))
}

export function setCountPrecision(value: number): void {
  if (!Number.isInteger(value) || value < 0) return
  spec.format.countPrecision = value
  spec.display()
}

export function changeCountPrecision(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) setCountPrecision(Number(input.value))
}

export function setDisplayFormat(value: DisplayFormat): void {
  spec.format.displayFormat = value
  spec.display()
}

export function changeFormat(event: Event): void {
  const input = getEventControl(event)
  if (input === null || (input.value !== "decimal" && input.value !== "rational")) return
  setDisplayFormat(input.value)
}

export function setMiningProductivityPercent(value: string): void {
  spec.miningProd = Rational.from_string(value).div(Rational.from_float(100))
  syncMiningProductivityControls()
  spec.updateSolution()
}

export function changeMprod(event: Event): void {
  const input = getEventInput(event)
  if (input !== null) setMiningProductivityPercent(input.value)
}

export function syncMiningProductivityControls(): void {
  let value = spec.miningProd.mul(Rational.from_integer(100)).toDecimal()
  let input = document.getElementById("mprod") as HTMLInputElement | null
  if (input !== null) input.value = value
}

// visualizer events

export function changeVisualizationType(value: string): void {
  setVisualizerType(value)
  const direction = getDefaultVisualizerDirection()
  setVisualizerDirection(direction)
  select(`#${direction}_direction`).property("checked", true)
  spec.display()
}

export function changeVisType(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) changeVisualizationType(input.value)
}

export function changeVisualizationRender(value: string): void {
  setVisualizerRender(value)
  spec.display()
}

export function changeVisRender(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) changeVisualizationRender(input.value)
}

export function changeVisualizationDirection(value: string): void {
  setVisualizerDirection(value)
  spec.display()
}

export function changeVisDir(event: Event): void {
  const input = getEventControl(event)
  if (input !== null) changeVisualizationDirection(input.value)
}

export function setDebugEnabled(enabled: boolean): void {
  spec.debug = enabled
  spec.display()
}

// debug events
export function toggleDebug(event: Event): void {
  const input = getEventInput(event)
  if (input !== null) setDebugEnabled(input.checked)
}

// -----------------------------------------------------------------------------
// Dataset selection
// -----------------------------------------------------------------------------

class Modification {
  constructor(
    readonly name: string,
    readonly filename: string,
    readonly legacy: boolean,
  ) {}
}

export const MODIFICATIONS = new Map([
  // 2.1.14 has no calculator-relevant prototype changes, so it intentionally reuses the 2.1.13 export and URL key.
  ["space-age-2-1-13", new Modification("Space Age 2.1.14 (EXPERIMENTAL)", "space-age-2.1.13.json", false)],
  ["2-0-55", new Modification("Vanilla 2.0.55", "vanilla-2.0.55.json", false)],
  ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
  ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
  ["space-age-2-0-55", new Modification("Space Age 2.0.55", "space-age-2.0.55.json", false)],
])

const DEFAULT_MODIFICATION = "space-age-2-1-13"
const modificationUpdates = new Map([
  ["space-age-2-1-12", "space-age-2-1-13"],
  ["2-0-6", "2-0-55"],
  ["2-0-7", "2-0-55"],
  ["2-0-10", "2-0-55"],
  ["1-1-19", "1-1-110"],
  ["1-1-19x", "1-1-110x"],
  ["space-age-2-0-10", "space-age-2-0-55"],
  ["space-age-2-0-11", "space-age-2-0-55"],
])

let onModificationChanged: () => void = () => {
  throw new Error("Dataset change handler has not been configured")
}

export function configureDatasetChangeHandler(handler: () => void): void {
  onModificationChanged = handler
}

function normalizeDataSetName(name: string | undefined): string {
  const updatedName = name === undefined ? undefined : (modificationUpdates.get(name) ?? name)
  return updatedName !== undefined && MODIFICATIONS.has(updatedName) ? updatedName : DEFAULT_MODIFICATION
}

export function renderDataSetOptions(settings: Map<string, string>): void {
  const selector = document.getElementById("data_set") as HTMLSelectElement
  select(selector).on("change", () => onModificationChanged())
  const configuredModification = normalizeDataSetName(settings.get("data"))
  selector.replaceChildren()
  for (const [key, modification] of MODIFICATIONS) {
    const option = document.createElement("option")
    option.textContent = modification.name
    option.value = key
    option.selected = key === configuredModification
    selector.appendChild(option)
  }
}

export function currentMod(): string {
  return (document.getElementById("data_set") as HTMLSelectElement).value
}

// -----------------------------------------------------------------------------
// Visualization state
// -----------------------------------------------------------------------------

export const DEFAULT_VISUALIZER = "sankey"
export const DEFAULT_RENDER = "zoom"

export let visualizerType = DEFAULT_VISUALIZER
export let visualizerRender = DEFAULT_RENDER
export let visualizerDirection = getDefaultVisualizerDirection()

export function setVisualizerType(value: string): void {
  visualizerType = value
}

export function setVisualizerRender(value: string): void {
  visualizerRender = value
}

export function setVisualizerDirection(value: string): void {
  visualizerDirection = value
}

export function getDefaultVisualizerDirection(): string {
  return visualizerType === "sankey" ? "right" : "down"
}

export function isDefaultVisualizerDirection(): boolean {
  return visualizerDirection === getDefaultVisualizerDirection()
}

// -----------------------------------------------------------------------------
// Calculation mode
// -----------------------------------------------------------------------------

let legacyCalculation = false

export function setLegacyCalculation(value: boolean): void {
  legacyCalculation = value
}

export function usesLegacyCalculation(): boolean {
  return legacyCalculation
}

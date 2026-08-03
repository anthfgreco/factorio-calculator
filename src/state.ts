import * as d3Package from "d3"
const d3: any = d3Package
import { spec } from "./factory.js"
import { Rational } from "./math.js"

// -----------------------------------------------------------------------------
// Document title
// -----------------------------------------------------------------------------

export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(title: string) {
  document.title = title === "" ? DEFAULT_TITLE : title
}

export type FactoryDensity = "comfortable" | "compact"

const FACTORY_DENSITY_STORAGE_KEY = "factorio-calculator-factory-density"
const DEFAULT_FACTORY_DENSITY: FactoryDensity = "compact"

export let factoryDensity: FactoryDensity = DEFAULT_FACTORY_DENSITY

function isFactoryDensity(value: string | null): value is FactoryDensity {
  return value === "comfortable" || value === "compact"
}

function applyFactoryDensity(value: FactoryDensity) {
  factoryDensity = value
  document.documentElement.dataset.factoryDensity = value
  document.querySelectorAll<HTMLInputElement>('input[name="factory_density"]').forEach((input) => {
    input.checked = input.value === value
  })
}

export function initializeFactoryDensity() {
  let storedDensity: string | null = null
  try {
    storedDensity = window.localStorage.getItem(FACTORY_DENSITY_STORAGE_KEY)
  } catch {
    // Storage may be disabled. The control still works for the current page.
  }
  applyFactoryDensity(isFactoryDensity(storedDensity) ? storedDensity : DEFAULT_FACTORY_DENSITY)
}

export function changeFactoryDensity(event: Event) {
  let input = event.target
  if (!(input instanceof HTMLInputElement) || !isFactoryDensity(input.value)) {
    return
  }
  applyFactoryDensity(input.value)
  try {
    window.localStorage.setItem(FACTORY_DENSITY_STORAGE_KEY, input.value)
  } catch {
    // Ignore storage failures; the selected density still applies immediately.
  }
}

export type ProgressionPreset = "early" | "pre-rocket" | "first-planets" | "late-space-age" | "megabase"

type PresetDefinition = {
  planets: string[]
  miningProductivity: number
  belt: string
  module: string | null
  beaconModule: string | null
  beaconCount: number
}

const PROGRESSION_PRESETS: Record<ProgressionPreset, PresetDefinition> = {
  early: {
    planets: ["nauvis"],
    miningProductivity: 0,
    belt: "transport-belt",
    module: null,
    beaconModule: null,
    beaconCount: 0,
  },
  "pre-rocket": {
    planets: ["nauvis"],
    miningProductivity: 20,
    belt: "fast-transport-belt",
    module: "productivity-module",
    beaconModule: null,
    beaconCount: 0,
  },
  "first-planets": {
    planets: ["nauvis", "vulcanus", "fulgora", "gleba"],
    miningProductivity: 50,
    belt: "express-transport-belt",
    module: "productivity-module-2",
    beaconModule: "speed-module-2",
    beaconCount: 4,
  },
  "late-space-age": {
    planets: ["nauvis", "vulcanus", "fulgora", "gleba", "aquilo", "space-platform"],
    miningProductivity: 100,
    belt: "turbo-transport-belt",
    module: "productivity-module-3",
    beaconModule: "speed-module-3",
    beaconCount: 8,
  },
  megabase: {
    planets: ["nauvis", "vulcanus", "fulgora", "gleba", "aquilo", "space-platform"],
    miningProductivity: 300,
    belt: "turbo-transport-belt",
    module: "productivity-module-3",
    beaconModule: "speed-module-3",
    beaconCount: 12,
  },
}

function getByKey(collection: Map<any, any> | null, key: string | null) {
  if (collection === null || key === null) return null
  return collection.get(key) ?? null
}

function syncProgressionPresetControls() {
  document.querySelectorAll<HTMLInputElement>('#belt_selector input[type="radio"]').forEach((input) => {
    input.checked = input.value === spec.belt?.key
  })

  document
    .querySelectorAll<HTMLInputElement>(
      '#default_module input[type="radio"], #secondary_module input[type="radio"], #default_beacon input[type="radio"]',
    )
    .forEach((input) => {
      let datum = (input as HTMLInputElement & { __data__?: { checked?: () => boolean } }).__data__
      input.checked = datum?.checked?.() ?? false
    })

  let beaconCount = document.getElementById("default_beacon_count") as HTMLInputElement | null
  if (beaconCount !== null) beaconCount.value = spec.defaultBeaconCount.toDecimal()
}

export function applyProgressionPreset(event: Event) {
  let select = event.target
  if (!(select instanceof HTMLSelectElement) || !(select.value in PROGRESSION_PRESETS)) return
  let preset = PROGRESSION_PRESETS[select.value as ProgressionPreset]

  spec.selectedPlanets.clear()
  for (let key of preset.planets) {
    let planet = getByKey(spec.planets, key)
    if (planet !== null) spec.selectPlanet(planet)
  }
  if (spec.selectedPlanets.size === 0 && spec.planets?.size) {
    spec.selectPlanet(spec.planets.values().next().value)
  }

  spec.miningProd = Rational.from_float(preset.miningProductivity / 100)
  let belt = getByKey(spec.belts, preset.belt)
  if (belt !== null) spec.belt = belt
  spec.defaultModule = getByKey(spec.modules, preset.module)
  spec.secondaryDefaultModule = null
  spec.defaultBeacon = [getByKey(spec.modules, preset.beaconModule), getByKey(spec.modules, preset.beaconModule)]
  spec.defaultBeaconCount = Rational.from_float(preset.beaconCount)
  spec.spec.clear()

  document.querySelectorAll<HTMLElement>("#planet_selector .toggle").forEach((toggle: any) => {
    let location = toggle.__data__
    toggle.classList.toggle("selected", spec.selectedPlanets.has(location))
    toggle.setAttribute("aria-pressed", String(spec.selectedPlanets.has(location)))
  })
  let miningInput = document.getElementById("mprod") as HTMLInputElement | null
  if (miningInput !== null) miningInput.value = String(preset.miningProductivity)
  syncProgressionPresetControls()
  spec.updateSolution()
}

// -----------------------------------------------------------------------------
// UI actions
// -----------------------------------------------------------------------------

// build target events

export function plusHandler() {
  spec.addTarget()
  spec.updateSolution()
}

let shareStatusTimer: ReturnType<typeof setTimeout> | null = null

function setShareStatus(message: string) {
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

function fallbackCopyText(text: string) {
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

export async function copyShareLink() {
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

export const DEFAULT_TAB = "totals"

export let currentTab = DEFAULT_TAB

export function clickTab(tabName) {
  if (tabName === "about" || tabName === "faq" || tabName === "changelog") {
    tabName = "help"
  }
  if (document.getElementById(tabName + "_tab") === null) {
    tabName = DEFAULT_TAB
  }
  currentTab = tabName
  d3.selectAll(".tab").style("display", "none")
  d3.selectAll(".tab_button, .toolbar-tab-button").classed("active", false)
  d3.select("#" + tabName + "_tab").style("display", "block")
  d3.select("#" + tabName + "_button").classed("active", true)
  document.getElementById("factory_tab_tools")?.toggleAttribute("hidden", tabName !== "totals")
  spec.setHash()
}

export function clickVisualize() {
  clickTab("graph")
  spec.display()
}

// shared events

export function toggleIgnoreHandler(event, d) {
  spec.toggleIgnore(d.item)
  spec.updateSolution()
}

// setting events

export function changeTitle(event) {
  setTitle(event.target.value)
  spec.setHash()
}

export function changeRatePrecision(event) {
  spec.format.ratePrecision = Number(event.target.value)
  spec.display()
}

export function changeCountPrecision(event) {
  spec.format.countPrecision = Number(event.target.value)
  spec.display()
}

export function changeFormat(event) {
  spec.format.displayFormat = event.target.value
  spec.display()
}

export function changeMprod(event) {
  spec.miningProd = Rational.from_string(event.target.value).div(Rational.from_float(100))
  spec.updateSolution()
}

// visualizer events

export function changeVisType(event) {
  setVisualizerType(event.target.value)
  let direction = getDefaultVisualizerDirection()
  setVisualizerDirection(direction)
  d3.select(`#${direction}_direction`).property("checked", true)
  spec.display()
}

export function changeVisRender(event) {
  setVisualizerRender(event.target.value)
  spec.display()
}

export function changeVisDir(event) {
  setVisualizerDirection(event.target.value)
  spec.display()
}

// debug events
export function toggleDebug(event) {
  spec.debug = event.target.checked
  spec.display()
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
  ["space-age-2-1-12", new Modification("Space Age 2.1.12 (EXPERIMENTAL)", "space-age-2.1.12.json", false)],
  ["2-0-55", new Modification("Vanilla 2.0.55", "vanilla-2.0.55.json", false)],
  ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
  ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
  ["space-age-2-0-55", new Modification("Space Age 2.0.55", "space-age-2.0.55.json", false)],
])

const DEFAULT_MODIFICATION = "space-age-2-1-12"
const modificationUpdates = new Map([
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

export function configureDatasetChangeHandler(handler: () => void) {
  onModificationChanged = handler
}

function normalizeDataSetName(name: string | undefined) {
  const updatedName = name === undefined ? undefined : (modificationUpdates.get(name) ?? name)
  return updatedName !== undefined && MODIFICATIONS.has(updatedName) ? updatedName : DEFAULT_MODIFICATION
}

export function renderDataSetOptions(settings: Map<string, string>) {
  const selector = document.getElementById("data_set") as HTMLSelectElement
  d3.select(selector).on("change", () => onModificationChanged())
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

export function currentMod() {
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

export function setVisualizerType(value: string) {
  visualizerType = value
}

export function setVisualizerRender(value: string) {
  visualizerRender = value
}

export function setVisualizerDirection(value: string) {
  visualizerDirection = value
}

export function getDefaultVisualizerDirection() {
  return visualizerType === "sankey" ? "right" : "down"
}

export function isDefaultVisualizerDirection() {
  return visualizerDirection === getDefaultVisualizerDirection()
}

// -----------------------------------------------------------------------------
// Calculation mode
// -----------------------------------------------------------------------------

let legacyCalculation = false

export function setLegacyCalculation(value: boolean) {
  legacyCalculation = value
}

export function usesLegacyCalculation() {
  return legacyCalculation
}

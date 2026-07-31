import { spec } from "./factory.js"
import { Rational } from "./math.js"

// -----------------------------------------------------------------------------
// Document title
// -----------------------------------------------------------------------------

export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(title: string) {
  document.title = title === "" ? DEFAULT_TITLE : title
}

// -----------------------------------------------------------------------------
// UI actions
// -----------------------------------------------------------------------------

// build target events

export function plusHandler() {
  spec.addTarget()
  spec.updateSolution()
}

// tab events

export const DEFAULT_TAB = "totals"

export let currentTab = DEFAULT_TAB

export function clickTab(tabName) {
  currentTab = tabName
  d3.selectAll(".tab").style("display", "none")
  d3.selectAll(".tab_button").classed("active", false)
  d3.select("#" + tabName + "_tab").style("display", "block")
  d3.select("#" + tabName + "_button").classed("active", true)
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
  const updatedName = name === undefined ? undefined : modificationUpdates.get(name) ?? name
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

import { spec } from "../application/calculator/index.js"
import { Rational } from "../core/math/rational.js"
import { setTitle } from "./document-title.js"
import {
  getDefaultVisualizerDirection,
  setVisualizerDirection,
  setVisualizerRender,
  setVisualizerType,
} from "../visualization/config.js"

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

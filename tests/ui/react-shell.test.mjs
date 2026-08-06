import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:ui")
const { CalculatorShell } = await import(pathToFileURL(resolve(build, "react/CalculatorShell.js")).href)

const commands = new Proxy(
  {},
  {
    get: () => () => undefined,
  },
)

const snapshot = {
  revision: 1,
  datasetKey: "space-age-2-1-13",
  activeTab: "totals",
  factoryDensity: "compact",
  title: "Factorio Calculator",
  status: "ready",
  errorMessage: null,
  targets: [],
  settings: {
    ratePrecision: 3,
    countPrecision: 1,
    displayFormat: "decimal",
    miningProductivityPercent: "30",
    beltStackSize: "1",
    bufferMinutes: "1",
    freshnessDelayMinutes: "0",
    maxQualityLevel: 2,
    visualizationType: "sankey",
    visualizationRender: "zoom",
    visualizationDirection: "right",
    debugEnabled: false,
  },
}

const html = renderToStaticMarkup(createElement(CalculatorShell, { commands, snapshot }))

test("React shell renders the complete accessible calculator workflow", () => {
  for (const text of [
    "Production targets",
    "Choose an output, then set its quality, machine count, or production rate.",
    "Factory",
    "Visualize",
    "Resources",
    "Settings",
    "Help",
    "Early Space Age",
    "Established megabase",
    "Default module (all eligible slots)",
    "Recipe productivity is capped at +300% total; mining productivity is uncapped.",
    "Shift-click location buttons",
    "An ingredient is missing from the chain",
  ]) {
    assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("React shell preserves imperative mount points and snapshot-owned controls", () => {
  for (const id of [
    "targets",
    "factory_summary",
    "totals",
    "recipe_toggles",
    "resource_settings",
    "graph",
    "progression_preset",
    "title_setting",
    "mprod",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`))
  }
  assert.match(html, /id="factory_density_compact"[^>]*checked=""/)
  assert.match(html, /id="mprod"[^>]*value="30"/)
  assert.doesNotMatch(html, /\son(?:click|change|input)=/i)
})

import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:ui")
const { CalculatorView } = await import(pathToFileURL(resolve(build, "main.js")).href)

const commands = new Proxy(
  {},
  {
    get: () => () => undefined,
  },
)

const runtime = await setupSpaceAgeFactory()
runtime.specification.selectOnePlanet(runtime.planets.get("nauvis"))
const target = runtime.specification.addTarget("advanced-circuit")
target.setRate("1")
runtime.specification.updateSolution()
assert.equal(runtime.specification.lastError, null)
assert.ok(runtime.specification.lastTotals)

function snapshot(overrides = {}) {
  return {
    revision: 1,
    specification: runtime.specification,
    totals: runtime.specification.lastTotals,
    datasetKey: "space-age-2-1-13",
    activeTab: "totals",
    factoryDensity: "compact",
    colorSchemeKey: "default",
    visualizerType: "sankey",
    visualizerRender: "zoom",
    visualizerDirection: "right",
    title: "Factorio Calculator",
    shareStatus: "",
    status: "ready",
    errorMessage: null,
    ...overrides,
  }
}

function render(overrides = {}) {
  return renderToStaticMarkup(createElement(CalculatorView, { commands, snapshot: snapshot(overrides) }))
}

const factoryHtml = render()
const loadingHtml = render({ status: "loading" })
const settingsHtml = render({ activeTab: "settings" })
const graphHtml = render({ activeTab: "graph" })
const resourcesHtml = render({ activeTab: "resources" })
const helpHtml = render({ activeTab: "help" })
const errorHtml = render({ status: "error", errorMessage: "No production path" })

const qualityRuntime = await setupSpaceAgeFactory()
qualityRuntime.specification.selectOnePlanet(qualityRuntime.planets.get("vulcanus"))
qualityRuntime.specification.setMaxQualityLevel(4)
qualityRuntime.specification.qualityPlannerMiningModuleQuality = qualityRuntime.specification.qualities.get("normal")
qualityRuntime.specification.qualityPlannerMiningBeaconQuality = qualityRuntime.specification.qualities.get("normal")
const qualityTarget = qualityRuntime.specification.addTarget("iron-plate")
qualityTarget.setQuality(4)
qualityTarget.setQualityStrategy("auto")
qualityTarget.setRate("10")
qualityRuntime.specification.updateSolution()
assert.equal(qualityRuntime.specification.lastError, null)
assert.ok(qualityRuntime.specification.lastTotals)
const qualityHtml = renderToStaticMarkup(
  createElement(CalculatorView, {
    commands,
    snapshot: snapshot({
      specification: qualityRuntime.specification,
      totals: qualityRuntime.specification.lastTotals,
    }),
  }),
)

const lavaRuntime = await setupSpaceAgeFactory()
lavaRuntime.specification.selectOnePlanet(lavaRuntime.planets.get("vulcanus"))
const lavaTarget = lavaRuntime.specification.addTarget("metallurgic-science-pack")
lavaTarget.setRate("1000")
lavaRuntime.specification.updateSolution()
assert.equal(lavaRuntime.specification.lastError, null)
assert.ok(lavaRuntime.specification.lastTotals)
const lavaHtml = renderToStaticMarkup(
  createElement(CalculatorView, {
    commands,
    snapshot: snapshot({
      specification: lavaRuntime.specification,
      totals: lavaRuntime.specification.lastTotals,
    }),
  }),
)

test("React UI renders the complete calculator workflow from one specification", () => {
  for (const text of [
    "Production targets",
    "Factory",
    "Visualize",
    "Resources",
    "Settings",
    "Help",
    "Copy plan link",
    "Advanced circuit",
    "Factory summary",
    "Active recipes",
    "Machines to place",
    "Electric + beacon power",
    "Add Advanced circuit as a production target",
  ]) {
    assert.match(factoryHtml, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
  }
  assert.match(factoryHtml, /<style>/)
  assert.match(factoryHtml, /data-density="compact"/)
  assert.match(factoryHtml, /--accent:#ff7200/)
  assert.match(factoryHtml, /aria-label="Choose output for target 1: Advanced circuit"/)
  assert.match(factoryHtml, /data-target-item-picker="target-output:0"/)
  assert.doesNotMatch(factoryHtml, /aria-label="Search target outputs"/)
  assert.match(factoryHtml, /aria-label="Rate for Advanced circuit"/)
  assert.match(factoryHtml, /images\/icons\.svg#right/)
  assert.match(factoryHtml, /images\/icons\.svg#popout/)
  assert.match(
    factoryHtml,
    /<a[^>]+href="#[^"]+"[^>]+target="_blank"[^>]+rel="noopener noreferrer"[^>]+aria-label="Add Advanced circuit as a production target"/i,
  )
  assert.match(factoryHtml, /aria-label="Empty module slot"/)
  assert.match(factoryHtml, /aria-label="Choose a machine for Advanced circuit"/)
  assert.match(factoryHtml, /data-inline-equipment-picker="machine:advanced-circuit"/)
  assert.match(factoryHtml, /class="factory-table-scroll"/)
  assert.match(factoryHtml, /aria-haspopup="dialog"/)
  assert.doesNotMatch(factoryHtml, /role="dialog"/)
  assert.doesNotMatch(factoryHtml, /Equipment, modules, beacons, and location/)
  assert.match(factoryHtml, /data-item-key="light-oil" data-recipe-key="heavy-oil-cracking"/)
  assert.match(factoryHtml, /data-item-key="petroleum-gas" data-recipe-key="light-oil-cracking"/)
  assert.doesNotMatch(factoryHtml, /\son(?:click|change|input|mouseenter|mouseleave)=/i)
})

test("factory rows keep lava-melting machines with their primary products", () => {
  assert.match(lavaHtml, /data-item-key="molten-copper" data-recipe-key="molten-copper-from-lava"/)
  assert.match(lavaHtml, /data-item-key="molten-iron" data-recipe-key="molten-iron-from-lava"/)
  assert.match(lavaHtml, /data-item-key="stone"/)
  assert.doesNotMatch(lavaHtml, /data-item-key="stone" data-recipe-key="molten-(?:copper|iron)-from-lava"/)
})

test("React UI disables target addition only while loading", () => {
  assert.match(loadingHtml, />\+ Add target<\/button>/)
  assert.match(loadingHtml, /<button[^>]*disabled=""[^>]*>\+ Add target<\/button>/)
  assert.doesNotMatch(factoryHtml, /<button[^>]*disabled=""[^>]*>\+ Add target<\/button>/)
})

test("settings are native React controls grouped by user intent", () => {
  for (const text of [
    "Data",
    "Display",
    "Factory",
    "Equipment quality defaults",
    "Quality factory",
    "Machines",
    "Research",
    "Resource assumptions",
    "Recipes",
    "Search recipes",
    "Show unavailable recipes",
    "Changed only",
    "Recycling recipes",
    "Disable all recycling recipes",
  ]) {
    assert.match(settingsHtml, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
  }
  assert.match(settingsHtml, /aria-label="Plan title"/)
  assert.match(settingsHtml, /<select/)
  assert.match(settingsHtml, /type="checkbox"/)
  assert.doesNotMatch(settingsHtml, /tippy|dropdownWrapper|display-row/)
})

test("quality results render the selected mining beacon equipment on the optimized source row", () => {
  const beaconIndex = qualityHtml.indexOf('title="Normal Beacon"')
  assert.notEqual(beaconIndex, -1)
  const rowStart = qualityHtml.lastIndexOf("<tr", beaconIndex)
  const rowEnd = qualityHtml.indexOf("</tr>", beaconIndex)
  assert.notEqual(rowStart, -1)
  assert.notEqual(rowEnd, -1)
  const beaconRow = qualityHtml.slice(rowStart, rowEnd)
  assert.match(beaconRow, /0\.036 Legendary\/min per miner · score 16\.8/)
  assert.match(beaconRow, /title="Normal Beacon"/)
  assert.match(beaconRow, /title="Speed module 2 in beacon"/)
  assert.match(beaconRow, />×4<\/span>/)
})

test("visualizer is declarative SVG rendered by React", () => {
  assert.match(graphHtml, /<svg id="graph" role="img" aria-label="Factory recipe flow graph"/)
  assert.match(graphHtml, /<path /)
  assert.match(graphHtml, /<g transform="translate\(/)
  assert.match(graphHtml, /<image href="images\/sprite-sheet-[^"]+\.webp"/)
  assert.match(graphHtml, /processes · \d+ flows/)
  assert.match(graphHtml, />Flow</)
  assert.match(graphHtml, /Recipe graph/)
  assert.doesNotMatch(graphHtml, /xlink:href|class="node"|class="link"/)
})

test("resources, help, and errors are owned by the same React tree", () => {
  assert.match(resourcesHtml, /Drag resources between tiers/)
  assert.match(resourcesHtml, /less valuable/)
  assert.match(resourcesHtml, /more valuable/)
  assert.match(resourcesHtml, /Restore defaults/)
  assert.match(helpHtml, /Using the calculator/)
  assert.match(helpHtml, /Useful controls/)
  assert.match(helpHtml, /Something looks wrong\?/)
  assert.match(helpHtml, /Q-Key Module Pipette/)
  assert.doesNotMatch(helpHtml, /\bArchitecture\b|React owns|framework-free/)
  assert.match(errorHtml, /No production path/)
})

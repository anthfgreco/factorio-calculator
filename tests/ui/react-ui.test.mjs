import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:ui")
const { CalculatorView, aggregateRecyclerDisplayRows } = await import(pathToFileURL(resolve(build, "main.js")).href)

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
const errorHtml = render({
  status: "error",
  errorMessage: "No production path",
})

const qualityRuntime = await setupSpaceAgeFactory()
qualityRuntime.specification.selectOnePlanet(qualityRuntime.planets.get("vulcanus"))
qualityRuntime.specification.setMaxQualityLevel(4)
qualityRuntime.specification.qualityPlannerMiningModuleQuality = qualityRuntime.specification.qualities.get("normal")
qualityRuntime.specification.qualityPlannerMiningBeaconQuality = qualityRuntime.specification.qualities.get("normal")
const qualityTarget = qualityRuntime.specification.addTarget("calcite")
qualityTarget.setQuality(4)
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

test("quality results combine shared sushi recyclers and render their automatic equipment sprites", () => {
  const recyclerRows = [...qualityHtml.matchAll(/<tr[^>]*>.*?<\/tr>/g)]
    .map(([row]) => row)
    .filter((row) => row.includes("recycle: Calcite recycling"))
  assert.equal(recyclerRows.length, 1)
  const beaconRow = recyclerRows[0]
  assert.ok(beaconRow)
  assert.match(beaconRow, /recycle: Calcite recycling/)
  assert.match(beaconRow, /Normal–Epic/)
  assert.match(beaconRow, /title="Quality module 2"/)
  assert.match(beaconRow, /title="Normal Beacon"/)
  assert.match(beaconRow, /title="Speed module 2 in beacon"/)
  assert.doesNotMatch(beaconRow, /\d+× (?:L-)?(?:Q2|Speed2)/)
  assert.doesNotMatch(qualityHtml, /Reset to automatic|Machine quality for .* at|<details style="margin-top:4px"/)
})

test("recycler display rows represent physically shareable Stone recycler pools", () => {
  const plan = qualityRuntime.specification.qualityPlans[0]
  assert.ok(plan)
  const recycler = plan.operations.find((operation) => operation.kind === "recycle")
  assert.ok(recycler)
  const stoneRecycling = qualityRuntime.recipes.get("stone-recycling")
  assert.ok(stoneRecycling)
  const amount = (value) => qualityRuntime.math.Rational.from_integer(value)
  const stoneDisposals = Array.from({ length: 5 }, (_, qualityLevel) => ({
    ...recycler,
    recipe: stoneRecycling,
    kind: "dispose",
    qualityLevel,
    rate: amount(qualityLevel + 1),
    machineCount: amount(qualityLevel + 2),
    power: amount(qualityLevel + 3),
  }))

  const pooled = aggregateRecyclerDisplayRows(stoneDisposals, "vulcanus")
  assert.equal(pooled.length, 1)
  assert.deepEqual(pooled[0].qualityLevels, [0, 1, 2, 3, 4])
  assert.equal(pooled[0].rate.toString(), "15")
  assert.equal(pooled[0].machineCount.toString(), "20")
  assert.equal(pooled[0].power.toString(), "25")

  const differentModules = {
    ...stoneDisposals[0],
    configuration: {
      ...stoneDisposals[0].configuration,
      moduleQualities: stoneDisposals[0].configuration.moduleQualities.map((quality) =>
        qualityRuntime.specification.qualities.get(quality.key === "normal" ? "legendary" : "normal"),
      ),
    },
  }
  const differentBeacons = {
    ...stoneDisposals[1],
    configuration: {
      ...stoneDisposals[1].configuration,
      beaconCount: stoneDisposals[1].configuration.beaconCount.add(amount(1)),
    },
  }
  assert.equal(
    aggregateRecyclerDisplayRows([...stoneDisposals, differentModules, differentBeacons], "vulcanus").length,
    3,
  )

  const recycle = { ...stoneDisposals[0], kind: "recycle" }
  assert.equal(aggregateRecyclerDisplayRows([...stoneDisposals, recycle], "vulcanus").length, 2)

  const crafts = [
    { ...stoneDisposals[0], kind: "craft", qualityLevel: 0 },
    { ...stoneDisposals[1], kind: "craft", qualityLevel: 1 },
  ]
  assert.equal(aggregateRecyclerDisplayRows([...stoneDisposals, ...crafts], "vulcanus").length, 3)
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

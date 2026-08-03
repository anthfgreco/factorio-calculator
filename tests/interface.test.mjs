import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

test("player-facing controls stay close to the evidence they affect", async () => {
  const html = await readFile(resolve(root, "calc.html"), "utf8")
  const results = await readFile(resolve(root, "src/results.ts"), "utf8")

  const tabsStart = html.indexOf('<div class="tabs">')
  const tabsEnd = html.indexOf('<div id="graph_tab"')
  const density = html.indexOf('id="factory_tab_tools"')
  assert.ok(tabsStart !== -1 && tabsEnd !== -1 && density > tabsStart && density < tabsEnd)
  assert.ok(!html.includes("factory-view-toolbar"))
  assert.ok(html.includes('id="targets_title"'))
  assert.ok(html.includes('id="visualization_summary"'))
  assert.ok(html.includes("fluids use a 10:1 scale"))

  assert.ok(results.includes('classed("item-name", true)'))
  assert.ok(results.includes('new Header("Item", 2'))
  assert.ok(results.includes('new Header("Rate / " + spec.format.rateName'))
  assert.ok(results.includes('new Header("Belts", 1'))
  assert.ok(results.includes('new Header("Power", 1'))
  assert.ok(results.includes('classed("align-left"'))
  assert.ok(results.includes('classed("align-center"'))
  assert.ok(results.includes('classed("align-right"'))
  assert.ok(results.includes("if (x.isZero())"))
  assert.ok(results.includes('classed("target-output"'))
  assert.ok(results.includes("compatibleBuildings.length <= 1"))
  assert.ok(results.includes("option.displayBuilding.icon.make(32, true)"))
  assert.ok(results.includes('attr("aria-label", `Choose a machine for ${row.recipe.name}`)'))
})

test("factory rerenders clear machine controls from every reused result row", async () => {
  const results = await readFile(resolve(root, "src/results.ts"), "utf8")
  const machineCleanup = 'row.selectAll("td.building-icon > :not(.recipe-selector)").remove()'
  const buildingRows = "let buildingRow = row.filter((d) => d.building !== null)"

  assert.ok(results.includes(machineCleanup))
  assert.ok(results.indexOf(machineCleanup) < results.indexOf(buildingRows))
})

test("tooltips use Tippy for rich and text content without the legacy Popper runtime", async () => {
  const [html, globals, main, presentation, settings, results, ui, packageJson] = await Promise.all([
    readFile(resolve(root, "calc.html"), "utf8"),
    readFile(resolve(root, "src/globals.d.ts"), "utf8"),
    readFile(resolve(root, "src/main.ts"), "utf8"),
    readFile(resolve(root, "src/presentation.ts"), "utf8"),
    readFile(resolve(root, "src/settings.ts"), "utf8"),
    readFile(resolve(root, "src/results.ts"), "utf8"),
    readFile(resolve(root, "src/ui.ts"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ])

  assert.equal(JSON.parse(packageJson).dependencies["tippy.js"], "6.3.7")
  assert.ok(main.includes('import "tippy.js/dist/tippy.css"'))
  assert.ok(presentation.includes('import tippy, { delegate, hideAll } from "tippy.js"'))
  assert.ok(presentation.includes('target: "[data-tooltip]"'))
  assert.ok(presentation.includes("arrow: false"))
  assert.ok(presentation.includes("offset: [0, 4] as [number, number]"))
  assert.ok(!presentation.includes("offset: [0, 12]"))
  assert.ok(presentation.includes("this.instance = tippy(reference"))
  assert.ok(presentation.includes("export function makePopover"))
  assert.ok(presentation.includes("if (!suppressTooltip)"))
  assert.ok(results.includes("makePopover(details.node(), menu.node()"))
  assert.ok(results.includes('placement: "right-start"'))
  assert.ok(results.includes("row.item.icon.make(32, true)"))
  assert.ok(!presentation.includes("Popper.createPopper"))
  assert.ok(!globals.includes("const Popper"))
  assert.ok(!html.includes("third_party/popper.min.js"))
  assert.ok(!html.includes('id="tooltip_container"'))

  const tooltipMarkup = [html, presentation, settings, results, ui].join("\n")
  assert.ok(!tooltipMarkup.includes(' title="'))
  assert.ok(!tooltipMarkup.includes('.attr("title"'))
  assert.ok(!tooltipMarkup.includes('setAttribute("title"'))
})

test("dropdowns use Tippy positioning without the legacy fullscreen click catcher", async () => {
  const [presentation, dropdownStyles] = await Promise.all([
    readFile(resolve(root, "src/presentation.ts"), "utf8"),
    readFile(resolve(root, "src/styles/dropdown.css"), "utf8"),
  ])

  assert.ok(presentation.includes('trigger: "manual"'))
  assert.ok(presentation.includes('theme: "factorio-dropdown"'))
  assert.ok(presentation.includes('placement: "bottom-start"'))
  assert.ok(presentation.includes("instance.setContent(dropdownNode)"))
  assert.ok(!presentation.includes('classed("clicker"'))
  assert.ok(dropdownStyles.includes('.tippy-box[data-theme~="factorio-dropdown"]'))
  assert.ok(!dropdownStyles.includes("position: fixed"))
})

test("runtime libraries load from pnpm modules instead of classic vendored globals", async () => {
  const [html, globals, math, urlState, visualization, packageJson] = await Promise.all([
    readFile(resolve(root, "calc.html"), "utf8"),
    readFile(resolve(root, "src/globals.d.ts"), "utf8"),
    readFile(resolve(root, "src/math.ts"), "utf8"),
    readFile(resolve(root, "src/url-state.ts"), "utf8"),
    readFile(resolve(root, "src/visualization.ts"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ])
  const dependencies = JSON.parse(packageJson).dependencies

  for (const dependency of ["d3", "@dagrejs/dagre", "pako", "big-integer"]) {
    assert.ok(dependencies[dependency])
  }
  assert.ok(math.includes('from "big-integer"'))
  assert.ok(urlState.includes('from "pako"'))
  assert.ok(visualization.includes('from "@dagrejs/dagre"'))
  assert.ok(!html.includes("third_party/"))
  for (const globalName of ["BigInteger", "bigInt", "d3", "dagre", "pako"]) {
    assert.ok(!globals.includes(`const ${globalName}:`))
  }
})

test("progression presets keep Settings controls synchronized", async () => {
  const state = await readFile(resolve(root, "src/state.ts"), "utf8")
  assert.ok(state.includes("syncProgressionPresetControls()"))
  assert.ok(state.includes("input.value === spec.belt?.key"))
  assert.ok(state.includes('document.getElementById("default_beacon_count")'))
})

test("recipe productivity settings use the official icons and independent level inputs", async () => {
  const html = await readFile(resolve(root, "calc.html"), "utf8")
  const settings = await readFile(resolve(root, "src/settings.ts"), "utf8")

  assert.ok(html.includes('id="recipe_productivity_row"'))
  assert.ok(html.includes('id="recipe_productivity_settings"'))
  assert.ok(settings.includes("spec.recipeProductivityResearch.values()"))
  assert.ok(settings.includes("entry.icon.make(24, true)"))
  assert.ok(settings.includes('attr("aria-label", (entry) => `${entry.name} level`)'))
  assert.ok(settings.includes("spec.setRecipeProductivityLevel(entry.key, Number(this.value))"))
})

import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
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
  assert.ok(results.includes('classed("launch-limited"'))
  assert.ok(results.includes("Rocket launches / ${specification.format.rateName}"))
  assert.ok(results.includes("more speed will not increase throughput"))
  assert.ok(results.includes("compatibleBuildings.length <= 1"))
  assert.ok(results.includes("option.displayBuilding.icon.make(32, true)"))
  assert.ok(results.includes('attr("aria-label", `Choose a machine for ${row.recipe.name}`)'))
  assert.ok(results.includes('label: "Cross-location flows"'))
  assert.ok(results.includes('label: "Imported items"'))
  for (const verboseSummary of [
    "Transfers between locations:",
    "Gleba spores:",
    "Agricultural tower counts assume",
    "Other machines do not emit spores",
    "electric load",
  ]) {
    assert.ok(!results.includes(verboseSummary), `Found verbose summary copy: ${verboseSummary}`)
  }
})

test("player-facing copy describes Factorio behavior instead of implementation details", async () => {
  const sources = await Promise.all(
    ["calc.html", "public/docs/changelog.html", "src/results.ts", "src/ui.ts", "src/planning.ts"].map((file) =>
      readFile(resolve(root, file), "utf8"),
    ),
  )
  const playerCopy = sources.join("\n").toLowerCase()

  for (const implementationPhrase of [
    "is not exported",
    "synthetic solver",
    "dataset validation",
    "transport pseudo-recipes",
    "quality-qualified",
    "internal production",
  ]) {
    assert.ok(!playerCopy.includes(implementationPhrase), `Found implementation phrase: ${implementationPhrase}`)
  }
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
  assert.ok(presentation.includes('reference.addEventListener("pointerenter", this.activate)'))
  assert.ok(presentation.includes("this.ensureInstance()?.show()"))
  assert.ok(presentation.includes("this.instance = tippy(this.reference"))
  assert.ok(presentation.includes("export function makePopover"))
  assert.ok(presentation.includes("if (!suppressTooltip)"))
  assert.ok(results.includes('makePopover(details.node(), " "'))
  assert.ok(results.includes("const ensureMenu = (instance) =>"))
  assert.ok(results.includes("ensureMenu(instance)"))
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
  assert.ok(presentation.includes("tippyInstance ??= tippy(wrapperNode"))
  assert.ok(presentation.includes("realInstance.setContent(dropdownNode)"))
  assert.ok(presentation.includes("return tippyInstance?.state ?? hiddenState"))
  assert.ok(!presentation.includes('classed("clicker"'))
  assert.ok(dropdownStyles.includes('.tippy-box[data-theme~="factorio-dropdown"]'))
  assert.ok(!dropdownStyles.includes("position: fixed"))
})

test("module dropdown rerenders initialize only entering wrappers", async () => {
  const models = await readFile(resolve(root, "src/models.ts"), "utf8")

  assert.ok(models.includes("s.each(function (this: HTMLElement)"))
  assert.ok(models.includes("makeDropdown(d3.select(this))"))
  assert.ok(!models.includes("makeDropdown(s)"))
})

test("mobile startup keeps optional runtimes and hidden controls off the critical path", async () => {
  const [html, main, app, settings, ui, presentation, graph, visualization, packageJson] = await Promise.all([
    readFile(resolve(root, "calc.html"), "utf8"),
    readFile(resolve(root, "src/main.ts"), "utf8"),
    readFile(resolve(root, "src/app.ts"), "utf8"),
    readFile(resolve(root, "src/settings.ts"), "utf8"),
    readFile(resolve(root, "src/ui.ts"), "utf8"),
    readFile(resolve(root, "src/presentation.ts"), "utf8"),
    readFile(resolve(root, "src/graph.ts"), "utf8"),
    readFile(resolve(root, "src/visualization.ts"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ])

  assert.ok(!html.includes('body onload='))
  assert.ok(html.includes('<link rel="stylesheet" href="./src/styles/dropdown.css" />'))
  assert.ok(html.includes('<link rel="stylesheet" href="./src/styles/calc.css" />'))
  assert.ok(html.includes('<link rel="stylesheet" href="./src/styles/player-ui.css" />'))
  assert.ok(html.includes('rel="preload" href="./data/space-age-2.1.12.json" as="fetch" crossorigin'))
  assert.ok(!main.includes('import "./styles/'))
  assert.ok(main.trimEnd().endsWith("init()"))
  assert.ok(app.includes('import("./visualization.js")'))
  assert.ok(!app.includes('from "./visualization.js"'))
  assert.ok(app.includes('cache: "force-cache", credentials: "same-origin"'))
  assert.ok(app.includes('window.addEventListener("load", scheduleIdleLoad, { once: true })'))
  assert.ok(app.includes("let initialized = false"))
  assert.ok(settings.includes("if (!recipeSettingsRendered)"))
  assert.ok(settings.includes("if (!resourcePrioritiesRendered)"))
  assert.ok(ui.includes("let itemOptionsRendered = false"))
  assert.ok(ui.includes("renderItemOptions(selection)"))
  assert.ok(presentation.includes("private ensureInstance(): any"))
  assert.ok(presentation.includes("tippyInstance ??= tippy(wrapperNode"))
  assert.ok(!settings.includes('from "./graph.js"'))
  assert.ok(!graph.includes('from "./color-schemes.js"'))
  assert.ok(visualization.includes('import { color, curveBasis, line, select } from "d3"'))
  assert.ok(visualization.includes("const d3: any = { color, curveBasis, line, select }"))
  assert.equal(JSON.parse(packageJson).scripts.bench, "node scripts/bench-solver.mjs")

  for (const source of [app, settings, ui, presentation, graph, visualization]) {
    assert.ok(!source.includes('import * as d3Package from "d3"'))
  }
})

test("Resources and Settings initialize independently on first open", async () => {
  const [app, settings, state] = await Promise.all([
    readFile(resolve(root, "src/app.ts"), "utf8"),
    readFile(resolve(root, "src/settings.ts"), "utf8"),
    readFile(resolve(root, "src/state.ts"), "utf8"),
  ])

  assert.ok(state.includes('if (tabName === "settings" || tabName === "resources")'))
  assert.ok(state.includes("onDeferredTabOpened(tabName)"))

  const tabHandlerStart = app.indexOf("configureDeferredTabHandler((tabName)")
  const tabHandler = app.slice(tabHandlerStart, app.indexOf("window.spec = spec", tabHandlerStart))
  assert.ok(tabHandler.includes('if (tabName === "settings")'))
  assert.ok(tabHandler.includes("ensureDeferredSettingsRendered()"))
  assert.ok(tabHandler.includes("ensureDeferredResourcesRendered()"))

  const settingsRenderer = settings.slice(
    settings.indexOf("export function ensureDeferredSettingsRendered"),
    settings.indexOf("export function ensureDeferredResourcesRendered"),
  )
  const resourcesRenderer = settings.slice(
    settings.indexOf("export function ensureDeferredResourcesRendered"),
    settings.indexOf("// debug"),
  )
  assert.ok(settingsRenderer.includes("renderRecipeSettings(spec)"))
  assert.ok(!settingsRenderer.includes("renderResourcePriorityEditor"))
  assert.ok(resourcesRenderer.includes("renderResourcePriorityEditor"))
  assert.ok(!resourcesRenderer.includes("renderRecipeSettings(spec)"))
})

test("runtime sprite sheets use smaller lossless WebP assets", async () => {
  const dataDirectory = resolve(root, "public/data")
  const datasets = (await readdir(dataDirectory)).filter((name) => name.endsWith(".json"))
  const hashes = new Set()
  for (const dataset of datasets) {
    const data = JSON.parse(await readFile(resolve(dataDirectory, dataset), "utf8"))
    hashes.add(data.sprites.hash)
  }

  assert.ok(hashes.size > 0)
  for (const hash of hashes) {
    const png = await stat(resolve(root, `public/images/sprite-sheet-${hash}.png`))
    const webp = await stat(resolve(root, `public/images/sprite-sheet-${hash}.webp`))
    assert.ok(webp.size < png.size, `${hash}: expected WebP ${webp.size} to be smaller than PNG ${png.size}`)
  }

  const runtimeSources = await Promise.all(
    ["src/presentation.ts", "src/graph.ts", "src/visualization.ts"].map((file) =>
      readFile(resolve(root, file), "utf8"),
    ),
  )
  assert.ok(runtimeSources.every((source) => source.includes(".webp")))
  assert.ok(runtimeSources.every((source) => !source.includes('sheetHash + ".png"')))
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

test("productivity settings use official icons and percentage inputs", async () => {
  const html = await readFile(resolve(root, "calc.html"), "utf8")
  const settings = await readFile(resolve(root, "src/settings.ts"), "utf8")
  const state = await readFile(resolve(root, "src/state.ts"), "utf8")
  const styles = await readFile(resolve(root, "src/styles/calc.css"), "utf8")

  assert.ok(html.includes('id="recipe_productivity_row"'))
  assert.ok(html.includes('id="recipe_productivity_settings"'))
  const productivityStart = html.indexOf('id="recipe_productivity_settings"')
  const productivityEnd = html.indexOf("</div>", productivityStart)
  const miningProductivity = html.indexOf('id="mprod"')
  assert.ok(miningProductivity > productivityStart && miningProductivity < productivityEnd)
  assert.ok(!html.includes('<td class="setting-label">Mining productivity bonus:</td>'))
  assert.ok(html.includes('class="recipe-productivity-icon mining-productivity-icon"'))
  assert.ok(html.includes('class="recipe-productivity-percentage"'))
  assert.ok(!html.includes("mining-productivity-bonus"))
  assert.ok(settings.includes('spec.items.get("electric-mining-drill")'))
  assert.ok(settings.includes("spec.recipeProductivityResearch.values()"))
  assert.ok(settings.includes('selectAll("label.recipe-productivity-research-setting")'))
  assert.ok(settings.includes("entry.icon.make(24, true)"))
  assert.ok(settings.includes('attr("max", 300)'))
  assert.ok(settings.includes('attr("aria-label", (entry) => `${entry.name} bonus percentage`)'))
  assert.ok(settings.includes("recipeProductivityLevelFromPercent(entry, this.value)"))
  assert.ok(settings.includes('.classed("recipe-productivity-percentage", true)'))
  assert.ok(!settings.includes("recipe-productivity-bonus"))
  assert.ok(!state.includes("mining-productivity-bonus"))
  assert.ok(styles.includes(".recipe-productivity-percentage"))
  assert.ok(
    html
      .replace(/\s+/g, " ")
      .includes("Recipe productivity is capped at +300% total; mining productivity is uncapped."),
  )
  assert.ok(state.includes("syncMiningProductivityControls()"))
})

import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

test("player-facing controls stay close to the evidence they affect", async () => {
  const shell = await readFile(resolve(root, "src/react/CalculatorShell.tsx"), "utf8")
  const results = await readFile(resolve(root, "src/results.ts"), "utf8")
  const ui = await readFile(resolve(root, "src/ui.ts"), "utf8")
  const styles = await readFile(resolve(root, "src/styles/player-ui.css"), "utf8")

  const tabsStart = shell.indexOf('className="tabs"')
  const tabsEnd = shell.indexOf('id="graph_tab"')
  const density = shell.indexOf('id="factory_tab_tools"')
  assert.ok(tabsStart !== -1 && tabsEnd !== -1 && density > tabsStart && density < tabsEnd)
  assert.ok(!shell.includes("factory-view-toolbar"))
  assert.ok(shell.includes('id="targets_title"'))
  assert.ok(shell.includes('className="production-target-header"'))
  assert.ok(shell.includes("Choose an output, then set its quality, machine count, or production rate."))
  assert.ok(shell.includes("<span>Output</span>"))
  assert.ok(shell.includes("<span>Quality</span>"))
  assert.ok(shell.includes("<span>Machines</span>"))
  assert.ok(shell.includes("<span>Rate/min</span>"))
  assert.ok(ui.includes('classed("target production-target-row", true)'))
  assert.ok(ui.includes('classed("production-target-settings", true)'))
  assert.ok(ui.includes('.attr("aria-label", `Quality for ${item.name}`)'))
  assert.ok(!ui.includes("Item quality"))
  assert.ok(!ui.includes('this.recipeSelector.append("span").text(" \\u00d7 ")'))
  assert.ok(!ui.includes("showQualityAdjustment"))
  assert.ok(!ui.includes("Configured ${this.item.name}"))
  assert.ok(styles.includes("grid-template-columns: 2rem 180px 104px 72px 88px"))
  assert.ok(styles.includes("width: max-content"))
  assert.ok(styles.includes(".add-target-button"))
  assert.ok(styles.includes("margin-left: calc(2rem + 8px)"))
  assert.ok(shell.includes('id="visualization_summary"'))
  assert.ok(shell.includes("fluids use a 10:1 scale"))

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

test("Settings navigation, recipe management, and compact beacon rows preserve the dense UI", async () => {
  const [shell, panel, settings, results, styles] = await Promise.all([
    readFile(resolve(root, "src/react/CalculatorShell.tsx"), "utf8"),
    readFile(resolve(root, "src/react/SettingsPanel.tsx"), "utf8"),
    readFile(resolve(root, "src/settings.ts"), "utf8"),
    readFile(resolve(root, "src/results.ts"), "utf8"),
    readFile(resolve(root, "src/styles/player-ui.css"), "utf8"),
  ])

  assert.ok(!panel.includes('className="settings-nav"'))
  assert.ok(!panel.includes("Back to top"))
  assert.ok(settings.includes('text("Changed only")'))
  assert.ok(settings.includes('text("Reset recipe changes")'))
  assert.ok(settings.includes('classed("recipe-category-nav", true)'))
  assert.ok(settings.includes('.selectAll("details.recipe-settings-category")'))
  assert.ok(settings.includes('"Orange: enabled · Dimmed: disabled · Click to toggle"'))
  assert.ok(results.includes('.classed("ui add-beacon", true)'))
  assert.ok(results.includes('.text("+ Beacon")'))
  assert.ok(results.includes('classed("beacon-collapsed"'))
  assert.ok(panel.includes('id="default_beacon_setting"'))
  assert.ok(!panel.includes('id="add_default_beacon"'))
  assert.ok(panel.includes('className="setting-row compact-setting-row compact-setting-first"'))
  assert.ok(panel.includes('className="setting-row compact-setting-row compact-setting-second"'))
  assert.ok(styles.includes("table#settings tbody"))
  assert.ok(styles.includes("grid-template-columns: repeat(2, minmax(0, 15rem))"))
  assert.ok(styles.includes("tr.setting-row td:first-child"))
  assert.ok(styles.includes("display: block"))
  assert.ok(styles.includes("text-align: left"))
  assert.ok(styles.includes("td.beacon.beacon-collapsed .beacon-controls"))
  assert.ok(shell.includes('import.meta.env.DEV || new URLSearchParams(window.location.search).has("debug")'))
})

test("player-facing copy describes Factorio behavior instead of implementation details", async () => {
  const sources = await Promise.all(
    [
      "src/react/CalculatorShell.tsx",
      "src/react/SettingsPanel.tsx",
      "src/react/HelpPanel.tsx",
      "public/docs/changelog.html",
      "src/results.ts",
      "src/ui.ts",
      "src/planning.ts",
    ].map((file) => readFile(resolve(root, file), "utf8")),
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

test("Help is task-oriented and keeps the changelog secondary", async () => {
  const help = await readFile(resolve(root, "src/react/HelpPanel.tsx"), "utf8")

  assert.ok(help.includes("<h1>Help</h1>"))
  assert.ok(help.includes("Factorio 2.1.13"))
  assert.ok(help.includes('id="help-using"'))
  assert.ok(help.includes("Using the calculator"))
  assert.ok(help.includes("Shift-click location buttons"))
  assert.ok(help.includes("An ingredient is missing from the chain"))
  assert.ok(help.includes("Source on GitHub"))
  assert.ok(help.includes('target="_blank" rel="noopener noreferrer"'))
  assert.ok(help.includes('<details id="help-changelog" className="help-section help-changelog" open>'))
  assert.ok(!help.includes("Quick Reference &amp; Workflows"))
  assert.ok(!help.includes("help-reference-list"))
  assert.ok(!help.includes("Plan Factorio production chains"))
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
    readFile(resolve(root, "src/main.tsx"), "utf8"),
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
    readFile(resolve(root, "src/main.tsx"), "utf8"),
    readFile(resolve(root, "src/app.ts"), "utf8"),
    readFile(resolve(root, "src/settings.ts"), "utf8"),
    readFile(resolve(root, "src/ui.ts"), "utf8"),
    readFile(resolve(root, "src/presentation.ts"), "utf8"),
    readFile(resolve(root, "src/graph.ts"), "utf8"),
    readFile(resolve(root, "src/visualization.ts"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ])

  assert.ok(!html.includes("body onload="))
  assert.ok(html.includes('<link rel="stylesheet" href="./src/styles/dropdown.css" />'))
  assert.ok(html.includes('<link rel="stylesheet" href="./src/styles/calc.css" />'))
  assert.ok(html.includes('<link rel="stylesheet" href="./src/styles/player-ui.css" />'))
  assert.ok(html.includes('rel="preload" href="./data/space-age-2.1.13.json" as="fetch" crossorigin'))
  assert.ok(!main.includes('import "./styles/'))
  assert.ok(main.includes("createRoot(rootElement).render(<CalculatorApp />)"))
  assert.ok(!main.includes("StrictMode"))
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

test("Factorio 2.1.12 links migrate to the current Space Age data", async () => {
  const state = await readFile(resolve(root, "src/state.ts"), "utf8")
  assert.ok(state.includes('["space-age-2-1-12", "space-age-2-1-13"]'))
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
  const presetStart = state.indexOf("type PresetDefinition")
  const presetEnd = state.indexOf("function getByKey", presetStart)
  const presetSource = state.slice(presetStart, presetEnd)
  assert.ok(state.includes("syncProgressionControls()"))
  assert.ok(state.includes("input.value === spec.belt?.key"))
  assert.ok(presetSource.includes("beltStackSize"))
  assert.ok(presetSource.includes("maxQualityLevel"))
  assert.ok(presetSource.includes("planets:"))
  assert.ok(presetSource.includes("defaultMachines"))
  assert.ok(presetSource.includes('"assembling-machine-1"'))
  assert.ok(presetSource.includes('"assembling-machine-3"'))
  assert.ok(presetSource.includes('"foundry"'))
  assert.ok(presetSource.includes('"electromagnetic-plant"'))
  assert.ok(presetSource.includes('"cryogenic-plant"'))
  assert.ok(!presetSource.includes("module"))
  assert.ok(!presetSource.includes("beacon"))
  const applyStart = state.indexOf("export function applyProgressionPreset")
  const applyEnd = state.indexOf("export function changePlanningSetting", applyStart)
  const applySource = state.slice(applyStart, applyEnd)
  assert.ok(applySource.includes("selectedPlanets"))
  assert.ok(!applySource.includes("defaultModule"))
  assert.ok(!applySource.includes("defaultBeacon"))
  assert.ok(!applySource.includes("spec.spec.clear()"))
  assert.ok(applySource.includes("spec.clearBuildingOverrides()"))
  assert.ok(applySource.includes("spec.setAutomaticBuildingPreferences("))

  const shell = await readFile(resolve(root, "src/react/CalculatorShell.tsx"), "utf8")
  const settings = await readFile(resolve(root, "src/react/SettingsPanel.tsx"), "utf8")
  assert.ok(shell.includes('<option value="first-planets">Early Space Age</option>'))
  assert.ok(shell.includes('<option value="megabase">Established megabase</option>'))
  assert.ok(settings.includes("Default module (all eligible slots)"))
})

test("productivity settings use official icons and percentage inputs", async () => {
  const html = await readFile(resolve(root, "src/react/SettingsPanel.tsx"), "utf8")
  const settings = await readFile(resolve(root, "src/settings.ts"), "utf8")
  const state = await readFile(resolve(root, "src/state.ts"), "utf8")
  const styles = await readFile(resolve(root, "src/styles/calc.css"), "utf8")

  assert.ok(html.includes('id="recipe_productivity_row"'))
  assert.ok(html.includes('id="recipe_productivity_settings"'))
  const productivityStart = html.indexOf('id="recipe_productivity_settings"')
  const productivityEnd = html.indexOf("</div>", productivityStart)
  const miningProductivity = html.indexOf('id="mprod"')
  assert.ok(miningProductivity > productivityStart && miningProductivity < productivityEnd)
  assert.ok(!html.includes('<td className="setting-label">Mining productivity bonus:</td>'))
  assert.ok(html.includes('className="recipe-productivity-icon mining-productivity-icon"'))
  assert.ok(html.includes('className="recipe-productivity-percentage"'))
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

test("React 19 shell uses typed local actions without inline or global handlers", async () => {
  const [html, main, app, shell, settingsPanel, globals, packageJson, tsconfig, lockfile] = await Promise.all([
    readFile(resolve(root, "calc.html"), "utf8"),
    readFile(resolve(root, "src/main.tsx"), "utf8"),
    readFile(resolve(root, "src/react/CalculatorApp.tsx"), "utf8"),
    readFile(resolve(root, "src/react/CalculatorShell.tsx"), "utf8"),
    readFile(resolve(root, "src/react/SettingsPanel.tsx"), "utf8"),
    readFile(resolve(root, "src/globals.d.ts"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
    readFile(resolve(root, "tsconfig.json"), "utf8"),
    readFile(resolve(root, "pnpm-lock.yaml"), "utf8"),
  ])
  const packageData = JSON.parse(packageJson)
  const compilerOptions = JSON.parse(tsconfig).compilerOptions

  assert.equal(packageData.dependencies.react, "19.2.8")
  assert.equal(packageData.dependencies["react-dom"], "19.2.8")
  assert.equal(packageData.devDependencies["@types/react"], "19.2.17")
  assert.equal(packageData.devDependencies["@types/react-dom"], "19.2.3")
  assert.ok(lockfile.includes("react:\n        specifier: 19.2.8\n        version: 19.2.8"))
  assert.ok(lockfile.includes("react-dom:\n        specifier: 19.2.8\n        version: 19.2.8(react@19.2.8)"))
  assert.equal(compilerOptions.jsx, "react-jsx")
  assert.ok(html.includes('<div id="root"></div>'))
  assert.ok(html.includes('src="./src/main.tsx"'))
  assert.ok(!html.includes("onclick="))
  assert.ok(!html.includes("onchange="))
  assert.ok(main.includes('from "react-dom/client"'))
  assert.ok(app.includes("useLayoutEffect"))
  assert.ok(app.includes("<CalculatorShell actions={actions} />"))
  assert.ok(shell.includes("forwardNativeEvent"))
  assert.ok(settingsPanel.includes('defaultValue="4"'))
  assert.ok(settingsPanel.includes("defaultChecked"))
  assert.ok(!globals.includes("CalculatorHandlers"))
  assert.ok(!globals.includes("handlers:"))
})

test("URL fragment navigation updates settings on hashchange and popstate", async () => {
  const app = await readFile(resolve(root, "src/app.ts"), "utf8")
  assert.ok(app.includes('window.addEventListener("hashchange", handleUrlHashChange)'))
  assert.ok(app.includes('window.addEventListener("popstate", handleUrlHashChange)'))
  assert.ok(app.includes("function handleUrlHashChange()"))
})

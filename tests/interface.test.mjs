import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8")
}

test("React 19 entry uses the typed store and no inline or global handler API", async () => {
  const [html, main, app, shell, settingsPanel, store, contracts, globals, packageJson, tsconfig, lockfile] =
    await Promise.all([
      read("calc.html"),
      read("src/main.tsx"),
      read("src/react/CalculatorApp.tsx"),
      read("src/react/CalculatorShell.tsx"),
      read("src/react/SettingsPanel.tsx"),
      read("src/application/store.ts"),
      read("src/application/contracts.ts"),
      read("src/globals.d.ts"),
      read("package.json"),
      read("tsconfig.json"),
      read("pnpm-lock.yaml"),
    ])
  const packageData = JSON.parse(packageJson)
  const compilerOptions = JSON.parse(tsconfig).compilerOptions

  assert.equal(packageData.dependencies.react, "19.2.8")
  assert.equal(packageData.dependencies["react-dom"], "19.2.8")
  assert.match(lockfile, /react:\n\s+specifier: 19\.2\.8\n\s+version: 19\.2\.8/)
  assert.equal(compilerOptions.jsx, "react-jsx")
  for (const option of [
    "strict",
    "noImplicitAny",
    "strictNullChecks",
    "strictPropertyInitialization",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "useUnknownInCatchVariables",
  ]) {
    assert.equal(compilerOptions[option], true, `${option} must stay enabled`)
  }

  assert.match(html, /<div id="root"><\/div>/)
  assert.match(html, /src="\.\/src\/main\.tsx"/)
  assert.doesNotMatch(html, /\son(?:click|change|input)=/i)
  assert.match(main, /from "react-dom\/client"/)
  assert.match(app, /useCalculatorStore\(\)/)
  assert.match(store, /class BrowserCalculatorStore/)
  assert.match(store, /specification\.subscribe\(this\.refresh\)/)
  assert.match(contracts, /export interface CalculatorCommands/)
  assert.match(shell, /commands\.setFactoryDensity/)
  assert.match(settingsPanel, /commands\.setPlanningSetting/)
  assert.doesNotMatch(shell + settingsPanel, /forwardNativeEvent/)
  assert.doesNotMatch(globals, /CalculatorHandlers|handlers:/)
})

test("startup keeps optional rendering work outside the critical path", async () => {
  const [html, app, settings, ui, presentation, graph, visualization, packageJson] = await Promise.all([
    read("calc.html"),
    read("src/app.ts"),
    read("src/settings.ts"),
    read("src/ui.ts"),
    read("src/presentation.ts"),
    read("src/graph.ts"),
    read("src/visualization.ts"),
    read("package.json"),
  ])
  const scripts = JSON.parse(packageJson).scripts

  assert.match(html, /rel="preload" href="\.\/data\/space-age-2\.1\.13\.json" as="fetch" crossorigin/)
  assert.match(app, /import\("\.\/visualization\.js"\)/)
  assert.doesNotMatch(app, /from "\.\/visualization\.js"|preloadVisualization/)
  assert.match(app, /cache: "force-cache", credentials: "same-origin"/)
  assert.match(settings, /if \(!recipeSettingsRendered\)/)
  assert.match(settings, /if \(!resourcePrioritiesRendered\)/)
  assert.match(ui, /let itemOptionsRendered = false/)
  assert.match(presentation, /private ensureInstance\(\): Instance \| null/)
  assert.doesNotMatch(settings, /from "\.\/graph\.js"/)
  assert.doesNotMatch(graph, /from "\.\/color-schemes\.js"/)
  assert.match(visualization, /from "@dagrejs\/dagre"/)
  assert.equal(scripts["bench:check"], "node scripts/bench-solver.mjs --check")
})

test("imperative renderer constraints remain explicit", async () => {
  const [models, results, presentation, dropdownStyles] = await Promise.all([
    read("src/models.ts"),
    read("src/results.ts"),
    read("src/presentation.ts"),
    read("src/styles/dropdown.css"),
  ])

  const cleanup = 'displayRows.selectAll("td.building-icon > :not(.recipe-selector)").remove()'
  const buildingRows = "const buildingRows = displayRows.filter("
  assert.ok(results.indexOf(cleanup) !== -1 && results.indexOf(cleanup) < results.indexOf(buildingRows))
  assert.match(models, /selector\.each\(function \(datum, index, groups\)/)
  assert.match(models, /wrappers\.each\(function \(this: Element\)/)
  assert.match(models, /makeDropdown\(select\(this\)\)/)
  assert.match(presentation, /import tippy, \{ delegate, hideAll(?:, [^}]*)? \} from "tippy\.js"/)
  assert.doesNotMatch(presentation, /Popper\.createPopper|classed\("clicker"/)
  assert.match(dropdownStyles, /tippy-box\[data-theme~="factorio-dropdown"\]/)
  assert.doesNotMatch(dropdownStyles, /position: fixed/)
})

test("runtime libraries come from pnpm and generated sprite sheets prefer lossless WebP", async () => {
  const [html, globals, math, urlCodec, visualization, packageJson] = await Promise.all([
    read("calc.html"),
    read("src/globals.d.ts"),
    read("src/math.ts"),
    read("src/url/codec.ts"),
    read("src/visualization.ts"),
    read("package.json"),
  ])
  const dependencies = JSON.parse(packageJson).dependencies
  for (const dependency of ["d3", "@dagrejs/dagre", "pako", "big-integer", "tippy.js"]) {
    assert.ok(dependencies[dependency], `missing ${dependency}`)
  }
  assert.match(math, /from "big-integer"/)
  assert.match(urlCodec, /from "pako"/)
  assert.match(visualization, /from "@dagrejs\/dagre"/)
  assert.doesNotMatch(html, /third_party\//)
  assert.doesNotMatch(globals, /const (?:BigInteger|bigInt|d3|dagre|pako):/)

  const dataDirectory = resolve(root, "public/data")
  const datasets = (await readdir(dataDirectory)).filter((name) => name.endsWith(".json"))
  const hashes = new Set()
  for (const dataset of datasets)
    hashes.add(JSON.parse(await readFile(resolve(dataDirectory, dataset), "utf8")).sprites.hash)
  assert.ok(hashes.size > 0)
  for (const hash of hashes) {
    const png = await stat(resolve(root, `public/images/sprite-sheet-${hash}.png`))
    const webp = await stat(resolve(root, `public/images/sprite-sheet-${hash}.webp`))
    assert.ok(webp.size < png.size, `${hash}: expected WebP ${webp.size} to be smaller than PNG ${png.size}`)
  }
})

test("Settings navigation, recipe management, and beacon controls preserve the dense UI", async () => {
  const [shell, panel, settings, results, styles] = await Promise.all([
    read("src/react/CalculatorShell.tsx"),
    read("src/react/SettingsPanel.tsx"),
    read("src/settings.ts"),
    read("src/results.ts"),
    read("src/styles/player-ui.css"),
  ])

  assert.ok(!panel.includes('className="settings-nav"'))
  assert.ok(!panel.includes("Back to top"))
  assert.ok(settings.includes('text("Changed only")'))
  assert.ok(settings.includes('text("Reset recipe changes")'))
  assert.ok(settings.includes('classed("recipe-category-nav", true)'))
  assert.ok(settings.includes('"details.recipe-settings-category"'))
  assert.ok(settings.includes('"Orange: enabled · Dimmed: disabled · Click to toggle"'))
  assert.ok(!results.includes('.text("+ Beacon")'))
  assert.ok(results.includes('.classed("beacon-controls", true)'))
  assert.ok(panel.includes('id="default_beacon_setting"'))
  assert.ok(!panel.includes('id="add_default_beacon"'))
  assert.ok(panel.includes('className="setting-row compact-setting-row compact-setting-first"'))
  assert.ok(panel.includes('className="setting-row compact-setting-row compact-setting-second"'))
  assert.ok(styles.includes("table#settings tbody"))
  assert.ok(styles.includes("grid-template-columns: repeat(2, minmax(0, 15rem))"))
  assert.ok(styles.includes("tr.setting-row td:first-child"))
  assert.ok(styles.includes("display: block"))
  assert.ok(styles.includes("text-align: left"))
  assert.ok(styles.includes(".beacon-controls"))
  const beaconStyleStart = styles.indexOf("span.beacon-container")
  const beaconStyle = styles.slice(beaconStyleStart, styles.indexOf("}", beaconStyleStart))
  assert.ok(beaconStyle.includes("padding: 0"))
  assert.ok(beaconStyle.includes("border: 0"))
  assert.ok(shell.includes('new URLSearchParams(window.location.search).has("debug")'))
})

test("player-facing copy excludes implementation terminology", async () => {
  const sources = await Promise.all(
    [
      "src/react/CalculatorShell.tsx",
      "src/react/SettingsPanel.tsx",
      "src/react/HelpPanel.tsx",
      "public/docs/changelog.html",
      "src/results.ts",
      "src/ui.ts",
      "src/planning.ts",
    ].map(read),
  )
  const playerCopy = sources.join("\n").toLowerCase()
  for (const phrase of [
    "is not exported",
    "synthetic solver",
    "dataset validation",
    "transport pseudo-recipes",
    "quality-qualified",
    "internal production",
  ]) {
    assert.doesNotMatch(playerCopy, new RegExp(phrase), `Found implementation phrase: ${phrase}`)
  }
})

test("repository agent guardrails and validation lanes are installed", async () => {
  const [agents, packageJson, buildBudgets, performanceBudgets] = await Promise.all([
    read("AGENTS.md"),
    read("package.json"),
    read("config/build-budgets.json"),
    read("config/performance-budgets.json"),
  ])
  const scripts = JSON.parse(packageJson).scripts
  for (const command of ["doctor", "check:quick", "test:core", "test:ui", "test:e2e", "bench:check", "verify"]) {
    assert.equal(typeof scripts[command], "string", `missing ${command}`)
  }
  assert.match(agents, /^# Code Review Rules$/m)
  assert.ok(JSON.parse(buildBudgets).requiredDeferredModuleFragments.includes("src/visualization.ts"))
  assert.ok(JSON.parse(performanceBudgets).solverScenarios["1001"])
})

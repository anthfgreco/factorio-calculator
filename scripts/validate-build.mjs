import { access, readFile } from "node:fs/promises"

const dist = new URL("../dist/", import.meta.url)

async function requireFile(relativePath) {
  const url = new URL(relativePath, dist)
  await access(url)
  return url
}

await Promise.all([
  requireFile("index.html"),
  requireFile("calc.html"),
  requireFile("favicon.png"),
  requireFile("data/space-age-2.1.12.json"),
  requireFile("docs/changelog.html"),
  requireFile("posts/bower_components/function-plot/dist/function-plot.js"),
])

const calculatorHtml = await readFile(new URL("calc.html", dist), "utf8")
if (calculatorHtml.includes("/src/") || calculatorHtml.includes("src/main.ts")) {
  throw new Error("calc.html still references unbuilt TypeScript source")
}
if (calculatorHtml.includes("third_party/")) {
  throw new Error("calc.html still references a classic vendored runtime dependency")
}
if (!calculatorHtml.includes('id="targets_title"')) {
  throw new Error("calc.html is missing the production-target heading")
}
if (
  !calculatorHtml.includes('name="description"') ||
  !calculatorHtml.includes('<link rel="canonical" href="https://anthfgreco.github.io/factorio-calculator/calc.html"')
) {
  throw new Error("calc.html is missing its search description or canonical URL")
}
if (!calculatorHtml.includes('type="application/ld+json"') || !calculatorHtml.includes('"@type": "WebApplication"')) {
  throw new Error("calc.html is missing WebApplication structured data")
}
if (!calculatorHtml.includes("<h1>Factorio Calculator</h1>")) {
  throw new Error("calc.html is missing its primary Factorio Calculator heading")
}
if (!calculatorHtml.includes('id="visualization_summary"') || !calculatorHtml.includes("fluids use a 10:1 scale")) {
  throw new Error("calc.html is missing the visualization scale and scope guidance")
}
const tabsStart = calculatorHtml.indexOf('<div class="tabs">')
const graphTabStart = calculatorHtml.indexOf('<div id="graph_tab"')
const factoryToolsIndex = calculatorHtml.indexOf('id="factory_tab_tools"')
if (tabsStart === -1 || graphTabStart === -1 || factoryToolsIndex < tabsStart || factoryToolsIndex > graphTabStart) {
  throw new Error("Factory row-density controls must stay on the right side of the tab bar")
}
if (calculatorHtml.includes("factory-view-toolbar") || calculatorHtml.includes("Table density")) {
  throw new Error("calc.html still contains the old separate Factory density toolbar")
}
if (!calculatorHtml.includes('id="location_toolbar"')) {
  throw new Error("calc.html is missing the top-level production-location control")
}
if (
  !calculatorHtml.includes('id="help_tab"') ||
  !calculatorHtml.includes('id="help-about"') ||
  !calculatorHtml.includes('id="help-faq"') ||
  !calculatorHtml.includes('id="help-changelog"')
) {
  throw new Error("calc.html is missing the consolidated Help tab")
}
if (
  calculatorHtml.includes('id="about_tab"') ||
  calculatorHtml.includes('id="faq_tab"') ||
  calculatorHtml.includes('id="changelog_tab"') ||
  calculatorHtml.includes("changelog-frame")
) {
  throw new Error("calc.html still contains a legacy About, FAQ, or Changelog tab")
}
if (
  !calculatorHtml.includes('id="factory_density_comfortable"') ||
  !calculatorHtml.includes('id="factory_density_compact"')
) {
  throw new Error("calc.html is missing Factory table density controls")
}
if (calculatorHtml.includes("Recent changes:")) {
  throw new Error("calc.html still contains the removed Recent changes box")
}
const copyButtonIndex = calculatorHtml.indexOf('id="copy_share_link"')
const debugButtonIndex = calculatorHtml.indexOf('id="debug_button"')
if (copyButtonIndex === -1 || debugButtonIndex === -1 || copyButtonIndex > debugButtonIndex) {
  throw new Error("Copy plan link must appear immediately before the Debug toolbar button")
}
if (calculatorHtml.includes("Machine equivalents")) {
  throw new Error("calc.html still shows the confusing machine-equivalents summary")
}

const changelogHtml = await readFile(new URL("docs/changelog.html", dist), "utf8")
if (/20(?:0\d|1\d|2[0-5])-/.test(changelogHtml)) {
  throw new Error("The changelog still contains entries from 2025 or earlier")
}

const sitemapXml = await readFile(await requireFile("sitemap.xml"), "utf8")
if (!sitemapXml.includes("https://anthfgreco.github.io/factorio-calculator/calc.html")) {
  throw new Error("sitemap.xml is missing the canonical calculator URL")
}

const dataPath = await requireFile("data/space-age-2.1.12.json")
const data = JSON.parse(await readFile(dataPath, "utf8"))
if (data.game_version !== "2.1.12") {
  throw new Error(`Unexpected dataset version: ${data.game_version}`)
}
if (!Array.isArray(data.recipes) || data.recipes.length < 600) {
  throw new Error("The Space Age dataset is missing recipes")
}
if (!data.sprites?.hash) {
  throw new Error("The Space Age dataset is missing sprite metadata")
}

await requireFile(`images/sprite-sheet-${data.sprites.hash}.png`)
await requireFile(`images/sprite-sheet-${data.sprites.hash}.webp`)

console.log(`Validated Vite build with ${data.recipes.length} Factorio 2.1.12 recipes.`)

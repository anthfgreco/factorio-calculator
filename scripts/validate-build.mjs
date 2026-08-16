import { access, readFile, readdir } from "node:fs/promises"

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
  requireFile("data/space-age-2.1.13.json"),
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
if (!calculatorHtml.includes('<div id="root"></div>')) {
  throw new Error("calc.html is missing the React root")
}
if (
  calculatorHtml.includes("onclick=") ||
  calculatorHtml.includes("onchange=") ||
  calculatorHtml.includes("oninput=")
) {
  throw new Error("calc.html still contains inline event handlers")
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

const assetSources = await readJavaScriptAssets(new URL("assets/", dist))
const calculatorBundle = assetSources.join("\n")
for (const requiredText of [
  "Production targets",
  "Copy plan link",
  "Active recipes",
  "Machines to place",
  "Factory recipe flow graph",
  "Recipe graph",
  "Drag resources between tiers",
  "less valuable",
  "more valuable",
  "Planning diagnostics",
  "Automatic quality factory",
  "Show unavailable recipes",
  "Disable recycling",
  "Relaxed",
  "Compact",
]) {
  if (!calculatorBundle.includes(requiredText)) {
    throw new Error(`Built calculator bundle is missing ${JSON.stringify(requiredText)}`)
  }
}
for (const removedText of [
  "CALCULATOR_CSS",
  "GLOBAL_CSS",
  "vendor-sankey",
  "@dagrejs/dagre",
  "tippy.js",
  "factory-view-toolbar",
  "debug_button",
  "debug_tab",
]) {
  if (calculatorBundle.includes(removedText)) {
    throw new Error(`Built calculator bundle still contains ${JSON.stringify(removedText)}`)
  }
}

const changelogHtml = await readFile(new URL("docs/changelog.html", dist), "utf8")
if (/20(?:0\d|1\d|2[0-5])-/.test(changelogHtml)) {
  throw new Error("The changelog still contains entries from 2025 or earlier")
}

const sitemapXml = await readFile(await requireFile("sitemap.xml"), "utf8")
if (!sitemapXml.includes("https://anthfgreco.github.io/factorio-calculator/calc.html")) {
  throw new Error("sitemap.xml is missing the canonical calculator URL")
}

const dataPath = await requireFile("data/space-age-2.1.13.json")
const data = JSON.parse(await readFile(dataPath, "utf8"))
if (data.game_version !== "2.1.13") {
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

console.log(`Validated React 19 Vite build with ${data.recipes.length} Factorio 2.1.13 recipes.`)

async function readJavaScriptAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory)
      if (entry.isDirectory()) {
        return readJavaScriptAssets(url)
      }
      if (entry.isFile() && entry.name.endsWith(".js")) {
        return [await readFile(url, "utf8")]
      }
      return []
    }),
  )
  return files.flat()
}

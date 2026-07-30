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
  requireFile("third_party/BigInteger.min.js"),
  requireFile("third_party/d3.min.js"),
  requireFile("data/space-age-2.1.12.json"),
  requireFile("docs/changelog.html"),
])

const calculatorHtml = await readFile(new URL("calc.html", dist), "utf8")
if (calculatorHtml.includes("/src/") || calculatorHtml.includes("src/main.ts")) {
  throw new Error("calc.html still references unbuilt TypeScript source")
}
if (!calculatorHtml.includes("third_party/BigInteger.min.js")) {
  throw new Error("calc.html is missing the BigInteger runtime dependency")
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

console.log(`Validated Vite build with ${data.recipes.length} Factorio 2.1.12 recipes.`)

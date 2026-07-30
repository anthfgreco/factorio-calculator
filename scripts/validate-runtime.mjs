import { execFileSync } from "node:child_process"
import { readFile, rm } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import vm from "node:vm"

const root = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(root, ".tmp/runtime")
const tsc = resolve(root, "node_modules/typescript/bin/tsc")

await rm(outputDirectory, { recursive: true, force: true })

execFileSync(process.execPath, [tsc, "--noEmit", "false", "--outDir", outputDirectory, "--declaration", "false"], {
  cwd: root,
  stdio: "inherit",
})

const bigIntegerSource = await readFile(resolve(root, "public/third_party/BigInteger.min.js"), "utf8")
vm.runInThisContext(bigIntegerSource)

globalThis.window = {}
globalThis.d3 = {
  local: () => ({
    get: () => null,
    set: () => undefined,
  }),
}

const loadModule = (name) => import(pathToFileURL(resolve(outputDirectory, `${name}.js`)).href)

const { getItems } = await loadModule("item")
const { getRecipes } = await loadModule("recipe")
const { getBuildings } = await loadModule("building")
const { getModules } = await loadModule("module")
const { getBelts } = await loadModule("belt")
const { getFuel } = await loadModule("fuel")
const { getPlanets } = await loadModule("planet")
const { getItemGroups } = await loadModule("group")
const factory = await loadModule("factory")
const { itemMatchesSearch } = await loadModule("search")

const searchCases = [
  [{ key: "underground-belt", name: "Underground belt" }, "underground belt"],
  [{ key: "fast-underground-belt", name: "Fast underground belt" }, "underground belt"],
  [{ key: "fast-underground-belt", name: "Fast underground belt" }, "fast belt"],
  [{ key: "automation-science-pack", name: "Automation science pack" }, "red"],
  [{ key: "automation-science-pack", name: "Automation science pack" }, "red science"],
  [{ key: "logistic-science-pack", name: "Logistic science pack" }, "green"],
  [{ key: "military-science-pack", name: "Military science pack" }, "grey"],
  [{ key: "military-science-pack", name: "Military science pack" }, "gray"],
  [{ key: "military-science-pack", name: "Military science pack" }, "black"],
  [{ key: "chemical-science-pack", name: "Chemical science pack" }, "blue"],
  [{ key: "production-science-pack", name: "Production science pack" }, "purple"],
  [{ key: "utility-science-pack", name: "Utility science pack" }, "yellow"],
  [{ key: "space-science-pack", name: "Space science pack" }, "white"],
  [{ key: "metallurgic-science-pack", name: "Metallurgic science pack" }, "orange"],
  [{ key: "electromagnetic-science-pack", name: "Electromagnetic science pack" }, "pink"],
  [{ key: "electromagnetic-science-pack", name: "Electromagnetic science pack" }, "magenta"],
  [{ key: "agricultural-science-pack", name: "Agricultural science pack" }, "lime"],
  [{ key: "agricultural-science-pack", name: "Agricultural science pack" }, "light green"],
  [{ key: "cryogenic-science-pack", name: "Cryogenic science pack" }, "cyan"],
  [{ key: "cryogenic-science-pack", name: "Cryogenic science pack" }, "light blue"],
  [{ key: "cryogenic-science-pack", name: "Cryogenic science pack" }, "blue"],
  [{ key: "promethium-science-pack", name: "Promethium science pack" }, "black"],
  [{ key: "promethium-science-pack", name: "Promethium science pack" }, "dark blue"],
  [{ key: "promethium-science-pack", name: "Promethium science pack" }, "dark purple"],
]

for (const [item, query] of searchCases) {
  if (!itemMatchesSearch(item, query)) {
    throw new Error(`Search query ${JSON.stringify(query)} did not match ${item.name}`)
  }
}

if (itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "cyan")) {
  throw new Error("Unrelated search alias matched the wrong science pack")
}

const datasets = [
  "vanilla-1.1.110.json",
  "vanilla-1.1.110-expensive.json",
  "vanilla-2.0.55.json",
  "space-age-2.0.55.json",
  "space-age-2.1.12.json",
]

const originalLog = console.log
const summaries = []

try {
  // Legacy datasets intentionally contain raw resources without recipes. The
  // loader logs those items while creating disabled-resource pseudo-recipes.
  console.log = () => undefined

  for (const filename of datasets) {
    factory.resetSpec()
    const data = JSON.parse(await readFile(resolve(root, "public/data", filename), "utf8"))
    const items = getItems(data)
    const recipes = getRecipes(data, items)
    const buildings = getBuildings(data, items)
    const modules = getModules(data, items)
    const belts = getBelts(data)
    const fuels = getFuel(data, items)
    const planets = getPlanets(data, recipes)
    const groups = getItemGroups(items, data)

    factory.spec.setData(items, recipes, planets, modules, buildings, belts, fuels, groups)

    for (const recipe of recipes.values()) {
      if (recipe.categories?.size > 0 && !factory.spec.getBuilding(recipe)) {
        throw new Error(`${filename}: no compatible building for ${recipe.key}`)
      }
    }

    summaries.push(`${filename}: ${data.recipes.length} data recipes, ${recipes.size} runtime recipes`)
  }
} finally {
  console.log = originalLog
  await rm(resolve(root, ".tmp"), { recursive: true, force: true })
}

console.log(`Validated ${datasets.length} datasets and ${searchCases.length} search cases through the emitted TypeScript runtime.`)
for (const summary of summaries) {
  console.log(`- ${summary}`)
}

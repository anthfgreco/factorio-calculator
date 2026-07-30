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

console.log(`Validated ${datasets.length} datasets through the emitted TypeScript runtime.`)
for (const summary of summaries) {
  console.log(`- ${summary}`)
}

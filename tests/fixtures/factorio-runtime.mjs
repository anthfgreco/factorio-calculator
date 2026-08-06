import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dirname, "../..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:core")
const load = (path) => import(pathToFileURL(resolve(build, `${path}.js`)).href)

let parsedDataPromise = null

export async function loadCoreModules() {
  const [data, math, models, recipes, factory, planning] = await Promise.all([
    load("data"),
    load("math"),
    load("models"),
    load("recipes"),
    load("factory"),
    load("planning"),
  ])
  return { data, math, models, recipes, factory, planning }
}

export async function setupSpaceAgeFactory() {
  const modules = await loadCoreModules()
  parsedDataPromise ??= readFile(resolve(root, "public/data/space-age-2.1.13.json"), "utf8").then((text) =>
    modules.data.parseCalculatorData(JSON.parse(text)),
  )
  const data = await parsedDataPromise
  const items = modules.recipes.getItems(data)
  const recipes = modules.recipes.getRecipes(data, items)
  const buildings = modules.models.getBuildings(data, items)
  const planets = modules.models.getPlanets(data, recipes, buildings)
  const calculatorModules = modules.models.getModules(data, items)
  const belts = modules.models.getBelts(data)
  const fuel = modules.models.getFuel(data, items)
  const itemGroups = modules.models.getItemGroups(items, data)
  const productivity = modules.models.getRecipeProductivityResearch(data, recipes)
  const specification = new modules.factory.FactorySpecification()
  modules.models.configureModelRuntime({
    getSpecification: () => specification,
    useLegacyCalculation: () => false,
  })
  specification.setData(
    items,
    recipes,
    planets,
    calculatorModules,
    buildings,
    belts,
    fuel,
    itemGroups,
    productivity,
    modules.models.getBeaconPower(data),
  )
  specification.setDefaultPriority()
  return { ...modules, specification, items, recipes, planets, calculatorModules }
}

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import vm from "node:vm"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

vm.runInThisContext(await readFile(resolve(root, "public/third_party/BigInteger.min.js"), "utf8"))
globalThis.d3 = {
  local: () => ({
    get: () => null,
    set: () => undefined,
  }),
}
const load = (path) => import(pathToFileURL(resolve(build, `${path}.js`)).href)

const { DatasetValidationError, parseCalculatorData } = await load("data")
const { Matrix, powerRepresentation, Rational, one, zero } = await load("math")
const { itemMatchesSearch } = await load("data")
const { ModuleSpec, configureModelRuntime, getBuildings, getModules, getPlanets, getBelts, getFuel, getItemGroups } = await load("models")
const { getItems, getRecipes } = await load("recipes")
const { FactorySpecification } = await load("factory")
const { PriorityList } = await load("priorities")
const { solve, SolverFailure } = await load("solver")

test("dataset parser accepts the generated Space Age dataset", async () => {
  const raw = JSON.parse(await readFile(resolve(root, "public/data/space-age-2.1.12.json"), "utf8"))
  const data = parseCalculatorData(raw)
  assert.equal(data.game_version, "2.1.12")
  assert.ok(data.recipes.length > 600)
})

test("dataset parser reports the failing path", () => {
  assert.throws(
    () => parseCalculatorData({ items: [] }),
    (error) => error instanceof DatasetValidationError && error.path === "recipes",
  )
})

test("dataset parser rejects malformed machine effect lists", async () => {
  const raw = JSON.parse(await readFile(resolve(root, "public/data/space-age-2.1.12.json"), "utf8"))
  raw.crafting_machines[0].allowed_effects = {}
  assert.throws(
    () => parseCalculatorData(raw),
    (error) =>
      error instanceof DatasetValidationError && error.path === "crafting_machines[0].allowed_effects",
  )
})

test("rational arithmetic remains exact", () => {
  const oneThird = Rational.from_string("1/3")
  assert.equal(oneThird.add(oneThird).add(oneThird).toString(), "1")
  assert.equal(Rational.from_decimal("12.5").toString(), "25/2")
  assert.equal(Rational.from_float(-0.5).toString(), "-1/2")
})

test("power representation zero returns clean W suffix", () => {
  const { power, suffix } = powerRepresentation(zero)
  assert.equal(power.toString(), "0")
  assert.equal(suffix, "W")
})

test("matrix reduction preserves exact pivots", () => {
  const matrix = new Matrix(2, 3, [one, one, Rational.from_integer(3), one, zero, one])
  assert.deepEqual(matrix.rref(), [0, 1])
  assert.equal(matrix.index(0, 2).toString(), "1")
  assert.equal(matrix.index(1, 2).toString(), "2")
})

test("search handles aliases and spaced names", () => {
  assert.equal(itemMatchesSearch({ key: "fast-underground-belt", name: "Fast underground belt" }, "underground belt"), true)
  assert.equal(itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "red science"), true)
  assert.equal(itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "cyan"), false)
  assert.equal(zero.toString(), "0")
})



test("solver reports a missing production path", () => {
  const item = {
    key: "unproducible-item",
    name: "Unproducible item",
    recipes: [],
    uses: [],
    disableRecipe: null,
  }
  const specification = {
    ignore: new Set(),
    buildTargets: [],
    priority: [],
    fuel: { item },
    lastPartial: null,
    lastTableau: null,
    lastMetadata: null,
    lastSolution: null,
    getRecipes: () => [],
    getRecipeGraph: () => new Set(),
    getProdEffect: () => one,
    getBuilding: () => null,
  }

  assert.throws(
    () => solve(specification, [{ item, rate: one, recipe: null }]),
    (error) => error instanceof SolverFailure && error.code === "missing-recipe" && error.item === item,
  )
})

test("priority model stays deterministic without a DOM", () => {
  const low = { key: "low", isResource: () => true, defaultPriority: 0, defaultWeight: Rational.from_integer(2) }
  const high = { key: "high", isResource: () => true, defaultPriority: 0, defaultWeight: Rational.from_integer(1) }
  const defaults = PriorityList.getDefaultArray(new Map([[low.key, low], [high.key, high]]))
  const priority = PriorityList.fromArray(defaults)
  let notifications = 0
  priority.subscribe(() => notifications++)

  const level = priority.getFirstLevel()
  assert.deepEqual(level.resources.map((resource) => resource.recipe.key), ["high", "low"])
  priority.setWeight(priority.getResource(low), Rational.from_integer(0))
  assert.deepEqual(level.resources.map((resource) => resource.recipe.key), ["low", "high"])

  const newLevel = priority.addPriorityBefore(level)
  priority.setPriority(priority.getResource(high), newLevel)
  assert.equal(priority.getFirstLevel(), newLevel)
  assert.ok(notifications >= 3)
})

test("speedEffect clamps total speed multiplier to 20% minimum floor", () => {
  const prod3 = {
    speed: Rational.from_float(-0.15),
    productivity: Rational.from_float(0.1),
  }
  const spec = new ModuleSpec(null, { defaultBeacon: [], defaultBeaconCount: zero })
  spec.modules = Array(8).fill(prod3)
  assert.equal(spec.speedEffect().toString(), "1/5")
})

test("cryogenic science at 60 SPM in cryogenic plant with 8 productivity 3 modules has positive building count and power", async () => {
  const raw = JSON.parse(await readFile(resolve(root, "public/data/space-age-2.1.12.json"), "utf8"))
  const data = parseCalculatorData(raw)
  const items = getItems(data)
  const recipes = getRecipes(data, items)
  const buildings = getBuildings(data, items)
  const planets = getPlanets(data, recipes, buildings)
  const modules = getModules(data, items)
  const belts = getBelts(data)
  const fuel = getFuel(data, items)
  const itemGroups = getItemGroups(items, data)

  const factorySpec = new FactorySpecification()
  configureModelRuntime({
    getSpecification: () => factorySpec,
    useLegacyCalculation: () => false,
  })
  factorySpec.setData(items, recipes, planets, modules, buildings, belts, fuel, itemGroups)
  factorySpec.setDefaultPriority()

  const recipe = recipes.get("cryogenic-science-pack")
  const prod3 = modules.get("productivity-module-3")
  const plant = factorySpec.buildingKeys.get("cryogenic-plant")
  const mSpec = factorySpec.getModuleSpec(recipe)
  mSpec.setBuilding(plant, factorySpec)
  for (let i = 0; i < 8; i++) {
    mSpec.setModule(i, prod3)
  }

  const item = items.get("cryogenic-science-pack")
  const targetRate = Rational.from_integer(60).div(factorySpec.format.rateFactor)
  const totals = solve(factorySpec, [{ item, rate: targetRate, recipe: null }])
  const count = factorySpec.getCount(recipe, totals.rates.get(recipe))
  const { power } = factorySpec.getPowerUsage(recipe, totals.rates.get(recipe))

  assert.ok(zero.less(count), `Expected positive building count, got ${count.toString()}`)
  assert.ok(zero.less(power), `Expected positive power usage, got ${power.toString()}`)
})

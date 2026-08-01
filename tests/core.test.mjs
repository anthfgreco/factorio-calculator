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
const { ModuleSpec, configureModelRuntime, getBuildings, getModules, getPlanets, getBelts, getFuel, getItemGroups } =
  await load("models")
const { getExpectedResultAmount, getItems, getRecipes } = await load("recipes")
const { FactorySpecification } = await load("factory")
const { getFactorySummary } = await load("results")
const { PriorityList } = await load("priorities")
const { Ingredient, solve, SolverFailure } = await load("solver")

// Keep real-dataset solves location-scoped; unrestricted Space Age graphs include recycling cycles and can take minutes.
const DATASET_SOLVER_TIMEOUT_MS = 10_000
const SYNTHETIC_SOLVER_TIMEOUT_MS = 2_000

let testDatasetTextPromise = null
let parsedTestDataPromise = null

function getTestDatasetText() {
  testDatasetTextPromise ??= readFile(resolve(root, "public/data/space-age-2.1.12.json"), "utf8")
  return testDatasetTextPromise
}

function getParsedTestData() {
  parsedTestDataPromise ??= getTestDatasetText().then((text) => parseCalculatorData(JSON.parse(text)))
  return parsedTestDataPromise
}

async function createTestRuntime() {
  const data = await getParsedTestData()
  const items = getItems(data)
  const recipes = getRecipes(data, items)
  const buildings = getBuildings(data, items)
  const planets = getPlanets(data, recipes, buildings)
  const modules = getModules(data, items)
  const belts = getBelts(data)
  const fuel = getFuel(data, items)
  const itemGroups = getItemGroups(items, data)
  return { items, recipes, buildings, planets, modules, belts, fuel, itemGroups }
}

async function setupTestFactory() {
  const { items, recipes, buildings, planets, modules, belts, fuel, itemGroups } = await createTestRuntime()

  const factorySpec = new FactorySpecification()
  configureModelRuntime({
    getSpecification: () => factorySpec,
    useLegacyCalculation: () => false,
  })
  factorySpec.setData(items, recipes, planets, modules, buildings, belts, fuel, itemGroups)
  factorySpec.setDefaultPriority()

  return { factorySpec, items, recipes, buildings, planets, modules, belts, fuel, itemGroups }
}

test("dataset parser accepts the generated Space Age dataset", async () => {
  const data = await getParsedTestData()
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
  const raw = JSON.parse(await getTestDatasetText())
  raw.crafting_machines[0].allowed_effects = {}
  assert.throws(
    () => parseCalculatorData(raw),
    (error) => error instanceof DatasetValidationError && error.path === "crafting_machines[0].allowed_effects",
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

test("Factorio 2.1 independent and shared product probabilities combine", () => {
  const amount = getExpectedResultAmount({
    amount: 4,
    independent_probability: 0.5,
    shared_probability: { min: 0.25, max: 0.75 },
  })
  assert.equal(amount.toString(), "1")
})

test("search handles aliases and spaced names", () => {
  assert.equal(
    itemMatchesSearch({ key: "fast-underground-belt", name: "Fast underground belt" }, "underground belt"),
    true,
  )
  assert.equal(
    itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "red science"),
    true,
  )
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
    getFuelForRecipe: () => null,
  }

  assert.throws(
    () => solve(specification, [{ item, rate: one, recipe: null }]),
    (error) => error instanceof SolverFailure && error.code === "missing-recipe" && error.item === item,
  )
})

test("simplex productivity excludes catalyst and coolant returns", () => {
  const two = Rational.from_integer(2)
  const three = Rational.from_integer(3)

  function makeItem(key) {
    const item = { key, name: key, recipes: [], uses: [], disableRecipe: null }
    item.disableRecipe = {
      key: `disable-${key}`,
      name: key,
      ingredients: [],
      products: [new Ingredient(item, one)],
      getIngredients: () => [],
      gives: () => one,
      isReal: () => true,
      isDisable: () => true,
      isResource: () => false,
    }
    return item
  }

  const science = makeItem("science")
  const coolantCold = makeItem("coolant-cold")
  const coolantHot = makeItem("coolant-hot")

  const scienceRecipe = {
    key: "science-recipe",
    name: "Science recipe",
    ingredients: [new Ingredient(coolantCold, three)],
    products: [new Ingredient(science, one, one), new Ingredient(coolantHot, three, zero)],
    getIngredients() {
      return this.ingredients
    },
    gives(item) {
      if (item === science) return two
      if (item === coolantHot) return three
      throw new Error("unknown product")
    },
    isReal: () => true,
    isDisable: () => false,
    isResource: () => false,
  }
  const condensationRecipe = {
    key: "condensation",
    name: "Condensation",
    ingredients: [new Ingredient(coolantHot, three)],
    products: [new Ingredient(coolantCold, three)],
    getIngredients() {
      return this.ingredients
    },
    gives(item) {
      if (item === coolantCold) return three
      throw new Error("unknown product")
    },
    isReal: () => true,
    isDisable: () => false,
    isResource: () => false,
  }

  science.recipes.push(scienceRecipe)
  coolantCold.recipes.push(condensationRecipe)
  coolantCold.uses.push(scienceRecipe)
  coolantHot.recipes.push(scienceRecipe)
  coolantHot.uses.push(condensationRecipe)

  const recipes = new Set([scienceRecipe, condensationRecipe])
  const specification = {
    ignore: new Set(),
    buildTargets: [],
    priority: [],
    lastPartial: null,
    lastTableau: null,
    lastMetadata: null,
    lastSolution: null,
    getRecipes: (item) => item.recipes.filter((recipe) => recipes.has(recipe)),
    getRecipeGraph: () => new Set(recipes),
    getProdEffect: (recipe) => (recipe === scienceRecipe ? two : one),
    getBuilding: () => ({ fuel: null }),
    getFuelForRecipe: () => null,
  }

  const totals = solve(specification, [{ item: science, rate: one, recipe: null }])
  assert.equal(totals.rates.get(scienceRecipe).toString(), "1/2")
  assert.equal(totals.rates.get(condensationRecipe).toString(), "1/2")
  assert.equal(totals.surplus.size, 0)
})

test("priority model stays deterministic without a DOM", () => {
  const low = { key: "low", isResource: () => true, defaultPriority: 0, defaultWeight: Rational.from_integer(2) }
  const high = { key: "high", isResource: () => true, defaultPriority: 0, defaultWeight: Rational.from_integer(1) }
  const defaults = PriorityList.getDefaultArray(
    new Map([
      [low.key, low],
      [high.key, high],
    ]),
  )
  const priority = PriorityList.fromArray(defaults)
  let notifications = 0
  priority.subscribe(() => notifications++)

  const level = priority.getFirstLevel()
  assert.deepEqual(
    level.resources.map((resource) => resource.recipe.key),
    ["high", "low"],
  )
  priority.setWeight(priority.getResource(low), Rational.from_integer(0))
  assert.deepEqual(
    level.resources.map((resource) => resource.recipe.key),
    ["low", "high"],
  )

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

test(
  "cryogenic science at 60 SPM in cryogenic plant with 8 productivity 3 modules has positive building count and power",
  { timeout: DATASET_SOLVER_TIMEOUT_MS },
  async () => {
    const { factorySpec, items, recipes, planets, modules } = await setupTestFactory()
    factorySpec.selectOnePlanet(planets.get("aquilo"))

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
  },
)

test("changing the crafting machine after selecting Nauvis updates an existing magazine factory", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()

  const assemblingMachine1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const assemblingMachine2 = factorySpec.buildingKeys.get("assembling-machine-2")
  factorySpec.setMinimumBuilding(assemblingMachine1)
  factorySpec.selectOnePlanet(planets.get("nauvis"))

  const recipe = recipes.get("firearm-magazine")

  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-1")
  assert.doesNotThrow(() => factorySpec.setMinimumBuilding(assemblingMachine2))
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-2")
})

test("downgrading crafting machine truncates module slots and keeps productivity effect valid", async () => {
  const { factorySpec, recipes, modules } = await setupTestFactory()
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const prod3 = modules.get("productivity-module-3")
  const recipe = recipes.get("advanced-circuit")

  factorySpec.setMinimumBuilding(am3)
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  for (let i = 0; i < 4; i++) {
    moduleSpec.setModule(i, prod3)
  }
  assert.equal(moduleSpec.modules.length, 4)
  assert.equal(factorySpec.getProdEffect(recipe).toString(), "7/5")

  factorySpec.setMinimumBuilding(am2)
  assert.equal(moduleSpec.modules.length, 2)
  assert.equal(factorySpec.getProdEffect(recipe).toString(), "6/5")
})

test("downgrading crafting machine to zero slots clears modules without calculation errors", async () => {
  const { factorySpec, recipes, modules } = await setupTestFactory()
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const am1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const prod1 = modules.get("productivity-module")
  const recipe = recipes.get("electronic-circuit")

  factorySpec.setMinimumBuilding(am2)
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  moduleSpec.setModule(0, prod1)
  moduleSpec.setModule(1, prod1)
  assert.equal(moduleSpec.modules.length, 2)

  factorySpec.setMinimumBuilding(am1)
  assert.equal(factorySpec.getProdEffect(recipe).toString(), "1")
})

test("upgrading crafting machine expands module slots and populates default module", async () => {
  const { factorySpec, recipes, modules } = await setupTestFactory()
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const speed3 = modules.get("speed-module-3")
  const recipe = recipes.get("firearm-magazine")

  factorySpec.setDefaultModule(speed3)
  factorySpec.setMinimumBuilding(am3)
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  assert.ok(moduleSpec !== undefined, "Expected moduleSpec to be defined for AM3")
  assert.equal(moduleSpec.modules.length, 4)
  assert.deepEqual(moduleSpec.modules, [speed3, speed3, speed3, speed3])
})

test("selecting Nauvis after setting minimum building preserves machine selection for populated module spec", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const recipe = recipes.get("firearm-magazine")

  factorySpec.setMinimumBuilding(am2)
  const moduleSpec = factorySpec.getModuleSpec(recipe)

  assert.equal(moduleSpec.building.key, "assembling-machine-2")
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-2")
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  assert.equal(moduleSpec.building.key, "assembling-machine-2")
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-2")
})

test("switching planet to Aquilo updates building availability for cryogenic science pack recipe", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const aquilo = planets.get("aquilo")
  const nauvis = planets.get("nauvis")
  const recipe = recipes.get("cryogenic-science-pack")
  const plant = factorySpec.buildingKeys.get("cryogenic-plant")

  factorySpec.selectOnePlanet(nauvis)
  assert.equal(factorySpec.isBuildingAvailable(plant, recipe), false)

  factorySpec.selectOnePlanet(aquilo)
  assert.equal(factorySpec.isBuildingAvailable(plant, recipe), true)
})

test("deselecting all planets restores default building availability while preserving custom specs", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const nauvis = planets.get("nauvis")
  const recipe = recipes.get("firearm-magazine")

  factorySpec.selectOnePlanet(nauvis)
  const moduleSpec = factorySpec.getModuleSpec(recipe)

  factorySpec.selectedPlanets.clear()
  assert.equal(factorySpec.getModuleSpec(recipe), moduleSpec)
  assert.ok(factorySpec.getBuilding(recipe) !== null)
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-1")
})

test("setting minimum building before or after selectOnePlanet yields identical building selections", async () => {
  const { factorySpec: specA, recipes: recipesA, planets: planetsA } = await setupTestFactory()
  const { factorySpec: specB, recipes: recipesB, planets: planetsB } = await setupTestFactory()

  const am2A = specA.buildingKeys.get("assembling-machine-2")
  specA.setMinimumBuilding(am2A)
  specA.selectOnePlanet(planetsA.get("nauvis"))

  const am2B = specB.buildingKeys.get("assembling-machine-2")
  specB.selectOnePlanet(planetsB.get("nauvis"))
  specB.setMinimumBuilding(am2B)

  const rA = recipesA.get("firearm-magazine")
  const rB = recipesB.get("firearm-magazine")
  assert.equal(specA.getBuilding(rA).key, specB.getBuilding(rB).key)
  assert.equal(specA.getBuilding(rA).key, "assembling-machine-2")
})

test("changing minimum furnace from Stone Furnace to Electric Furnace changes fuel requirement from coal to null", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const stoneFurnace = factorySpec.buildingKeys.get("stone-furnace")
  const electricFurnace = factorySpec.buildingKeys.get("electric-furnace")
  const recipe = recipes.get("iron-plate")

  factorySpec.setMinimumBuilding(stoneFurnace)
  assert.equal(factorySpec.getBuilding(recipe).key, "stone-furnace")
  assert.equal(factorySpec.getFuelForRecipe(recipe).key, "coal")

  factorySpec.setMinimumBuilding(electricFurnace)
  assert.equal(factorySpec.getBuilding(recipe).key, "electric-furnace")
  assert.equal(factorySpec.getFuelForRecipe(recipe), null)
})

test("changing minimum furnace from Electric Furnace to Stone Furnace restores fuel requirement", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const stoneFurnace = factorySpec.buildingKeys.get("stone-furnace")
  const electricFurnace = factorySpec.buildingKeys.get("electric-furnace")
  const recipe = recipes.get("copper-plate")

  factorySpec.setMinimumBuilding(electricFurnace)
  assert.equal(factorySpec.getFuelForRecipe(recipe), null)

  factorySpec.setMinimumBuilding(stoneFurnace)
  assert.equal(factorySpec.getBuilding(recipe).key, "stone-furnace")
  assert.equal(factorySpec.getFuelForRecipe(recipe).key, "coal")
})

test("changing crafting machine tier updates calculated power usage", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const am1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const recipe = recipes.get("firearm-magazine")
  const rate = Rational.from_integer(1).div(factorySpec.format.rateFactor)

  factorySpec.setMinimumBuilding(am1)
  const power1 = factorySpec.getPowerUsage(recipe, rate).power

  factorySpec.setMinimumBuilding(am2)
  const power2 = factorySpec.getPowerUsage(recipe, rate).power

  assert.ok(!power1.equal(power2), "Expected power usage to change between AM1 and AM2")
  assert.ok(zero.less(power1))
  assert.ok(zero.less(power2))
})

test("switching from beaconable to non-beaconable machine ignores beacon effects without throwing", async () => {
  const { factorySpec, recipes, modules } = await setupTestFactory()
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const am1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const speed3 = modules.get("speed-module-3")
  const recipe = recipes.get("firearm-magazine")

  factorySpec.setMinimumBuilding(am2)
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  moduleSpec.setBeaconModule(speed3, 0)
  moduleSpec.beaconCount = Rational.from_integer(8)

  assert.doesNotThrow(() => factorySpec.setMinimumBuilding(am1))
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-1")
  assert.equal(factorySpec.getBuilding(recipe).canBeacon(), false)
})

test("changing minimum crafting machine leaves furnace minimum building isolated", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const steelFurnace = factorySpec.buildingKeys.get("steel-furnace")
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")

  factorySpec.setMinimumBuilding(steelFurnace)
  factorySpec.setMinimumBuilding(am3)

  assert.equal(factorySpec.getBuilding(recipes.get("iron-plate")).key, "steel-furnace")
  assert.equal(factorySpec.getBuilding(recipes.get("firearm-magazine")).key, "assembling-machine-3")
})

test("changing minimum building updates all pre-existing module specs in that crafting category", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const r1 = recipes.get("firearm-magazine")
  const r2 = recipes.get("electronic-circuit")
  const r3 = recipes.get("iron-gear-wheel")

  factorySpec.setMinimumBuilding(am2)
  factorySpec.getModuleSpec(r1)
  factorySpec.getModuleSpec(r2)
  factorySpec.getModuleSpec(r3)

  factorySpec.setMinimumBuilding(am3)

  assert.equal(factorySpec.getModuleSpec(r1).building.key, "assembling-machine-3")
  assert.equal(factorySpec.getModuleSpec(r2).building.key, "assembling-machine-3")
  assert.equal(factorySpec.getModuleSpec(r3).building.key, "assembling-machine-3")
})

test("factorySpec.getCount updates building count when machine crafting speed changes", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const am1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const recipe = recipes.get("iron-gear-wheel")
  const rate = Rational.from_integer(10).div(factorySpec.format.rateFactor)

  factorySpec.setMinimumBuilding(am1)
  const count1 = factorySpec.getCount(recipe, rate)

  factorySpec.setMinimumBuilding(am3)
  const count3 = factorySpec.getCount(recipe, rate)

  assert.ok(count3.less(count1), `Expected count3 (${count3}) to be less than count1 (${count1})`)
})

test(
  "productivity module effect recalculates correctly when machine is downgraded",
  { timeout: DATASET_SOLVER_TIMEOUT_MS },
  async () => {
    const { factorySpec, items, recipes, planets, modules } = await setupTestFactory()
    const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
    const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
    const prod3 = modules.get("productivity-module-3")
    const item = items.get("advanced-circuit")
    const recipe = recipes.get("advanced-circuit")

    factorySpec.selectOnePlanet(planets.get("nauvis"))
    factorySpec.setMinimumBuilding(am3)
    const mSpec = factorySpec.getModuleSpec(recipe)
    for (let i = 0; i < 4; i++) {
      mSpec.setModule(i, prod3)
    }

    const targetRate = Rational.from_integer(10).div(factorySpec.format.rateFactor)
    const totalsBefore = solve(factorySpec, [{ item, rate: targetRate, recipe: null }])
    const rateBefore = totalsBefore.rates.get(recipes.get("electronic-circuit"))

    factorySpec.setMinimumBuilding(am2)
    const totalsAfter = solve(factorySpec, [{ item, rate: targetRate, recipe: null }])
    const rateAfter = totalsAfter.rates.get(recipes.get("electronic-circuit"))

    assert.ok(rateBefore.less(rateAfter), "Expected electronic circuit demand to be higher with fewer prod modules")
  },
)

test("custom minimum building update synchronizes all recipes in crafting category", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const am1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const rMagazine = recipes.get("firearm-magazine")
  const rGear = recipes.get("iron-gear-wheel")

  factorySpec.setMinimumBuilding(am2)
  const mSpec = factorySpec.getModuleSpec(rMagazine)
  assert.equal(mSpec.building.key, "assembling-machine-2")

  factorySpec.setMinimumBuilding(am3)
  assert.equal(mSpec.building.key, "assembling-machine-3")
  assert.equal(factorySpec.getBuilding(rGear).key, "assembling-machine-3")

  factorySpec.setMinimumBuilding(am1)
  assert.equal(factorySpec.getBuilding(rGear).key, "assembling-machine-1")
})

test("selecting Fulgora makes Electromagnetic Plant available for compatible electronics recipes", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const fulgora = planets.get("fulgora")
  const recipe = recipes.get("processing-unit")

  factorySpec.selectOnePlanet(fulgora)
  const emPlant = factorySpec.buildingKeys.get("electromagnetic-plant")

  assert.equal(factorySpec.isBuildingAvailable(emPlant, recipe), true)
})

test("switching planets from Nauvis to Aquilo and back preserves valid spec building states", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const nauvis = planets.get("nauvis")
  const aquilo = planets.get("aquilo")
  const recipe = recipes.get("firearm-magazine")
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")

  factorySpec.setMinimumBuilding(am2)
  factorySpec.selectOnePlanet(nauvis)
  const moduleSpec = factorySpec.getModuleSpec(recipe)

  assert.doesNotThrow(() => factorySpec.selectOnePlanet(aquilo))
  assert.doesNotThrow(() => factorySpec.selectOnePlanet(nauvis))
  assert.equal(moduleSpec.building.key, "assembling-machine-2")
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-2")
})

test("burner machines use their own fuel category and consumption-module effects", async () => {
  const { factorySpec, recipes, modules } = await setupTestFactory()

  const biofluxRecipe = recipes.get("bioflux")
  const biochamber = factorySpec.buildingKeys.get("biochamber")
  const moduleSpec = factorySpec.getModuleSpec(biofluxRecipe)
  moduleSpec.setBuilding(biochamber, factorySpec)

  const nutrientFuel = factorySpec.getFuelForRecipe(biofluxRecipe)
  assert.equal(nutrientFuel.key, "nutrients")
  const baseFuelAmount = biofluxRecipe.fuelIngredient()[0].amount

  const efficiency3 = modules.get("efficiency-module-3")
  for (let index = 0; index < biochamber.moduleSlots; index++) {
    moduleSpec.setModule(index, efficiency3)
  }
  const efficientFuelAmount = biofluxRecipe.fuelIngredient()[0].amount
  assert.equal(efficientFuelAmount.div(baseFuelAmount).toString(), "1/5")

  const summary = getFactorySummary(factorySpec, {
    rates: new Map([[biofluxRecipe, one]]),
    items: new Set(),
  })
  assert.equal(summary.fuelRates.get(nutrientFuel).toString(), efficientFuelAmount.toString())

  const biterEggRecipe = recipes.get("biter-egg")
  assert.equal(factorySpec.getFuelForRecipe(biterEggRecipe).key, "bioflux")
})

test("solver handles a 500-step production chain with exact rates", { timeout: SYNTHETIC_SOLVER_TIMEOUT_MS }, () => {
  const depth = 500
  const items = Array.from({ length: depth + 1 }, (_, index) => ({
    key: `chain-item-${index}`,
    name: `Chain item ${index}`,
    recipes: [],
    uses: [],
    disableRecipe: null,
  }))
  const recipes = []

  for (let index = 0; index <= depth; index++) {
    const ingredient = index === depth ? [] : [new Ingredient(items[index + 1], one)]
    const recipe = {
      key: `chain-recipe-${index}`,
      name: `Chain recipe ${index}`,
      ingredients: ingredient,
      products: [new Ingredient(items[index], one)],
      getIngredients() {
        return this.ingredients
      },
      gives: (item) => {
        if (item === items[index]) return one
        throw new Error("unknown product")
      },
      isReal: () => true,
      isDisable: () => false,
      isResource: () => index === depth,
    }
    items[index].recipes.push(recipe)
    if (index < depth) {
      items[index + 1].uses.push(recipe)
    }
    items[index].disableRecipe = recipe
    recipes.push(recipe)
  }

  const recipeSet = new Set(recipes)
  const specification = {
    ignore: new Set(),
    buildTargets: [],
    priority: [],
    lastPartial: null,
    lastTableau: null,
    lastMetadata: null,
    lastSolution: null,
    getRecipes: (item) => item.recipes,
    getRecipeGraph: () => new Set(recipeSet),
    getProdEffect: () => one,
    getBuilding: () => null,
    getFuelForRecipe: () => null,
  }

  const totals = solve(specification, [{ item: items[0], rate: one, recipe: null }])
  assert.equal(totals.rates.get(recipes[0]).toString(), "1")
  assert.equal(totals.rates.get(recipes[depth]).toString(), "1")
  assert.equal([...totals.rates].filter(([recipe]) => recipe.isReal()).length, depth + 1)
})

test(
  "solver returns a typed failure for an infeasible zero-net cycle",
  { timeout: SYNTHETIC_SOLVER_TIMEOUT_MS },
  () => {
    const item = { key: "closed-loop", name: "Closed loop", recipes: [], uses: [], disableRecipe: null }
    const recipe = {
      key: "closed-loop",
      name: "Closed loop",
      ingredients: [new Ingredient(item, one)],
      products: [new Ingredient(item, one)],
      getIngredients() {
        return this.ingredients
      },
      gives: () => one,
      isReal: () => true,
      isDisable: () => false,
      isResource: () => false,
    }
    item.recipes.push(recipe)
    item.uses.push(recipe)
    item.disableRecipe = recipe

    const specification = {
      ignore: new Set(),
      buildTargets: [],
      priority: [],
      lastPartial: null,
      lastTableau: null,
      lastMetadata: null,
      lastSolution: null,
      getRecipes: () => [recipe],
      getRecipeGraph: () => new Set([recipe]),
      getProdEffect: () => one,
      getBuilding: () => null,
      getFuelForRecipe: () => null,
    }

    assert.throws(
      () => solve(specification, [{ item, rate: one, recipe: null }]),
      (error) => error instanceof SolverFailure && error.code === "infeasible",
    )
  },
)

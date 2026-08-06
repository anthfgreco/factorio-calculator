import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

const load = (path) => import(pathToFileURL(resolve(build, `${path}.js`)).href)

const { DatasetValidationError, parseCalculatorData } = await load("data")
const { Matrix, powerRepresentation, Rational, one, zero } = await load("math")
const { itemMatchesSearch } = await load("data")
const {
  ModuleSpec,
  configureModelRuntime,
  getBeaconPower: getConfiguredBeaconPower,
  getBuildings,
  getModules,
  getPlanets,
  getBelts,
  getFuel,
  getItemGroups,
  getRecipeProductivityResearch,
} = await load("models")
const { getExpectedResultAmount, getItems, getRecipes } = await load("recipes")
const { FactorySpecification, resetSpec } = await load("factory")
const { handleTargetQualityChange } = await load("ui")
const { getFactorySummary } = await load("results")
const { PriorityList } = await load("priorities")
const { Ingredient, solve, SolverFailure } = await load("solver")
const {
  getAquiloHeat,
  getAsteroidConstraintReport,
  getBeaconPower,
  getFreshnessReport,
  getPollution,
  getPollutionComponents,
  getQualityTargetFeasibility,
  getRocketLaunchReport,
  getTransportFlows,
  qualityProbability,
} = await load("planning")

// Keep real-dataset solves location-scoped; unrestricted Space Age graphs include recycling cycles and can take minutes.
const DATASET_SOLVER_TIMEOUT_MS = 10_000
const SYNTHETIC_SOLVER_TIMEOUT_MS = 2_000

let testDatasetTextPromise = null
let parsedTestDataPromise = null

function getTestDatasetText() {
  testDatasetTextPromise ??= readFile(resolve(root, "public/data/space-age-2.1.13.json"), "utf8")
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
  const recipeProductivityResearch = getRecipeProductivityResearch(data, recipes)
  const beaconPower = getConfiguredBeaconPower(data)
  return {
    items,
    recipes,
    buildings,
    planets,
    modules,
    belts,
    fuel,
    itemGroups,
    recipeProductivityResearch,
    beaconPower,
  }
}

async function setupTestFactory() {
  const {
    items,
    recipes,
    buildings,
    planets,
    modules,
    belts,
    fuel,
    itemGroups,
    recipeProductivityResearch,
    beaconPower,
  } = await createTestRuntime()

  const factorySpec = new FactorySpecification()
  configureModelRuntime({
    getSpecification: () => factorySpec,
    useLegacyCalculation: () => false,
  })
  factorySpec.setData(
    items,
    recipes,
    planets,
    modules,
    buildings,
    belts,
    fuel,
    itemGroups,
    recipeProductivityResearch,
    beaconPower,
  )
  factorySpec.setDefaultPriority()

  return {
    factorySpec,
    items,
    recipes,
    buildings,
    planets,
    modules,
    belts,
    fuel,
    itemGroups,
    recipeProductivityResearch,
  }
}

test("dataset parser accepts the generated Space Age dataset", async () => {
  const data = await getParsedTestData()
  assert.equal(data.game_version, "2.1.13")
  assert.ok(data.recipes.length > 600)
  assert.deepEqual(data.rocket_launch, {
    buffered: true,
    launch_cycle_ticks: 1614,
    parts_per_launch: 50,
  })
  assert.equal(data.planets.find((planet) => planet.key === "nauvis").pollutant_type, "pollution")
  assert.equal(data.planets.find((planet) => planet.key === "gleba").pollutant_type, "spores")
  assert.deepEqual(data.plants.find((plant) => plant.key === "yumako-tree").harvest_emissions, { spores: 15 })
})

test("Factorio 2.1.13 recycling times scale with recipe result counts", async () => {
  const data = await getParsedTestData()
  assert.equal(data.recipes.find((recipe) => recipe.key === "concrete-recycling").energy_required, 0.0625)
  assert.equal(data.recipes.find((recipe) => recipe.key === "land-mine-recycling").energy_required, 0.078125)
})

test("generated Space Age data includes every official recipe productivity research effect", async () => {
  const data = await getParsedTestData()
  const actual = Object.fromEntries(
    data.recipe_productivity_research.map((research) => [
      research.key,
      research.effects.map((effect) => `${effect.recipe}:${effect.change}`).sort(),
    ]),
  )
  assert.deepEqual(actual, {
    "asteroid-productivity": [
      "advanced-carbonic-asteroid-crushing:0.1",
      "advanced-metallic-asteroid-crushing:0.1",
      "advanced-oxide-asteroid-crushing:0.1",
      "carbonic-asteroid-crushing:0.1",
      "metallic-asteroid-crushing:0.1",
      "oxide-asteroid-crushing:0.1",
    ],
    "low-density-structure-productivity": ["casting-low-density-structure:0.1", "low-density-structure:0.1"],
    "plastic-bar-productivity": ["bioplastic:0.1", "plastic-bar:0.1"],
    "processing-unit-productivity": ["processing-unit:0.1"],
    "rocket-fuel-productivity": ["ammonia-rocket-fuel:0.1", "rocket-fuel-from-jelly:0.1", "rocket-fuel:0.1"],
    "rocket-part-productivity": ["rocket-part:0.1"],
    "scrap-recycling-productivity": ["scrap-recycling:0.1"],
    "steel-plate-productivity": ["casting-steel:0.1", "steel-plate:0.1"],
  })
  assert.equal(
    data.recipes.every((recipe) => recipe.maximum_productivity === 3),
    true,
  )
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

test("dataset parser rejects malformed recipe productivity research", async () => {
  const raw = structuredClone(await getParsedTestData())
  raw.recipe_productivity_research[0].effects[0].change = -0.1
  assert.throws(
    () => parseCalculatorData(raw),
    (error) =>
      error instanceof DatasetValidationError && error.path === "recipe_productivity_research[0].effects[0].change",
  )
})

test("dataset parser validates advanced planning metadata", async () => {
  const raw = structuredClone(await getParsedTestData())
  raw.plants[0].growth_ticks = "five minutes"
  assert.throws(
    () => parseCalculatorData(raw),
    (error) => error instanceof DatasetValidationError && error.path === "plants[0].growth_ticks",
  )

  raw.plants[0].growth_ticks = 18_000
  raw.agricultural_tower[0].energy_source.emissions_per_minute.spores = "four"
  assert.throws(
    () => parseCalculatorData(raw),
    (error) =>
      error instanceof DatasetValidationError &&
      error.path === "agricultural_tower[0].energy_source.emissions_per_minute.spores",
  )

  raw.agricultural_tower[0].energy_source.emissions_per_minute.spores = 4
  raw.plants[0].harvest_emissions.spores = "fifteen"
  assert.throws(
    () => parseCalculatorData(raw),
    (error) => error instanceof DatasetValidationError && error.path === "plants[0].harvest_emissions.spores",
  )

  raw.plants[0].harvest_emissions.spores = 15
  raw.rocket_launch.launch_cycle_ticks = 0
  assert.throws(
    () => parseCalculatorData(raw),
    (error) => error instanceof DatasetValidationError && error.path === "rocket_launch.launch_cycle_ticks",
  )

  raw.rocket_launch.launch_cycle_ticks = 1614
  raw.planets[0].pollutant_type = 42
  assert.throws(
    () => parseCalculatorData(raw),
    (error) => error instanceof DatasetValidationError && error.path === "planets[0].pollutant_type",
  )
})

test("rational arithmetic remains exact", () => {
  const oneThird = Rational.from_string("1/3")
  assert.equal(oneThird.add(oneThird).add(oneThird).toString(), "1")
  assert.equal(Rational.from_decimal("12.5").toString(), "25/2")
  assert.equal(Rational.from_float(-0.5).toString(), "-1/2")
})

test("rational display formatting preserves exact rounding semantics", () => {
  assert.equal(Rational.from_string("1/3").toDecimal(3), "0.333")
  assert.equal(Rational.from_string("2/3").toDecimal(3), "0.667")
  assert.equal(Rational.from_string("1/2").toDecimal(3), "0.5")
  assert.equal(Rational.from_string("1999/200").toDecimal(2), "10.00")
  assert.equal(Rational.from_string("-1/8").toDecimal(3), "-0.125")
  assert.equal(Rational.from_string("1/1000").toDecimal(3, zero), "0.001")
})

test("rational zero and equal-denominator operations keep exact fast paths", () => {
  const oneThird = Rational.from_string("1/3")
  const twoThirds = Rational.from_string("2/3")
  assert.equal(oneThird.add(zero), oneThird)
  assert.equal(zero.add(oneThird), oneThird)
  assert.equal(oneThird.add(twoThirds).toString(), "1")
  assert.equal(twoThirds.sub(oneThird).toString(), "1/3")
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

test("search handles common Factorio item names", () => {
  assert.equal(itemMatchesSearch({ key: "electronic-circuit", name: "Electronic circuit" }, "green chip"), true)
  assert.equal(itemMatchesSearch({ key: "advanced-circuit", name: "Advanced circuit" }, "red chips"), true)
  assert.equal(itemMatchesSearch({ key: "processing-unit", name: "Processing unit" }, "blue chip"), true)
  assert.equal(itemMatchesSearch({ key: "processing-unit", name: "Processing unit" }, "chip"), true)
  assert.equal(itemMatchesSearch({ key: "iron-plate", name: "Iron plate" }, "chip"), false)

  assert.equal(itemMatchesSearch({ key: "firearm-magazine", name: "Firearm magazine" }, "yellow magazine"), true)
  assert.equal(
    itemMatchesSearch({ key: "piercing-rounds-magazine", name: "Piercing rounds magazine" }, "red magazines"),
    true,
  )
  assert.equal(
    itemMatchesSearch({ key: "uranium-rounds-magazine", name: "Uranium rounds magazine" }, "green magazine"),
    true,
  )

  assert.equal(itemMatchesSearch({ key: "fast-transport-belt", name: "Fast transport belt" }, "red belt"), true)
  assert.equal(
    itemMatchesSearch({ key: "express-underground-belt", name: "Express underground belt" }, "blue underground belts"),
    true,
  )
  assert.equal(itemMatchesSearch({ key: "turbo-splitter", name: "Turbo splitter" }, "green splitters"), true)

  assert.equal(itemMatchesSearch({ key: "low-density-structure", name: "Low density structure" }, "LDS"), true)
  assert.equal(itemMatchesSearch({ key: "construction-robot", name: "Construction robot" }, "construction bots"), true)
  assert.equal(itemMatchesSearch({ key: "copper-cable", name: "Copper cable" }, "copper wire"), true)
  assert.equal(itemMatchesSearch({ key: "iron-gear-wheel", name: "Iron gear wheel" }, "gears"), true)
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

test("recipe productivity researches are independent and apply to every exported recipe", async () => {
  const { factorySpec, recipes, recipeProductivityResearch } = await setupTestFactory()
  const unrelatedRecipe = recipes.get("copper-cable")

  let level = 1
  for (let research of recipeProductivityResearch.values()) {
    assert.equal(factorySpec.setRecipeProductivityLevel(research.key, level), true)
    for (let [recipe, change] of research.effects) {
      assert.equal(factorySpec.getRecipeProductivityBonus(recipe).equal(change.mul(Rational.from_integer(level))), true)
    }
    assert.equal(factorySpec.getRecipeProductivityBonus(unrelatedRecipe).isZero(), true)
    factorySpec.setRecipeProductivityLevel(research.key, 0)
    level += 1
  }

  assert.equal(factorySpec.setRecipeProductivityLevel("unknown-productivity", 10), false)
  factorySpec.setRecipeProductivityLevel("steel-plate-productivity", 0.5)
  assert.equal(factorySpec.getRecipeProductivityLevel("steel-plate-productivity"), 0.5)
  let steelPlate = recipes.get("steel-plate")
  assert.equal(factorySpec.getRecipeProductivityBonus(steelPlate).equal(Rational.from_floats(5, 100)), true)
  factorySpec.setRecipeProductivityLevel("steel-plate-productivity", -1)
  assert.equal(factorySpec.getRecipeProductivityLevel("steel-plate-productivity"), 0)
})

test("recipe productivity respects the recipe cap while mining productivity remains uncapped", async () => {
  const { factorySpec, recipes } = await setupTestFactory()
  const processingUnit = recipes.get("processing-unit")
  factorySpec.setRecipeProductivityLevel("processing-unit-productivity", 31)
  assert.equal(factorySpec.getProdEffect(processingUnit).equal(Rational.from_integer(4)), true)

  const ironOre = recipes.get("iron-ore")
  factorySpec.miningProd = Rational.from_integer(4)
  assert.equal(factorySpec.getProdEffect(ironOre).equal(Rational.from_integer(5)), true)
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

test("recipe building override stays exact when the automatic machine tier changes", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const recipe = recipes.get("processing-unit")
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const emPlant = factorySpec.buildingKeys.get("electromagnetic-plant")

  factorySpec.selectOnePlanet(planets.get("fulgora"))
  factorySpec.setMinimumBuilding(am2)

  assert.equal(factorySpec.setBuildingOverride(recipe, emPlant), true)
  assert.equal(factorySpec.getBuildingOverride(recipe), emPlant)
  assert.equal(factorySpec.getBuilding(recipe), emPlant)
  assert.equal(factorySpec.getModuleSpec(recipe).building, emPlant)

  factorySpec.setMinimumBuilding(am3)
  assert.equal(factorySpec.getBuilding(recipe), emPlant)
  assert.equal(factorySpec.getModuleSpec(recipe).building, emPlant)

  factorySpec.setBuildingOverride(recipe, null)
  assert.equal(factorySpec.getBuildingOverride(recipe), null)
  assert.equal(factorySpec.getBuilding(recipe), am3)
  assert.equal(factorySpec.getModuleSpec(recipe).building, am3)
})

test("automatic machines support explicit multiple selections without selecting lower tiers", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const recipe = recipes.get("processing-unit")
  const am1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const am2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const am3 = factorySpec.buildingKeys.get("assembling-machine-3")
  const emPlant = factorySpec.buildingKeys.get("electromagnetic-plant")

  factorySpec.selectOnePlanet(planets.get("fulgora"))
  factorySpec.setMinimumBuilding(am2)
  assert.equal(factorySpec.setAutomaticBuildingEnabled(emPlant, true), true)

  assert.equal(factorySpec.isAutomaticBuildingEnabled(am1), false)
  assert.equal(factorySpec.isAutomaticBuildingEnabled(am2), true)
  assert.equal(factorySpec.isAutomaticBuildingEnabled(am3), false)
  assert.equal(factorySpec.isAutomaticBuildingEnabled(emPlant), true)
  assert.equal(factorySpec.getAutomaticBuilding(recipe), emPlant)

  assert.equal(factorySpec.setAutomaticBuildingEnabled(emPlant, false), true)
  assert.equal(factorySpec.getAutomaticBuilding(recipe), am2)
  assert.equal(factorySpec.setAutomaticBuildingEnabled(am2, false), false)
  assert.equal(factorySpec.isAutomaticBuildingEnabled(am2), true)
})

test("automatic machine preferences choose compatible baseline and specialized machines", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  factorySpec.setAutomaticBuildingPreferences(
    ["assembling-machine-1", "chemical-plant", "stone-furnace", "electric-mining-drill"].map((key) =>
      factorySpec.buildingKeys.get(key),
    ),
  )

  factorySpec.selectOnePlanet(planets.get("nauvis"))
  assert.equal(factorySpec.getBuilding(recipes.get("iron-gear-wheel")).key, "assembling-machine-1")
  assert.equal(factorySpec.getBuilding(recipes.get("sulfuric-acid")).key, "chemical-plant")
  assert.equal(factorySpec.getBuilding(recipes.get("iron-plate")).key, "stone-furnace")

  const preferredKeys = [
    "assembling-machine-3",
    "chemical-plant",
    "foundry",
    "electromagnetic-plant",
    "biochamber",
    "cryogenic-plant",
    "electric-furnace",
    "big-mining-drill",
  ]
  factorySpec.setAutomaticBuildingPreferences(preferredKeys.map((key) => factorySpec.buildingKeys.get(key)))

  assert.equal(factorySpec.getBuilding(recipes.get("iron-gear-wheel")).key, "assembling-machine-3")
  assert.equal(factorySpec.getBuilding(recipes.get("iron-plate")).key, "electric-furnace")

  factorySpec.selectOnePlanet(planets.get("fulgora"))
  assert.equal(factorySpec.getBuilding(recipes.get("processing-unit")).key, "electromagnetic-plant")
})

test("recipe building overrides reject incompatible machines", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const recipe = recipes.get("processing-unit")
  const emPlant = factorySpec.buildingKeys.get("electromagnetic-plant")
  const electricFurnace = factorySpec.buildingKeys.get("electric-furnace")

  factorySpec.selectOnePlanet(planets.get("fulgora"))
  assert.equal(factorySpec.setBuildingOverride(recipe, electricFurnace), false)
  assert.equal(factorySpec.setBuildingOverride(recipe, emPlant), true)
  assert.equal(factorySpec.getBuildingOverride(recipe), emPlant)
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
    proportionate: [],
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

test("Gleba plants include harvest spores and always-on agricultural tower spores", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("gleba"))
  const recipe = recipes.get("yumako-tree")
  const tower = factorySpec.getBuilding(recipe)
  const oneTowerRate = Rational.from_floats(47, 300)
  assert.equal(recipe.time.toString(), "300")
  assert.equal(tower.key, "agricultural-tower")
  assert.equal(factorySpec.getRecipeRate(recipe).toString(), "47/300")
  assert.equal(factorySpec.getCount(recipe, oneTowerRate).toString(), "1")

  const spores = getPollutionComponents(factorySpec, recipe, oneTowerRate, "spores")
  assert.equal(spores.machine.toString(), "4")
  assert.equal(spores.process.toString(), "141")
  assert.equal(spores.total.toString(), "145")

  const halfTowerRate = Rational.from_floats(47, 600)
  const fractionalTowerSpores = getPollutionComponents(factorySpec, recipe, halfTowerRate, "spores")
  assert.equal(factorySpec.getCount(recipe, halfTowerRate).toString(), "1/2")
  assert.equal(fractionalTowerSpores.machine.toString(), "4")
  assert.equal(fractionalTowerSpores.process.toString(), "141/2")
  assert.equal(fractionalTowerSpores.total.toString(), "149/2")

  assert.equal(getPollution(factorySpec, recipe, oneTowerRate, "pollution").toString(), "0")
  assert.equal(planets.get("space-platform").allowsRecipe(recipe), false)
})

test("pollution reporting follows the assigned surface pollutant", async () => {
  const { factorySpec, recipes, planets } = await setupTestFactory()
  const recipe = recipes.get("iron-plate")

  factorySpec.selectOnePlanet(planets.get("nauvis"))
  assert.ok(zero.less(getPollution(factorySpec, recipe, one, "pollution")))

  factorySpec.selectOnePlanet(planets.get("gleba"))
  assert.equal(getPollution(factorySpec, recipe, one, "pollution").toString(), "0")
  assert.equal(getPollution(factorySpec, recipe, one, "spores").toString(), "0")

  factorySpec.selectOnePlanet(planets.get("vulcanus"))
  assert.equal(getPollution(factorySpec, recipe, one, "pollution").toString(), "0")
})

test("Space Age rocket silos overlap crafting and expose the launch-animation cap", async () => {
  const { factorySpec, recipes, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("rocket-part")
  const silo = factorySpec.getBuilding(recipe)

  let stats = silo.getLaunchStats(factorySpec)
  assert.equal(stats.buffered, true)
  assert.equal(stats.partsPerLaunch.toString(), "50")
  assert.equal(stats.craftsPerLaunch.toString(), "50")
  assert.equal(stats.launch.toString(), "1/150")
  assert.equal(factorySpec.getRecipeRate(recipe).toString(), "1/3")
  assert.equal(stats.launchLimited, false)

  let report = getRocketLaunchReport(factorySpec, { rates: new Map([[recipe, Rational.from_floats(1, 3)]]) })
  assert.equal(report.launches.toString(), "1/150")
  assert.equal(report.exactSilos.toString(), "1")

  const moduleSpec = factorySpec.getModuleSpec(recipe)
  const speed3 = modules.get("speed-module-3")
  for (let index = 0; index < moduleSpec.modules.length; index++) moduleSpec.setModule(index, speed3)
  moduleSpec.setBeaconModule(speed3, 0)
  moduleSpec.setBeaconModule(speed3, 1)
  moduleSpec.setBeaconCount(Rational.from_integer(12))

  stats = silo.getLaunchStats(factorySpec)
  assert.equal(stats.launchLimited, true)
  assert.equal(stats.launch.toString(), Rational.from_floats(60, 1614).toString())
  assert.equal(stats.part.toString(), stats.launch.mul(stats.craftsPerLaunch).toString())

  for (let index = 0; index < moduleSpec.modules.length; index++) moduleSpec.setModule(index, null)
  const prod3 = modules.get("productivity-module-3")
  for (let index = 0; index < moduleSpec.modules.length; index++) moduleSpec.setModule(index, prod3)
  stats = silo.getLaunchStats(factorySpec)
  assert.equal(stats.effectivePartsPerCraft.toString(), "7/5")
  assert.equal(stats.craftsPerLaunch.toString(), "250/7")
  assert.equal(stats.launchLimited, true)

  report = getRocketLaunchReport(factorySpec, { rates: new Map([[recipe, stats.craftsPerLaunch]]) })
  assert.equal(report.launches.toString(), "1")
  assert.equal(report.exactSilos.toString(), Rational.from_floats(1614, 60).toString())

  factorySpec.setRecipeProductivityLevel("rocket-part-productivity", 2)
  stats = silo.getLaunchStats(factorySpec)
  assert.equal(stats.effectivePartsPerCraft.toString(), "8/5")
  assert.equal(stats.craftsPerLaunch.toString(), "125/4")
})

test("spoilage metadata calculates remaining agricultural science freshness", async () => {
  const { factorySpec, items } = await setupTestFactory()
  factorySpec.freshnessDelayMinutes = Rational.from_float(30)
  const science = items.get("agricultural-science-pack")
  const totals = { items: new Map([[science, Rational.from_float(1)]]) }
  const row = getFreshnessReport(factorySpec, totals)[0]
  assert.equal(science.spoilTime.toString(), "3600")
  assert.equal(row.remaining.toString(), "1/2")
  assert.equal(row.effectiveRate.toString(), "1/2")
})

test("default advanced circuit quality target recommends assembling machine 2 and quality module 1", async () => {
  const { factorySpec, recipes, items, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("advanced-circuit")
  const item = items.get("advanced-circuit")
  const unrelatedRecipe = recipes.get("electronic-circuit")
  const assemblingMachine1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const assemblingMachine2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const qualityModule1 = modules.get("quality-module")

  assert.equal(factorySpec.getBuilding(recipe), assemblingMachine1)
  const unrelatedBuilding = factorySpec.getBuilding(unrelatedRecipe)
  const feasibility = getQualityTargetFeasibility(factorySpec, recipe, 1)
  assert.equal(feasibility.status, "auto-configurable")
  assert.equal(feasibility.building, assemblingMachine2)
  assert.equal(feasibility.module, qualityModule1)
  assert.equal(feasibility.slotCount, 2)

  const globalDefault = factorySpec.defaultModule
  assert.equal(factorySpec.applyQualityTargetConfiguration(recipe, feasibility), true)
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  assert.equal(moduleSpec.building, assemblingMachine2)
  assert.deepEqual(moduleSpec.modules, [qualityModule1, qualityModule1])
  assert.equal(factorySpec.defaultModule, globalDefault)
  assert.equal(factorySpec.getBuilding(unrelatedRecipe), unrelatedBuilding)
  assert.equal(factorySpec.spec.has(unrelatedRecipe), false)

  factorySpec.buildTargets = [{ item, recipe, qualityLevel: 1, changedBuilding: false, getRate: () => one }]
  assert.doesNotThrow(() => factorySpec.updateSolution())
  assert.equal(factorySpec.lastError, null)
  assert.ok(factorySpec.lastTotals !== null)
})

test("target quality handler configures only the advanced circuit and keeps results valid", async () => {
  const runtime = await createTestRuntime()
  const factorySpec = resetSpec()
  configureModelRuntime({
    getSpecification: () => factorySpec,
    useLegacyCalculation: () => false,
  })
  factorySpec.setData(
    runtime.items,
    runtime.recipes,
    runtime.planets,
    runtime.modules,
    runtime.buildings,
    runtime.belts,
    runtime.fuel,
    runtime.itemGroups,
    runtime.recipeProductivityResearch,
    runtime.beaconPower,
  )
  factorySpec.setDefaultPriority()
  factorySpec.selectOnePlanet(runtime.planets.get("nauvis"))

  const item = runtime.items.get("advanced-circuit")
  const recipe = runtime.recipes.get("advanced-circuit")
  const unrelatedRecipe = runtime.recipes.get("electronic-circuit")
  const unrelatedBuilding = factorySpec.getBuilding(unrelatedRecipe)
  const target = {
    item,
    recipe,
    qualityLevel: 0,
    changedBuilding: false,
    getRate: () => one,
    setQuality(level) {
      this.qualityLevel = level
    },
    clearQualityWarning() {
      this.warningCleared = true
    },
    showQualityUnavailable() {
      throw new Error("The default quality target should be configurable")
    },
  }
  factorySpec.buildTargets = [target]

  handleTargetQualityChange(target, 1)

  const moduleSpec = factorySpec.getModuleSpec(recipe)
  assert.equal(target.qualityLevel, 1)
  assert.equal(target.warningCleared, true)
  assert.equal(
    moduleSpec.modules.every((module) => module.key === "quality-module"),
    true,
  )
  assert.equal(factorySpec.getBuilding(unrelatedRecipe), unrelatedBuilding)
  assert.equal(factorySpec.lastError, null)
  assert.ok(factorySpec.lastTotals !== null)

  handleTargetQualityChange(target, 1)
  handleTargetQualityChange(target, 0)
  assert.equal(target.qualityLevel, 0)
  assert.equal(factorySpec.getBuilding(recipe).key, "assembling-machine-2")
  assert.equal(
    factorySpec.getModuleSpec(recipe).modules.every((module) => module.key === "quality-module"),
    true,
  )
})

test("quality target recommendation follows the default module tier and stays idempotent", async () => {
  const { factorySpec, recipes, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("advanced-circuit")
  const speedModule2 = modules.get("speed-module-2")
  const qualityModule2 = modules.get("quality-module-2")
  factorySpec.setDefaultModule(speedModule2)

  const first = getQualityTargetFeasibility(factorySpec, recipe, 1)
  assert.equal(first.status, "auto-configurable")
  assert.equal(first.module, qualityModule2)
  assert.equal(factorySpec.applyQualityTargetConfiguration(recipe, first), true)
  assert.equal(getQualityTargetFeasibility(factorySpec, recipe, 1).status, "feasible")
  assert.equal(
    factorySpec.getModuleSpec(recipe).modules.every((module) => module === qualityModule2),
    true,
  )
})

test("quality feasibility preserves compatible configuration and identifies explicit conflicts", async () => {
  const { factorySpec, recipes, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("advanced-circuit")
  const assemblingMachine1 = factorySpec.buildingKeys.get("assembling-machine-1")
  const assemblingMachine2 = factorySpec.buildingKeys.get("assembling-machine-2")
  const qualityModule1 = modules.get("quality-module")
  const productivityModule1 = modules.get("productivity-module")

  factorySpec.setBuildingOverride(recipe, assemblingMachine2)
  const configured = factorySpec.getModuleSpec(recipe)
  configured.setModule(0, qualityModule1)
  configured.setModule(1, qualityModule1)
  assert.equal(getQualityTargetFeasibility(factorySpec, recipe, 1).status, "feasible")

  factorySpec.setBuildingOverride(recipe, assemblingMachine1)
  assert.deepEqual(getQualityTargetFeasibility(factorySpec, recipe, 1), {
    status: "conflict",
    building: assemblingMachine1,
    module: null,
    reason: "explicit-building",
  })

  const secondFactory = await setupTestFactory()
  secondFactory.factorySpec.selectOnePlanet(secondFactory.planets.get("nauvis"))
  const secondRecipe = secondFactory.recipes.get("advanced-circuit")
  secondFactory.factorySpec.setMinimumBuilding(secondFactory.factorySpec.buildingKeys.get("assembling-machine-2"))
  const secondSpec = secondFactory.factorySpec.getModuleSpec(secondRecipe)
  secondSpec.setModule(0, productivityModule1)
  assert.equal(getQualityTargetFeasibility(secondFactory.factorySpec, secondRecipe, 1).status, "conflict")
  assert.equal(getQualityTargetFeasibility(secondFactory.factorySpec, secondRecipe, 1).reason, "explicit-modules")
})

test("quality feasibility reports unavailable module and machine paths without solving", async () => {
  const { factorySpec, recipes, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("advanced-circuit")
  const assemblingMachine1 = factorySpec.buildingKeys.get("assembling-machine-1")

  factorySpec.modules = new Map([...modules].filter(([, module]) => module.category !== "quality"))
  assert.deepEqual(getQualityTargetFeasibility(factorySpec, recipe, 1), {
    status: "unavailable",
    reason: "no-quality-module",
  })

  const noSlotsFactory = await setupTestFactory()
  noSlotsFactory.factorySpec.selectOnePlanet(noSlotsFactory.planets.get("nauvis"))
  const noSlotsRecipe = noSlotsFactory.recipes.get("advanced-circuit")
  noSlotsFactory.factorySpec.getCompatibleBuildings = () => [assemblingMachine1]
  assert.deepEqual(getQualityTargetFeasibility(noSlotsFactory.factorySpec, noSlotsRecipe, 1), {
    status: "unavailable",
    reason: "no-module-slots",
  })

  const normal = getQualityTargetFeasibility(factorySpec, recipe, 0)
  assert.equal(normal.status, "feasible")
  assert.equal(factorySpec.getBuilding(recipe), assemblingMachine1)
})

test("the solver still rejects a manually constructed impossible quality target", async () => {
  const { factorySpec, recipes, items, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("advanced-circuit")
  factorySpec.buildTargets = [
    {
      item: items.get("advanced-circuit"),
      recipe,
      qualityLevel: 1,
      changedBuilding: false,
      getRate: () => one,
    },
  ]
  assert.throws(() => factorySpec.solve(), /cannot produce Uncommon output/)
})

test("exact-quality targets scale the selected recipe by its direct yield", async () => {
  const { factorySpec, recipes, items, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const item = items.get("electronic-circuit")
  const recipe = recipes.get("electronic-circuit")
  factorySpec.setBuildingOverride(recipe, factorySpec.buildingKeys.get("assembling-machine-3"))
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  const qualityModule = modules.get("quality-module-3")
  for (let index = 0; index < moduleSpec.modules.length; index++) {
    moduleSpec.setModule(index, qualityModule)
  }
  const chance = qualityModule.quality.mul(Rational.from_integer(moduleSpec.modules.length))
  const probability = qualityProbability(chance, 1, 4)
  factorySpec.buildTargets = [
    {
      item,
      recipe,
      qualityLevel: 1,
      changedBuilding: false,
      getRate: () => one,
    },
  ]

  const totals = factorySpec.solve()
  assert.equal(totals.products.get(item).toString(), probability.reciprocate().toString())
  assert.ok(totals.rates.has(recipe))
})

test("recipe location pins produce explicit interplanetary transport flows", async () => {
  const { factorySpec, recipes, items, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  factorySpec.selectPlanet(planets.get("fulgora"))
  const cable = recipes.get("copper-cable")
  const circuits = recipes.get("electronic-circuit")
  factorySpec.setRecipeLocation(cable, planets.get("fulgora"))
  factorySpec.setRecipeLocation(circuits, planets.get("nauvis"))
  const copperCable = items.get("copper-cable")
  const totals = {
    proportionate: [{ item: copperCable, from: cable, to: circuits, rate: Rational.from_float(6), fuel: false }],
  }
  const flows = getTransportFlows(factorySpec, totals)
  assert.equal(flows.length, 1)
  assert.equal(flows[0].from.key, "fulgora")
  assert.equal(flows[0].to.key, "nauvis")
  assert.equal(flows[0].rate.toString(), "6")
})

test("transport planning ignores solver output recipes", async () => {
  const { factorySpec, items, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const totals = solve(factorySpec, [{ item: items.get("copper-cable"), rate: one, recipe: null }])
  assert.ok(totals.proportionate.some((link) => !link.to.isReal()))
  factorySpec.populateModuleSpec(totals)
  assert.deepEqual(getFactorySummary(factorySpec, totals).planning.transport, [])
})

test("pollution scales with energy consumption and direct pollution effects", async () => {
  const { factorySpec, recipes, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("nauvis"))
  const recipe = recipes.get("iron-ore")
  const rate = Rational.from_integer(10)
  const base = getPollution(factorySpec, recipe, rate)
  const moduleSpec = factorySpec.getModuleSpec(recipe)
  const efficiency3 = modules.get("efficiency-module-3")
  for (let index = 0; index < moduleSpec.modules.length; index++) moduleSpec.setModule(index, efficiency3)
  const reduced = getPollution(factorySpec, recipe, rate)
  assert.ok(reduced.less(base), `Expected ${reduced} to be less than ${base}`)
})

test("agricultural towers report spores and configured beacons report power", async () => {
  const { factorySpec, recipes, modules, planets } = await setupTestFactory()
  factorySpec.selectOnePlanet(planets.get("gleba"))
  const plant = recipes.get("yumako-tree")
  assert.ok(zero.less(getPollution(factorySpec, plant, Rational.from_floats(47, 300), "spores")))

  const bioflux = recipes.get("bioflux")
  const moduleSpec = factorySpec.getModuleSpec(bioflux)
  moduleSpec.setBeaconModule(modules.get("speed-module-3"), 0)
  moduleSpec.setBeaconCount(Rational.from_integer(4))
  factorySpec.beaconPower = Rational.from_integer(480000)
  assert.ok(zero.less(getBeaconPower(factorySpec, bioflux, one)))
})

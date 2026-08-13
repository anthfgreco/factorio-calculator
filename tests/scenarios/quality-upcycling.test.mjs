import assert from "node:assert/strict"
import test from "node:test"

import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

function requireValue(map, key) {
  const value = map.get(key)
  assert.ok(value, `Expected ${key}`)
  return value
}

test("quality transitions are exact stochastic columns with Legendary absorbing", async () => {
  const { math, qualityMath } = await setupSpaceAgeFactory()
  const chance = math.Rational.from_floats(1, 5)

  for (let fromLevel = 0; fromLevel <= 4; fromLevel++) {
    const distribution = qualityMath.qualityTransitionDistribution(chance, fromLevel, 4)
    assert.equal(distribution.reduce((sum, value) => sum.add(value), math.zero).toString(), "1")
  }
  assert.deepEqual(
    qualityMath.qualityTransitionDistribution(chance, 4, 4).map((value) => value.toString()),
    ["0", "0", "0", "0", "1"],
  )
  assert.equal(qualityMath.qualityTransitionProbability(chance, 0, 4, 4).toString(), "1/5000")
})

test("Nauvis Legendary advanced circuits recursively quality-plan every solid intermediate", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, items, recipes, planets, qualityHighs } = runtime
  const nauvis = requireValue(planets, "nauvis")
  const advancedCircuit = requireValue(items, "advanced-circuit")
  const advancedCircuitRecipe = requireValue(recipes, "advanced-circuit")

  specification.selectOnePlanet(nauvis)
  specification.setMaxQualityLevel(4)
  specification.setAutomaticBuildingPreferences(
    [
      "assembling-machine-3",
      "chemical-plant",
      "foundry",
      "electromagnetic-plant",
      "biochamber",
      "cryogenic-plant",
      "electric-furnace",
      "big-mining-drill",
    ].map((key) => requireValue(specification.buildingKeys, key)),
  )
  specification.buildTargets.push({
    item: advancedCircuit,
    recipe: advancedCircuitRecipe,
    changedBuilding: false,
    qualityLevel: 4,
    qualityStrategy: "auto",
    getRate: () => math.one,
  })

  const optimizer = await qualityHighs.loadHighsQualityOptimizer()
  specification.setQualityGraphOptimizer(optimizer)
  const totals = specification.solve()
  const plan = specification.qualityPlans[0]
  assert.ok(plan)
  assert.equal(plan.profile, "planet")
  assert.equal(plan.planetKey, "nauvis")
  assert.equal(plan.requested.toString(), "1")
  assert.equal(totals.rates.size, 0)
  assert.equal(optimizer.lastRun?.certified, false, JSON.stringify(optimizer.lastRun))

  for (const itemKey of ["copper-cable", "plastic-bar", "electronic-circuit"]) {
    assert.equal(
      plan.freshInputs.some((entry) => entry.item.key === itemKey),
      false,
      `${itemKey} must be produced inside the qualified graph`,
    )
    const qualityStages = plan.operations.filter(
      (operation) => operation.recipe.key === itemKey && operation.qualityLevel < 4,
    )
    assert.ok(qualityStages.length > 0, `Expected quality stages for ${itemKey}`)
    assert.equal(
      qualityStages.every(
        (operation) =>
          math.zero.less(operation.configuration.qualityChance) &&
          operation.configuration.modules.some((module) => module?.category === "quality"),
      ),
      true,
      `Expected quality modules before Legendary ${itemKey}`,
    )
  }

  const guaranteedCircuit = plan.operations.find(
    (operation) => operation.recipe.key === "advanced-circuit" && operation.qualityLevel === 4,
  )
  assert.ok(guaranteedCircuit)
  assert.equal(guaranteedCircuit.configuration.qualityChance.toString(), "0")
  assert.equal(
    guaranteedCircuit.configuration.modules.some((module) => module?.category === "productivity"),
    true,
  )
})

test("automatic quality planning requires a planet instead of falling back to a target-only loop", async () => {
  const { specification, math, items, recipes } = await setupSpaceAgeFactory()
  specification.selectedPlanets.clear()
  specification.recipeLocations.clear()
  specification.buildTargets.push({
    item: requireValue(items, "advanced-circuit"),
    recipe: requireValue(recipes, "advanced-circuit"),
    changedBuilding: false,
    qualityLevel: 4,
    qualityStrategy: "auto",
    getRate: () => math.one,
  })

  assert.throws(
    () => specification.solve(),
    /automatic quality planning for Advanced circuit requires one selected planet or an assigned recipe location/i,
  )
  assert.equal(specification.qualityPlans.length, 0)
})

test("Vulcanus automatic quality starts iron plates at lava casting and recycles every failed tier", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, vulcanusPlanner, items, recipes, planets, calculatorModules } = runtime
  const vulcanus = requireValue(planets, "vulcanus")
  const ironPlate = requireValue(items, "iron-plate")
  const normalSmelting = requireValue(recipes, "iron-plate")
  const qualityModule = requireValue(calculatorModules, "quality-module-2")
  const productivityModule = requireValue(calculatorModules, "productivity-module-3")
  const legendary = requireValue(specification.qualities, "legendary")

  assert.equal(specification.qualityPlannerModule, qualityModule)
  assert.equal(specification.qualityPlannerModuleQuality, legendary)
  assert.equal(specification.qualityPlannerProductivityModule, productivityModule)
  assert.equal(specification.qualityPlannerProductivityModuleQuality, legendary)
  specification.selectOnePlanet(vulcanus)
  specification.qualityPlannerObjective = "practical"

  const plan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: ironPlate,
    recipe: normalSmelting,
    requested: math.one,
    qualityLevel: 4,
  })

  assert.equal(plan.profile, "vulcanus")
  assert.equal(plan.recipe.key, "casting-iron")
  assert.equal(plan.firstPassChance.toString(), "1/5000")
  assert.ok(plan.fluidInputs.some((entry) => entry.item.key === "lava" && math.zero.less(entry.amount)))
  assert.ok(plan.freshInputs.some((entry) => entry.item.key === "calcite" && math.zero.less(entry.amount)))
  assert.equal(plan.importedInputs.length, 0)
  assert.equal(
    plan.freshInputs.some((entry) => entry.item.key === "iron-plate"),
    false,
  )
  assert.equal(
    plan.fluidInputs.some((entry) => entry.item.key === "molten-iron"),
    false,
  )

  const casting = plan.operations.find(
    (operation) => operation.recipe.key === "casting-iron" && operation.qualityLevel === 0,
  )
  assert.ok(casting)
  assert.equal(casting.configuration.qualityChance.toString(), "1/5")
  assert.equal(
    casting.configuration.modules.every((module) => module?.key === "quality-module-2"),
    true,
  )

  const melting = plan.operations.find((operation) => operation.recipe.key === "molten-iron-from-lava")
  assert.ok(melting)
  assert.equal(melting.configuration.qualityChance.toString(), "0")
  assert.ok(math.one.less(melting.configuration.productivity))
  assert.equal(
    melting.configuration.modules.every((module) => module?.key === "productivity-module-3"),
    true,
  )
  assert.equal(
    melting.configuration.moduleQualities.every((quality) => quality.key === "legendary"),
    true,
  )

  const recycling = plan.operations.filter(
    (operation) => operation.kind === "recycle" && operation.recipe.key === "iron-plate-recycling",
  )
  assert.deepEqual(
    recycling.map((operation) => operation.qualityLevel),
    [0, 1, 2, 3],
  )
  assert.equal(
    recycling.every((operation) => operation.configuration.qualityChance.toString() === "1/5"),
    true,
  )
  assert.ok(
    plan.operations.some((operation) => operation.kind === "dispose" && operation.recipe.key === "stone-recycling"),
  )
  assert.equal(plan.surplusOutputs.length, 0)
})

test("Vulcanus practical electronics honor the dedicated productivity module profile", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, vulcanusPlanner, items, recipes, planets, calculatorModules } = runtime
  specification.selectOnePlanet(requireValue(planets, "vulcanus"))
  specification.qualityPlannerModule = requireValue(calculatorModules, "quality-module-2")
  specification.qualityPlannerModuleQuality = requireValue(specification.qualities, "legendary")
  specification.qualityPlannerProductivityModule = requireValue(calculatorModules, "productivity-module-2")
  specification.qualityPlannerProductivityModuleQuality = requireValue(specification.qualities, "rare")

  const plan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "electronic-circuit"),
    recipe: requireValue(recipes, "electronic-circuit"),
    requested: math.one,
    qualityLevel: 4,
  })

  assert.equal(plan.importedInputs.length, 0)
  assert.deepEqual(
    plan.freshInputs.map((entry) => entry.item.key),
    ["calcite"],
  )
  assert.deepEqual(
    plan.fluidInputs.map((entry) => entry.item.key),
    ["lava"],
  )
  assert.ok(plan.operations.some((operation) => operation.recipe.key === "casting-iron"))
  assert.ok(plan.operations.some((operation) => operation.recipe.key === "casting-copper-cable"))

  const qualityStages = plan.operations.filter(
    (operation) => operation.recipe.key === "electronic-circuit" && operation.qualityLevel < 4,
  )
  assert.equal(qualityStages.length, 4)
  assert.equal(
    qualityStages.every((operation) => operation.configuration.building?.key === "electromagnetic-plant"),
    true,
  )
  assert.equal(
    qualityStages.every((operation) => operation.configuration.qualityChance.toString() === "1/4"),
    true,
  )

  const legendaryStage = plan.operations.find(
    (operation) => operation.recipe.key === "electronic-circuit" && operation.qualityLevel === 4,
  )
  assert.ok(legendaryStage)
  assert.equal(legendaryStage.configuration.building?.key, "electromagnetic-plant")
  assert.equal(legendaryStage.configuration.qualityChance.toString(), "0")
  assert.ok(math.one.less(legendaryStage.configuration.productivity))
  assert.equal(
    legendaryStage.configuration.modules.every((module) => module?.key === "productivity-module-2"),
    true,
  )
  assert.equal(
    legendaryStage.configuration.moduleQualities.every((quality) => quality.key === "rare"),
    true,
  )
})

test("Vulcanus Mech armor makes its oil chain locally and imports only holmium ore", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, qualityHighs, vulcanusPlanner, items, recipes, planets } = runtime
  specification.selectOnePlanet(requireValue(planets, "vulcanus"))

  const optimizer = await qualityHighs.loadHighsQualityOptimizer()
  specification.setQualityGraphOptimizer(optimizer)
  const plan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "mech-armor"),
    recipe: requireValue(recipes, "mech-armor"),
    requested: math.one,
    qualityLevel: 4,
  })
  assert.equal(optimizer.lastRun?.certified, true, JSON.stringify(optimizer.lastRun))
  assert.equal(
    plan.totalCrafts.toString(),
    "654695212069960015266641502753802861784751118/1559668913829556971062523577911481640625",
  )
  assert.equal(
    plan.totalRecycles.toString(),
    "1237937377184826460954378686853325258859601/4413756926211535373891223186470587500",
  )

  const scaledPlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "mech-armor"),
    recipe: requireValue(recipes, "mech-armor"),
    requested: math.Rational.from_integer(2),
    qualityLevel: 4,
  })
  assert.equal(optimizer.lastRun?.cacheHit, true)
  assert.equal(scaledPlan.totalCrafts.toString(), plan.totalCrafts.mul(math.Rational.from_integer(2)).toString())
  assert.equal(scaledPlan.totalRecycles.toString(), plan.totalRecycles.mul(math.Rational.from_integer(2)).toString())

  assert.deepEqual(
    plan.importedInputs.map((entry) => entry.item.key),
    ["holmium-ore"],
  )
  for (const recipeKey of [
    "acid-neutralisation",
    "steam-condensation",
    "simple-coal-liquefaction",
    "heavy-oil-cracking",
    "light-oil-cracking",
    "plastic-bar",
  ]) {
    assert.ok(
      plan.operations.some((operation) => operation.recipe.key === recipeKey),
      `Expected ${recipeKey}`,
    )
  }
  for (const itemKey of ["water", "crude-oil", "petroleum-gas", "heavy-oil", "plastic-bar"]) {
    assert.equal(
      plan.importedInputs.some((entry) => entry.item.key === itemKey),
      false,
      `Expected ${itemKey} to be made on Vulcanus`,
    )
  }
})

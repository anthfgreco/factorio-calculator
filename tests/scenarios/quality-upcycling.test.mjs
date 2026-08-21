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

test("25% self-recycling resources expose the exact Legendary throughput shortcut", async () => {
  const { math, qualityMath } = await setupSpaceAgeFactory()
  const sourceQuality = math.Rational.from_floats(1, 5)
  const recyclerQuality = math.Rational.from_floats(1, 5)
  const outputPerSecond = math.Rational.from_floats(58, 10)

  assert.equal(
    qualityMath.quarterSelfRecycleLegendaryProbability(sourceQuality, recyclerQuality).toString(),
    "125/131072",
  )
  assert.equal(
    qualityMath.quarterSelfRecycleLegendaryScore(outputPerSecond, sourceQuality, recyclerQuality).toString(),
    "116/75",
  )
})

test("self-recycling mining jointly optimizes miner and recycler for the selected bottleneck", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, items, recipes, planets, calculatorModules, vulcanusPlanner } = runtime
  const vulcanus = requireValue(planets, "vulcanus")
  const calcite = requireValue(items, "calcite")
  const calciteRecipe = requireValue(recipes, "calcite")
  const speedModule = requireValue(calculatorModules, "speed-module-3")
  const legendary = requireValue(specification.qualities, "legendary")

  specification.selectOnePlanet(vulcanus)
  specification.setMaxQualityLevel(4)
  specification.setDefaultMachineQuality(legendary)
  specification.setAutomaticBuildingPreferences(
    ["big-mining-drill", "recycler"].map((key) => requireValue(specification.buildingKeys, key)),
  )
  specification.qualityPlannerMiningModule = speedModule
  specification.qualityPlannerMiningModuleQuality = legendary
  specification.qualityPlannerMiningBeaconQuality = legendary
  specification.qualityPlannerMiningBeaconCount = math.Rational.from_integer(8)

  specification.qualityPlannerObjective = "materials"
  const materialsPlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: calcite,
    recipe: calciteRecipe,
    requested: math.one,
    qualityLevel: 4,
  })
  const materialsMining = materialsPlan.operations.find(
    (operation) => operation.kind === "source" && operation.recipe.key === "calcite",
  )
  const materialsRecycler = materialsPlan.operations.find(
    (operation) => operation.kind === "recycle" && operation.recipe.key === "calcite-recycling",
  )
  assert.ok(materialsMining)
  assert.ok(materialsRecycler)
  assert.equal(materialsMining.configuration.modules.filter((module) => module?.category === "quality").length, 3)
  assert.equal(materialsMining.configuration.modules.filter((module) => module?.category === "productivity").length, 1)
  assert.equal(materialsRecycler.configuration.modules.filter((module) => module?.category === "quality").length, 4)
  assert.equal(materialsMining.configuration.beaconCount.toString(), "0")
  assert.equal(materialsRecycler.configuration.beaconCount.toString(), "0")

  specification.qualityPlannerObjective = "quality-modules"
  const modulePlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: calcite,
    recipe: calciteRecipe,
    requested: math.one,
    qualityLevel: 4,
  })
  const moduleMining = modulePlan.operations.find(
    (operation) => operation.kind === "source" && operation.recipe.key === "calcite",
  )
  const moduleRecycler = modulePlan.operations.find(
    (operation) => operation.kind === "recycle" && operation.recipe.key === "calcite-recycling",
  )
  assert.ok(moduleMining)
  assert.ok(moduleRecycler)
  assert.equal(moduleMining.configuration.modules.filter((module) => module?.category === "quality").length, 0)
  assert.equal(moduleMining.configuration.modules.filter((module) => module?.category === "productivity").length, 4)
  assert.equal(moduleMining.configuration.beaconCount.toString(), "0")
  assert.equal(moduleRecycler.configuration.modules.filter((module) => module?.category === "quality").length, 4)
  assert.equal(moduleRecycler.configuration.beaconCount.toString(), "1")
  assert.deepEqual(
    moduleRecycler.configuration.beaconModules.map((module) => module?.key ?? null),
    ["speed-module-3", null],
  )
  assert.ok(modulePlan.totalQualityModules.less(materialsPlan.totalQualityModules))
  assert.ok(materialsMining.rate.less(moduleMining.rate))

  specification.qualityPlannerObjective = "machines"
  const machinePlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: calcite,
    recipe: calciteRecipe,
    requested: math.one,
    qualityLevel: 4,
  })
  assert.ok(machinePlan.totalMachineCount.less(materialsPlan.totalMachineCount))

  const recycler = requireValue(specification.buildingKeys, "recycler")
  recycler.power = math.Rational.from_integer(1_000_000_000)
  specification.qualityPlannerObjective = "power"
  const directPlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: calcite,
    recipe: calciteRecipe,
    requested: math.one,
    qualityLevel: 4,
  })
  assert.equal(
    directPlan.operations.some(
      (operation) => operation.kind === "recycle" && operation.recipe.key === "calcite-recycling",
    ),
    false,
  )
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
  assert.equal(optimizer.lastRun?.certified, true, JSON.stringify(optimizer.lastRun))

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

test("Fulgora Legendary Mech armor starts at quality scrap mining instead of imported intermediates", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, items, recipes, planets, qualityHighs } = runtime
  const fulgora = requireValue(planets, "fulgora")

  specification.selectOnePlanet(fulgora)
  specification.setMaxQualityLevel(4)
  specification.miningProd = math.one
  for (const researchKey of [
    "asteroid-productivity",
    "low-density-structure-productivity",
    "plastic-bar-productivity",
    "processing-unit-productivity",
    "rocket-fuel-productivity",
    "rocket-part-productivity",
    "scrap-recycling-productivity",
    "steel-plate-productivity",
  ]) {
    if (specification.recipeProductivityResearch.has(researchKey)) {
      specification.setRecipeProductivityLevel(researchKey, 10)
    }
  }
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
    item: requireValue(items, "mech-armor"),
    recipe: requireValue(recipes, "mech-armor"),
    changedBuilding: false,
    qualityLevel: 4,
    getRate: () => math.Rational.from_floats(1, 6000),
  })

  const optimizer = await qualityHighs.loadHighsQualityOptimizer()
  specification.setQualityGraphOptimizer(optimizer)
  specification.solve()
  const plan = specification.qualityPlans[0]
  assert.ok(plan)
  assert.equal(plan.planetKey, "fulgora")
  assert.deepEqual(
    plan.importedInputs.map((entry) => entry.item.key),
    [],
    "Fulgora must expand Mech armor through its local scrap and fluid economy before importing intermediates",
  )
  assert.ok(plan.freshInputs.some((entry) => entry.item.key === "scrap" && math.zero.less(entry.amount)))
  assert.ok(plan.fluidInputs.some((entry) => entry.item.key === "heavy-oil" && math.zero.less(entry.amount)))

  const scrapMining = plan.operations.find(
    (operation) => operation.kind === "source" && operation.recipe.key === "scrap",
  )
  assert.ok(scrapMining)
  assert.equal(scrapMining.configuration.building?.key, "big-mining-drill")
  assert.equal(scrapMining.configuration.qualityChance.toString(), "1/5")
  assert.equal(
    scrapMining.configuration.modules.every((module) => module?.key === "quality-module-2"),
    true,
  )
  assert.equal(
    scrapMining.configuration.moduleQualities.every((quality) => quality.key === "legendary"),
    true,
  )
  assert.ok(math.zero.less(scrapMining.machineCount))

  const scrapRecycling = plan.operations.filter(
    (operation) => operation.kind === "recycle" && operation.recipe.key === "scrap-recycling",
  )
  assert.ok(scrapRecycling.length > 0)
  assert.equal(
    scrapRecycling.every((operation) => operation.configuration.qualityChance.toString() === "1/5"),
    true,
  )
  assert.ok(scrapRecycling.some((operation) => math.zero.less(operation.machineCount)))
  assert.ok(
    plan.operations.some((operation) => operation.kind === "recycle" && operation.recipe.key !== "scrap-recycling"),
    "Fulgora must reuse generated downstream recycler routes from scrap products",
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
    getRate: () => math.one,
  })

  assert.throws(
    () => specification.solve(),
    /automatic quality planning for Advanced circuit requires one selected planet or an assigned recipe location/i,
  )
  assert.equal(specification.qualityPlans.length, 0)
})

test("Vulcanus Legendary iron plates can use the calcite, concrete, and iron ore shuffle", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, vulcanusPlanner, items, recipes, planets, calculatorModules } = runtime
  const vulcanus = requireValue(planets, "vulcanus")
  const ironPlate = requireValue(items, "iron-plate")
  const normalSmelting = requireValue(recipes, "iron-plate")
  const qualityModule = requireValue(calculatorModules, "quality-module-2")
  const productivityModule = requireValue(calculatorModules, "productivity-module-3")
  const normal = requireValue(specification.qualities, "normal")
  const legendary = requireValue(specification.qualities, "legendary")

  assert.equal(specification.qualityPlannerModule, qualityModule)
  assert.equal(specification.qualityPlannerModuleQuality, legendary)
  assert.equal(specification.qualityPlannerProductivityModule, productivityModule)
  assert.equal(specification.qualityPlannerProductivityModuleQuality, legendary)
  specification.selectOnePlanet(vulcanus)
  specification.qualityPlannerObjective = "quality-modules"
  specification.qualityPlannerMiningModuleQuality = normal
  specification.qualityPlannerMiningBeaconQuality = normal

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
  assert.equal(plan.warnings.length, 2)
  assert.match(plan.warnings[0], /local lava, casting, and available quality shuffles/i)
  assert.match(plan.warnings[1], /steady-state estimate/i)
  assert.ok(plan.fluidInputs.some((entry) => entry.item.key === "lava" && math.zero.less(entry.amount)))
  assert.ok(plan.freshInputs.some((entry) => entry.item.key === "calcite" && math.zero.less(entry.amount)))
  assert.ok(
    plan.freshInputs.some(
      (entry) => entry.item.key === "calcite" && entry.qualityLevel === 4 && math.zero.less(entry.amount),
    ),
  )
  const utilityCalciteMining = plan.operations.find(
    (operation) =>
      operation.kind === "source" && operation.recipe.key === "calcite" && operation.sourcePurpose === "utility",
  )
  const qualityCalciteMining = plan.operations.find(
    (operation) =>
      operation.kind === "source" && operation.recipe.key === "calcite" && operation.sourcePurpose === "quality",
  )
  assert.ok(utilityCalciteMining)
  assert.ok(qualityCalciteMining)
  assert.equal(utilityCalciteMining.selfRecyclingLegendary, undefined)
  assert.equal(qualityCalciteMining.selfRecyclingLegendary?.item.key, "calcite")
  assert.equal(qualityCalciteMining.selfRecyclingLegendary?.recyclerRecipe.key, "calcite-recycling")
  assert.ok(math.zero.less(qualityCalciteMining.selfRecyclingLegendary?.legendaryPerMinutePerMachine ?? math.zero))
  assert.ok(math.zero.less(qualityCalciteMining.selfRecyclingLegendary?.score ?? math.zero))
  assert.ok(plan.totalQualityModules.less(math.Rational.from_integer(300)))
  assert.equal(plan.importedInputs.length, 0)
  assert.equal(
    plan.freshInputs.some((entry) => entry.item.key === "iron-plate"),
    false,
  )
  assert.equal(
    plan.fluidInputs.some((entry) => entry.item.key === "molten-iron"),
    false,
  )
  const finalSmelting = plan.operations.find(
    (operation) => operation.recipe.key === "iron-plate" && operation.qualityLevel === 4,
  )
  assert.ok(finalSmelting)
  assert.equal(
    finalSmelting.configuration.modules.every((module) => module === null),
    true,
  )

  const melting = plan.operations.find(
    (operation) => operation.recipe.key === "molten-iron-from-lava" && operation.qualityLevel === 4,
  )
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
  assert.equal(
    recycling.every(
      (operation) => operation.qualityLevel < 4 && operation.configuration.qualityChance.toString() === "1/5",
    ),
    true,
  )
  for (const recipeKey of ["stone-brick", "concrete-from-molten-iron", "concrete-recycling", "iron-plate"]) {
    assert.ok(
      plan.operations.some((operation) => operation.recipe.key === recipeKey && operation.qualityLevel === 4),
      `Expected Legendary ${recipeKey}`,
    )
  }
  assert.equal(
    plan.operations.some((operation) => operation.kind === "dispose" && operation.recipe.key === "stone-recycling"),
    false,
  )
  assert.ok(
    plan.surplusOutputs.some(
      (output) => output.item.key === "molten-iron" && output.qualityLevel === 0 && math.zero.less(output.amount),
    ),
  )

  specification.setDisable(requireValue(recipes, "concrete-from-molten-iron"))
  const fallback = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: ironPlate,
    recipe: normalSmelting,
    requested: math.one,
    qualityLevel: 4,
  })
  assert.equal(
    fallback.operations.some((operation) => operation.recipe.key === "concrete-from-molten-iron"),
    false,
  )
  assert.ok(
    fallback.operations.some((operation) => operation.kind === "dispose" && operation.recipe.key === "stone-recycling"),
  )
  const stoneDisposals = fallback.operations.filter(
    (operation) => operation.kind === "dispose" && operation.recipe.key === "stone-recycling",
  )
  assert.equal(
    stoneDisposals.every(
      (operation) =>
        operation.configuration.modules.every((module) => module === null) &&
        operation.configuration.modules.every((module) => module?.category !== "quality") &&
        operation.configuration.beaconModules.every((module) => module?.category !== "quality"),
    ),
    true,
  )

  specification.qualityPlannerObjective = "machines"
  const machineOptimizedFallback = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: ironPlate,
    recipe: normalSmelting,
    requested: math.one,
    qualityLevel: 4,
  })
  const machineOptimizedDisposals = machineOptimizedFallback.operations.filter(
    (operation) => operation.kind === "dispose" && operation.recipe.key === "stone-recycling",
  )
  assert.ok(machineOptimizedDisposals.length > 0)
  assert.equal(
    machineOptimizedDisposals.some((operation) =>
      operation.configuration.modules.some((module) => module?.category === "speed"),
    ),
    true,
  )
  assert.equal(
    machineOptimizedDisposals.every((operation) =>
      operation.configuration.modules.every((module) => module?.category !== "quality"),
    ),
    true,
  )
})

test("Vulcanus Legendary LDS shuffling supplies steel and regenerates plastic at the productivity cap", async () => {
  const runtime = await setupSpaceAgeFactory()
  const { specification, math, vulcanusPlanner, items, recipes, planets } = runtime
  specification.selectOnePlanet(requireValue(planets, "vulcanus"))
  specification.setRecipeProductivityLevel("low-density-structure-productivity", 30)

  const plan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "steel-plate"),
    recipe: requireValue(recipes, "steel-plate"),
    requested: math.one,
    qualityLevel: 4,
  })

  const casting = plan.operations.find(
    (operation) => operation.recipe.key === "casting-low-density-structure" && operation.qualityLevel === 4,
  )
  const recycling = plan.operations.find(
    (operation) => operation.recipe.key === "low-density-structure-recycling" && operation.qualityLevel === 4,
  )
  assert.ok(casting)
  assert.ok(recycling)
  assert.equal(casting.configuration.productivity.toString(), "4")
  assert.equal(casting.configuration.qualityChance.toString(), "0")
  assert.equal(recycling.configuration.qualityChance.toString(), "0")
  assert.equal(casting.rate.mul(math.Rational.from_integer(4)).toString(), recycling.rate.toString())
  assert.equal(
    plan.freshInputs.some((entry) => entry.item.key === "plastic-bar"),
    false,
  )
  assert.equal(plan.importedInputs.length, 0)
  assert.equal(
    plan.operations.some((operation) => operation.recipe.key === "casting-steel"),
    false,
  )

  specification.setDisable(requireValue(recipes, "casting-low-density-structure"))
  const fallback = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "steel-plate"),
    recipe: requireValue(recipes, "steel-plate"),
    requested: math.one,
    qualityLevel: 4,
  })
  assert.equal(
    fallback.operations.some((operation) => operation.recipe.key === "low-density-structure-recycling"),
    false,
  )
  assert.ok(fallback.operations.some((operation) => operation.recipe.key === "casting-steel"))
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
  const feederOperations = (candidatePlan) =>
    candidatePlan.operations.filter(
      (operation) => operation.recipe.key === "casting-iron" || operation.recipe.key === "casting-copper-cable",
    )
  assert.equal(
    feederOperations(plan).every((operation) =>
      operation.configuration.modules.every((module) => module?.category === "speed"),
    ),
    true,
  )

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

  specification.qualityPlannerObjective = "machines"
  const machinePlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "electronic-circuit"),
    recipe: requireValue(recipes, "electronic-circuit"),
    requested: math.one,
    qualityLevel: 4,
  })
  assert.equal(machinePlan.requested.toString(), plan.requested.toString())
  assert.equal(
    feederOperations(machinePlan).every((operation) =>
      operation.configuration.modules.every((module) => module?.category === "speed"),
    ),
    true,
  )

  specification.qualityPlannerObjective = "materials"
  const materialPlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "electronic-circuit"),
    recipe: requireValue(recipes, "electronic-circuit"),
    requested: math.one,
    qualityLevel: 4,
  })
  assert.equal(materialPlan.requested.toString(), plan.requested.toString())
  assert.equal(
    feederOperations(materialPlan).every((operation) =>
      operation.configuration.modules.every((module) => module?.category === "productivity"),
    ),
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
  assert.equal(optimizer.lastRun?.certified, false, JSON.stringify(optimizer.lastRun))
  assert.ok(math.zero.less(plan.totalCrafts))
  assert.ok(math.zero.less(plan.totalRecycles))

  const scaledPlan = vulcanusPlanner.planVulcanusQualityTarget({
    specification,
    item: requireValue(items, "mech-armor"),
    recipe: requireValue(recipes, "mech-armor"),
    requested: math.Rational.from_integer(2),
    qualityLevel: 4,
  })
  assert.equal(optimizer.lastRun?.cacheHit, false)
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

import assert from "node:assert/strict"
import test from "node:test"

import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

test("equipment quality applies exact machine, module, beacon, drill, and rocket effects", async () => {
  const { specification, recipes, calculatorModules, models, math, planning } = await setupSpaceAgeFactory()
  const normal = specification.qualities.get("normal")
  const legendary = specification.qualities.get("legendary")
  assert.ok(normal)
  assert.ok(legendary)

  const circuit = recipes.get("advanced-circuit")
  const assembler = specification.buildingKeys.get("assembling-machine-3")
  assert.ok(circuit)
  assert.ok(assembler)
  specification.setBuildingOverride(circuit, assembler)
  const normalRate = specification.getRecipeRate(circuit)
  specification.setMachineQuality(circuit, legendary)
  assert.equal(
    specification.getRecipeRate(circuit).toString(),
    normalRate.mul(math.Rational.from_floats(5, 2)).toString(),
  )

  const moduleSpec = specification.getModuleSpec(circuit)
  const qualityModule = calculatorModules.get("quality-module-3")
  const productivityModule = calculatorModules.get("productivity-module-3")
  const efficiencyModule = calculatorModules.get("efficiency-module-3")
  const speedModule = calculatorModules.get("speed-module-3")
  assert.ok(moduleSpec)
  assert.ok(qualityModule)
  assert.ok(productivityModule)
  assert.ok(efficiencyModule)
  assert.ok(speedModule)
  moduleSpec.setModule(0, qualityModule)
  moduleSpec.setModuleQuality(0, legendary)
  assert.equal(planning.getRecipeQualityChance(specification, circuit).toString(), "31/500")
  moduleSpec.setModule(0, productivityModule)
  assert.equal(productivityModule.productivityFor(legendary).toString(), "1/4")
  assert.equal(productivityModule.speedFor(legendary).toString(), "-3/20")
  assert.equal(productivityModule.powerFor(legendary).toString(), "4/5")
  assert.equal(productivityModule.pollutionFor(legendary).toString(), "1/10")
  assert.equal(efficiencyModule.powerFor(legendary).toString(), "-5/4")
  assert.equal(efficiencyModule.pollutionFor(legendary).toString(), "0")
  assert.equal(speedModule.qualityFor(legendary).toString(), "-1/40")

  specification.setMachineQuality(circuit, normal)
  for (let index = 0; index < moduleSpec.modules.length; index++) moduleSpec.setModule(index, null)
  moduleSpec.setBeaconModule(efficiencyModule, 0)
  moduleSpec.setBeaconCount(math.one)
  const rate = math.one
  moduleSpec.setBeaconQuality(normal)
  const normalBeaconPower = planning.getBeaconPower(specification, circuit, rate)
  moduleSpec.setBeaconQuality(legendary)
  assert.equal(
    planning.getBeaconPower(specification, circuit, rate).toString(),
    normalBeaconPower.div(math.Rational.from_integer(6)).toString(),
  )
  moduleSpec.setBeaconModule(speedModule, 0)
  moduleSpec.setBeaconQuality(normal)
  assert.equal(moduleSpec.speedEffect().toString(), "7/4")
  moduleSpec.setBeaconQuality(legendary)
  assert.equal(moduleSpec.speedEffect().toString(), "9/4")
  moduleSpec.setBeaconQuality(normal)
  moduleSpec.setBeaconModuleQuality(legendary, 0)
  assert.equal(moduleSpec.speedEffect().toString(), "23/8")

  const ore = recipes.get("iron-ore")
  const bigDrill = specification.buildingKeys.get("big-mining-drill")
  assert.ok(ore)
  assert.ok(bigDrill instanceof models.Miner)
  specification.setMachineQuality(ore, normal)
  assert.equal(bigDrill.getResourceDrainRate(specification, ore).toString(), "1/2")
  specification.setMachineQuality(ore, legendary)
  assert.equal(bigDrill.getResourceDrainRate(specification, ore).toString(), "1/12")

  const rocketPart = recipes.get("rocket-part")
  const silo = specification.buildingKeys.get("rocket-silo")
  assert.ok(rocketPart)
  assert.ok(silo instanceof models.RocketSilo)
  specification.setMachineQuality(rocketPart, legendary)
  assert.equal(
    silo.getLaunchStats(specification).animationLaunchRate.toString(),
    math.Rational.from_floats(60, 1097).toString(),
  )
})

test("explicit equipment quality choices survive later default changes", async () => {
  const { specification, recipes } = await setupSpaceAgeFactory()
  const rare = specification.qualities.get("rare")
  const legendary = specification.qualities.get("legendary")
  const circuit = recipes.get("advanced-circuit")
  const assembler = specification.buildingKeys.get("assembling-machine-3")
  assert.ok(rare)
  assert.ok(legendary)
  assert.ok(circuit)
  assert.ok(assembler)

  specification.setBuildingOverride(circuit, assembler)
  const moduleSpec = specification.getModuleSpec(circuit)
  assert.ok(moduleSpec)
  specification.setMachineQuality(circuit, rare)
  moduleSpec.setModuleQuality(0, rare)
  moduleSpec.setBeaconModuleQuality(rare, 0)
  moduleSpec.setBeaconQuality(rare)

  specification.setDefaultMachineQuality(rare)
  specification.setDefaultModuleQuality(rare)
  specification.setDefaultBeaconQuality(rare)
  specification.setDefaultMachineQuality(legendary)
  specification.setDefaultModuleQuality(legendary)
  specification.setDefaultBeaconQuality(legendary)

  assert.equal(specification.getMachineQuality(circuit), rare)
  assert.equal(moduleSpec.moduleQualities[0], rare)
  assert.equal(moduleSpec.moduleQualities[1], legendary)
  assert.equal(moduleSpec.beaconModuleQualities[0], rare)
  assert.equal(moduleSpec.beaconModuleQualities[1], legendary)
  assert.equal(moduleSpec.beaconQuality, rare)
})

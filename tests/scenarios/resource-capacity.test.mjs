import assert from "node:assert/strict"
import test from "node:test"

import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

test("pumpjack field yield scales fluid resource capacity", async () => {
  const { specification, recipes, planets, math } = await setupSpaceAgeFactory()
  specification.selectOnePlanet(planets.get("nauvis"))
  const crudeOil = recipes.get("crude-oil")
  const baseRate = specification.getRecipeRate(crudeOil)
  specification.setResourceYield(crudeOil, math.Rational.from_integer(2))
  assert.equal(specification.getRecipeRate(crudeOil).toString(), baseRate.mul(math.Rational.from_integer(2)).toString())
})

test("belt stacking changes throughput capacity without changing item rate", async () => {
  const { specification, items, math } = await setupSpaceAgeFactory()
  const ironOre = items.get("iron-ore")
  const ironPlate = items.get("iron-plate")
  specification.beltStackSize = math.Rational.from_integer(4)
  specification.setBeltStackOverride(ironOre, "stacked")

  assert.equal(specification.getBeltCount(ironOre, math.Rational.from_integer(45)).toString(), "3/4")
  assert.equal(specification.getBeltCount(ironPlate, math.Rational.from_integer(45)).toString(), "3")
})

test("belt targets use full two-lane throughput and the selected stack height", async () => {
  const { specification, items, math } = await setupSpaceAgeFactory()
  const ironPlate = items.get("iron-plate")
  const half = math.Rational.from_floats(1, 2)
  specification.beltStackDefaultPolicy = "stacked"

  assert.equal(specification.getRateForBeltCount(ironPlate, math.Rational.from_integer(1)).toString(), "15")

  specification.beltStackSize = math.Rational.from_integer(4)
  assert.equal(specification.getRateForBeltCount(ironPlate, half).toString(), "30")

  specification.belt = specification.belts.get("turbo-transport-belt")
  assert.equal(specification.getRateForBeltCount(ironPlate, math.Rational.from_integer(1)).toString(), "240")
  assert.equal(specification.getBeltCount(ironPlate, math.Rational.from_integer(120)).toString(), "1/2")
})

test("Auto recognizes guaranteed stacked output from big mining drills", async () => {
  const { specification, items, recipes, math } = await setupSpaceAgeFactory()
  const ironOre = items.get("iron-ore")
  const miningRecipe = recipes.get("iron-ore")
  const bigMiningDrill = specification.buildingKeys.get("big-mining-drill")
  const electricMiningDrill = specification.buildingKeys.get("electric-mining-drill")
  specification.beltStackSize = math.Rational.from_integer(4)

  assert.equal(bigMiningDrill.dropsFullBeltStacks, true)
  assert.equal(electricMiningDrill.dropsFullBeltStacks, false)
  assert.equal(specification.setBuildingOverride(miningRecipe, bigMiningDrill), true)
  assert.equal(specification.getEffectiveBeltStackSize(ironOre, miningRecipe).toString(), "4")

  assert.equal(specification.setBuildingOverride(miningRecipe, electricMiningDrill), true)
  assert.equal(specification.getEffectiveBeltStackSize(ironOre, miningRecipe).toString(), "1")
})

test("asteroid collection caps identify an over-capacity plan", async () => {
  const { specification, items, planning, math } = await setupSpaceAgeFactory()
  const chunk = items.get("metallic-asteroid-chunk")
  specification.asteroidLimits.set(chunk.key, math.Rational.from_integer(5))
  const report = planning.getAsteroidConstraintReport(specification, {
    items: new Map([[chunk, math.Rational.from_integer(6)]]),
  })
  assert.equal(report.length, 1)
  assert.equal(report[0].exceeded, true)
})

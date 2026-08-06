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
  const { specification, math } = await setupSpaceAgeFactory()
  specification.beltStackSize = math.Rational.from_integer(4)
  assert.equal(specification.getBeltCount(math.Rational.from_integer(45)).toString(), "3/4")
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

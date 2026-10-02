import assert from "node:assert/strict"
import test from "node:test"

import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

test("3.75 rocket parts per second with normal productivity module 1s uses buffered silo throughput", async () => {
  const { specification, recipes, planets, calculatorModules, math } = await setupSpaceAgeFactory()
  specification.selectOnePlanet(planets.get("nauvis"))
  specification.format.setDisplayRate("s")
  const recipe = recipes.get("rocket-part")
  const moduleSpec = specification.getModuleSpec(recipe)
  const productivity = calculatorModules.get("productivity-module")
  for (let index = 0; index < moduleSpec.modules.length; index++) moduleSpec.setModule(index, productivity)

  const target = specification.addTarget("rocket-part")
  target.setRate("3.75")
  specification.updateSolution()
  assert.equal(specification.lastError, null)
  assert.equal(target.getRate().toString(), "15/4")
  assert.equal(target.getDisplayedRate(), "3.8")
  assert.equal(moduleSpec.speedEffect().toString(), "4/5")
  assert.equal(recipe.gives(target.item).toString(), "29/25")
  const stats = specification.getBuilding(recipe).getLaunchStats(specification)
  assert.equal(stats.buffered, true)
  assert.equal(stats.launchLimited, false)
  assert.equal(specification.getRecipeRate(recipe).toString(), "4/15")
  const crafts = specification.lastTotals.rates.get(recipe)
  assert.equal(crafts.toString(), "375/116")
  const silos = specification.getCount(recipe, crafts)
  assert.equal(silos.toString(), "5625/464")
  assert.equal(silos.ceil().toString(), "13")
  assert.equal(target.getDisplayedBuildings(), "12.2")
  assert.equal(specification.format.count(silos), "12.2")
  assert.equal(target.getRate().div(stats.effectivePartsPerCraft).toString(), crafts.toString())
  assert.ok(silos.less(math.Rational.from_integer(13)))
})

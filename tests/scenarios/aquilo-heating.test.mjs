import assert from "node:assert/strict"
import test from "node:test"

import { setupSpaceAgeFactory } from "../fixtures/factorio-runtime.mjs"

test("Aquilo production machines expose their heating requirement", async () => {
  const { specification, recipes, planets, planning } = await setupSpaceAgeFactory()
  specification.selectOnePlanet(planets.get("aquilo"))
  const recipe = recipes.get("cryogenic-science-pack")
  const oneMachineRate = specification.getRecipeRate(recipe)
  assert.equal(planning.getAquiloHeat(specification, recipe, oneMachineRate).toString(), "100000")
})

import assert from "node:assert/strict"
import test from "node:test"

import { loadCoreModules } from "../fixtures/factorio-runtime.mjs"

test("quality probability collapses repeated upgrades into the highest unlocked tier", async () => {
  const { planning, math } = await loadCoreModules()
  const chance = math.Rational.from_floats(1, 4)
  assert.equal(planning.qualityProbability(chance, 1, 4).toString(), "9/40")
  assert.equal(planning.qualityProbability(chance, 4, 4).toString(), "1/4000")
  assert.equal(planning.qualityProbability(chance, 2, 2).toString(), "1/40")
})

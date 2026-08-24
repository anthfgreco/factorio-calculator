import assert from "node:assert/strict"
import test from "node:test"
import { setupSpaceAgeFactory } from "./fixtures/factorio-runtime.mjs"

test("advanced-circuit totals expose a connected visualization graph", async () => {
  const runtime = await setupSpaceAgeFactory()
  runtime.specification.selectOnePlanet(runtime.planets.get("nauvis"))
  const target = runtime.specification.addTarget("advanced-circuit")
  target.setRate("1")
  runtime.specification.updateSolution()

  assert.equal(runtime.specification.lastError, null)
  assert.ok(runtime.specification.lastTotals)

  const totals = runtime.specification.lastTotals
  const nodes = new Set(totals.rates.keys())

  assert.ok(nodes.size > 5)
  assert.ok(totals.proportionate.length > 5)
  assert.ok([...nodes].some((recipe) => recipe.key === "advanced-circuit"))
  assert.ok(totals.proportionate.every((link) => nodes.has(link.from) && nodes.has(link.to)))
})

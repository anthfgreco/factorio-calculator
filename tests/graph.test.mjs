import assert from "node:assert/strict"
import test from "node:test"
import { setupSpaceAgeFactory } from "./fixtures/factorio-runtime.mjs"

test("declarative graph data is deterministic and internally connected", async () => {
  const runtime = await setupSpaceAgeFactory()
  runtime.specification.selectOnePlanet(runtime.planets.get("nauvis"))
  const target = runtime.specification.addTarget("advanced-circuit")
  target.setRate("1")
  runtime.specification.updateSolution()

  assert.equal(runtime.specification.lastError, null)
  assert.ok(runtime.specification.lastTotals)

  const first = runtime.factory.buildDeclarativeGraph(runtime.specification.lastTotals)
  const second = runtime.factory.buildDeclarativeGraph(runtime.specification.lastTotals)
  const nodes = new Set(first.nodes)

  assert.ok(first.nodes.length > 5)
  assert.ok(first.links.length > 5)
  assert.ok(first.nodes.some((node) => node.recipe.key === "advanced-circuit"))
  assert.equal(new Set(first.links.map((link) => link.key)).size, first.links.length)
  assert.ok(first.links.every((link) => nodes.has(link.from) && nodes.has(link.to)))
  assert.deepEqual(
    first.nodes.map((node) => [node.recipe.key, node.column, node.row]),
    second.nodes.map((node) => [node.recipe.key, node.column, node.row]),
  )
  assert.deepEqual(
    first.links.map((link) => link.key),
    second.links.map((link) => link.key),
  )
})

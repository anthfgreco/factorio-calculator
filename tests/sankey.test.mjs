import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

const sankeyModule = await import(pathToFileURL(resolve(build, "vendor-sankey.js")).href)

test("vendored Sankey helpers run without a browser d3 global", () => {
  const graph = sankeyModule.sankey()({
    nodes: [{ name: "source" }, { name: "target" }],
    links: [{ source: 0, target: 1, value: 2 }],
  })

  assert.equal(graph.nodes[0].value, 2)
  assert.equal(
    sankeyModule.sankeyCenter({
      depth: 0,
      sourceLinks: [{ target: { depth: 2 } }],
      targetLinks: [],
    }),
    1,
  )
  assert.equal(
    sankeyModule.sankeyLinkHorizontal()({
      source: { x1: 0 },
      target: { x0: 10 },
      y0: 2,
      y1: 4,
    }),
    "M0,2C5,2,5,4,10,4",
  )
})

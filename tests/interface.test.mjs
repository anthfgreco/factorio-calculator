import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

test("player-facing controls stay close to the evidence they affect", async () => {
  const html = await readFile(resolve(root, "calc.html"), "utf8")
  const results = await readFile(resolve(root, "src/results.ts"), "utf8")

  const tabsStart = html.indexOf('<div class="tabs">')
  const tabsEnd = html.indexOf('<div id="graph_tab"')
  const density = html.indexOf('id="factory_tab_tools"')
  assert.ok(tabsStart !== -1 && tabsEnd !== -1 && density > tabsStart && density < tabsEnd)
  assert.ok(!html.includes("factory-view-toolbar"))
  assert.ok(html.includes('id="targets_title"'))
  assert.ok(html.includes('id="visualization_summary"'))
  assert.ok(html.includes("fluids use a 10:1 scale"))

  assert.ok(results.includes('classed("item-name", true)'))
  assert.ok(results.includes('new Header("Item", 2'))
  assert.ok(results.includes('new Header("Rate / " + spec.format.rateName'))
  assert.ok(results.includes('new Header("Belts", 1'))
  assert.ok(results.includes('new Header("Power", 1'))
  assert.ok(results.includes('classed("align-left"'))
  assert.ok(results.includes('classed("align-center"'))
  assert.ok(results.includes('classed("align-right"'))
  assert.ok(results.includes('if (x.isZero())'))
  assert.ok(results.includes('classed("target-output"'))
})


test("progression presets keep Settings controls synchronized", async () => {
  const state = await readFile(resolve(root, "src/state.ts"), "utf8")
  assert.ok(state.includes("syncProgressionPresetControls()"))
  assert.ok(state.includes("input.value === spec.belt?.key"))
  assert.ok(state.includes('document.getElementById("default_beacon_count")'))
})

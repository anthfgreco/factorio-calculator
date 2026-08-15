import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

class FakeInput {
  constructor(value) {
    this.value = value
    this.checked = false
  }
}

globalThis.HTMLInputElement = FakeInput

const inputs = [new FakeInput("comfortable"), new FakeInput("compact")]
const storage = new Map()

globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
}
globalThis.document = {
  documentElement: { dataset: {} },
  querySelectorAll: () => inputs,
}

const { changeFactoryDensity, initializeFactoryDensity, setFactoryDensity } = await import(
  pathToFileURL(resolve(build, "main.js")).href
)

test("Factory table density restores and persists through the typed value API", () => {
  initializeFactoryDensity()
  assert.equal(document.documentElement.dataset.factoryDensity, "compact")
  assert.equal(inputs[0].checked, false)
  assert.equal(inputs[1].checked, true)

  setFactoryDensity("comfortable")
  assert.equal(document.documentElement.dataset.factoryDensity, "comfortable")
  assert.equal(storage.get("factorio-calculator-factory-density"), "comfortable")
  assert.equal(inputs[0].checked, true)
  assert.equal(inputs[1].checked, false)
})

test("Legacy density event adapter delegates only valid input values", () => {
  changeFactoryDensity({ target: inputs[1] })
  assert.equal(document.documentElement.dataset.factoryDensity, "compact")

  changeFactoryDensity({ target: new FakeInput("unsupported") })
  assert.equal(document.documentElement.dataset.factoryDensity, "compact")
})

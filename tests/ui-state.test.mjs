import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:ui")

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
}

const calculator = await import(pathToFileURL(resolve(build, "main.js")).href)

test("factory density restores a valid persisted value", () => {
  storage.set("factorio-calculator-factory-density", "comfortable")
  calculator.initializeFactoryDensity()
  assert.equal(calculator.factoryDensity, "comfortable")
})

test("factory density falls back to compact for missing or invalid storage", () => {
  storage.delete("factorio-calculator-factory-density")
  calculator.initializeFactoryDensity()
  assert.equal(calculator.factoryDensity, "compact")

  storage.set("factorio-calculator-factory-density", "unsupported")
  calculator.initializeFactoryDensity()
  assert.equal(calculator.factoryDensity, "compact")
})

test("factory density setter updates the live module state and persistence", () => {
  calculator.setFactoryDensity("comfortable")
  assert.equal(calculator.factoryDensity, "comfortable")
  assert.equal(storage.get("factorio-calculator-factory-density"), "comfortable")

  calculator.setFactoryDensity("compact")
  assert.equal(calculator.factoryDensity, "compact")
  assert.equal(storage.get("factorio-calculator-factory-density"), "compact")
})

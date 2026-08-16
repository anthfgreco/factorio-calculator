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

const main = await import(pathToFileURL(resolve(build, "main.js")).href)
const { BrowserCalculatorStore, FactorySpecification } = main

test("calculator store publishes the authoritative specification instead of a duplicate view model", () => {
  const store = new BrowserCalculatorStore()
  const specification = new FactorySpecification()
  let notifications = 0
  store.subscribe(() => notifications++)

  store.bindSpecification(specification)
  const initial = store.getSnapshot()
  assert.equal(initial.specification, specification)
  assert.equal(initial.totals, null)
  assert.equal(initial.datasetKey, "space-age-2-1-13")
  assert.equal(initial.status, "loading")
  assert.equal(initial.visualizerType, "sankey")
  assert.equal(initial.visualizerRender, "zoom")
  assert.equal(initial.visualizerDirection, "right")

  specification.format.rateName = "s"
  specification.notifyStateChanged()

  const updated = store.getSnapshot()
  assert.ok(updated.revision > initial.revision)
  assert.equal(updated.specification, specification)
  assert.equal(updated.specification.format.rateName, "s")
  assert.ok(notifications >= 2)
})

test("calculator store surfaces calculation failures without throwing during render", () => {
  const store = new BrowserCalculatorStore()
  const specification = new FactorySpecification()
  store.bindSpecification(specification)

  specification.lastError = new Error("No production path")
  specification.notifyStateChanged()

  assert.equal(store.getSnapshot().status, "error")
  assert.equal(store.getSnapshot().errorMessage, "No production path")
})

test("calculator store keeps snapshot identity stable until state changes", () => {
  const store = new BrowserCalculatorStore()
  const specification = new FactorySpecification()
  store.bindSpecification(specification)

  const first = store.getSnapshot()
  assert.equal(store.getSnapshot(), first)

  specification.notifyStateChanged()
  assert.notEqual(store.getSnapshot(), first)
})

test("calculator store unsubscribe and dispose stop future notifications", () => {
  const store = new BrowserCalculatorStore()
  const firstSpecification = new FactorySpecification()
  const secondSpecification = new FactorySpecification()
  let notifications = 0
  const unsubscribe = store.subscribe(() => notifications++)

  store.bindSpecification(firstSpecification)
  const afterFirstBind = notifications
  store.bindSpecification(secondSpecification)
  const afterSecondBind = notifications

  firstSpecification.notifyStateChanged()
  assert.equal(notifications, afterSecondBind)
  secondSpecification.notifyStateChanged()
  assert.equal(notifications, afterSecondBind + 1)

  unsubscribe()
  secondSpecification.notifyStateChanged()
  assert.equal(notifications, afterSecondBind + 1)

  store.dispose()
  const revisionAfterDispose = store.getSnapshot().revision
  secondSpecification.notifyStateChanged()
  assert.equal(store.getSnapshot().revision, revisionAfterDispose)
  assert.ok(afterFirstBind >= 1)
})

test("calculator store ignores target mutations before the dataset is ready", () => {
  const store = new BrowserCalculatorStore()
  const specification = new FactorySpecification()
  store.bindSpecification(specification)
  const before = store.getSnapshot()

  assert.doesNotThrow(() => store.commands.addTarget())
  store.commands.removeTarget(99)

  assert.equal(store.getSnapshot(), before)
  assert.equal(specification.buildTargets.length, 0)
})

test("calculator store owns browser-only density state through one command", () => {
  const store = new BrowserCalculatorStore()
  const specification = new FactorySpecification()
  store.bindSpecification(specification)

  store.commands.setFactoryDensity("comfortable")

  assert.equal(store.getSnapshot().factoryDensity, "comfortable")
  assert.equal(storage.get("factorio-calculator-factory-density"), "comfortable")
})

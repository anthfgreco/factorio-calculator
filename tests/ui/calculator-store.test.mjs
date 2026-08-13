import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:ui")
const load = (path) => import(pathToFileURL(resolve(build, `${path}.js`)).href)

const { BrowserCalculatorStore } = await load("application/store")
const { FactorySpecification } = await load("factory")
const { Rational } = await load("math")

function createBrowserPort() {
  return {
    datasetKey: "space-age-2-1-13",
    title: "Factorio Calculator",
    readDatasetKey() {
      return this.datasetKey
    },
    readTitle() {
      return this.title
    },
  }
}

test("calculator store publishes stable snapshots from the bound specification", () => {
  const browser = createBrowserPort()
  const store = new BrowserCalculatorStore(browser)
  const specification = new FactorySpecification()
  let notifications = 0
  store.subscribe(() => notifications++)

  store.bindSpecification(specification)
  const initial = store.getSnapshot()
  assert.equal(initial.datasetKey, "space-age-2-1-13")
  assert.equal(initial.status, "loading")
  assert.equal(initial.targets.length, 0)
  assert.equal(initial.settings.beltStackDefaultPolicy, "auto")

  specification.buildTargets.push({
    index: 0,
    itemKey: "advanced-circuit",
    item: { name: "Advanced circuit" },
    recipe: null,
    defaultRecipe: null,
    changedBuilding: false,
    buildings: Rational.from_integer(1),
    rate: Rational.from_integer(2),
    belts: Rational.from_integer(0),
    basis: "rate",
    qualityLevel: 1,
    qualityStrategy: "auto",
    getRate: () => Rational.from_integer(2),
    getBuildingCountInput: () => "1",
    getBeltCountInput: () => "0",
    setBuildings: () => undefined,
    setRate: () => undefined,
    setBelts: () => undefined,
    setQuality: () => undefined,
    setQualityStrategy: () => undefined,
    displayRecipes: () => undefined,
    rateChanged: () => undefined,
  })
  specification.notifyStateChanged()

  const updated = store.getSnapshot()
  assert.ok(updated.revision > initial.revision)
  assert.equal(updated.targets[0].itemKey, "advanced-circuit")
  assert.equal(updated.targets[0].qualityLevel, 1)
  assert.equal(updated.targets[0].qualityStrategy, "auto")
  assert.equal(updated.targets[0].rate, "2")
  assert.ok(notifications >= 2)
})

test("calculator store publishes display-rate changes", () => {
  const store = new BrowserCalculatorStore(createBrowserPort())
  const specification = new FactorySpecification()
  store.bindSpecification(specification)

  assert.equal(store.getSnapshot().settings.displayRate, "m")

  specification.format.setDisplayRate("s")
  specification.notifyStateChanged()

  assert.equal(store.getSnapshot().settings.displayRate, "s")
})

test("calculator store surfaces calculation failures without throwing during render", () => {
  const store = new BrowserCalculatorStore(createBrowserPort())
  const specification = new FactorySpecification()
  store.bindSpecification(specification)

  specification.lastError = new Error("No production path")
  specification.notifyStateChanged()

  assert.equal(store.getSnapshot().status, "error")
  assert.equal(store.getSnapshot().errorMessage, "No production path")
})

test("calculator store keeps snapshot identity stable until state changes", () => {
  const store = new BrowserCalculatorStore(createBrowserPort())
  const specification = new FactorySpecification()
  store.bindSpecification(specification)

  const first = store.getSnapshot()
  assert.equal(store.getSnapshot(), first)

  specification.notifyStateChanged()
  assert.notEqual(store.getSnapshot(), first)
})

test("calculator store unsubscribe and dispose stop future notifications", () => {
  const store = new BrowserCalculatorStore(createBrowserPort())
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

test("calculator store ignores removal requests for missing targets", () => {
  const store = new BrowserCalculatorStore(createBrowserPort())
  const specification = new FactorySpecification()
  store.bindSpecification(specification)
  const before = store.getSnapshot()

  store.commands.removeTarget(99)

  assert.equal(store.getSnapshot(), before)
  assert.equal(specification.buildTargets.length, 0)
})

test("calculator store ignores target additions before the dataset is ready", () => {
  const store = new BrowserCalculatorStore(createBrowserPort())
  const specification = new FactorySpecification()
  store.bindSpecification(specification)
  const before = store.getSnapshot()

  assert.doesNotThrow(() => store.commands.addTarget())

  assert.equal(store.getSnapshot(), before)
  assert.equal(specification.buildTargets.length, 0)
})

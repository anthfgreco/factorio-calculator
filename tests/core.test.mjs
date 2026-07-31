import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import vm from "node:vm"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

vm.runInThisContext(await readFile(resolve(root, "public/third_party/BigInteger.min.js"), "utf8"))
const load = (path) => import(pathToFileURL(resolve(build, `${path}.js`)).href)

const { DatasetValidationError, parseCalculatorData } = await load("data")
const { Matrix } = await load("math")
const { Rational, one, zero } = await load("math")
const { itemMatchesSearch } = await load("data")
const { PriorityList } = await load("priorities")

test("dataset parser accepts the generated Space Age dataset", async () => {
  const raw = JSON.parse(await readFile(resolve(root, "public/data/space-age-2.1.12.json"), "utf8"))
  const data = parseCalculatorData(raw)
  assert.equal(data.game_version, "2.1.12")
  assert.ok(data.recipes.length > 600)
})

test("dataset parser reports the failing path", () => {
  assert.throws(
    () => parseCalculatorData({ items: [] }),
    (error) => error instanceof DatasetValidationError && error.path === "recipes",
  )
})

test("rational arithmetic remains exact", () => {
  const oneThird = Rational.from_string("1/3")
  assert.equal(oneThird.add(oneThird).add(oneThird).toString(), "1")
  assert.equal(Rational.from_decimal("12.5").toString(), "25/2")
  assert.equal(Rational.from_float(-0.5).toString(), "-1/2")
})

test("matrix reduction preserves exact pivots", () => {
  const matrix = new Matrix(2, 3, [one, one, Rational.from_integer(3), one, zero, one])
  assert.deepEqual(matrix.rref(), [0, 1])
  assert.equal(matrix.index(0, 2).toString(), "1")
  assert.equal(matrix.index(1, 2).toString(), "2")
})

test("search handles aliases and spaced names", () => {
  assert.equal(itemMatchesSearch({ key: "fast-underground-belt", name: "Fast underground belt" }, "underground belt"), true)
  assert.equal(itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "red science"), true)
  assert.equal(itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "cyan"), false)
  assert.equal(zero.toString(), "0")
})


test("priority model stays deterministic without a DOM", () => {
  const low = { key: "low", isResource: () => true, defaultPriority: 0, defaultWeight: Rational.from_integer(2) }
  const high = { key: "high", isResource: () => true, defaultPriority: 0, defaultWeight: Rational.from_integer(1) }
  const defaults = PriorityList.getDefaultArray(new Map([[low.key, low], [high.key, high]]))
  const priority = PriorityList.fromArray(defaults)
  let notifications = 0
  priority.subscribe(() => notifications++)

  const level = priority.getFirstLevel()
  assert.deepEqual(level.resources.map((resource) => resource.recipe.key), ["high", "low"])
  priority.setWeight(priority.getResource(low), Rational.from_integer(0))
  assert.deepEqual(level.resources.map((resource) => resource.recipe.key), ["low", "high"])

  const newLevel = priority.addPriorityBefore(level)
  priority.setPriority(priority.getResource(high), newLevel)
  assert.equal(priority.getFirstLevel(), newLevel)
  assert.ok(notifications >= 3)
})

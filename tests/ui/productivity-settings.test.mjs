import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const build = process.env.FACTORIO_TEST_BUILD
if (!build) throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test:ui")
const load = (path) => import(pathToFileURL(resolve(build, "main.js")).href)

const {
  FACTORIO_PRODUCTIVITY_EXPORT_COMMAND,
  MAX_RECIPE_PRODUCTIVITY_PERCENT,
  parseFactorioProductivityExport,
  recipeProductivityLevelFromPercent,
  recipeProductivityPercent,
  recipeProductivityPercentPerLevel,
} = await load("settings/productivity-research")
const { Rational } = await load("math")

function createResearch(changes) {
  return {
    key: "test-productivity",
    name: "Test productivity",
    effects: new Map(changes.map(([recipe, value]) => [recipe, Rational.from_string(value)])),
  }
}

test("recipe productivity setting converts between levels and percentages", () => {
  const research = createResearch([[{ key: "advanced-circuit" }, "1/10"]])

  assert.equal(recipeProductivityPercentPerLevel(research), 10)
  assert.equal(recipeProductivityPercent(research, 7), "70")
  assert.equal(recipeProductivityLevelFromPercent(research, "70"), 7)
})

test("recipe productivity setting caps bonuses and rejects inconsistent effects", () => {
  const capped = createResearch([[{ key: "advanced-circuit" }, "1/2"]])
  assert.equal(recipeProductivityPercent(capped, 20), String(MAX_RECIPE_PRODUCTIVITY_PERCENT))
  assert.equal(recipeProductivityLevelFromPercent(capped, "900"), 6)
  assert.equal(recipeProductivityLevelFromPercent(capped, "not-a-number"), 0)

  const inconsistent = createResearch([
    [{ key: "advanced-circuit" }, "1/10"],
    [{ key: "processing-unit" }, "1/5"],
  ])
  assert.equal(recipeProductivityPercent(inconsistent, 3), null)
})

test("Factorio productivity exports are validated before import", () => {
  const imported = parseFactorioProductivityExport(
    JSON.stringify({
      kind: "factorio-calculator-productivity",
      schemaVersion: 1,
      miningProductivityPercent: 230,
      technologyLevels: {
        "processing-unit-productivity": 6,
        "steel-plate-productivity": 9,
      },
    }),
  )

  assert.equal(imported.miningProductivityPercent, 230)
  assert.deepEqual(
    [...imported.technologyLevels],
    [
      ["processing-unit-productivity", 6],
      ["steel-plate-productivity", 9],
    ],
  )
  assert.match(FACTORIO_PRODUCTIVITY_EXPORT_COMMAND, /^\/c /)
  assert.match(FACTORIO_PRODUCTIVITY_EXPORT_COMMAND, /box\.select_all\(\)/)
  assert.throws(() => parseFactorioProductivityExport("not json"), /valid Factorio productivity export/)
  assert.throws(
    () =>
      parseFactorioProductivityExport(
        JSON.stringify({
          kind: "factorio-calculator-productivity",
          schemaVersion: 1,
          miningProductivityPercent: 20,
          technologyLevels: { "processing-unit-productivity": 2.5 },
        }),
      ),
    /expected an integer/,
  )
})

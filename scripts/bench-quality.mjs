import { performance } from "node:perf_hooks"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { compileTypeScript } from "./lib/compile-typescript.mjs"

const root = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(root, ".tmp/quality-benchmark")

function requireValue(map, key) {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Expected ${key}`)
  return value
}

async function measure(name, setup) {
  const { run, operationCount } = await setup()
  const start = performance.now()
  const plan = run()
  const duration = performance.now() - start
  console.log(`${name}: ${duration.toFixed(2)} ms (${operationCount(plan)} reported operations)`)
  return plan
}

await rm(outputDirectory, { recursive: true, force: true })

try {
  await compileTypeScript({ root, outputDirectory })
  process.env.FACTORIO_TEST_BUILD = outputDirectory
  const { setupSpaceAgeFactory } = await import(
    pathToFileURL(resolve(root, "tests/fixtures/factorio-runtime.mjs")).href
  )
  const { loadHighsQualityOptimizer } = await import(
    pathToFileURL(resolve(outputDirectory, "quality/highs-solver.js")).href
  )
  const loadStarted = performance.now()
  const optimizer = await loadHighsQualityOptimizer()
  console.log(`HiGHS WASM initialization: ${(performance.now() - loadStarted).toFixed(2)} ms`)

  console.log("Exact quality planner benchmark (single-run wall time)")
  await measure("Nauvis Legendary advanced circuits", async () => {
    const runtime = await setupSpaceAgeFactory()
    const { specification, items, recipes, planets, math } = runtime
    specification.setQualityGraphOptimizer(optimizer)
    specification.selectOnePlanet(requireValue(planets, "nauvis"))
    specification.setMaxQualityLevel(4)
    specification.setAutomaticBuildingPreferences(
      [
        "assembling-machine-3",
        "chemical-plant",
        "foundry",
        "electromagnetic-plant",
        "biochamber",
        "cryogenic-plant",
        "electric-furnace",
        "big-mining-drill",
      ].map((key) => requireValue(specification.buildingKeys, key)),
    )
    const item = requireValue(items, "advanced-circuit")
    const recipe = requireValue(recipes, "advanced-circuit")
    specification.buildTargets.push({
      item,
      recipe,
      changedBuilding: false,
      qualityLevel: 4,
      qualityStrategy: "auto",
      getRate: () => math.one,
    })
    return {
      run: () => {
        specification.solve()
        const plan = specification.qualityPlans[0]
        if (plan === undefined) throw new Error("Expected Nauvis quality plan")
        return plan
      },
      operationCount: (plan) => plan.operations.length,
    }
  })
  console.log("HiGHS exact certification", optimizer.lastRun)
  await measure("Vulcanus Legendary Mech armor", async () => {
    const runtime = await setupSpaceAgeFactory()
    const { specification, items, recipes, planets, math } = runtime
    specification.setQualityGraphOptimizer(optimizer)
    specification.selectOnePlanet(requireValue(planets, "vulcanus"))
    return {
      run: () =>
        runtime.vulcanusPlanner.planVulcanusQualityTarget({
          specification,
          item: requireValue(items, "mech-armor"),
          recipe: requireValue(recipes, "mech-armor"),
          requested: math.one,
          qualityLevel: 4,
        }),
      operationCount: (plan) => plan.operations.length,
    }
  })
  console.log("HiGHS exact certification", optimizer.lastRun)
  await measure("Vulcanus Legendary Mech armor (cached at 2x rate)", async () => {
    const runtime = await setupSpaceAgeFactory()
    const { specification, items, recipes, planets, math } = runtime
    specification.setQualityGraphOptimizer(optimizer)
    specification.selectOnePlanet(requireValue(planets, "vulcanus"))
    return {
      run: () =>
        runtime.vulcanusPlanner.planVulcanusQualityTarget({
          specification,
          item: requireValue(items, "mech-armor"),
          recipe: requireValue(recipes, "mech-armor"),
          requested: math.Rational.from_integer(2),
          qualityLevel: 4,
        }),
      operationCount: (plan) => plan.operations.length,
    }
  })
  console.log("HiGHS exact certification", optimizer.lastRun)
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}

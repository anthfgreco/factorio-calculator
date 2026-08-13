import { performance } from "node:perf_hooks"
import { readFile, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { compileTypeScript } from "./lib/compile-typescript.mjs"

const root = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(root, ".tmp/solver-benchmark")
const checkBudgets = process.argv.includes("--check")
const budgets = checkBudgets
  ? JSON.parse(await readFile(resolve(root, "config/performance-budgets.json"), "utf8"))
  : null
const scenarios = [
  { depth: 500, runs: 21 },
  { depth: 1000, runs: 15 },
]

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

await rm(outputDirectory, { recursive: true, force: true })

try {
  await compileTypeScript({ root, outputDirectory })
  const load = (name) => import(pathToFileURL(resolve(outputDirectory, `${name}.js`)).href)
  const { one } = await load("math")
  const { Ingredient, solve } = await load("solver")

  function makeChain(depth) {
    const items = Array.from({ length: depth + 1 }, (_, index) => ({
      key: `benchmark-item-${index}`,
      name: `Benchmark item ${index}`,
      recipes: [],
      uses: [],
      disableRecipe: null,
    }))
    const recipes = []

    for (let index = 0; index <= depth; index++) {
      const ingredients = index === depth ? [] : [new Ingredient(items[index + 1], one)]
      const recipe = {
        key: `benchmark-recipe-${index}`,
        name: `Benchmark recipe ${index}`,
        ingredients,
        products: [new Ingredient(items[index], one)],
        getIngredients() {
          return this.ingredients
        },
        gives(item) {
          if (item === items[index]) return one
          throw new Error("unknown benchmark product")
        },
        isReal: () => true,
        isDisable: () => false,
        isResource: () => index === depth,
      }
      items[index].recipes.push(recipe)
      if (index < depth) items[index + 1].uses.push(recipe)
      items[index].disableRecipe = recipe
      recipes.push(recipe)
    }

    return {
      item: items[0],
      specification: {
        ignore: new Set(),
        buildTargets: [],
        priority: [],
        getRecipes: (item) => item.recipes,
        getRecipeGraph: () => new Set(recipes),
        getProdEffect: () => one,
        getBuilding: () => null,
        getFuelForRecipe: () => null,
      },
    }
  }

  console.log("Exact solver benchmark (median wall time)")
  for (const scenario of scenarios) {
    const { item, specification } = makeChain(scenario.depth)
    const target = [{ item, rate: one, recipe: null }]
    for (let index = 0; index < 3; index++) solve(specification, target)

    const samples = []
    for (let index = 0; index < scenario.runs; index++) {
      const start = performance.now()
      solve(specification, target)
      samples.push(performance.now() - start)
    }
    const duration = median(samples)
    const recipesPerSecond = ((scenario.depth + 1) / duration) * 1000
    const recipeCount = scenario.depth + 1
    console.log(
      `${recipeCount} recipes: ${duration.toFixed(2)} ms median (${recipesPerSecond.toFixed(0)} recipes/s, ${scenario.runs} runs)`,
    )
    if (budgets !== null) {
      const budget = budgets.solverScenarios?.[String(recipeCount)]
      if (budget === undefined) throw new Error(`Missing solver performance budget for ${recipeCount} recipes.`)
      if (duration > budget.maximumMedianMilliseconds) {
        throw new Error(
          `${recipeCount}-recipe median exceeded its budget: ${duration.toFixed(2)} ms > ${budget.maximumMedianMilliseconds} ms`,
        )
      }
      if (recipesPerSecond < budget.minimumRecipesPerSecond) {
        throw new Error(
          `${recipeCount}-recipe throughput fell below its budget: ${recipesPerSecond.toFixed(0)} < ${budget.minimumRecipesPerSecond} recipes/s`,
        )
      }
    }
  }
  if (budgets !== null) console.log("Solver performance budgets passed.")
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}

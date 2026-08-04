import { performance } from "node:perf_hooks"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { compileTypeScript } from "./lib/compile-typescript.mjs"

const root = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(root, ".tmp/solver-benchmark")
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
        lastPartial: null,
        lastTableau: null,
        lastMetadata: null,
        lastSolution: null,
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
    console.log(
      `${scenario.depth + 1} recipes: ${duration.toFixed(2)} ms median (${recipesPerSecond.toFixed(0)} recipes/s, ${scenario.runs} runs)`,
    )
  }
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}

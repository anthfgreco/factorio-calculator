import { getCycleRecipes } from "./cycle.js"
import { Matrix } from "../math/matrix.js"
import { Rational, minusOne, zero, one } from "../math/rational.js"
import { Ingredient } from "../model/ingredient.js"
import { simplex } from "../math/simplex.js"
import { Totals } from "./totals.js"
import type { SolverItem, SolverOutput, SolverRecipe, SolverSpec } from "./contracts.js"

class OutputRecipe implements SolverRecipe {
  readonly name: string = "output"
  readonly products: readonly Ingredient<SolverItem, Rational>[] = []
  readonly ingredients: readonly Ingredient<SolverItem, Rational>[]

  constructor(outputs: Iterable<[SolverItem, Rational]>) {
    this.ingredients = [...outputs].map(([item, rate]) => new Ingredient(item, rate))
  }

  getIngredients(): readonly Ingredient<SolverItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }
}

class SurplusRecipe extends OutputRecipe {
  readonly name = "surplus"
}

interface UnfinishedTarget {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe
}

class PartialResult {
  readonly recipeRates = new Map<SolverRecipe, Rational>()
  readonly remaining = new Map<SolverItem, Rational>()
  targets: UnfinishedTarget[] = []

  add(recipe: SolverRecipe, rate: Rational): void {
    this.recipeRates.set(recipe, (this.recipeRates.get(recipe) ?? zero).add(rate))
  }

  remainder(item: SolverItem, rate: Rational): void {
    this.remaining.set(item, (this.remaining.get(item) ?? zero).add(rate))
  }

  unfinishedTarget(item: SolverItem, rate: Rational, recipe: SolverRecipe): void {
    this.targets.push({ item, rate, recipe })
  }

  combine(other: PartialResult): void {
    for (let [recipe, rate] of other.recipeRates) {
      this.add(recipe, rate)
    }
    for (let [item, rate] of other.remaining) {
      this.remainder(item, rate)
    }
    this.targets.push(...other.targets)
  }
}

function traverse(
  spec: SolverSpec,
  cyclic: Set<SolverRecipe>,
  item: SolverItem,
  rate: Rational,
  forcedRecipe: SolverRecipe | null = null,
): PartialResult {
  let result = new PartialResult()
  let recipe = forcedRecipe
  if (recipe === null) {
    let itemRecipes = spec.getRecipes(item)
    if (itemRecipes.length === 0) {
      throw new Error(`No production recipe available for ${item.name ?? item.key ?? "unknown item"}`)
    }
    if (itemRecipes.length > 1 || itemRecipes[0].products.length > 1 || cyclic.has(itemRecipes[0])) {
      result.remainder(item, rate)
      return result
    }
    recipe = itemRecipes[0]
  } else if (recipe.products.length > 1 || cyclic.has(recipe)) {
    result.remainder(item, rate)
    result.unfinishedTarget(item, rate, recipe)
    return result
  }

  let recipeRate = rate.div(recipe.gives(item))
  result.add(recipe, recipeRate)
  if (spec.ignore.has(item)) {
    return result
  }
  for (let ingredient of recipe.getIngredients()) {
    result.combine(traverse(spec, cyclic, ingredient.item, recipeRate.mul(ingredient.amount)))
  }
  return result
}

function recursiveSolve(spec: SolverSpec, cyclic: Set<SolverRecipe>, outputs: readonly SolverOutput[]): PartialResult {
  let result = new PartialResult()
  for (let { item, rate, recipe } of outputs) {
    result.combine(traverse(spec, cyclic, item, rate, recipe))
  }
  return result
}

function mergeOutputs(outputs: readonly SolverOutput[]): Map<SolverItem, Rational> {
  let merged = new Map<SolverItem, Rational>()
  for (let { item, rate } of outputs) {
    merged.set(item, (merged.get(item) ?? zero).add(rate))
  }
  return merged
}

/** Solve target outputs into recipe rates and proportional material flows. */
export function solve(spec: SolverSpec, fullOutputs: readonly SolverOutput[]): Totals {
  let outputs = mergeOutputs(fullOutputs)
  let recipes = spec.getRecipeGraph(outputs)
  let cyclic = getCycleRecipes(spec, recipes)
  let partialSolution = recursiveSolve(spec, cyclic, fullOutputs)
  let solution = partialSolution.recipeRates
  spec.lastPartial = partialSolution

  if (partialSolution.remaining.size === 0) {
    spec.lastTableau = null
    spec.lastMetadata = null
    spec.lastSolution = null
    solution.set(new OutputRecipe(outputs), one)
    return new Totals(spec, outputs, solution, new Map(), new Map())
  }

  recipes = spec.getRecipeGraph(partialSolution.remaining)

  let targetItemMap = new Map<SolverItem, SolverRecipe>()
  for (let target of spec.buildTargets) {
    if (target.changedBuilding && target.recipe !== null) {
      targetItemMap.set(target.item, target.recipe)
    }
  }

  let maxPriorityRecipes = new Map<SolverItem, SolverRecipe>()
  for (let recipe of recipes) {
    if (!cyclic.has(recipe)) {
      continue
    }
    for (let { item } of recipe.getIngredients()) {
      if (recipes.has(item.disableRecipe)) {
        continue
      }
      let candidate = item.recipes.some((subrecipe) => cyclic.has(subrecipe))
      let outside = item.recipes.some((subrecipe) => !cyclic.has(subrecipe) && recipes.has(subrecipe))
      if (candidate && (targetItemMap.has(item) || !outside)) {
        maxPriorityRecipes.set(item, item.disableRecipe)
      }
    }
  }
  for (let recipe of maxPriorityRecipes.values()) {
    recipes.add(recipe)
  }

  let products = new Set<SolverItem>()
  let items: SolverItem[] = []
  let itemColumns = new Map<SolverItem, number>()
  let recipeArray: SolverRecipe[] = []
  let recipeRows = new Map<SolverRecipe, number>()
  for (let recipe of recipes) {
    recipeRows.set(recipe, recipeArray.length)
    recipeArray.push(recipe)
    for (let product of recipe.products) {
      if (!products.has(product.item)) {
        itemColumns.set(product.item, items.length)
        items.push(product.item)
      }
      products.add(product.item)
    }
  }

  let columns = items.length + partialSolution.targets.length + recipeArray.length + 3
  let rows = recipeArray.length + 2
  let tableau = new Matrix(rows, columns)
  let taxColumn = items.length + partialSolution.targets.length

  for (let [row, recipe] of recipeArray.entries()) {
    for (let product of recipe.products) {
      tableau.setIndex(row, itemColumns.get(product.item)!, product.amount)
    }
    for (let ingredient of recipe.getIngredients()) {
      tableau.addIndex(row, itemColumns.get(ingredient.item)!, zero.sub(ingredient.amount))
    }
    let productivity = spec.getProdEffect(recipe)
    if (one.less(productivity)) {
      for (let product of recipe.products) {
        let col = itemColumns.get(product.item)!
        let amount = tableau.index(row, col)
        if (zero.less(amount)) {
          tableau.setIndex(row, col, amount.mul(productivity))
        }
      }
    }
    tableau.setIndex(row, taxColumn, minusOne)
    tableau.setIndex(row, taxColumn + row + 1, one)
  }

  for (let [index, target] of partialSolution.targets.entries()) {
    let row = recipeRows.get(target.recipe)!
    let col = items.length + index
    let itemCol = itemColumns.get(target.item)!
    tableau.setIndex(row, col, tableau.index(row, itemCol))
    tableau.setIndex(rows - 1, col, zero.sub(target.rate))
  }

  tableau.setIndex(rows - 2, taxColumn, one)
  tableau.setIndex(rows - 1, columns - 2, one)

  for (let [item, rate] of partialSolution.remaining) {
    tableau.setIndex(rows - 1, itemColumns.get(item)!, zero.sub(rate))
  }

  let minimum: Rational | null = null
  let maximum = zero
  for (let coefficient of tableau.mat) {
    if (coefficient.isZero()) {
      continue
    }
    let absolute = coefficient.abs()
    if (minimum === null || absolute.less(minimum)) {
      minimum = absolute
    }
    if (maximum.less(absolute)) {
      maximum = absolute
    }
  }
  if (minimum === null) {
    throw new Error("Cannot solve an empty recipe tableau")
  }
  let two = Rational.from_float(2)
  let costRatio = maximum.div(minimum).mul(two)
  if (costRatio.less(two)) {
    costRatio = two
  }
  tableau.setIndex(rows - 2, columns - 1, one)
  let priorityCost = costRatio
  for (let level of spec.priority) {
    let normalizedTotal = zero
    let minimumWeight: Rational | null = null
    for (let { weight } of level) {
      if (minimumWeight === null || weight.less(minimumWeight)) {
        minimumWeight = weight
      }
    }
    if (minimumWeight === null) {
      continue
    }
    for (let { recipe, weight } of level) {
      let row = recipeRows.get(recipe)
      if (row === undefined) {
        continue
      }
      let normalizedWeight = weight.div(minimumWeight)
      normalizedTotal = normalizedTotal.add(normalizedWeight)
      tableau.setIndex(row, columns - 1, priorityCost.mul(normalizedWeight))
    }
    if (!normalizedTotal.isZero()) {
      priorityCost = priorityCost.mul(costRatio).mul(normalizedTotal)
    }
  }
  for (let recipe of maxPriorityRecipes.values()) {
    tableau.setIndex(recipeRows.get(recipe)!, columns - 1, priorityCost)
  }

  spec.lastTableau = tableau.copy()
  spec.lastMetadata = { items, recipes: recipeArray, targets: partialSolution.targets }
  simplex(tableau)
  spec.lastSolution = tableau

  for (let [row, recipe] of recipeArray.entries()) {
    let rate = tableau.index(tableau.rows - 1, taxColumn + row + 1)
    if (zero.less(rate)) {
      solution.set(recipe, (solution.get(recipe) ?? zero).add(rate))
    }
  }
  solution.set(new OutputRecipe(outputs), one)

  let surplus = new Map<SolverItem, Rational>()
  for (let [index, item] of items.entries()) {
    let rate = tableau.index(tableau.rows - 1, index)
    if (zero.less(rate)) {
      surplus.set(item, rate)
    }
  }
  if (surplus.size > 0) {
    solution.set(new SurplusRecipe(surplus), one)
  }
  return new Totals(spec, outputs, solution, surplus, maxPriorityRecipes)
}

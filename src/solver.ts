import { Matrix, minusOne, one, Rational, simplex, zero } from "./math.js"

// -----------------------------------------------------------------------------
// Ingredient contract
// -----------------------------------------------------------------------------

/**
 * A normalized item amount used by recipes and solver graph edges.
 *
 * The core intentionally keeps `item` generic: the solver only relies on
 * stable item identity, while the browser domain layer supplies the concrete
 * item model.
 */
export class Ingredient<TItem = unknown, TAmount = unknown> {
  constructor(
    public readonly item: TItem,
    public readonly amount: TAmount,
    public readonly productivityAmount: TAmount | null = null,
  ) {}
}

// -----------------------------------------------------------------------------
// Solver contracts
// -----------------------------------------------------------------------------

export interface SolverIngredient {
  item: SolverItem
  amount: Rational
  productivityAmount?: Rational | null
}

export interface SolverRecipe {
  key?: string
  name: string
  ingredients: readonly SolverIngredient[]
  products: readonly SolverIngredient[]
  getIngredients(): readonly SolverIngredient[]
  gives(item: SolverItem): Rational
  isReal(): boolean
  isDisable?(): boolean
  isResource?(): boolean
}

export interface SolverItem {
  key?: string
  name?: string
  recipes: SolverRecipe[]
  uses: SolverRecipe[]
  disableRecipe: SolverRecipe
}

export interface SolverTarget {
  item: SolverItem
  recipe: SolverRecipe | null
  changedBuilding: boolean
}

export interface SolverPriorityEntry {
  recipe: SolverRecipe
  weight: Rational
}

export interface SolverBuilding {
  fuel: string | null
}

export interface SolverFuel {
  item: SolverItem
}

export interface SolverSpec {
  ignore: Set<SolverItem>
  buildTargets: SolverTarget[]
  priority: Iterable<Iterable<SolverPriorityEntry>>
  lastPartial: unknown
  lastTableau: Matrix | null
  lastMetadata: unknown
  lastSolution: Matrix | null
  getRecipes(item: SolverItem): SolverRecipe[]
  getRecipeGraph(items: Map<SolverItem, Rational>): Set<SolverRecipe>
  getProdEffect(recipe: SolverRecipe): Rational
  getBuilding(recipe: SolverRecipe): SolverBuilding | null
  getFuelForRecipe(recipe: SolverRecipe): SolverFuel | null
}

export interface SolverOutput {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe | null
}

export class SolverFailure extends Error {
  readonly code: "missing-recipe" | "infeasible"
  readonly item: SolverItem | null

  constructor(code: "missing-recipe" | "infeasible", message: string, item: SolverItem | null = null) {
    super(message)
    this.name = "SolverFailure"
    this.code = code
    this.item = item
  }
}

// -----------------------------------------------------------------------------
// Cycle detection
// -----------------------------------------------------------------------------

function fuelConsumers(spec: SolverSpec, recipes: Set<SolverRecipe>, item: SolverItem): SolverRecipe[] {
  return [...recipes].filter((recipe) => spec.getFuelForRecipe(recipe)?.item === item)
}

function neighboringRecipes(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  invert: boolean,
): Set<SolverRecipe> {
  let result = new Set<SolverRecipe>()
  let itemAmounts = invert ? recipe.products : recipe.getIngredients()
  for (let { item } of itemAmounts) {
    let candidates: SolverRecipe[] = invert ? item.uses : item.recipes
    if (invert) {
      candidates = candidates.concat(fuelConsumers(spec, recipes, item))
    }
    for (let candidate of candidates) {
      if (recipes.has(candidate)) {
        result.add(candidate)
      }
    }
  }
  return result
}

function effectiveProductAmount(spec: SolverSpec, recipe: SolverRecipe, product: SolverIngredient): Rational {
  let productivity = spec.getProdEffect(recipe)
  if (!one.less(productivity)) {
    return product.amount
  }

  let productivityAmount = product.productivityAmount ?? null
  if (productivityAmount === null) {
    productivityAmount = product.amount
    for (let ingredient of recipe.getIngredients()) {
      if (ingredient.item === product.item) {
        productivityAmount = productivityAmount.sub(ingredient.amount)
      }
    }
    if (productivityAmount.less(zero)) {
      return product.amount
    }
  }

  return product.amount.add(productivityAmount.mul(productivity.sub(one)))
}

function visit(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  seen: Set<SolverRecipe>,
  invert: boolean,
): SolverRecipe[] {
  if (seen.has(recipe)) {
    return []
  }
  seen.add(recipe)
  let result: SolverRecipe[] = []
  for (let neighbor of neighboringRecipes(spec, recipes, recipe, invert)) {
    result.push(...visit(spec, recipes, neighbor, seen, invert))
  }
  result.push(recipe)
  return result
}

function isSelfCycle(component: readonly SolverRecipe[]): boolean {
  let recipe = component[0]
  let products = new Set<SolverItem>(recipe.products.map(({ item }) => item))
  return recipe.getIngredients().some(({ item }) => products.has(item))
}

export function getCycleRecipes(spec: SolverSpec, recipes: Set<SolverRecipe>): Set<SolverRecipe> {
  let seen = new Set<SolverRecipe>()
  let ordered: SolverRecipe[] = []
  for (let recipe of recipes) {
    ordered.push(...visit(spec, recipes, recipe, seen, false))
  }

  let result = new Set<SolverRecipe>()
  seen = new Set<SolverRecipe>()
  for (let index = ordered.length - 1; index >= 0; index--) {
    let root = ordered[index]
    if (seen.has(root)) {
      continue
    }
    let component = visit(spec, recipes, root, seen, true)
    if (component.length > 1 || isSelfCycle(component)) {
      for (let recipe of component) {
        result.add(recipe)
      }
    }
  }
  return result
}

// -----------------------------------------------------------------------------
// Solver totals
// -----------------------------------------------------------------------------

function addRate<TKey>(map: Map<TKey, Rational>, key: TKey, rate: Rational): void {
  map.set(key, (map.get(key) ?? zero).add(rate))
}

function setNested<TKey1, TKey2>(
  map: Map<TKey1, Map<TKey2, Rational>>,
  key1: TKey1,
  key2: TKey2,
  value: Rational,
): void {
  let nested = map.get(key1)
  if (nested === undefined) {
    nested = new Map<TKey2, Rational>()
    map.set(key1, nested)
  }
  nested.set(key2, value)
}

export interface ProportionateLink {
  item: SolverItem
  from: SolverRecipe
  to: SolverRecipe
  rate: Rational
  fuel: boolean
}

export class Totals {
  readonly items = new Map<SolverItem, Rational>()
  readonly producers = new Map<SolverItem, Map<SolverRecipe, Rational>>()
  readonly consumers = new Map<SolverItem, Map<SolverRecipe, Rational>>()
  readonly proportionate: ProportionateLink[] = []

  constructor(
    spec: SolverSpec,
    public readonly products: Map<SolverItem, Rational>,
    public readonly rates: Map<SolverRecipe, Rational>,
    public readonly surplus: Map<SolverItem, Rational>,
    public readonly extra: Map<SolverItem, SolverRecipe>,
  ) {
    for (let [recipe, rate] of rates) {
      for (let ingredient of recipe.getIngredients()) {
        let itemRate = rate.mul(ingredient.amount)
        setNested(this.consumers, ingredient.item, recipe, itemRate)
        addRate(this.items, ingredient.item, itemRate)
      }
      for (let product of recipe.products) {
        setNested(this.producers, product.item, recipe, rate.mul(recipe.gives(product.item)))
      }
    }

    for (let [recipe, recipeRate] of rates) {
      let ingredients = recipe.getIngredients()
      for (let index = 0; index < ingredients.length; index++) {
        let ingredient = ingredients[index]
        let totalRate = this.items.get(ingredient.item)
        if (totalRate === undefined || totalRate.isZero()) {
          continue
        }
        let ratio = recipeRate.mul(ingredient.amount).div(totalRate)
        let sourceRecipes = spec.getRecipes(ingredient.item)
        let extraRecipe = extra.get(ingredient.item)
        if (extraRecipe !== undefined) {
          sourceRecipes.push(extraRecipe)
        }
        for (let sourceRecipe of sourceRecipes) {
          let sourceRate = rates.get(sourceRecipe)
          if (sourceRate === undefined) {
            continue
          }
          this.proportionate.push({
            item: ingredient.item,
            from: sourceRecipe,
            to: recipe,
            rate: sourceRate.mul(sourceRecipe.gives(ingredient.item)).mul(ratio),
            fuel: index >= recipe.ingredients.length,
          })
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Factory solver
// -----------------------------------------------------------------------------

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
      throw new SolverFailure(
        "missing-recipe",
        `No enabled production recipe can make ${item.name ?? item.key ?? "unknown item"}.`,
        item,
      )
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
      tableau.setIndex(row, itemColumns.get(product.item)!, effectiveProductAmount(spec, recipe, product))
    }
    for (let ingredient of recipe.getIngredients()) {
      tableau.addIndex(row, itemColumns.get(ingredient.item)!, zero.sub(ingredient.amount))
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
  try {
    simplex(tableau)
  } catch {
    throw new SolverFailure(
      "infeasible",
      "This combination of recipes and resource priorities cannot produce every requested output.",
    )
  }
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

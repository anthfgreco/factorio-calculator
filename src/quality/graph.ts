import { one, Rational, zero } from "../math.js"
import { Ingredient, solve, type SolverItem, type SolverRecipe, type SolverSpec, Totals } from "../solver.js"
import type { Item, Recipe } from "../recipes.js"

export type QualityGraphOperationKind = "craft" | "recycle" | "source"

class QualityDisableRecipe implements SolverRecipe {
  readonly name: string
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[] = []
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[] = []

  constructor(readonly item: QualityGraphItem) {
    this.name = `Disable ${item.name}`
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }

  isDisable(): boolean {
    return true
  }
}

export class QualityGraphItem implements SolverItem {
  readonly recipes: QualityGraphRecipe[] = []
  readonly uses: QualityGraphRecipe[] = []
  readonly disableRecipe: SolverRecipe
  readonly key: string
  readonly name: string

  constructor(
    readonly item: Item,
    readonly qualityLevel: number | null,
    key: string,
    name: string,
  ) {
    this.key = key
    this.name = name
    this.disableRecipe = new QualityDisableRecipe(this)
  }
}

export interface QualityGraphRecipeMetadata {
  readonly baseRecipe: Recipe | null
  readonly qualityLevel: number | null
  readonly kind: QualityGraphOperationKind
  readonly recycleRatesByQuality?: readonly Rational[]
  readonly sourceItem?: Item
  readonly configurationKey?: string
}

export interface QualityGraphSolution {
  readonly rates: ReadonlyMap<QualityGraphRecipe, Rational>
  readonly surplus: ReadonlyMap<QualityGraphItem, Rational>
}

export interface QualityGraphOptimizer {
  solve(graph: QualityGraph, output: QualityGraphItem, rate: Rational): QualityGraphSolution | null
}

export class QualityGraphRecipe implements SolverRecipe {
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[]
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[]

  constructor(
    readonly key: string,
    readonly name: string,
    ingredients: Iterable<Ingredient<QualityGraphItem, Rational>>,
    products: Iterable<Ingredient<QualityGraphItem, Rational>>,
    readonly metadata: QualityGraphRecipeMetadata,
  ) {
    this.ingredients = [...ingredients].filter(({ amount }) => !amount.isZero())
    this.products = [...products].filter(({ amount }) => !amount.isZero())
    for (const ingredient of this.ingredients) ingredient.item.uses.push(this)
    for (const product of this.products) product.item.recipes.push(this)
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(item: SolverItem): Rational {
    let amount = zero
    for (const product of this.products) {
      if (product.item === item) amount = amount.add(product.amount)
    }
    return amount
  }

  isReal(): boolean {
    return false
  }

  isDisable(): boolean {
    return false
  }

  isResource(): boolean {
    return this.metadata.kind === "source"
  }
}

export class QualityGraph {
  readonly items = new Map<string, QualityGraphItem>()
  readonly recipes: QualityGraphRecipe[] = []
  readonly sourceRecipes: QualityGraphRecipe[] = []
  readonly priorityLevels: Map<QualityGraphRecipe, Rational>[] = []

  item(baseItem: Item, qualityLevel: number | null): QualityGraphItem {
    const key = qualityLevel === null ? baseItem.key : `${baseItem.key}@q${qualityLevel}`
    let item = this.items.get(key)
    if (item === undefined) {
      const suffix = qualityLevel === null ? "" : ` quality ${qualityLevel}`
      item = new QualityGraphItem(baseItem, qualityLevel, key, `${baseItem.name}${suffix}`)
      this.items.set(key, item)
    }
    return item
  }

  recipe(
    key: string,
    name: string,
    ingredients: Iterable<Ingredient<QualityGraphItem, Rational>>,
    products: Iterable<Ingredient<QualityGraphItem, Rational>>,
    metadata: QualityGraphRecipeMetadata,
  ): QualityGraphRecipe {
    const recipe = new QualityGraphRecipe(key, name, ingredients, products, metadata)
    this.recipes.push(recipe)
    if (metadata.kind === "source") this.sourceRecipes.push(recipe)
    return recipe
  }

  source(item: QualityGraphItem, baseItem: Item, weight: Rational = one, level = 0): QualityGraphRecipe {
    const existing = this.sourceRecipes.find(
      (recipe) => recipe.metadata.sourceItem === baseItem && recipe.products[0]?.item === item,
    )
    if (existing !== undefined) return existing
    const recipe = this.recipe(`quality-source:${item.key}`, `Fresh ${item.name}`, [], [new Ingredient(item, one)], {
      baseRecipe: null,
      qualityLevel: item.qualityLevel,
      kind: "source",
      sourceItem: baseItem,
    })
    this.setPriority(recipe, weight, level)
    return recipe
  }

  setPriority(recipe: QualityGraphRecipe, weight: Rational, level = 0): void {
    while (this.priorityLevels.length <= level) this.priorityLevels.push(new Map())
    this.priorityLevels[level]!.set(recipe, weight)
  }

  private viableRecipes(): Set<QualityGraphRecipe> {
    const viable = new Set(this.recipes)
    let changed = true
    while (changed) {
      changed = false
      for (const recipe of [...viable]) {
        if (
          recipe.ingredients.some((ingredient) => ingredient.item.recipes.every((producer) => !viable.has(producer)))
        ) {
          viable.delete(recipe)
          changed = true
        }
      }
    }
    return viable
  }

  private recipeSignature(recipe: QualityGraphRecipe): string {
    const amounts = (values: readonly Ingredient<QualityGraphItem, Rational>[]): string[] =>
      values.map(({ item, amount }) => `${item.key}:${amount.toString()}`).sort()
    const priority = this.priorityLevels.map((level) => level.get(recipe)?.toString() ?? null)
    return JSON.stringify([
      amounts(recipe.ingredients),
      amounts(recipe.products),
      priority,
      recipe.metadata.baseRecipe?.key ?? null,
      recipe.metadata.qualityLevel,
      recipe.metadata.kind,
      recipe.metadata.recycleRatesByQuality?.map((rate) => rate.toString()) ?? null,
      recipe.metadata.sourceItem?.key ?? null,
      recipe.metadata.configurationKey ?? null,
    ])
  }

  private deduplicateRecipes(recipes: ReadonlySet<QualityGraphRecipe>): Set<QualityGraphRecipe> {
    const signatures = new Set<string>()
    const unique = new Set<QualityGraphRecipe>()
    for (const recipe of recipes) {
      const signature = this.recipeSignature(recipe)
      if (signatures.has(signature)) continue
      signatures.add(signature)
      unique.add(recipe)
    }
    return unique
  }

  solverRecipes(): ReadonlySet<QualityGraphRecipe> {
    return this.deduplicateRecipes(this.viableRecipes())
  }

  private solverSpec(viableRecipes: ReadonlySet<QualityGraphRecipe>): SolverSpec {
    const graph = this
    const priority = this.priorityLevels
      .map((level) => [...level].map(([recipe, weight]) => ({ recipe, weight })))
      .filter((level) => level.length > 0)
    return {
      ignore: new Set(),
      buildTargets: [],
      priority,
      getRecipes(item: SolverItem): SolverRecipe[] {
        if (!(item instanceof QualityGraphItem)) throw new Error("Unknown quality graph item")
        return item.recipes.filter((recipe) => viableRecipes.has(recipe))
      },
      getRecipeGraph(_items: Map<SolverItem, Rational>): Set<SolverRecipe> {
        return new Set(viableRecipes)
      },
      getProdEffect(_recipe: SolverRecipe): Rational {
        return one
      },
      getBuilding(_recipe: SolverRecipe) {
        return null
      },
      getFuelForRecipe(_recipe: SolverRecipe) {
        return null
      },
    }
  }

  private totalsFromSolution(
    viableRecipes: ReadonlySet<QualityGraphRecipe>,
    output: QualityGraphItem,
    rate: Rational,
    solution: QualityGraphSolution,
  ): Totals {
    const spec = this.solverSpec(viableRecipes)
    const outputs = new Map<SolverItem, Rational>([[output, rate]])
    const rates = new Map<SolverRecipe, Rational>(solution.rates)
    rates.set(new QualityOutputRecipe(outputs), one)
    const surplus = new Map<SolverItem, Rational>(solution.surplus)
    if (surplus.size > 0) rates.set(new QualitySurplusRecipe(surplus), one)
    return new Totals(spec, outputs, rates, surplus, new Map())
  }

  solve(output: QualityGraphItem, rate: Rational, optimizer: QualityGraphOptimizer | null = null): Totals {
    const viableRecipes = this.solverRecipes()
    const spec = this.solverSpec(viableRecipes)
    spec.buildTargets.push({ item: output, recipe: null, changedBuilding: false })

    try {
      const optimized = optimizer?.solve(this, output, rate) ?? null
      if (optimized !== null) return this.totalsFromSolution(viableRecipes, output, rate, optimized)
      return solve(spec, [{ item: output, rate, recipe: null }])
    } catch (error) {
      if (error instanceof Error && /unbounded|infeasible|cycle/i.test(error.message)) {
        throw new Error("Quality flow contains a neutral or positive production cycle", { cause: error })
      }
      throw error
    }
  }
}

class QualityOutputRecipe implements SolverRecipe {
  readonly name: string = "output"
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[] = []
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[]

  constructor(outputs: ReadonlyMap<SolverItem, Rational>) {
    this.ingredients = [...outputs].map(([item, amount]) => {
      if (!(item instanceof QualityGraphItem)) throw new Error("Unknown quality graph output")
      return new Ingredient(item, amount)
    })
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }
}

class QualitySurplusRecipe extends QualityOutputRecipe {
  override readonly name = "surplus"
}

export function addIngredient(
  amounts: Map<QualityGraphItem, Rational>,
  item: QualityGraphItem,
  amount: Rational,
): void {
  if (amount.isZero()) return
  amounts.set(item, (amounts.get(item) ?? zero).add(amount))
}

export function ingredientsFromMap(
  amounts: ReadonlyMap<QualityGraphItem, Rational>,
): Ingredient<QualityGraphItem, Rational>[] {
  return [...amounts].map(([item, amount]) => new Ingredient(item, amount))
}

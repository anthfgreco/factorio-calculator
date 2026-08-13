import { one, Rational, zero } from "../math.js"
import { Ingredient, solve, type SolverItem, type SolverRecipe, type SolverSpec, type Totals } from "../solver.js"
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

  solve(output: QualityGraphItem, rate: Rational): Totals {
    const graph = this
    const viableRecipes = this.viableRecipes()
    const priority = this.priorityLevels
      .map((level) => [...level].map(([recipe, weight]) => ({ recipe, weight })))
      .filter((level) => level.length > 0)
    const spec: SolverSpec = {
      ignore: new Set(),
      buildTargets: [{ item: output, recipe: null, changedBuilding: false }],
      priority,
      lastPartial: null,
      lastTableau: null,
      lastMetadata: null,
      lastSolution: null,
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

    try {
      return solve(spec, [{ item: output, rate, recipe: null }])
    } catch (error) {
      if (error instanceof Error && /unbounded|infeasible|cycle/i.test(error.message)) {
        throw new Error("Quality flow contains a neutral or positive production cycle", { cause: error })
      }
      throw error
    }
  }
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

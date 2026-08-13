import type { Rational } from "../math.js"

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

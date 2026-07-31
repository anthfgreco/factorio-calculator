import type { Matrix } from "../math/matrix.js"
import type { Rational } from "../math/rational.js"

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

export interface SolverSpec {
  ignore: Set<SolverItem>
  buildTargets: SolverTarget[]
  priority: Iterable<Iterable<SolverPriorityEntry>>
  fuel: { item: SolverItem }
  lastPartial: unknown
  lastTableau: Matrix | null
  lastMetadata: unknown
  lastSolution: Matrix | null
  getRecipes(item: SolverItem): SolverRecipe[]
  getRecipeGraph(items: Map<SolverItem, Rational>): Set<SolverRecipe>
  getProdEffect(recipe: SolverRecipe): Rational
  getBuilding(recipe: SolverRecipe): SolverBuilding | null
}

export interface SolverOutput {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe | null
}

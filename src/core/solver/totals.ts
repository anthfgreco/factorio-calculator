import { type Rational, zero } from "../math/rational.js"
import type { SolverItem, SolverRecipe, SolverSpec } from "./contracts.js"

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

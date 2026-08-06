import type { CalculatorData } from "../data.js"
import { Rational } from "../math.js"
import { Icon } from "../presentation.js"
import type { Recipe } from "../recipes.js"

export interface RecipeProductivityResearch {
  readonly key: string
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly effects: Map<Recipe, Rational>
  readonly icon: Icon
}

export function getRecipeProductivityResearch(
  data: CalculatorData,
  recipes: ReadonlyMap<string, Recipe>,
): Map<string, RecipeProductivityResearch> {
  const result = new Map<string, RecipeProductivityResearch>()
  for (let entry of data.recipe_productivity_research ?? []) {
    const effects = new Map<Recipe, Rational>()
    for (let effect of entry.effects) {
      let recipe = recipes.get(effect.recipe)
      if (recipe !== undefined) {
        effects.set(recipe, Rational.from_float_approximate(effect.change))
      }
    }
    const iconTarget = {
      key: entry.key,
      name: entry.localized_name.en,
      icon_col: entry.icon_col,
      icon_row: entry.icon_row,
      effects,
    }
    const research: RecipeProductivityResearch = { ...iconTarget, icon: new Icon(iconTarget) }
    result.set(entry.key, research)
  }
  return result
}

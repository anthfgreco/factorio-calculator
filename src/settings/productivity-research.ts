import { Rational } from "../math.js"
import type { RecipeProductivityResearch } from "../models.js"

export const MAX_RECIPE_PRODUCTIVITY_PERCENT = 300

export function recipeProductivityPercentPerLevel(research: RecipeProductivityResearch): number {
  const change = research.effects.values().next().value
  return change === undefined ? 0 : Number(change.mul(Rational.from_integer(100)).toDecimal())
}

export function recipeProductivityPercent(research: RecipeProductivityResearch, level: number): string | null {
  const bonuses = new Set<string>()
  for (const change of research.effects.values()) {
    bonuses.add(change.mul(Rational.from_float_approximate(level)).mul(Rational.from_integer(100)).toDecimal())
  }
  if (bonuses.size !== 1) return null

  const onlyBonus = bonuses.values().next().value
  if (onlyBonus === undefined) return null
  const percent = Rational.from_string(onlyBonus)
  return Rational.min(percent, Rational.from_integer(MAX_RECIPE_PRODUCTIVITY_PERCENT)).toDecimal()
}

export function recipeProductivityLevelFromPercent(research: RecipeProductivityResearch, value: string): number {
  const percent = Number(value)
  const percentPerLevel = recipeProductivityPercentPerLevel(research)
  if (!Number.isFinite(percent) || percentPerLevel <= 0) return 0
  return Math.min(MAX_RECIPE_PRODUCTIVITY_PERCENT, Math.max(0, percent)) / percentPerLevel
}

import { Matrix, one, Rational, zero } from "../math.js"

const CONTINUATION_CHANCE = Rational.from_floats(1, 10)
const STOP_AFTER_UPGRADE_CHANCE = Rational.from_floats(9, 10)

/**
 * Exact probability that one quality roll moves an item from `fromLevel` to
 * `toLevel`. Levels are sequential quality indexes, not prototype level
 * values (Legendary is index 4 even though its prototype level is 5).
 */
export function qualityTransitionProbability(
  chance: Rational,
  fromLevel: number,
  toLevel: number,
  maxLevel: number,
): Rational {
  if (fromLevel < 0 || toLevel < fromLevel || maxLevel < 0 || fromLevel > maxLevel || toLevel > maxLevel) {
    return zero
  }
  if (fromLevel === maxLevel) return toLevel === maxLevel ? one : zero

  const normalizedChance = Rational.max(zero, Rational.min(one, chance))
  if (toLevel === fromLevel) return one.sub(normalizedChance)

  const upgrades = toLevel - fromLevel
  const repeated = CONTINUATION_CHANCE.pow(upgrades - 1)
  return toLevel === maxLevel
    ? normalizedChance.mul(repeated)
    : normalizedChance.mul(STOP_AFTER_UPGRADE_CHANCE).mul(repeated)
}

export function qualityTransitionDistribution(
  chance: Rational,
  fromLevel: number,
  maxLevel: number,
): readonly Rational[] {
  return Array.from({ length: maxLevel + 1 }, (_, toLevel) =>
    qualityTransitionProbability(chance, fromLevel, toLevel, maxLevel),
  )
}

/** Solve A x = b exactly. Throws for singular or underdetermined systems. */
export function solveExactLinearSystem(
  coefficients: readonly (readonly Rational[])[],
  rhs: readonly Rational[],
): Rational[] {
  const size = coefficients.length
  if (size === 0 || rhs.length !== size || coefficients.some((row) => row.length !== size)) {
    throw new Error("Quality flow requires a non-empty square linear system")
  }

  const augmented = new Matrix(size, size + 1)
  for (let row = 0; row < size; row++) {
    const coefficientRow = coefficients[row]
    if (coefficientRow === undefined) throw new Error("Missing quality-flow coefficient row")
    for (let column = 0; column < size; column++) {
      const value = coefficientRow[column]
      if (value === undefined) throw new Error("Missing quality-flow coefficient")
      augmented.setIndex(row, column, value)
    }
    const result = rhs[row]
    if (result === undefined) throw new Error("Missing quality-flow result")
    augmented.setIndex(row, size, result)
  }

  const pivots = augmented.rref()
  if (pivots.length !== size || pivots.some((pivot, index) => pivot !== index)) {
    throw new Error("Quality flow contains a neutral or non-consuming cycle")
  }
  return Array.from({ length: size }, (_, row) => augmented.index(row, size))
}

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

function bigintGcd(left: bigint, right: bigint): bigint {
  left = left < 0n ? -left : left
  right = right < 0n ? -right : right
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function bigintLcm(left: bigint, right: bigint): bigint {
  return (left / bigintGcd(left, right)) * right
}

/**
 * Solve A x = b exactly with fraction-free Bareiss elimination.
 *
 * This avoids constructing and reducing a Rational for every cell update in
 * the larger optimal-basis certification systems used by the quality solver.
 */
export function solveExactLinearSystemFractionFree(
  coefficients: readonly (readonly Rational[])[],
  rhs: readonly Rational[],
): Rational[] {
  const size = coefficients.length
  if (size === 0 || rhs.length !== size || coefficients.some((row) => row.length !== size)) {
    throw new Error("Quality flow requires a non-empty square linear system")
  }

  const matrix = coefficients.map((sourceRow, row) => {
    const result = rhs[row]
    if (result === undefined) throw new Error("Missing quality-flow result")
    let denominator = result.q
    for (const value of sourceRow) denominator = bigintLcm(denominator, value.q)
    return [...sourceRow, result].map((value) => value.p * (denominator / value.q))
  })

  let previousPivot = 1n
  for (let pivotIndex = 0; pivotIndex < size - 1; pivotIndex++) {
    let pivotRow = pivotIndex
    while (pivotRow < size && matrix[pivotRow]?.[pivotIndex] === 0n) pivotRow++
    if (pivotRow === size) throw new Error("Quality flow contains a neutral or non-consuming cycle")
    if (pivotRow !== pivotIndex) {
      const current = matrix[pivotIndex]
      const replacement = matrix[pivotRow]
      if (current === undefined || replacement === undefined) throw new Error("Missing quality-flow row")
      matrix[pivotIndex] = replacement
      matrix[pivotRow] = current
    }

    const pivot = matrix[pivotIndex]?.[pivotIndex]
    const pivotValues = matrix[pivotIndex]
    if (pivot === undefined || pivot === 0n || pivotValues === undefined) {
      throw new Error("Quality flow contains a neutral or non-consuming cycle")
    }
    for (let row = pivotIndex + 1; row < size; row++) {
      const rowValues = matrix[row]
      const factor = rowValues?.[pivotIndex]
      if (rowValues === undefined || factor === undefined) throw new Error("Missing quality-flow coefficient")
      for (let column = pivotIndex + 1; column <= size; column++) {
        const value = rowValues[column]
        const pivotValue = pivotValues[column]
        if (value === undefined || pivotValue === undefined) throw new Error("Missing quality-flow coefficient")
        const numerator = value * pivot - factor * pivotValue
        if (numerator % previousPivot !== 0n) throw new Error("Fraction-free quality elimination lost exactness")
        rowValues[column] = numerator / previousPivot
      }
      rowValues[pivotIndex] = 0n
    }
    previousPivot = pivot
  }

  const solution = Array.from({ length: size }, () => zero)
  for (let row = size - 1; row >= 0; row--) {
    const rowValues = matrix[row]
    const diagonal = rowValues?.[row]
    const result = rowValues?.[size]
    if (rowValues === undefined || diagonal === undefined || result === undefined || diagonal === 0n) {
      throw new Error("Quality flow contains a neutral or non-consuming cycle")
    }
    let remainder = new Rational(result, 1n)
    for (let column = row + 1; column < size; column++) {
      const coefficient = rowValues[column]
      const value = solution[column]
      if (coefficient === undefined || value === undefined) throw new Error("Missing quality-flow coefficient")
      if (coefficient !== 0n) remainder = remainder.sub(new Rational(coefficient, 1n).mul(value))
    }
    solution[row] = remainder.div(new Rational(diagonal, 1n))
  }
  return solution
}

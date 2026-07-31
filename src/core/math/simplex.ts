import { Matrix } from "./matrix.js"
import { type Rational, zero } from "./rational.js"

function pivot(tableau: Matrix, row: number, col: number): void {
  let pivotValue = tableau.index(row, col)
  tableau.mulRow(row, pivotValue.reciprocate())
  for (let otherRow = 0; otherRow < tableau.rows; otherRow++) {
    if (otherRow === row) {
      continue
    }
    let ratio = tableau.index(otherRow, col)
    if (ratio.isZero()) {
      continue
    }
    for (let currentCol = 0; currentCol < tableau.cols; currentCol++) {
      let next = tableau.index(otherRow, currentCol).sub(tableau.index(row, currentCol).mul(ratio))
      tableau.setIndex(otherRow, currentCol, next)
    }
  }
}

function pivotColumn(tableau: Matrix, col: number): number | null {
  let bestRatio: Rational | null = null
  let bestRow: number | null = null
  for (let row = 0; row < tableau.rows - 1; row++) {
    let coefficient = tableau.index(row, col)
    if (!zero.less(coefficient)) {
      continue
    }
    let ratio = tableau.index(row, tableau.cols - 1).div(coefficient)
    if (bestRatio === null || ratio.less(bestRatio)) {
      bestRatio = ratio
      bestRow = row
    }
  }
  if (bestRow !== null) {
    pivot(tableau, bestRow, col)
  }
  return bestRow
}

/** Solve a canonical simplex tableau in place. */
export function simplex(tableau: Matrix): void {
  while (true) {
    let minimum: Rational | null = null
    let minimumColumn: number | null = null
    for (let col = 0; col < tableau.cols - 1; col++) {
      let value = tableau.index(tableau.rows - 1, col)
      if (minimum === null || value.less(minimum)) {
        minimum = value
        minimumColumn = col
      }
    }
    if (minimum === null || minimumColumn === null || !minimum.less(zero)) {
      return
    }
    if (pivotColumn(tableau, minimumColumn) === null) {
      throw new Error("Simplex tableau is unbounded for the selected pivot column")
    }
  }
}

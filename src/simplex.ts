import { minusOne, zero, one } from "./rational.js"

function pivot(A, row, col) {
  let x = A.index(row, col)
  A.mulRow(row, x.reciprocate())
  for (let r = 0; r < A.rows; r++) {
    if (r === row) {
      continue
    }
    let ratio = A.index(r, col)
    if (ratio.isZero()) {
      continue
    }

    for (let c = 0; c < A.cols; c++) {
      x = A.index(r, c).sub(A.index(row, c).mul(ratio))
      A.setIndex(r, c, x)
    }
  }
}

function getTestRatios(A, col) {
  let ratios = []
  for (let i = 0; i < A.rows - 1; i++) {
    let x = A.index(i, col)
    if (!zero.less(x)) {
      ratios.push(null)
    } else {
      ratios.push(A.index(i, A.cols - 1).div(x))
    }
  }
  return ratios
}

function pivotCol(A, col) {
  let best_ratio = null
  let best_row = null
  for (let row = 0; row < A.rows - 1; row++) {
    let x = A.index(row, col)
    if (!zero.less(x)) {
      continue
    }
    let ratio = A.index(row, A.cols - 1).div(x)
    if (best_ratio === null || ratio.less(best_ratio)) {
      best_ratio = ratio
      best_row = row
    }
  }
  if (best_ratio !== null) {
    pivot(A, best_row, col)
  }
  return best_row
}

// Every basic variable in our initial tableau is negative. This procedure will
// invert these bases, placing the tableau into the standard form, ready for
// application of the simplex method.
function eliminateNegativeBases(A) {
  let negativeBases = []
  for (let i = 0; i < A.rows - 1; i++) {
    // If the RHS is zero, just multiply the whole row by -1.
    if (A.index(i, A.cols - 1).equal(zero)) {
      A.mulRow(i, minusOne)
      negativeBases.push(false)
    } else {
      negativeBases.push(true)
    }
  }
  let done = false
  findNext: while (!done) {
    for (let i = 0; i < negativeBases.length; i++) {
      if (!negativeBases[i]) {
        continue
      }
      // Find largest positive coefficient in the row.
      let max = zero
      let maxCol = null
      for (let j = 0; j < A.cols - 1; j++) {
        let x = A.index(i, j)
        if (max.less(x)) {
          max = x
          maxCol = j
        }
      }
      // Something is wrong; we can't solve this.
      if (maxCol === null) {
        throw new Error("Cannot eliminate negative basic variable.")
      }
      // Pivot on that column. If two rows have an equal test ratio,
      // and one has a negative basic variable, prefer the row whose
      // value is negative.
      let ratios = getTestRatios(A, maxCol)
      let matches = []
      let minRatio = null
      for (let j = 0; j < ratios.length; j++) {
        let ratio = ratios[j]
        if (ratio === null || ratio.less(zero)) {
          continue
        }
        if (minRatio === null || ratio.less(minRatio)) {
          minRatio = ratio
          matches = [j]
        } else if (ratio.equal(minRatio)) {
          matches.push(j)
        }
      }
      let pivotIdx = 0
      for (; pivotIdx < matches.length; pivotIdx++) {
        if (negativeBases[matches[pivotIdx]]) {
          break
        }
      }
      if (pivotIdx === matches.length) {
        pivotIdx = 0
      }
      let pivotRow = matches[pivotIdx]
      negativeBases[pivotRow] = false
      pivot(A, pivotRow, maxCol)
      continue findNext
    }
    done = true
  }
}

export function simplex(A) {
  while (true) {
    let min = null
    let minCol = null
    for (let col = 0; col < A.cols - 1; col++) {
      let x = A.index(A.rows - 1, col)
      if (min === null || x.less(min)) {
        min = x
        minCol = col
      }
    }
    if (!min.less(zero)) {
      return
    }
    let bestRow = pivotCol(A, minCol)
    if (bestRow === null) {
      throw new Error("failed to pivot")
    }
  }
}

function getBasis(A) {
  let basis = []
  for (let i = 0; i < A.cols - 1; i++) {
    let found = null
    for (let j = 0; j < A.rows; j++) {
      let x = A.index(j, i)
      if (x.isZero()) {
        continue
      } else if (x.equal(one)) {
        if (found) {
          found = zero
          break
        }
        found = A.index(j, A.cols - 1)
        continue
      } else {
        found = zero
        break
      }
    }
    if (!found) {
      found = zero
    }
    basis.push(found)
  }
  return basis
}

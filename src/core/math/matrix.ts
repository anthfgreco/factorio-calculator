import { type Rational, zero, one } from "./rational.js"

/** Mutable M×N matrix backed by a row-major Rational array. */
export class Matrix {
  public readonly mat: Rational[]

  constructor(
    public readonly rows: number,
    public readonly cols: number,
    mat?: Rational[],
  ) {
    this.mat = mat ?? Array.from({ length: rows * cols }, () => zero)
  }

  toString(): string {
    let widths = Array.from({ length: this.cols }, (_, col) => {
      let width = 0
      for (let row = 0; row < this.rows; row++) {
        width = Math.max(width, this.index(row, col).toDecimal(3).length)
      }
      return width
    })
    let lines: string[] = []
    for (let row = 0; row < this.rows; row++) {
      let line: string[] = []
      for (let col = 0; col < this.cols; col++) {
        line.push(this.index(row, col).toDecimal(3).padStart(widths[col]))
      }
      lines.push(line.join(" "))
    }
    return lines.join("\n")
  }

  copy(): Matrix {
    return new Matrix(this.rows, this.cols, this.mat.slice())
  }

  index(row: number, col: number): Rational {
    return this.mat[row * this.cols + col]
  }

  setIndex(row: number, col: number, value: Rational): void {
    this.mat[row * this.cols + col] = value
  }

  addIndex(row: number, col: number, value: Rational): void {
    this.setIndex(row, col, this.index(row, col).add(value))
  }

  /** Multiply every positive element in a column in place. */
  mulPosColumn(col: number, value: Rational): void {
    for (let row = 0; row < this.rows; row++) {
      let current = this.index(row, col)
      if (zero.less(current)) {
        this.setIndex(row, col, current.mul(value))
      }
    }
  }

  mulRow(row: number, value: Rational): void {
    for (let col = 0; col < this.cols; col++) {
      this.setIndex(row, col, this.index(row, col).mul(value))
    }
  }

  appendColumn(column: readonly Rational[]): Matrix {
    if (column.length !== this.rows) {
      throw new Error(`Expected ${this.rows} column values, received ${column.length}`)
    }
    let mat: Rational[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        mat.push(this.index(row, col))
      }
      mat.push(column[row])
    }
    return new Matrix(this.rows, this.cols + 1, mat)
  }

  appendColumns(count: number): Matrix {
    let mat: Rational[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        mat.push(this.index(row, col))
      }
      for (let col = 0; col < count; col++) {
        mat.push(zero)
      }
    }
    return new Matrix(this.rows, this.cols + count, mat)
  }

  setColumn(col: number, column: readonly Rational[]): void {
    if (column.length !== this.rows) {
      throw new Error(`Expected ${this.rows} column values, received ${column.length}`)
    }
    for (let row = 0; row < this.rows; row++) {
      this.setIndex(row, col, column[row])
    }
  }

  zeroColumn(col: number): void {
    for (let row = 0; row < this.rows; row++) {
      this.setIndex(row, col, zero)
    }
  }

  zeroRow(row: number): void {
    for (let col = 0; col < this.cols; col++) {
      this.setIndex(row, col, zero)
    }
  }

  swapRows(left: number, right: number): void {
    for (let col = 0; col < this.cols; col++) {
      let temp = this.index(left, col)
      this.setIndex(left, col, this.index(right, col))
      this.setIndex(right, col, temp)
    }
  }

  /** Reduce the matrix in place and return pivot column indexes. */
  rref(): number[] {
    let pivotRow = 0
    let pivotCol = 0
    let pivots: number[] = []
    while (pivotCol < this.cols && pivotRow < this.rows) {
      let pivotValue = zero
      let pivotOffset = 0
      for (; pivotOffset < this.rows - pivotRow; pivotOffset++) {
        pivotValue = this.index(pivotRow + pivotOffset, pivotCol)
        if (!pivotValue.isZero()) {
          break
        }
      }
      if (pivotOffset === this.rows - pivotRow) {
        pivotCol++
        continue
      }
      pivots.push(pivotCol)
      if (pivotOffset !== 0) {
        this.swapRows(pivotRow, pivotRow + pivotOffset)
      }
      for (let row = 0; row < this.rows; row++) {
        if (row === pivotRow) {
          continue
        }
        let value = this.index(row, pivotCol)
        if (value.isZero()) {
          continue
        }
        for (let col = 0; col < this.cols; col++) {
          let next = pivotValue.mul(this.index(row, col)).sub(value.mul(this.index(pivotRow, col)))
          this.setIndex(row, col, next)
        }
      }
      pivotRow++
    }
    for (let row = 0; row < pivots.length; row++) {
      let col = pivots[row]
      let pivotValue = this.index(row, col)
      this.setIndex(row, col, one)
      for (let nextCol = col + 1; nextCol < this.cols; nextCol++) {
        this.setIndex(row, nextCol, this.index(row, nextCol).div(pivotValue))
      }
    }
    return pivots
  }
}

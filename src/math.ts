// -----------------------------------------------------------------------------
// BigInteger adapter
// -----------------------------------------------------------------------------

export interface BigIntegerValue {
  abs(): BigIntegerValue
  divide(other: BigIntegerValue): BigIntegerValue
  divmod(other: BigIntegerValue): { quotient: BigIntegerValue; remainder: BigIntegerValue }
  equals(other: BigIntegerValue | number): boolean
  greater(other: BigIntegerValue): boolean
  isZero(): boolean
  lesser(other: BigIntegerValue): boolean
  minus(other: BigIntegerValue): BigIntegerValue
  plus(other: BigIntegerValue): BigIntegerValue
  subtract(other: BigIntegerValue): BigIntegerValue
  times(other: BigIntegerValue): BigIntegerValue
  pow(exponent: number): BigIntegerValue
  shiftLeft(bits: number): BigIntegerValue
  toJSNumber(): number
  toString(): string
}

interface BigIntegerFactory {
  (value: string | number | BigIntegerValue): BigIntegerValue
  readonly zero: BigIntegerValue
  readonly one: BigIntegerValue
  readonly minusOne: BigIntegerValue
  gcd(left: BigIntegerValue, right: BigIntegerValue): BigIntegerValue
}

/** Typed access to the vendored BigInteger browser global. */
export const integer = (globalThis as typeof globalThis & { bigInt: BigIntegerFactory }).bigInt

// -----------------------------------------------------------------------------
// Exact rational arithmetic
// -----------------------------------------------------------------------------

export class Rational {
  public readonly p: BigIntegerValue
  public readonly q: BigIntegerValue

  constructor(numerator: BigIntegerValue, denominator: BigIntegerValue) {
    let p = numerator
    let q = denominator
    if (q.lesser(integer.zero)) {
      p = integer.zero.minus(p)
      q = integer.zero.minus(q)
    }
    let gcd = integer.gcd(p.abs(), q)
    if (gcd.greater(integer.one)) {
      p = p.divide(gcd)
      q = q.divide(gcd)
    }
    this.p = p
    this.q = q
  }

  toFloat(): number {
    return this.p.toJSNumber() / this.q.toJSNumber()
  }

  toString(): string {
    return this.q.equals(integer.one) ? this.p.toString() : `${this.p}/${this.q}`
  }

  toDecimal(maxDigits = 3, roundingFactor: Rational | null = null): string {
    let digits = maxDigits ?? 3
    let rounding = roundingFactor ?? new Rational(integer(5), integer(10).pow(digits + 1))
    let sign = ""
    let value: Rational = this
    if (value.less(zero)) {
      sign = "-"
      value = zero.sub(value)
    }
    value = value.add(rounding)
    let divmod = value.p.divmod(value.q)
    let integerPart = divmod.quotient.toString()
    let decimalPart = ""
    let fraction = new Rational(divmod.remainder, value.q)
    let ten = new Rational(integer(10), integer.one)
    while (digits > 0 && !fraction.equal(rounding)) {
      fraction = fraction.mul(ten)
      rounding = rounding.mul(ten)
      divmod = fraction.p.divmod(fraction.q)
      decimalPart += divmod.quotient.toString()
      fraction = new Rational(divmod.remainder, fraction.q)
      digits--
    }
    if (fraction.equal(rounding)) {
      decimalPart = decimalPart.replace(/0+$/, "")
    }
    return decimalPart === "" ? sign + integerPart : `${sign}${integerPart}.${decimalPart}`
  }

  toUpDecimal(maxDigits = 3): string {
    let fraction = new Rational(integer.one, integer(10).pow(maxDigits))
    let { remainder } = this.divmod(fraction)
    let value = remainder.isZero() ? this : this.add(fraction)
    return value.toDecimal(maxDigits, zero)
  }

  toMixed(): string {
    let { quotient, remainder } = this.p.divmod(this.q)
    if (quotient.isZero() || remainder.isZero()) {
      return this.toString()
    }
    return `${quotient} + ${remainder}/${this.q}`
  }

  isZero(): boolean {
    return this.p.isZero()
  }

  isOne(): boolean {
    return this.p.equals(1) && this.q.equals(1)
  }

  isInteger(): boolean {
    return this.q.equals(integer.one)
  }

  ceil(): Rational {
    let { quotient, remainder } = this.p.divmod(this.q)
    let result = new Rational(quotient, integer.one)
    return remainder.isZero() ? result : result.add(one)
  }

  floor(): Rational {
    let { quotient, remainder } = this.p.divmod(this.q)
    let result = new Rational(quotient, integer.one)
    return result.less(zero) && !remainder.isZero() ? result.sub(one) : result
  }

  equal(other: Rational): boolean {
    return this.p.equals(other.p) && this.q.equals(other.q)
  }

  less(other: Rational): boolean {
    return this.p.times(other.q).lesser(this.q.times(other.p))
  }

  abs(): Rational {
    return this.less(zero) ? this.mul(minusOne) : this
  }

  add(other: Rational): Rational {
    return new Rational(this.p.times(other.q).plus(this.q.times(other.p)), this.q.times(other.q))
  }

  sub(other: Rational): Rational {
    if (other.isZero()) {
      return this
    }
    return new Rational(this.p.times(other.q).subtract(this.q.times(other.p)), this.q.times(other.q))
  }

  mul(other: Rational): Rational {
    if (this.isZero() || other.isZero()) {
      return zero
    }
    if (this.isOne()) {
      return other
    }
    if (other.isOne()) {
      return this
    }
    return new Rational(this.p.times(other.p), this.q.times(other.q))
  }

  div(other: Rational): Rational {
    return new Rational(this.p.times(other.q), this.q.times(other.p))
  }

  divmod(other: Rational): { quotient: Rational; remainder: Rational } {
    let quotient = this.div(other).floor()
    return { quotient, remainder: this.sub(other.mul(quotient)) }
  }

  reciprocate(): Rational {
    return new Rational(this.q, this.p)
  }

  pow(exponent: number): Rational {
    return new Rational(this.p.pow(exponent), this.q.pow(exponent))
  }

  static from_decimal(value: string): Rational {
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1 || decimalIndex === value.length - 1) {
      return new Rational(integer(value), integer.one)
    }
    let integerPart = new Rational(integer(value.slice(0, decimalIndex)), integer.one)
    let numerator = integer(value.slice(decimalIndex + 1))
    let denominator = integer(10).pow(value.length - decimalIndex - 1)
    return integerPart.add(new Rational(numerator, denominator))
  }

  static from_string(value: string): Rational {
    let slashIndex = value.indexOf("/")
    if (slashIndex === -1) {
      return Rational.from_decimal(value)
    }
    let plusIndex = value.indexOf("+")
    let denominator = integer(value.slice(slashIndex + 1))
    let numerator =
      plusIndex === -1
        ? integer(value.slice(0, slashIndex))
        : integer(value.slice(plusIndex + 1, slashIndex)).plus(integer(value.slice(0, plusIndex)).times(denominator))
    return new Rational(numerator, denominator)
  }

  static from_integer(value: number): Rational {
    return Rational.from_floats(value, 1)
  }

  static from_float(value: number): Rational {
    if (value === 0 || !Number.isFinite(value) || Number.isNaN(value)) {
      return zero
    }
    if (Number.isInteger(value)) {
      return Rational.from_integer(value)
    }
    let absolute = Math.abs(value)
    let exponent = Math.max(-1023, Math.floor(Math.log2(absolute)) + 1)
    let floatPart = absolute * 2 ** -exponent
    for (let i = 0; i < 300 && floatPart !== Math.floor(floatPart); i++) {
      floatPart *= 2
      exponent--
    }
    let numerator = integer(floatPart)
    let denominator = integer.one
    if (exponent > 0) {
      numerator = numerator.shiftLeft(exponent)
    } else {
      denominator = denominator.shiftLeft(-exponent)
    }
    if (value < 0) {
      numerator = integer.zero.minus(numerator)
    }
    return new Rational(numerator, denominator)
  }

  static from_float_approximate(value: number): Rational {
    if (Number.isInteger(value)) {
      return Rational.from_floats(value, 1)
    }
    let result = new Rational(integer(Math.round(value * 100000)), integer(100000))
    let { quotient, remainder } = result.divmod(one)
    if (remainder.equal(_oneThirdApproximation)) {
      return quotient.add(oneThird)
    }
    if (remainder.equal(_twoThirdsApproximation)) {
      return quotient.add(twoThirds)
    }
    return result
  }

  static from_floats(numerator: number, denominator: number): Rational {
    return new Rational(integer(numerator), integer(denominator))
  }
}

const _oneThirdApproximation = new Rational(integer(33333), integer(100000))
const _twoThirdsApproximation = new Rational(integer(33333), integer(50000))

export const minusOne = new Rational(integer.minusOne, integer.one)
export const zero = new Rational(integer.zero, integer.one)
export const one = new Rational(integer.one, integer.one)
export const half = new Rational(integer.one, integer(2))
export const oneThird = new Rational(integer.one, integer(3))
export const twoThirds = new Rational(integer(2), integer(3))

// -----------------------------------------------------------------------------
// Matrix arithmetic
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Simplex primitive
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Display formatting
// -----------------------------------------------------------------------------

export const DEFAULT_RATE = "m"
export const DEFAULT_RATE_PRECISION = 3
export const DEFAULT_COUNT_PRECISION = 1
export const DEFAULT_FORMAT = "decimal"

export type DisplayRate = "s" | "m" | "h"
export type DisplayFormat = "decimal" | "rational"

const displayRates = new Map<DisplayRate, Rational>([
  ["s", one],
  ["m", Rational.from_float(60)],
  ["h", Rational.from_float(3600)],
])

export const longRateNames = new Map<DisplayRate, string>([
  ["s", "second"],
  ["m", "minute"],
  ["h", "hour"],
])

export class Formatter {
  rateName: DisplayRate = DEFAULT_RATE
  longRate = longRateNames.get(DEFAULT_RATE)!
  rateFactor = displayRates.get(DEFAULT_RATE)!
  displayFormat: DisplayFormat = DEFAULT_FORMAT
  ratePrecision = DEFAULT_RATE_PRECISION
  countPrecision = DEFAULT_COUNT_PRECISION

  setDisplayRate(rate: DisplayRate): void {
    this.rateName = rate
    this.longRate = longRateNames.get(rate)!
    this.rateFactor = displayRates.get(rate)!
  }

  private align(value: string, precision: number): string {
    if (this.displayFormat === "rational") {
      return value
    }
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1) {
      decimalIndex = value.length
    }
    let padding = precision - value.length + decimalIndex + (precision > 0 ? 1 : 0)
    return value + "\u00A0".repeat(Math.max(0, padding))
  }

  rate(rate: Rational): string {
    let scaled = rate.mul(this.rateFactor)
    return this.displayFormat === "rational" ? scaled.toMixed() : scaled.toDecimal(this.ratePrecision)
  }

  alignRate(rate: Rational): string {
    return this.align(this.rate(rate), this.ratePrecision)
  }

  count(count: Rational): string {
    return this.displayFormat === "rational" ? count.toMixed() : count.toUpDecimal(this.countPrecision)
  }

  alignCount(count: Rational): string {
    return this.align(this.count(count), this.countPrecision)
  }
}

// -----------------------------------------------------------------------------
// Power formatting
// -----------------------------------------------------------------------------

const powerSuffixes = ["W", "kW", "MW", "GW", "TW", "PW"] as const

export function powerRepresentation(value: Rational): { power: Rational; suffix: string } {
  let thousand = Rational.from_float(1000)
  let power = value
  let suffixIndex = 0
  while (thousand.less(power) && suffixIndex < powerSuffixes.length - 1) {
    power = power.div(thousand)
    suffixIndex++
  }
  return { power, suffix: powerSuffixes[suffixIndex] }
}

// -----------------------------------------------------------------------------
// Exact integer helpers
// -----------------------------------------------------------------------------

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function removeCanadianGrouping(value: string): string {
  return value.replace(/,(?=\d{3}(?:,|\.\d|\/|\s|\+|$))/g, "")
}

export function formatCanadianNumber(value: string): string {
  return value.replace(
    /(^|[^\d.])(-?)(\d+)(?=\.|\/|\s|\+|$)/g,
    (_match, prefix: string, sign: string, digits: string) => {
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      return `${prefix}${sign}${grouped}`
    },
  )
}

// -----------------------------------------------------------------------------
// Exact rational arithmetic
// -----------------------------------------------------------------------------

export class Rational {
  public readonly p: bigint
  public readonly q: bigint

  constructor(numerator: bigint, denominator: bigint) {
    let p = numerator
    let q = denominator
    if (q < 0n) {
      p = -p
      q = -q
    }
    if (p === 0n && q !== 0n) {
      this.p = 0n
      this.q = 1n
      return
    }
    if (q === 1n) {
      this.p = p
      this.q = q
      return
    }
    const gcd = greatestCommonDivisor(p < 0n ? -p : p, q)
    if (gcd > 1n) {
      p /= gcd
      q /= gcd
    }
    this.p = p
    this.q = q
  }

  toFloat(): number {
    return Number(this.p) / Number(this.q)
  }

  toString(): string {
    return this.q === 1n ? this.p.toString() : `${this.p}/${this.q}`
  }

  toDecimal(maxDigits = 3, roundingFactor: Rational | null = null): string {
    let digits = maxDigits ?? 3
    const rounding = roundingFactor ?? new Rational(5n, 10n ** BigInt(digits + 1))
    let sign = ""
    let value: Rational = this
    if (value.less(zero)) {
      sign = "-"
      value = zero.sub(value)
    }
    value = value.add(rounding)

    let quotient = value.p / value.q
    let remainder = value.p % value.q
    const integerPart = quotient.toString()
    let decimalPart = ""
    let roundingNumerator = rounding.p
    const roundingDenominator = rounding.q
    const equalsRounding = () => remainder * roundingDenominator === roundingNumerator * value.q

    while (digits > 0 && !equalsRounding()) {
      const scaledRemainder = remainder * 10n
      decimalPart += (scaledRemainder / value.q).toString()
      remainder = scaledRemainder % value.q
      roundingNumerator *= 10n
      digits--
    }
    if (equalsRounding()) {
      decimalPart = decimalPart.replace(/0+$/, "")
    }
    return decimalPart === "" ? sign + integerPart : `${sign}${integerPart}.${decimalPart}`
  }

  toUpDecimal(maxDigits = 3): string {
    let fraction = new Rational(1n, 10n ** BigInt(maxDigits))
    let { remainder } = this.divmod(fraction)
    let value = remainder.isZero() ? this : this.add(fraction)
    return value.toDecimal(maxDigits, zero)
  }

  toMixed(): string {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    if (quotient === 0n || remainder === 0n) {
      return this.toString()
    }
    return `${quotient} + ${remainder}/${this.q}`
  }

  isZero(): boolean {
    return this.p === 0n
  }

  isOne(): boolean {
    return this.p === 1n && this.q === 1n
  }

  isInteger(): boolean {
    return this.q === 1n
  }

  ceil(): Rational {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    const result = new Rational(quotient, 1n)
    return remainder === 0n ? result : result.add(one)
  }

  floor(): Rational {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    const result = new Rational(quotient, 1n)
    return result.less(zero) && remainder !== 0n ? result.sub(one) : result
  }

  equal(other: Rational): boolean {
    return this.p === other.p && this.q === other.q
  }

  less(other: Rational): boolean {
    return this.p * other.q < this.q * other.p
  }

  abs(): Rational {
    return this.less(zero) ? this.mul(minusOne) : this
  }

  add(other: Rational): Rational {
    if (this.isZero()) return other
    if (other.isZero()) return this
    if (this.q === other.q) {
      return new Rational(this.p + other.p, this.q)
    }
    return new Rational(this.p * other.q + this.q * other.p, this.q * other.q)
  }

  sub(other: Rational): Rational {
    if (other.isZero()) return this
    if (this.q === other.q) {
      return new Rational(this.p - other.p, this.q)
    }
    return new Rational(this.p * other.q - this.q * other.p, this.q * other.q)
  }

  subProduct(left: Rational, right: Rational): Rational {
    if (left.isZero() || right.isZero()) return this
    const productNumerator = left.p * right.p
    const productDenominator = left.q * right.q
    return new Rational(this.p * productDenominator - this.q * productNumerator, this.q * productDenominator)
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
    return new Rational(this.p * other.p, this.q * other.q)
  }

  div(other: Rational): Rational {
    return new Rational(this.p * other.q, this.q * other.p)
  }

  divmod(other: Rational): { quotient: Rational; remainder: Rational } {
    let quotient = this.div(other).floor()
    return { quotient, remainder: this.sub(other.mul(quotient)) }
  }

  reciprocate(): Rational {
    return new Rational(this.q, this.p)
  }

  pow(exponent: number): Rational {
    return new Rational(this.p ** BigInt(exponent), this.q ** BigInt(exponent))
  }

  static max(a: Rational, b: Rational): Rational {
    return a.less(b) ? b : a
  }

  static min(a: Rational, b: Rational): Rational {
    return a.less(b) ? a : b
  }

  static from_decimal(value: string): Rational {
    value = removeCanadianGrouping(value)
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1 || decimalIndex === value.length - 1) {
      return new Rational(BigInt(value), 1n)
    }
    let integerPart = new Rational(BigInt(value.slice(0, decimalIndex)), 1n)
    let numerator = BigInt(value.slice(decimalIndex + 1))
    let denominator = 10n ** BigInt(value.length - decimalIndex - 1)
    return integerPart.add(new Rational(numerator, denominator))
  }

  static from_string(value: string): Rational {
    value = removeCanadianGrouping(value)
    let slashIndex = value.indexOf("/")
    if (slashIndex === -1) {
      return Rational.from_decimal(value)
    }
    let plusIndex = value.indexOf("+")
    let denominator = BigInt(value.slice(slashIndex + 1))
    let numerator =
      plusIndex === -1
        ? BigInt(value.slice(0, slashIndex))
        : BigInt(value.slice(plusIndex + 1, slashIndex)) + BigInt(value.slice(0, plusIndex)) * denominator
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
    let numerator = BigInt(floatPart)
    let denominator = 1n
    if (exponent > 0) {
      numerator <<= BigInt(exponent)
    } else {
      denominator <<= BigInt(-exponent)
    }
    if (value < 0) {
      numerator = -numerator
    }
    return new Rational(numerator, denominator)
  }

  static from_float_approximate(value: number): Rational {
    if (Number.isInteger(value)) {
      return Rational.from_floats(value, 1)
    }
    let result = new Rational(BigInt(Math.round(value * 100000)), 100000n)
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
    return new Rational(BigInt(numerator), BigInt(denominator))
  }
}

const _oneThirdApproximation = new Rational(33333n, 100000n)
const _twoThirdsApproximation = new Rational(33333n, 50000n)

export const minusOne = new Rational(-1n, 1n)
export const zero = new Rational(0n, 1n)
export const one = new Rational(1n, 1n)
export const half = new Rational(1n, 2n)
export const oneThird = new Rational(1n, 3n)
export const twoThirds = new Rational(2n, 3n)

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
        line.push(this.index(row, col).toDecimal(3).padStart(widths[col]!))
      }
      lines.push(line.join(" "))
    }
    return lines.join("\n")
  }

  copy(): Matrix {
    return new Matrix(this.rows, this.cols, this.mat.slice())
  }

  index(row: number, col: number): Rational {
    const value = this.mat[row * this.cols + col]
    if (value === undefined) {
      throw new RangeError(`Matrix index out of bounds: row ${row}, column ${col}`)
    }
    return value
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
      mat.push(column[row]!)
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
      this.setIndex(row, col, column[row]!)
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
      let col = pivots[row]!
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
  const pivotColumns: number[] = []
  for (let currentCol = 0; currentCol < tableau.cols; currentCol++) {
    if (currentCol === col) {
      tableau.setIndex(row, currentCol, one)
      continue
    }
    const value = tableau.index(row, currentCol)
    if (value.isZero()) continue
    tableau.setIndex(row, currentCol, value.div(pivotValue))
    pivotColumns.push(currentCol)
  }
  for (let otherRow = 0; otherRow < tableau.rows; otherRow++) {
    if (otherRow === row) {
      continue
    }
    let ratio = tableau.index(otherRow, col)
    if (ratio.isZero()) {
      continue
    }
    tableau.setIndex(otherRow, col, zero)
    for (const currentCol of pivotColumns) {
      let next = tableau.index(otherRow, currentCol).subProduct(tableau.index(row, currentCol), ratio)
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
    const value = this.displayFormat === "rational" ? scaled.toMixed() : scaled.toDecimal(this.ratePrecision)
    return formatCanadianNumber(value)
  }

  alignRate(rate: Rational): string {
    return this.align(this.rate(rate), this.ratePrecision)
  }

  count(count: Rational): string {
    const value = this.displayFormat === "rational" ? count.toMixed() : count.toUpDecimal(this.countPrecision)
    return formatCanadianNumber(value)
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
  return { power, suffix: powerSuffixes[suffixIndex]! }
}

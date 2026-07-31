import { Rational, one } from "../math/rational.js"

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

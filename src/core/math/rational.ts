import { integer, type BigIntegerValue } from "./big-integer.js"

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

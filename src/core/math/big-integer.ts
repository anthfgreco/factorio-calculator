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

import { Rational } from "../math/rational.js"

const powerSuffixes = ["\u00A0W", "kW", "MW", "GW", "TW", "PW"] as const

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

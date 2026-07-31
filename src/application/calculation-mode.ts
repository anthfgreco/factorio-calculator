let legacyCalculation = false

export function setLegacyCalculation(value: boolean) {
  legacyCalculation = value
}

export function usesLegacyCalculation() {
  return legacyCalculation
}

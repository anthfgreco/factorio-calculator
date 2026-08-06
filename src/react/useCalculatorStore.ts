import { useSyncExternalStore } from "react"

import { calculatorStore } from "../application/store.js"

export function useCalculatorStore() {
  return useSyncExternalStore(calculatorStore.subscribe, calculatorStore.getSnapshot, calculatorStore.getSnapshot)
}

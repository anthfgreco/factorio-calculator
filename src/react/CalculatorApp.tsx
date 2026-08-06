import { useLayoutEffect } from "react"

import { calculatorStore } from "../application/store.js"
import { dispose, init } from "../app.js"
import { CalculatorShell } from "./CalculatorShell.js"
import { useCalculatorStore } from "./useCalculatorStore.js"

export function CalculatorApp() {
  const snapshot = useCalculatorStore()

  useLayoutEffect(() => {
    calculatorStore.start()
    init()
    return () => {
      dispose()
      calculatorStore.dispose()
    }
  }, [])

  return <CalculatorShell commands={calculatorStore.commands} snapshot={snapshot} />
}

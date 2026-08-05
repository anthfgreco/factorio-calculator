import type { SyntheticEvent } from "react"

export type CalculatorTab = "totals" | "graph" | "resources" | "settings" | "help" | "debug"

export interface CalculatorActions {
  addTarget: () => void
  openTab: (tab: CalculatorTab) => void
  openVisualization: () => void
  copyShareLink: () => void
  applyProgressionPreset: (event: Event) => void
  changeFactoryDensity: (event: Event) => void
  changeTitle: (event: Event) => void
  changeRatePrecision: (event: Event) => void
  changeCountPrecision: (event: Event) => void
  changeFormat: (event: Event) => void
  changeMiningProductivity: (event: Event) => void
  changePlanningSetting: (event: Event) => void
  changeVisualizationType: (event: Event) => void
  changeVisualizationRender: (event: Event) => void
  changeVisualizationDirection: (event: Event) => void
  toggleDebug: (event: Event) => void
}

export function forwardNativeEvent<T extends Element>(handler: (event: Event) => void) {
  return (event: SyntheticEvent<T>) => handler(event.nativeEvent)
}

import { useLayoutEffect } from "react"

import { init } from "../app.js"
import {
  applyProgressionPreset,
  changeCountPrecision,
  changeFactoryDensity,
  changeFormat,
  changeMprod,
  changePlanningSetting,
  changeRatePrecision,
  changeTitle,
  changeVisDir,
  changeVisRender,
  changeVisType,
  clickTab,
  clickVisualize,
  copyShareLink,
  plusHandler,
  toggleDebug,
} from "../state.js"
import { CalculatorShell } from "./CalculatorShell.js"
import type { CalculatorActions } from "./types.js"

const actions: CalculatorActions = {
  addTarget: plusHandler,
  openTab: clickTab,
  openVisualization: clickVisualize,
  copyShareLink: () => void copyShareLink(),
  applyProgressionPreset,
  changeFactoryDensity,
  changeTitle,
  changeRatePrecision,
  changeCountPrecision,
  changeFormat,
  changeMiningProductivity: changeMprod,
  changePlanningSetting,
  changeVisualizationType: changeVisType,
  changeVisualizationRender: changeVisRender,
  changeVisualizationDirection: changeVisDir,
  toggleDebug,
}

export function CalculatorApp() {
  useLayoutEffect(() => {
    init()
  }, [])

  return <CalculatorShell actions={actions} />
}

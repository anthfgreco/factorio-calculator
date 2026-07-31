import "./styles/calc.css"
import "./styles/dropdown.css"
import { init } from "./app.js"
import {
  changeCountPrecision,
  applyProgressionPreset,
  changeFactoryDensity,
  changeFormat,
  changeMprod,
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
} from "./state.js"

// -----------------------------------------------------------------------------
// Browser entry point
// -----------------------------------------------------------------------------

window.handlers = {
  plusHandler,
  clickTab,
  clickVisualize,
  copyShareLink,
  applyProgressionPreset,
  changeFactoryDensity,
  changeTitle,
  changeRatePrecision,
  changeCountPrecision,
  changeFormat,
  changeMprod,
  changeVisType,
  changeVisRender,
  changeVisDir,
  toggleDebug,
  init,
}

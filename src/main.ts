import "tippy.js/dist/tippy.css"
import { init } from "./app.js"
import {
  changeCountPrecision,
  applyProgressionPreset,
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
  changePlanningSetting,
  changeVisType,
  changeVisRender,
  changeVisDir,
  toggleDebug,
  init,
}

init()

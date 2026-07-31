import "./styles/calc.css"
import "./styles/dropdown.css"
import { init } from "./app.js"
import { changeCountPrecision, changeFormat, changeMprod, changeRatePrecision, changeTitle, changeVisDir, changeVisRender, changeVisType, clickTab, clickVisualize, plusHandler, toggleDebug } from "./state.js"

// -----------------------------------------------------------------------------
// Browser entry point
// -----------------------------------------------------------------------------

window.handlers = {
  plusHandler,
  clickTab,
  clickVisualize,
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

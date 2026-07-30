import "./styles/calc.css"
import "./styles/dropdown.css"

import {
  changeCountPrecision,
  changeFormat,
  changeMprod,
  changeRatePrecision,
  changeTitle,
  changeVisDir,
  changeVisRender,
  changeVisType,
  clickTab,
  clickVisualize,
  plusHandler,
  toggleDebug,
} from "./events.js"
import { init } from "./init.js"

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

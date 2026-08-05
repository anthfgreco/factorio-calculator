import "tippy.js/dist/tippy.css"
import { createRoot } from "react-dom/client"

import { CalculatorApp } from "./react/CalculatorApp.js"

const rootElement = document.getElementById("root")
if (rootElement === null) {
  throw new Error('Calculator root element "#root" was not found.')
}

createRoot(rootElement).render(<CalculatorApp />)

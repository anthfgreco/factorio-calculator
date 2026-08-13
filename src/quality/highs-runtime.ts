import highsRuntimeUrl from "highs/runtime?url"
import { loadHighsQualityOptimizer, type HighsQualityOptimizer } from "./highs-solver.js"

/** Load the optional quality LP engine without adding it to the normal-plan entry chunk. */
export function loadBrowserHighsQualityOptimizer(): Promise<HighsQualityOptimizer> {
  return loadHighsQualityOptimizer({ locateFile: () => highsRuntimeUrl })
}

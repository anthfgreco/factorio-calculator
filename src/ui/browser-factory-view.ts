import { renderDebug } from "./debug.js"
import { displayItems } from "./results/display.js"
import { currentTab } from "./events.js"
import { formatSettings } from "../ui/persistence/fragment.js"
import { syncUrlHash } from "../infrastructure/url/url-state.js"
import { BuildTarget } from "./targets/build-target.js"
import { reapTooltips } from "../presentation/tooltip.js"
import { renderTotals } from "../visualization/visualize.js"
import type { FactoryViewPort } from "../application/calculator/factory-view.js"

export const browserFactoryView: FactoryViewPort = {
  createBuildTarget(index, itemKey, item, itemGroups) {
    return new BuildTarget(index, itemKey, item, itemGroups)
  },

  mountBuildTarget(target) {
    d3.select("#targets").insert(() => target.element, "#plusButton")
  },

  removeBuildTarget(target) {
    d3.select(target.element).remove()
  },

  renderSolution(specification: any, totals) {
    displayItems(specification, totals)
    if (currentTab === "graph") {
      renderTotals(totals, specification.ignore)
    }
    reapTooltips()
  },

  persistUrlState() {
    syncUrlHash(formatSettings())
  },

  renderDebug() {
    renderDebug()
  },
}

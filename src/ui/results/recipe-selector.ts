import { spec } from "../../application/calculator/index.js"
import { getItemProductionRecipes, setRecipeEnabled } from "../../application/recipes/recipe-selection.js"
import { getRecipeSelectorGroups } from "../../application/recipes/recipe-settings.js"
import { refreshRecipeSettings } from "../settings/recipe-settings-browser.js"

let openItemKey: string | null = null
let dismissHandlerInstalled = false

function closeAll(): void {
  openItemKey = null
  document.querySelectorAll<HTMLDetailsElement>("details.recipe-selector[open]").forEach((details) => {
    details.open = false
  })
}

function installDismissHandler(): void {
  if (dismissHandlerInstalled) {
    return
  }
  dismissHandlerInstalled = true
  document.addEventListener("click", (event) => {
    let target = event.target
    if (!(target instanceof Element) || !target.closest("details.recipe-selector")) {
      closeAll()
    }
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll()
    }
  })
}

export function makeRecipeSelector(row) {
  let recipes = getItemProductionRecipes(row.item)
  if (recipes.length === 0 || row.recipe === null) {
    return null
  }

  installDismissHandler()
  let details = d3
    .create("details")
    .classed("recipe-selector", true)
    .property("open", openItemKey === row.item.key)
  details
    .append("summary")
    .attr("title", `Enable or disable recipes for ${row.item.name}.`)
    .attr("aria-label", `Enable or disable recipes for ${row.item.name}.`)
    .on("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      let shouldOpen = !details.property("open")
      closeAll()
      if (shouldOpen) {
        openItemKey = row.item.key
        details.property("open", true)
      }
    })
    .append(() => row.item.icon.make(32))

  let menu = details.append("div").classed("recipe-selector-menu", true)
  menu.append("div").classed("recipe-selector-title", true).text(`Recipes for ${row.item.name}`)
  let groups = menu
    .selectAll("section.recipe-selector-group")
    .data(getRecipeSelectorGroups(recipes, row.recipe), (entry) => entry.key)
    .join("section")
    .classed("recipe-selector-group", true)
  groups.append("div").classed("recipe-selector-group-title", true).text((entry) => entry.name)
  let options = groups
    .selectAll("label")
    .data((entry) => entry.recipes)
    .join("label")
    .classed("recipe-selector-option", true)
    .classed("active", (recipe) => recipe === row.recipe)
  options
    .append("input")
    .attr("type", "checkbox")
    .property("checked", (recipe) => !spec.disable.has(recipe))
    .on("change", (event, recipe) => {
      event.stopPropagation()
      openItemKey = row.item.key
      setRecipeEnabled(spec, recipe, event.target.checked)
      refreshRecipeSettings(spec)
      spec.updateSolution()
    })
  options.append((recipe) => recipe.icon.make(32))
  options.append("span").text((recipe) => recipe.name)
  return details.node()
}

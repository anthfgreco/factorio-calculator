import { spec } from "./factory.js"
import { one, Rational, zero } from "./math.js"
import { addInputs, makeDropdown } from "./presentation.js"
import { formatLocationList, getUnavailableLocationInfo, itemMatchesSearch } from "./data.js"
import { refreshRecipeSettings } from "./settings.js"

// -----------------------------------------------------------------------------
// Build targets
// -----------------------------------------------------------------------------

function hasRecipeCategories(recipe) {
  if (recipe === null || recipe === undefined) {
    return false
  }
  let categories = recipe.categories
  if (categories !== undefined && categories !== null) {
    if (typeof categories.size === "number") {
      return categories.size > 0
    }
    return categories.length > 0
  }
  return recipe.category !== undefined && recipe.category !== null
}

const SELECTED_INPUT = "selected"

// events

function itemHandler(target) {
  return function (item) {
    target.itemKey = item.key
    target.item = item
    target.displayRecipes()
    spec.updateSolution()
  }
}

function removeHandler(target) {
  return function () {
    spec.removeTarget(target)
    spec.updateSolution()
  }
}

function changeBuildingCountHandler(target) {
  return function () {
    target.buildingsChanged()
    spec.updateSolution()
  }
}

function changeRateHandler(target) {
  return function () {
    target.rateChanged()
    spec.updateSolution()
  }
}

function resetSearch(dropdown) {
  dropdown.getElementsByClassName("search")[0].value = ""

  // unhide all child nodes
  let elems = dropdown.querySelectorAll("label, hr")
  for (let elem of elems) {
    elem.style.display = ""
  }
}

function searchTargets(this: HTMLInputElement, event) {
  let search = this
  let searchText = search.value
  let dropdown = d3.select(search.parentNode)

  if (!searchText.trim()) {
    resetSearch(search.parentNode)
    return
  }

  // handle enter key press (select target if only one is visible)
  if (event.keyCode === 13) {
    let labels = dropdown.selectAll("label").filter(function (this: HTMLElement) {
      return this.style.display !== "none"
    })
    // don't do anything if more than one icon is visible
    if (labels.size() === 1) {
      let input = document.getElementById(labels.attr("for")) as HTMLInputElement
      input.checked = true
      input.dispatchEvent(new Event("change"))
    }
    return
  }

  // hide non-matching labels & icons
  let currentHrHasContent = false
  let lastHrWithContent = null
  dropdown.selectAll("hr, label").each(function (this: HTMLElement, item) {
    if (this.tagName === "HR") {
      if (currentHrHasContent) {
        this.style.display = ""
        lastHrWithContent = this
      } else {
        this.style.display = "none"
      }
      currentHrHasContent = false
    } else {
      if (!itemMatchesSearch(item, searchText)) {
        this.style.display = "none"
      } else {
        this.style.display = ""
        currentHrHasContent = true
      }
    }
  })
  if (!currentHrHasContent && lastHrWithContent !== null) {
    lastHrWithContent.style.display = "none"
  }
}

let targetCount = 0
let recipeSelectorCount = 0

export class BuildTarget {
  [key: string]: any
  constructor(index, itemKey, item, itemGroups) {
    this.index = index
    this.itemKey = itemKey
    this.item = item
    // When item has multiple recipes.
    this.recipe = null
    this.defaultRecipe = null
    this.changedBuilding = true
    this.buildings = one
    this.rate = zero

    let element = d3.create("li").classed("target", true)
    element
      .append("button")
      .classed("targetButton ui", true)
      .text("×")
      .attr("data-tooltip", "Remove this production target.")
      .on("click", removeHandler(this))
    this.element = element.node()

    let dropdown = makeDropdown(
      element,
      (d) => d.select(".search").node().focus(),
      (d) => resetSearch(d.node()),
    )
    dropdown.classed("itemDropdown", true)
    dropdown.append("input").classed("search", true).attr("placeholder", "Search").on("keyup", searchTargets)
    let group = dropdown.selectAll("div").data(itemGroups).join("div")
    group.filter((d, i) => i > 0).append("hr")
    let items = group
      .selectAll("div")
      .data((d) => d)
      .join("div")
      .selectAll("span")
      .data((d) => d)
      .join("span")
    let itemLabel = addInputs(items, `target-${targetCount}`, (d) => d === item, itemHandler(this))

    itemLabel.append((d) => d.icon.make(32, false, dropdown.node()))
    itemLabel
      .append("span")
      .classed("target-item-name", true)
      .text((d) => d.name)

    targetCount++

    this.buildingLabel = element.append("label").classed(SELECTED_INPUT, true).text(" Machines ").node()

    this.recipeSelector = element.append("span")

    this.buildingInput = element
      .append("input")
      .on("change", changeBuildingCountHandler(this))
      .attr("type", "text")
      .attr("value", 1)
      .attr("size", 3)
      .attr(
        "title",
        "Enter a value to specify the number of buildings. The rate will be determined based on the number of items a single building can make.",
      )
      .node()

    this.rateLabel = element.append("label").node()
    this.setRateLabel()

    this.rateInput = element
      .append("input")
      .on("change", changeRateHandler(this))
      .attr("type", "text")
      .attr("value", "")
      .attr("size", 5)
      .attr(
        "data-tooltip",
        "Enter a value to specify the rate. The number of buildings will be determined based on the rate.",
      )
      .node()

    this.locationWarning = element
      .append("div")
      .classed("location-warning", true)
      .attr("aria-live", "polite")
      .style("display", "none")
    this.locationWarning.append("div").classed("location-warning-title", true)
    this.locationWarning.append("div").classed("location-warning-message", true)
    this.locationWarning
      .append("button")
      .classed("ui", true)
      .attr("type", "button")
      .text("Enable compatible locations")
      .on("click", () => this.enableCompatibleLocations())

    this.compatibleLocations = []
    this.displayRecipes()
  }
  setRateLabel() {
    this.rateLabel.textContent = " Rate/" + spec.format.longRate + " "
  }
  displayLocationWarning() {
    let info = getUnavailableLocationInfo(spec, this.item)
    if (info === null) {
      this.compatibleLocations = []
      this.locationWarning.style("display", "none")
      return
    }

    this.compatibleLocations = info.compatibleLocations
    let selectedLabel = info.selectedLocations.length === 1 ? "location" : "locations"
    this.locationWarning
      .select(".location-warning-title")
      .text(`Unavailable on selected ${selectedLabel}: ${formatLocationList(info.selectedLocations, "and")}`)
    this.locationWarning.select(".location-warning-message").text("Choose a compatible production location above.")
    this.locationWarning.style("display", null)
  }
  enableCompatibleLocations() {
    let locations = [...this.compatibleLocations]
    for (let location of locations) {
      if (!spec.selectedPlanets.has(location)) {
        spec.selectPlanet(location)
      }
    }
    d3.selectAll("#planet_selector .toggle")
      .classed("selected", (location) => spec.selectedPlanets.has(location))
      .attr("aria-pressed", (location) => String(spec.selectedPlanets.has(location)))
    refreshRecipeSettings(spec)
    spec.updateSolution()
  }
  displayRecipes() {
    this.recipeSelector.selectAll("*").remove()
    let recipes = []
    let found = false
    if (!spec.ignore.has(this.item)) {
      for (let recipe of this.item.recipes) {
        if (spec.disable.has(recipe) || !recipe.isNetProducer(this.item)) {
          continue
        }
        if (recipe === this.recipe) {
          found = true
        }
        recipes.push(recipe)
      }
    }
    if (!found) {
      this.recipe = null
    }
    this.displayLocationWarning()
    if (recipes.length > 0) {
      this.defaultRecipe = recipes[0]
    }
    if (recipes.length === 0) {
      this.defaultRecipe = null
      return
    } else if (recipes.length === 1) {
      this.recipe = recipes[0]
      return
    }
    // If there are multiple valid recipes, render the recipe dropdown.
    if (this.recipe === null) {
      this.recipe = recipes[0]
    }
    let self = this
    let dropdown = makeDropdown(this.recipeSelector)
    let inputs = dropdown.selectAll("div").data(recipes).join("div")
    let labels = addInputs(
      inputs,
      "target-recipe-" + recipeSelectorCount,
      (d) => self.recipe === d,
      (d) => {
        self.recipe = d
        spec.updateSolution()
      },
    )
    labels.append((d) => d.icon.make(32, false, dropdown.node()))
    recipeSelectorCount++
    this.recipeSelector.append("span").text(" \u00d7 ")
  }
  getRate() {
    this.setRateLabel()
    let rate = zero
    let recipe = this.recipe
    if (!hasRecipeCategories(recipe) && this.changedBuilding) {
      this.rateChanged()
    }
    let baseRate = null
    if (recipe !== null) {
      baseRate = spec.getRecipeRate(recipe)
      if (baseRate !== null) {
        baseRate = baseRate.mul(recipe.gives(this.item))
      }
    }
    if (this.changedBuilding) {
      rate = baseRate.mul(this.buildings)
      this.rateInput.value = spec.format.rate(rate)
    } else {
      rate = this.rate
      if (baseRate !== null) {
        let count = rate.div(baseRate)
        this.buildingInput.value = spec.format.count(count)
      } else {
        this.buildingInput.value = "N/A"
      }
      this.rateInput.value = spec.format.rate(rate)
    }
    return rate
  }
  buildingsChanged() {
    this.changedBuilding = true
    this.buildingLabel.classList.add(SELECTED_INPUT)
    this.rateLabel.classList.remove(SELECTED_INPUT)
    this.buildings = Rational.from_string(this.buildingInput.value)
    this.rate = zero
    this.rateInput.value = ""
  }
  setBuildings(count, recipe) {
    this.buildingInput.value = count
    this.recipe = recipe
    this.buildingsChanged()
  }
  rateChanged() {
    this.changedBuilding = false
    this.buildingLabel.classList.remove(SELECTED_INPUT)
    this.rateLabel.classList.add(SELECTED_INPUT)
    this.buildings = zero
    this.rate = Rational.from_string(this.rateInput.value).div(spec.format.rateFactor)
    this.buildingInput.value = ""
  }
  setRate(rate) {
    this.rateInput.value = rate
    this.rateChanged()
  }
}

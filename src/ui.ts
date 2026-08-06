import { create, select, selectAll } from "d3"
const d3: any = { create, select, selectAll }
import { spec } from "./factory.js"
import { one, Rational, zero } from "./math.js"
import { addInputs, makeDropdown, reapTooltips } from "./presentation.js"
import { formatLocationList, getUnavailableLocationInfo, itemMatchesSearch } from "./data.js"
import { refreshRecipeSettings } from "./settings.js"
import { getQualityTargetFeasibility, getRecipeQualityChance, qualityProbability, QUALITY_TIERS } from "./planning.js"

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

function getTargetQualityRecipe(target) {
  return target.recipe ?? spec.getRecipes(target.item)[0] ?? null
}

function applyAutomaticQualityConfiguration(target, recipe, qualityLevel, previousQuality, recommendation) {
  if (!spec.applyQualityTargetConfiguration(recipe, recommendation)) {
    target.setQuality(previousQuality)
    target.showQualityUnavailable(qualityLevel)
    return false
  }

  target.clearQualityWarning()
  spec.updateSolution()
  return true
}

export function handleTargetQualityChange(target, requestedQuality) {
  const previousQuality = target.qualityLevel
  target.setQuality(requestedQuality)
  const qualityLevel = target.qualityLevel

  if (qualityLevel <= 0) {
    target.clearQualityWarning()
    spec.updateSolution()
    return
  }

  const recipe = getTargetQualityRecipe(target)
  if (recipe === null) {
    target.setQuality(previousQuality)
    target.showQualityUnavailable(qualityLevel)
    return
  }

  const feasibility = getQualityTargetFeasibility(spec, recipe, qualityLevel)
  if (feasibility.status === "feasible") {
    target.clearQualityWarning()
    spec.updateSolution()
    return
  }

  if (feasibility.status === "auto-configurable") {
    applyAutomaticQualityConfiguration(target, recipe, qualityLevel, previousQuality, feasibility)
    return
  }

  if (feasibility.status === "conflict") {
    target.qualityConflictPreviousQuality = previousQuality
    target.showQualityConflict(qualityLevel)
    return
  }

  target.setQuality(previousQuality)
  target.showQualityUnavailable(qualityLevel)
}

function configureQualityFromNotice(target) {
  const recipe = getTargetQualityRecipe(target)
  if (recipe === null || target.qualityLevel <= 0) return

  const recommendation = getQualityTargetFeasibility(spec, recipe, target.qualityLevel, { ignoreExplicit: true })
  if (recommendation.status === "auto-configurable") {
    const previousQuality = target.qualityConflictPreviousQuality ?? target.qualityLevel
    applyAutomaticQualityConfiguration(target, recipe, target.qualityLevel, previousQuality, recommendation)
  } else if (recommendation.status === "unavailable") {
    target.setQuality(target.qualityLevel)
    target.showQualityUnavailable(target.qualityLevel)
  }
}

function resetSearch(dropdown) {
  let search = dropdown.getElementsByClassName("search")[0] as HTMLInputElement | undefined
  if (search !== undefined) {
    search.value = ""
  }

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
    this.qualityLevel = 0
    this.qualityNoticeKind = null
    this.qualityConflictPreviousQuality = null

    let element = d3.create("li").classed("target production-target-row", true)
    element
      .append("button")
      .classed("targetButton ui", true)
      .text("×")
      .attr("data-tooltip", "Remove this production target.")
      .on("click", removeHandler(this))
    this.element = element.node()

    const targetInputName = `target-${targetCount}`
    let itemOptionsRendered = false
    let dropdown: any
    const itemColumn = element.append("span").classed("production-target-item", true)

    const renderItemOptions = (selection: any) => {
      if (itemOptionsRendered) {
        return
      }
      itemOptionsRendered = true
      selection.selectAll("*").remove()
      selection.append("input").classed("search", true).attr("placeholder", "Search").on("keyup", searchTargets)
      let group = selection.selectAll("div").data(itemGroups).join("div")
      group.filter((d, i) => i > 0).append("hr")
      let items = group
        .selectAll("div")
        .data((d) => d)
        .join("div")
        .selectAll("span")
        .data((d) => d)
        .join("span")
      let itemLabel = addInputs(items, targetInputName, (d) => d === this.item, itemHandler(this))
      itemLabel.append((d) => d.icon.make(32, false, selection.node()))
      itemLabel
        .append("span")
        .classed("target-item-name", true)
        .text((d) => d.name)
      reapTooltips()
    }

    dropdown = makeDropdown(
      itemColumn,
      (selection) => {
        renderItemOptions(selection)
        const search = selection.select(".search").node() as HTMLInputElement | null
        search?.focus()
      },
      (selection) => resetSearch(selection.node()),
    )
    dropdown.classed("itemDropdown", true)

    const selectedItem = dropdown.append("span").datum(item)
    const selectedItemLabel = addInputs(selectedItem, targetInputName, () => true, itemHandler(this))
    selectedItemLabel.append(() => item.icon.make(32, false, dropdown.node()))
    selectedItemLabel.append("span").classed("target-item-name", true).text(item.name)

    targetCount++

    this.recipeSelector = itemColumn.append("span").classed("production-target-recipe", true)
    const settings = element.append("span").classed("production-target-settings", true)

    const qualityInputId = `target-quality-${targetCount}`
    this.qualitySelector = settings
      .append("select")
      .classed("target-quality", true)
      .attr("id", qualityInputId)
      .attr("aria-label", `Quality for ${item.name}`)
      .attr(
        "data-tooltip",
        "Choose the output quality tier. The calculator uses the chance from the selected quality modules.",
      )
      .on("change", (event) => {
        handleTargetQualityChange(this, Number(event.target.value))
      })
      .node()
    d3.select(this.qualitySelector)
      .selectAll("option")
      .data(QUALITY_TIERS.map((name, level) => ({ name, level })))
      .join("option")
      .attr("value", (d) => d.level)
      .text((d) => d.name)
    this.setQuality(0)

    this.buildingInput = settings
      .append("input")
      .classed("target-machine-count", true)
      .classed(SELECTED_INPUT, true)
      .on("change", changeBuildingCountHandler(this))
      .attr("type", "text")
      .attr("value", 1)
      .attr("size", 3)
      .attr("aria-label", "Machines")
      .attr(
        "title",
        "Enter a value to specify the number of buildings. The rate will be determined based on the number of items a single building can make.",
      )
      .node()

    this.rateInput = settings
      .append("input")
      .classed("target-rate", true)
      .on("change", changeRateHandler(this))
      .attr("type", "text")
      .attr("value", "")
      .attr("size", 5)
      .attr(
        "data-tooltip",
        "Enter a value to specify the rate. The number of buildings will be determined based on the rate.",
      )
      .node()
    this.setRateLabel()

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

    this.qualityNotice = element
      .append("div")
      .classed("quality-notice", true)
      .attr("aria-live", "polite")
      .style("display", "none")
    this.qualityNoticeMessage = this.qualityNotice.append("span").classed("quality-notice-message", true)
    this.qualityNoticeAction = this.qualityNotice
      .append("button")
      .classed("ui", true)
      .attr("type", "button")
      .style("display", "none")

    this.compatibleLocations = []
    this.displayRecipes()
  }
  setRateLabel() {
    this.rateInput?.setAttribute("aria-label", "Rate per " + spec.format.longRate)
  }
  hideQualityNotice() {
    this.qualityNoticeKind = null
    this.qualityNoticeMessage.text("")
    this.qualityNoticeAction.text("").style("display", "none").on("click", null)
    this.qualityNotice.style("display", "none")
  }
  clearQualityNotice() {
    this.qualityConflictPreviousQuality = null
    this.hideQualityNotice()
  }
  clearQualityWarning() {
    this.qualityConflictPreviousQuality = null
    if (this.qualityNoticeKind === "warning") {
      this.hideQualityNotice()
    }
  }
  showQualityNotice(kind, message, actionText = null, action = null) {
    this.qualityNoticeKind = kind
    this.qualityNoticeMessage.text(message)
    if (actionText === null || action === null) {
      this.qualityNoticeAction.text("").style("display", "none").on("click", null)
    } else {
      this.qualityNoticeAction.text(actionText).style("display", null).on("click", action)
    }
    this.qualityNotice.style("display", null)
  }
  showQualityConflict(qualityLevel) {
    const tier = QUALITY_TIERS[qualityLevel] ?? `quality ${qualityLevel}`
    this.showQualityNotice(
      "warning",
      `${tier} output requires a machine with module slots and at least one quality module.`,
      "Configure automatically",
      () => configureQualityFromNotice(this),
    )
  }
  showQualityUnavailable(qualityLevel) {
    const tier = QUALITY_TIERS[qualityLevel] ?? `quality ${qualityLevel}`
    this.showQualityNotice(
      "warning",
      `${tier} ${this.item.name} is unavailable with the currently enabled machines and modules.`,
    )
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
    const previousRecipe = this.recipe
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
      if (previousRecipe !== this.recipe) this.clearQualityNotice()
      return
    } else if (recipes.length === 1) {
      this.recipe = recipes[0]
      if (previousRecipe !== this.recipe) this.clearQualityNotice()
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
        self.clearQualityNotice()
        spec.updateSolution()
      },
    )
    labels.append((d) => d.icon.make(32, false, dropdown.node()))
    recipeSelectorCount++
    if (previousRecipe !== this.recipe) this.clearQualityNotice()
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
    let qualityRate = baseRate
    if (baseRate !== null && recipe !== null && this.qualityLevel > 0) {
      let probability = qualityProbability(
        getRecipeQualityChance(spec, recipe),
        this.qualityLevel,
        spec.maxQualityLevel,
      )
      qualityRate = baseRate.mul(probability)
    }
    if (this.changedBuilding) {
      rate = qualityRate.mul(this.buildings)
      this.rateInput.value = spec.format.rate(rate)
    } else {
      rate = this.rate
      if (qualityRate !== null && !qualityRate.isZero()) {
        let count = rate.div(qualityRate)
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
    this.buildingInput.classList.add(SELECTED_INPUT)
    this.rateInput.classList.remove(SELECTED_INPUT)
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
    this.buildingInput.classList.remove(SELECTED_INPUT)
    this.rateInput.classList.add(SELECTED_INPUT)
    this.buildings = zero
    this.rate = Rational.from_string(this.rateInput.value).div(spec.format.rateFactor)
    this.buildingInput.value = ""
  }
  setRate(rate) {
    this.rateInput.value = rate
    this.rateChanged()
  }
  setQuality(level) {
    let maxLevel = Math.max(0, Math.min(QUALITY_TIERS.length - 1, spec.maxQualityLevel))
    d3.select(this.qualitySelector)
      .selectAll("option")
      .property("disabled", (option: any) => option.level > maxLevel)
    this.qualityLevel = Math.max(0, Math.min(maxLevel, Number(level) || 0))
    this.qualitySelector.value = String(this.qualityLevel)
  }
}

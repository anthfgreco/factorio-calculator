import { create, select, selectAll, type BaseType, type Selection } from "d3"
import { spec, type FactoryBuildTarget } from "./factory.js"
import { one, Rational, zero } from "./math.js"
import type { ItemGroups, Planet } from "./models.js"
import { Item, Recipe } from "./recipes.js"
import { addInputs, makeDropdown, reapTooltips } from "./presentation.js"
import { formatLocationList, getUnavailableLocationInfo, itemMatchesSearch } from "./data.js"
import { refreshRecipeSettings } from "./settings.js"
import {
  getQualityTargetFeasibility,
  getRecipeQualityChance,
  qualityProbability,
  QUALITY_TIERS,
  type QualityTargetFeasibility,
} from "./planning.js"

// -----------------------------------------------------------------------------
// Build targets
// -----------------------------------------------------------------------------

function hasRecipeCategories(recipe: Recipe | null | undefined): boolean {
  return recipe !== null && recipe !== undefined && (recipe.categories.size > 0 || recipe.category !== null)
}

const SELECTED_INPUT = "selected"

// events

function itemHandler(target: BuildTarget): (item: Item) => void {
  return function (item: Item) {
    target.itemKey = item.key
    target.item = item
    target.displayRecipes()
    spec.updateSolution()
  }
}

function removeHandler(target: BuildTarget): () => void {
  return function () {
    spec.removeTarget(target)
    spec.updateSolution()
  }
}

function changeBuildingCountHandler(target: BuildTarget): () => void {
  return function () {
    target.buildingsChanged()
    spec.updateSolution()
  }
}

function changeRateHandler(target: BuildTarget): () => void {
  return function () {
    target.rateChanged()
    spec.updateSolution()
  }
}

function getTargetQualityRecipe(target: BuildTarget): Recipe | null {
  return target.recipe ?? spec.getRecipes(target.item).find((candidate) => candidate instanceof Recipe) ?? null
}

function applyAutomaticQualityConfiguration(
  target: BuildTarget,
  recipe: Recipe,
  qualityLevel: number,
  previousQuality: number,
  recommendation: Extract<QualityTargetFeasibility, { status: "auto-configurable" }>,
): boolean {
  if (!spec.applyQualityTargetConfiguration(recipe, recommendation)) {
    target.setQuality(previousQuality)
    target.showQualityUnavailable(qualityLevel)
    return false
  }

  target.clearQualityWarning()
  spec.updateSolution()
  return true
}

export function handleTargetQualityChange(target: BuildTarget, requestedQuality: number): void {
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

function configureQualityFromNotice(target: BuildTarget): void {
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

function resetSearch(dropdown: Element): void {
  let search = dropdown.getElementsByClassName("search")[0] as HTMLInputElement | undefined
  if (search !== undefined) {
    search.value = ""
  }

  // unhide all child nodes
  const elems = dropdown.querySelectorAll<HTMLElement>("label, hr")
  for (const elem of elems) {
    elem.style.display = ""
  }
}

function searchTargets(this: HTMLInputElement, event: KeyboardEvent): void {
  const search = this
  const searchText = search.value
  const parent = search.parentElement
  if (parent === null) return
  const dropdown = select(parent)

  if (!searchText.trim()) {
    resetSearch(parent)
    return
  }

  // handle enter key press (select target if only one is visible)
  if (event.key === "Enter") {
    const labels = dropdown.selectAll<HTMLElement, unknown>("label").filter(function () {
      return this.style.display !== "none"
    })
    // don't do anything if more than one icon is visible
    if (labels.size() === 1) {
      const label = labels.node()
      if (label instanceof HTMLLabelElement) {
        const input = document.getElementById(label.htmlFor)
        if (input instanceof HTMLInputElement) {
          input.checked = true
          input.dispatchEvent(new Event("change"))
        }
      }
    }
    return
  }

  // hide non-matching labels & icons
  let currentHrHasContent = false
  const searchState: { lastHrWithContent: HTMLElement | null } = { lastHrWithContent: null }
  dropdown.selectAll<HTMLElement, unknown>("hr, label").each(function (item: unknown) {
    if (this.tagName === "HR") {
      if (currentHrHasContent) {
        this.style.display = ""
        searchState.lastHrWithContent = this
      } else {
        this.style.display = "none"
      }
      currentHrHasContent = false
    } else {
      if (!(item instanceof Item) || !itemMatchesSearch(item, searchText)) {
        this.style.display = "none"
      } else {
        this.style.display = ""
        currentHrHasContent = true
      }
    }
  })
  if (!currentHrHasContent && searchState.lastHrWithContent !== null) {
    searchState.lastHrWithContent.style.display = "none"
  }
}

let targetCount = 0
let recipeSelectorCount = 0

export class BuildTarget implements FactoryBuildTarget {
  index: number
  itemKey: string
  item: Item
  recipe: Recipe | null = null
  defaultRecipe: Recipe | null = null
  changedBuilding = true
  buildings = one
  rate = zero
  qualityLevel = 0
  qualityNoticeKind: "warning" | null = null
  qualityConflictPreviousQuality: number | null = null
  readonly element: HTMLElement
  readonly recipeSelector: Selection<HTMLSpanElement, undefined, null, undefined>
  readonly qualitySelector: HTMLSelectElement
  readonly buildingInput: HTMLInputElement
  readonly rateInput: HTMLInputElement
  readonly locationWarning: Selection<HTMLDivElement, undefined, null, undefined>
  readonly qualityNotice: Selection<HTMLDivElement, undefined, null, undefined>
  readonly qualityNoticeMessage: Selection<HTMLSpanElement, undefined, null, undefined>
  readonly qualityNoticeAction: Selection<HTMLButtonElement, undefined, null, undefined>
  compatibleLocations: Planet[] = []

  constructor(index: number, itemKey: string, item: Item, itemGroups: ItemGroups) {
    this.index = index
    this.itemKey = itemKey
    this.item = item

    let element = create("li").classed("target production-target-row", true)
    element
      .append("button")
      .classed("targetButton ui", true)
      .text("×")
      .attr("data-tooltip", "Remove this production target.")
      .on("click", removeHandler(this))
    const elementNode = element.node()
    if (!(elementNode instanceof HTMLElement)) throw new Error("Unable to create production target")
    this.element = elementNode

    const targetInputName = `target-${targetCount}`
    let itemOptionsRendered = false
    const itemColumn = element.append("span").classed("production-target-item", true)

    const renderItemOptions = (selection: Selection<HTMLElement, unknown, null, undefined>): void => {
      if (itemOptionsRendered) {
        return
      }
      itemOptionsRendered = true
      selection.selectAll("*").remove()
      selection
        .append("input")
        .classed("search", true)
        .attr("placeholder", "Search")
        .on("keyup", function (this: Element, event: KeyboardEvent) {
          if (this instanceof HTMLInputElement) searchTargets.call(this, event)
        })
      let group = selection.selectAll("div").data(itemGroups).join("div")
      group.filter((_d: Item[][], i: number) => i > 0).append("hr")
      let items = group
        .selectAll("div")
        .data((d: Item[][]) => d)
        .join("div")
        .selectAll("span")
        .data((d: Item[]) => d)
        .join("span")
      let itemLabel = addInputs(items, targetInputName, (d: Item) => d === this.item, itemHandler(this))
      itemLabel.append((d: Item) => {
        const node = selection.node()
        return d.icon.make(32, false, node instanceof HTMLElement ? node : undefined)
      })
      itemLabel
        .append("span")
        .classed("target-item-name", true)
        .text((d: Item) => d.name)
      reapTooltips()
    }

    const dropdown = makeDropdown(
      itemColumn,
      (selection) => {
        renderItemOptions(selection)
        const search = selection.select(".search").node() as HTMLInputElement | null
        search?.focus()
      },
      (selection) => {
        const node = selection.node()
        if (node instanceof Element) resetSearch(node)
      },
    )
    dropdown.classed("itemDropdown", true)

    const selectedItem = dropdown.append("span").datum(item)
    const selectedItemLabel = addInputs(selectedItem, targetInputName, () => true, itemHandler(this))
    selectedItemLabel.append(() => {
      const node = dropdown.node()
      return item.icon.make(32, false, node instanceof HTMLElement ? node : undefined)
    })
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
      .on("change", (event: Event) => {
        const target = event.target
        if (target instanceof HTMLSelectElement) handleTargetQualityChange(this, Number(target.value))
      })
      .node() as HTMLSelectElement
    select(this.qualitySelector)
      .selectAll("option")
      .data(QUALITY_TIERS.map((name, level) => ({ name, level })))
      .join("option")
      .attr("value", (d: { readonly name: string; readonly level: number }) => d.level)
      .text((d: { readonly name: string; readonly level: number }) => d.name)
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
      .node() as HTMLInputElement

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
      .node() as HTMLInputElement
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

    this.displayRecipes()
  }
  getBuildingCountInput(): string {
    return this.buildingInput.value
  }
  setRateLabel(): void {
    this.rateInput?.setAttribute("aria-label", "Rate per " + spec.format.longRate)
  }
  hideQualityNotice(): void {
    this.qualityNoticeKind = null
    this.qualityNoticeMessage.text("")
    this.qualityNoticeAction.text("").style("display", "none").on("click", null)
    this.qualityNotice.style("display", "none")
  }
  clearQualityNotice(): void {
    this.qualityConflictPreviousQuality = null
    this.hideQualityNotice()
  }
  clearQualityWarning(): void {
    this.qualityConflictPreviousQuality = null
    if (this.qualityNoticeKind === "warning") {
      this.hideQualityNotice()
    }
  }
  showQualityNotice(
    kind: "warning",
    message: string,
    actionText: string | null = null,
    action: (() => void) | null = null,
  ): void {
    this.qualityNoticeKind = kind
    this.qualityNoticeMessage.text(message)
    if (actionText === null || action === null) {
      this.qualityNoticeAction.text("").style("display", "none").on("click", null)
    } else {
      this.qualityNoticeAction.text(actionText).style("display", null).on("click", action)
    }
    this.qualityNotice.style("display", null)
  }
  showQualityConflict(qualityLevel: number): void {
    const tier = QUALITY_TIERS[qualityLevel] ?? `quality ${qualityLevel}`
    this.showQualityNotice(
      "warning",
      `${tier} output requires a machine with module slots and at least one quality module.`,
      "Configure automatically",
      () => configureQualityFromNotice(this),
    )
  }
  showQualityUnavailable(qualityLevel: number): void {
    const tier = QUALITY_TIERS[qualityLevel] ?? `quality ${qualityLevel}`
    this.showQualityNotice(
      "warning",
      `${tier} ${this.item.name} is unavailable with the currently enabled machines and modules.`,
    )
  }
  displayLocationWarning(): void {
    let info = getUnavailableLocationInfo(spec, this.item)
    if (info === null) {
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
  enableCompatibleLocations(): void {
    let locations = [...this.compatibleLocations]
    for (let location of locations) {
      if (!spec.selectedPlanets.has(location)) {
        spec.selectPlanet(location)
      }
    }
    selectAll<HTMLButtonElement, Planet>("#planet_selector .toggle")
      .classed("selected", (location: Planet) => spec.selectedPlanets.has(location))
      .attr("aria-pressed", (location: Planet) => String(spec.selectedPlanets.has(location)))
    refreshRecipeSettings(spec)
    spec.updateSolution()
  }
  displayRecipes(): void {
    const previousRecipe = this.recipe
    this.recipeSelector.selectAll("*").remove()
    const recipes: Recipe[] = []
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
      this.defaultRecipe = recipes[0] ?? null
    }
    if (recipes.length === 0) {
      this.defaultRecipe = null
      if (previousRecipe !== this.recipe) this.clearQualityNotice()
      return
    } else if (recipes.length === 1) {
      this.recipe = recipes[0] ?? null
      if (previousRecipe !== this.recipe) this.clearQualityNotice()
      return
    }
    // If there are multiple valid recipes, render the recipe dropdown.
    if (this.recipe === null) {
      this.recipe = recipes[0] ?? null
    }
    let self = this
    let dropdown = makeDropdown(this.recipeSelector)
    let inputs = dropdown.selectAll("div").data(recipes).join("div")
    let labels = addInputs(
      inputs,
      "target-recipe-" + recipeSelectorCount,
      (d: Recipe) => self.recipe === d,
      (d: Recipe) => {
        self.recipe = d
        self.clearQualityNotice()
        spec.updateSolution()
      },
    )
    labels.append((d: Recipe) => {
      const node = dropdown.node()
      return d.icon.make(32, false, node instanceof HTMLElement ? node : undefined)
    })
    recipeSelectorCount++
    if (previousRecipe !== this.recipe) this.clearQualityNotice()
  }
  getRate(): Rational {
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
      rate = qualityRate === null ? zero : qualityRate.mul(this.buildings)
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
  buildingsChanged(): void {
    this.changedBuilding = true
    this.buildingInput.classList.add(SELECTED_INPUT)
    this.rateInput.classList.remove(SELECTED_INPUT)
    this.buildings = Rational.from_string(this.buildingInput.value)
    this.rate = zero
    this.rateInput.value = ""
  }
  setBuildings(count: string, recipe: Recipe | null): void {
    this.buildingInput.value = count
    this.recipe = recipe
    this.buildingsChanged()
  }
  rateChanged(): void {
    this.changedBuilding = false
    this.buildingInput.classList.remove(SELECTED_INPUT)
    this.rateInput.classList.add(SELECTED_INPUT)
    this.buildings = zero
    this.rate = Rational.from_string(this.rateInput.value).div(spec.format.rateFactor)
    this.buildingInput.value = ""
  }
  setRate(rate: string): void {
    this.rateInput.value = rate
    this.rateChanged()
  }
  setQuality(level: number | string): void {
    let maxLevel = Math.max(0, Math.min(QUALITY_TIERS.length - 1, spec.maxQualityLevel))
    select(this.qualitySelector)
      .selectAll("option")
      .property("disabled", (option: { level: number }) => option.level > maxLevel)
    this.qualityLevel = Math.max(0, Math.min(maxLevel, Number(level) || 0))
    this.qualitySelector.value = String(this.qualityLevel)
  }
}

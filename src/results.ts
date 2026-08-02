import { getItemProductionRecipes, getRecipeLocations, setRecipeEnabled, spec } from "./factory.js"
import { one, powerRepresentation, Rational, zero } from "./math.js"
import { moduleDropdown, moduleRows, type Fuel } from "./models.js"
import { addInputs, Icon, makeDropdown } from "./presentation.js"
import { getRecipeSelectorGroups } from "./recipes.js"
import { refreshRecipeSettings } from "./settings.js"
import { toggleIgnoreHandler, usesLegacyCalculation } from "./state.js"
import { formatSettings } from "./url-state.js"

// -----------------------------------------------------------------------------
// Result grouping
// -----------------------------------------------------------------------------

function neighbors(groupMap, group) {
  let result = new Set()
  for (let recipe of group) {
    let ingredients: any[] = Array.from(recipe.getIngredients())
    // Reverse the list of ingredients here, so that it appears in the
    // "correct" order when the overall topoSort is reversed.
    ingredients.reverse()
    for (let ing of ingredients) {
      for (let subRecipe of ing.item.allRecipes()) {
        if (groupMap.has(subRecipe)) {
          result.add(groupMap.get(subRecipe))
        }
      }
    }
  }
  result.delete(group)
  return result
}

function visit(groupMap, group, result, seen) {
  if (result.has(group) || seen.has(group)) {
    return
  }
  seen.add(group)
  for (let g of neighbors(groupMap, group)) {
    visit(groupMap, g, result, seen)
  }
  seen.delete(group)
  result.add(group)
}

export function topoSort(groups) {
  let groupMap = new Map()
  for (let group of groups) {
    for (let recipe of group) {
      groupMap.set(recipe, group)
    }
  }
  let result = new Set()
  let seen = new Set()
  for (let group of groups) {
    if (!result.has(group) && !seen.has(group)) {
      visit(groupMap, group, result, seen)
    }
  }
  let ordered = Array.from(result)
  ordered.reverse()
  return ordered
}

export function getRecipeGroups(recipes) {
  let groups = new Map()
  let items = new Set<any>()
  for (let recipe of recipes) {
    if (recipe.products.length > 0) {
      groups.set(recipe, new Set([recipe]))
      for (let ing of recipe.products) {
        items.add(ing.item)
      }
    }
  }
  for (let item of items) {
    let itemRecipes = []
    for (let recipe of item.allRecipes()) {
      if (recipes.has(recipe)) {
        itemRecipes.push(recipe)
      }
    }
    if (itemRecipes.length > 1) {
      let combined = new Set()
      for (let recipe of itemRecipes) {
        for (let r of groups.get(recipe)) {
          combined.add(r)
        }
      }
      for (let recipe of combined) {
        groups.set(recipe, combined)
      }
    }
  }
  let groupObjects = new Set()
  for (let [r, group] of groups) {
    groupObjects.add(group)
  }
  return groupObjects
}

// -----------------------------------------------------------------------------
// Row recipe selector
// -----------------------------------------------------------------------------

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
  groups
    .append("div")
    .classed("recipe-selector-group-title", true)
    .text((entry) => entry.name)
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

let machineSelectorCount = 0

function makeMachineSelector(row, compatibleBuildings) {
  let automaticBuilding = spec.getAutomaticBuilding(row.recipe)
  let override = spec.getBuildingOverride(row.recipe)
  let options = [
    {
      building: null,
      displayBuilding: automaticBuilding,
      label: `Automatic (${automaticBuilding.name})`,
    },
    ...compatibleBuildings.map((building) => ({
      building,
      displayBuilding: building,
      label: building.name,
    })),
  ]

  let root = d3
    .create("span")
    .classed("machine-selector", true)
    .attr("aria-label", `Choose a machine for ${row.recipe.name}`)
  let choices = makeDropdown(root)
    .classed("machine-dropdown", true)
    .selectAll("div")
    .data(options)
    .join("div")
    .classed("machine-option", true)
  let labels = addInputs(
    choices,
    `machine-selector-${machineSelectorCount++}`,
    (option) => option.building === override,
    (option) => {
      if (spec.setBuildingOverride(row.recipe, option.building)) {
        spec.updateSolution()
      }
    },
  )
  labels.append(function (this: HTMLElement, option) {
    let icon = option.displayBuilding.icon.make(32, true)
    icon.removeAttribute("title")
    return icon
  })
  labels
    .append("span")
    .classed("machine-option-name", true)
    .text((option) => option.label)
  return root.node()
}

// -----------------------------------------------------------------------------
// Results table
// -----------------------------------------------------------------------------

export { powerRepresentation as powerRepr } from "./math.js"

function alignPower(x) {
  if (x.isZero()) {
    return "0 W"
  }
  let { power, suffix } = powerRepresentation(x)
  return spec.format.alignCount(power) + " " + suffix
}

class Header {
  [key: string]: any
  constructor(
    text: string,
    colspan: number,
    surplus = false,
    title: string | null = null,
    icon: any = null,
    align: "left" | "right" | "center" = "right",
  ) {
    this.text = text
    this.colspan = colspan
    this.surplus = surplus
    this.title = title
    this.icon = icon
    this.align = align
  }
}

function setlen(a, len, callback) {
  if (a.length > len) {
    a.length = len
  }
  while (a.length < len) {
    a.push(callback())
  }
}

class BreakdownRow {
  [key: string]: any
  constructor(item, destRecipe, rate, building, count, percent = null, divider = false) {
    this.item = item
    this.recipe = destRecipe
    this.rate = rate
    this.building = building
    this.count = count
    this.percent = percent
    this.divider = divider
  }
}

function getBreakdown(item, totals) {
  let rows = []
  let uses = []
  let found = false
  // The top half of the breakdown gives every ingredient used by every
  // recipe that produced the given item. If a given ingredient is produced
  // by a single recipe, then a building count for that recipe is given.
  for (let recipe of item.recipes) {
    if (!totals.rates.has(recipe)) {
      continue
    }
    for (let ing of recipe.getIngredients()) {
      let rate = totals.consumers.get(ing.item).get(recipe)
      let building = null
      let count = null
      let producers = totals.producers.get(ing.item)
      if (producers.size === 1) {
        let r: any = Array.from(producers.keys())[0]
        let recipeRate = rate.div(r.gives(ing.item))
        building = spec.getBuilding(r)
        count = spec.getCount(r, recipeRate)
      }
      rows.push(new BreakdownRow(ing.item, recipe, rate, building, count, null, false))
      found = true
    }
  }
  // The bottom half of the breakdown gives every recipe which consumes the
  // given item. If the given item is produced by a single recipe, then the
  // proportion of that recipe's building count is given.
  let singleRecipe = null
  let amount = null
  let building = null
  let producers = totals.producers.get(item)
  let hundred = Rational.from_float(100)
  if (producers.size === 1) {
    singleRecipe = Array.from(producers.keys())[0]
    amount = singleRecipe.gives(item)
    building = spec.getBuilding(singleRecipe)
  }
  for (let [recipe, rate] of totals.consumers.get(item)) {
    if (recipe.isReal()) {
      let count = null
      if (singleRecipe !== null) {
        let recipeRate = rate.div(amount)
        count = spec.getCount(singleRecipe, recipeRate)
      }
      let percent = rate.div(totals.items.get(item)).mul(hundred)
      let percentStr
      if (percent.less(one)) {
        percentStr = "<1%"
      } else {
        percentStr = percent.toDecimal(0) + "%"
      }
      rows.push(new BreakdownRow(item, recipe, rate, building, count, percentStr, found))
      found = false
    }
  }
  return rows
}

class ModuleInput {
  [key: string]: any
  constructor() {
    this.cell = null
    this.module = null
  }
  checked() {
    return this.cell.moduleSpec.getModule(this.cell.index) === this.module
  }
  choose() {
    let toUpdate = [this.cell.index]
    if (this.cell.index === 0) {
      let modules = this.cell.moduleSpec.modules
      let oldModule = modules[this.cell.index]
      for (let i = 1; i < modules.length; i++) {
        if (modules[i] === oldModule) {
          toUpdate.push(i)
        }
      }
    }
    let anyRecalc = false
    for (let i of toUpdate) {
      let recalc = this.cell.moduleSpec.setModule(i, this.module)
      anyRecalc = anyRecalc || recalc
    }
    if (anyRecalc || spec.isFactoryTarget(this.cell.moduleSpec.recipe)) {
      spec.updateSolution()
    } else {
      spec.display()
    }
  }
  setData(slot, m) {
    this.cell = slot
    this.module = m
  }
}

let slotCount = 0
class ModuleSlot {
  [key: string]: any
  constructor(group, row) {
    this.group = group
    this.row = row
    this.name = `moduleslot-${slotCount++}`
    this.moduleSpec = null
    this.index = null
    this.inputRows = []
    setlen(this.inputRows, moduleRows.length, () => [])
  }
  setData(mSpec, i) {
    this.moduleSpec = mSpec
    this.index = i
    for (let i = 0; i < this.inputRows.length; i++) {
      let inputRow = this.inputRows[i]
      let modules = moduleRows[i]
      let rowIndex = 0
      let j = 0
      for (; j < modules.length; j++) {
        let module = modules[j]
        if (module === null || module.canUse(mSpec.recipe, mSpec.building)) {
          if (rowIndex > inputRow.length - 1) {
            inputRow.push(new ModuleInput())
          }
          inputRow[rowIndex++].setData(this, module)
        }
      }
      if (inputRow.length > rowIndex) {
        inputRow.length = rowIndex
      }
      inputRow.length = rowIndex
    }
  }
}

class BeaconInput {
  [key: string]: any
  constructor(cell, module) {
    this.cell = cell
    this.module = module
  }
  checked() {
    return this.module === this.cell.row.moduleSpec.beaconModules[this.cell.index]
  }
  choose() {
    let toUpdate = [this.cell.index]
    if (this.cell.index === 0) {
      let modules = this.cell.row.moduleSpec.beaconModules
      if (modules[0] === modules[1]) {
        toUpdate.push(1)
      }
    }
    for (let index of toUpdate) {
      this.cell.row.moduleSpec.setBeaconModule(this.module, index)
    }
    if (spec.isFactoryTarget(this.cell.row.moduleSpec.recipe)) {
      spec.updateSolution()
    } else {
      spec.display()
    }
  }
}

let beaconCount = 0
class BeaconCell {
  [key: string]: any
  constructor(row, index) {
    this.name = `beaconslot-${beaconCount++}`
    this.row = row
    this.index = index
    this.inputRows = []
  }
  setData(moduleSpec) {
    this.inputRows.length = 0
    if (moduleSpec === null) {
      return
    }
    for (let row of moduleRows) {
      let inputRow = []
      for (let module of row) {
        if (module === null || (module.canBeacon() && module.canUse(moduleSpec.recipe, moduleSpec.building))) {
          inputRow.push(new BeaconInput(this, module))
        }
      }
      if (inputRow.length > 0) {
        this.inputRows.push(inputRow)
      }
    }
  }
}

class DisplayRow {
  [key: string]: any
  constructor() {
    this.slots = []
    this.beaconModules = []
    for (let i = 0; i < 2; i++) {
      this.beaconModules.push(new BeaconCell(this, i))
    }
  }
  setData(item, recipe, building, moduleSpec, single, breakdown) {
    this.item = item
    this.recipe = recipe
    this.building = building
    this.moduleSpec = moduleSpec
    this.single = single
    this.breakdown = breakdown
    for (let beaconCell of this.beaconModules) {
      beaconCell.setData(moduleSpec)
    }
  }
}

class DisplayGroup {
  [key: string]: any
  constructor() {
    this.rows = []
  }
  setData(totals, items, recipes) {
    let self = this
    items = [...items]
    recipes = [...recipes]
    if (items.length === 0) {
      this.rows.length = 0
      return
    }
    let len = Math.max(items.length, recipes.length)
    setlen(this.rows, len, () => new DisplayRow())
    let hundred = Rational.from_float(100)
    for (let i = 0; i < len; i++) {
      let row = this.rows[i]
      let item = items[i] || null
      let recipe = recipes[i] || null
      let building = null
      let moduleSpec = null
      let slotCount = 0
      if (recipe !== null) {
        building = spec.getBuilding(recipe)
        if (building !== null && building.canBeacon()) {
          moduleSpec = spec.getModuleSpec(recipe)
          slotCount = moduleSpec.modules.length
        } else {
          moduleSpec = null
          slotCount = 0
        }
      }
      setlen(row.slots, slotCount, () => new ModuleSlot(self, row))
      for (let j = 0; j < slotCount; j++) {
        row.slots[j].setData(moduleSpec, j)
      }
      let single = item !== null && recipe !== null && item.key === recipe.key
      let breakdown = null
      if (item !== null) {
        breakdown = getBreakdown(item, totals)
      }
      row.setData(item, recipe, building, moduleSpec, single, breakdown)
    }
  }
}

export function resetDisplay() {
  d3.selectAll("table#totals > tbody").remove()
  displayGroups = []
}

// Remember these values from update to update, to make it simpler to reuse
// elements.
let displayGroups = []

function getDisplayGroups(totals) {
  let recipes = Array.from(totals.rates.keys())
  recipes.reverse()
  let groupObjects: any[] = topoSort(getRecipeGroups(new Set(recipes))) as unknown as any[]
  setlen(displayGroups, groupObjects.length, () => new DisplayGroup())
  let i = 0
  for (let group of groupObjects) {
    let items = new Set<any>()
    for (let recipe of group) {
      for (let ing of recipe.products) {
        if (totals.items.has(ing.item)) {
          items.add(ing.item)
        }
      }
    }
    displayGroups[i++].setData(totals, items, group)
  }
}

function toggleBreakdownHandler(this: HTMLElement) {
  let row = this.parentElement
  let breakdownRow = row?.nextElementSibling
  if (row === null || breakdownRow === null) {
    return
  }
  if (row.classList.contains("breakdown-open")) {
    row.classList.remove("breakdown-open")
    breakdownRow.classList.remove("breakdown-open")
  } else {
    row.classList.add("breakdown-open")
    breakdownRow.classList.add("breakdown-open")
  }
}

class ItemIcon {
  [key: string]: any
  constructor(item) {
    this.item = item
    this.name = item.name
    this.extra = d3.create("span")

    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
  setText(text) {
    this.extra.text(text)
  }
  renderTooltip() {
    return this.item.renderTooltip(this.extra.node())
  }
}

// All this pipe stuff is legacy code, irrelevant as of 2.0, but we might as
// well keep it around for legacy datasets.

// For pipe segment of the given length, returns maximum throughput as fluid/s.
function pipeThroughput(length) {
  let R = Rational.from_float
  if (length.equal(zero)) {
    // A length of zero represents a solid line of pumps.
    return R(12000)
  } else if (length.less(R(198))) {
    let numerator = R(50).mul(length).add(R(150))
    let denominator = R(3).mul(length).sub(one)
    return numerator.div(denominator).mul(R(60))
  } else {
    return R(60 * 4000).div(R(39).add(length))
  }
}

// Throughput at which pipe length equation changes.
let pipeThreshold = Rational.from_floats(4000, 236)

// For fluid throughput in fluid/s, returns maximum length of pipe that can
// support it.
function pipeLength(throughput) {
  let R = Rational.from_float
  throughput = throughput.div(R(60))
  if (R(200).less(throughput)) {
    return null
  } else if (R(100).less(throughput)) {
    return zero
  } else if (pipeThreshold.less(throughput)) {
    let numerator = throughput.add(R(150))
    let denominator = R(3).mul(throughput).sub(R(50))
    return numerator.div(denominator)
  } else {
    return R(4000).div(throughput).sub(R(39))
  }
}

// Just hardcode this. It used to be a setting, but now it's defunct.
let minPipeLength = Rational.from_float(17)
let maxPipeThroughput = pipeThroughput(minPipeLength)

function pipeValues(rate) {
  let pipes = rate.div(maxPipeThroughput).ceil()
  let perPipeRate = rate.div(pipes)
  let length = pipeLength(perPipeRate).floor()
  return { pipes: pipes, length: length }
}

function pipeText(rate) {
  if (!usesLegacyCalculation()) {
    return ""
  }
  if (rate.equal(zero)) {
    return " \u00d7 0"
  }
  let { pipes, length } = pipeValues(rate)
  let pipeString = ""
  if (one.less(pipes)) {
    pipeString += " \u00d7 " + pipes.toDecimal(0)
  }
  pipeString += " \u2264 " + length.toDecimal(0)
  return pipeString
}

class PipeIcon {
  [key: string]: any
  constructor() {
    let item = spec.items.get("pipe")
    this.name = item.name
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
}

function formatLocationNames(locations) {
  return locations.map((location) => location.name).join(" / ")
}

function getLocationCellText(specification, recipe, building) {
  if (recipe === null || !recipe.isReal?.()) {
    return ""
  }
  let locations = getRecipeLocations(specification, recipe, building)
  if (locations.length === 0) {
    return "Unavailable"
  }
  if (locations.length === specification.selectedPlanets.size && locations.length > 2) {
    return "Any selected"
  }
  if (locations.length > 2) {
    return `${locations.length} locations`
  }
  return formatLocationNames(locations)
}

function hasQualityModules(moduleSpec) {
  return moduleSpec?.modules.some((module) => module?.category === "quality") ?? false
}

export function getFactorySummary(specification, totals) {
  let exactMachines = zero
  let placedMachines = zero
  let electricalPower = zero
  let fuelRates = new Map<Fuel, Rational>()
  let recipeCount = 0
  let ambiguousRecipeCount = 0
  let qualityRecipeCount = 0
  let beaconedRecipeCount = 0

  for (let [recipe, rate] of totals.rates) {
    if (!recipe.isReal?.()) {
      continue
    }
    recipeCount++
    let building = specification.getBuilding(recipe)
    if (building === null) {
      continue
    }

    let count = specification.getCount(recipe, rate)
    exactMachines = exactMachines.add(count)
    placedMachines = placedMachines.add(count.ceil())

    let { fuel, power } = specification.getPowerUsage(recipe, rate)
    if (fuel === "electric") {
      electricalPower = electricalPower.add(power)
    } else if (fuel !== null) {
      let recipeFuel = specification.getFuelForRecipe(recipe)
      if (recipeFuel !== null) {
        fuelRates.set(recipeFuel, (fuelRates.get(recipeFuel) ?? zero).add(power.div(recipeFuel.value)))
      }
    }

    if (getRecipeLocations(specification, recipe, building).length > 1) {
      ambiguousRecipeCount++
    }
    let moduleSpec = specification.getModuleSpec(recipe)
    if (hasQualityModules(moduleSpec)) {
      qualityRecipeCount++
    }
    if (
      moduleSpec !== undefined &&
      !moduleSpec.beaconCount.isZero() &&
      moduleSpec.beaconModules.some((module) => module !== null)
    ) {
      beaconedRecipeCount++
    }
  }

  let selectedLocations = [...(specification.selectedPlanets ?? [])].sort((a, b) => a.order.localeCompare(b.order))
  let importedItems = [...specification.ignore]
    .filter((item) => totals.items.has(item))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    exactMachines,
    placedMachines,
    electricalPower,
    fuelRates,
    recipeCount,
    ambiguousRecipeCount,
    qualityRecipeCount,
    beaconedRecipeCount,
    selectedLocations,
    importedItems,
  }
}

function renderFactorySummary(specification, totals) {
  let summary = getFactorySummary(specification, totals)
  let root = d3.select("#factory_summary").property("hidden", false)
  let { power, suffix } = powerRepresentation(summary.electricalPower)
  let cards = [
    { label: "Active recipes", value: String(summary.recipeCount) },
    { label: "Machines to place", value: summary.placedMachines.toDecimal(0) },
    { label: "Machine power", value: `${specification.format.count(power)} ${suffix}` },
  ]
  for (let [fuel, rate] of [...summary.fuelRates].sort(([fuelA], [fuelB]) => fuelA.name.localeCompare(fuelB.name))) {
    cards.push({
      label: `${fuel.name} / ${specification.format.rateName}`,
      value: specification.format.rate(rate),
    })
  }
  let card = root
    .selectAll("div.factory-summary-card")
    .data(cards, (entry) => entry.label)
    .join("div")
    .classed("factory-summary-card", true)
  card
    .selectAll("div.factory-summary-value")
    .data((entry) => [entry])
    .join("div")
    .classed("factory-summary-value", true)
    .text((entry) => entry.value)
  card
    .selectAll("div.factory-summary-label")
    .data((entry) => [entry])
    .join("div")
    .classed("factory-summary-label", true)
    .text((entry) => entry.label)

  let warnings = []
  if (summary.selectedLocations.length > 1) {
    let ambiguity =
      summary.ambiguousRecipeCount === 0
        ? ""
        : ` ${summary.ambiguousRecipeCount} recipe${summary.ambiguousRecipeCount === 1 ? " has" : "s have"} multiple possible locations.`
    warnings.push(`Shared materials; transport is not modeled.${ambiguity}`)
  }
  if (summary.qualityRecipeCount > 0) {
    warnings.push("Quality modules affect machines, but quality-tier yields and upcycling are not calculated.")
  }
  if (summary.importedItems.length > 0) {
    warnings.push(`Imported: ${summary.importedItems.map((item) => item.name).join(", ")}.`)
  }

  root
    .selectAll("div.factory-summary-warning")
    .data(warnings)
    .join("div")
    .classed("factory-summary-warning", true)
    .text((warning) => warning)
}

export function displayCalculationError(_specification, error) {
  let code = error && typeof error === "object" ? error.code : null
  let message = error instanceof Error ? error.message : String(error)
  let title = "Unable to calculate this factory"
  let guidance = "Check the target values, selected recipes, machines, locations, and resource priorities."

  if (code === "missing-recipe") {
    guidance =
      "Choose a compatible production location above, enable a recipe in Settings, choose another recipe, or click the item icon in the Factory table to treat that item as imported."
  } else if (code === "infeasible") {
    guidance =
      "Review alternate recipes and resource priorities. A cyclic or multi-output chain may require at least one additional recipe or imported input."
  } else if (/integer|number|denominator|divide|invalid/i.test(message)) {
    title = "Invalid numeric value"
    guidance = "Use a whole number, decimal, or fraction such as 60, 2.5, or 1/3."
  }

  let root = d3.select("#calculation_error").property("hidden", false)
  root.select(".calculation-error-title").text(title)
  root.select(".calculation-error-message").text(message)
  root.select(".calculation-error-guidance").text(guidance)
  d3.select("#factory_summary").property("hidden", true)
  d3.select("table#totals").property("hidden", true)
}

export function displayItems(spec, totals) {
  d3.select("#calculation_error").property("hidden", true)
  d3.select("table#totals").property("hidden", false)
  renderFactorySummary(spec, totals)
  let showLocations = spec.selectedPlanets?.size > 1
  let showSurplus = totals.surplus.size > 0
  let headers = [
    new Header("Item", 2, false, null, null, "left"),
    new Header("Rate / " + spec.format.rateName, 1, false, null, null, "right"),
    ...(showSurplus ? [new Header("Surplus / " + spec.format.rateName, 1, true, null, null, "right")] : []),
    new Header("Belts", 1, false, `Equivalent ${spec.belt.name} belts at the selected rate`, spec.belt.icon, "right"),
    new Header("Machines", 2, false, null, null, "center"),
    ...(showLocations ? [new Header("Location", 1, false, null, null, "left")] : []),
    new Header("Modules", 1, false, null, null, "left"),
    new Header("Beacons", 1, false, null, null, "left"),
    new Header("Power", 1, false, null, null, "right"),
    new Header("", 1, false, null, null, "center"), // pop-out links
  ]
  let totalCols = 0
  for (let header of headers) {
    totalCols += header.colspan
  }

  let table = d3.select("table#totals")
  table.classed("nosurplus", totals.surplus.size === 0)

  let headerRow = table.selectAll("thead tr").classed("factory-header", true).selectAll("th").data(headers)
  headerRow.exit().remove()
  let headerCell = headerRow
    .join("th")
    .classed("surplus", (d) => d.surplus)
    .classed("align-left", (d) => d.align === "left")
    .classed("align-center", (d) => d.align === "center")
    .classed("align-right", (d) => d.align === "right")
    .attr("colspan", (d) => d.colspan)
    .attr("title", (d) => d.title)
  headerCell.each(function (this: HTMLTableCellElement, header) {
    let cell = d3.select(this)
    cell.selectAll("*").remove()
    if (header.icon !== null) {
      cell.append(() => header.icon.make(18)).classed("header-icon", true)
    }
    cell.append("span").text(header.text)
  })

  getDisplayGroups(totals)
  let rowGroup = table
    .selectAll("tbody")
    .data(displayGroups)
    .join("tbody")
    .classed("display-group", true)
    .classed("multi", (d) => d.rows.length > 1)
  rowGroup.selectAll("tr.breakdown").remove()
  // Create new rows.
  let row = rowGroup
    .selectAll("tr")
    .data((d) => d.rows)
    .join((enter) => {
      let row = enter.append("tr").classed("display-row", true)
      // cell 1: breakdown toggle
      row
        .append("td")
        .classed("item", true)
        .on("click", toggleBreakdownHandler)
        .append("svg")
        .classed("breakdown-arrow", true)
        .attr("viewBox", "0 0 16 16")
        .attr("width", 16)
        .attr("height", 16)
        .append("use")
        .attr("href", "images/icons.svg#right")
      // cell 2: item identity and import toggle
      let itemCell = row.append("td").classed("item item-identity", true)
      let itemToggle = itemCell.append("button").classed("item-import-toggle", true).attr("type", "button")
      itemToggle.append("span").classed("item-icon", true)
      itemToggle.append("span").classed("item-name", true)
      itemToggle.append("span").classed("item-state", true)
      // cell 3: item rate
      row.append("td").classed("item right-align", true).append("tt").classed("item-rate", true)
      // cell 4: surplus rate
      row.append("td").classed("item surplus right-align", true).append("tt").classed("surplus-rate", true)
      // cell 5: equivalent belt count (fluids are blank for Factorio 2.x datasets)
      row
        .append("td")
        .classed("item right-align logistics-cell pad-right", true)
        .append("tt")
        .classed("belt-count", true)

      // cell 6: building icon
      let buildingCell = row.append("td").classed("pad building building-icon leftmost right-align", true)
      // cell 7: building count
      row.append("td").classed("right-align building", true).append("tt").classed("building-count", true)

      // Production location for multi-location plans.
      row.append("td").classed("location-cell", true)

      // cell 8: modules
      let moduleCell = row.append("td").classed("pad building module module-cell", true)

      // cell 9: beacons
      let beaconCell = row.append("td").classed("pad building module beacon", true)
      beaconCell.append("span").classed("beacon-container", true)
      let beaconCountSpan = beaconCell.append("span").classed("beacon-count", true)
      beaconCountSpan.append("span").text(" \u00d7 ")
      beaconCountSpan
        .append("input")
        .attr("type", "text")
        .attr("size", 3)
        .on("change", function (event, d) {
          let count = Rational.from_string(event.target.value)
          d.moduleSpec.setBeaconCount(count)
          if (spec.isFactoryTarget(d.recipe)) {
            spec.updateSolution()
          } else {
            spec.display()
          }
        })

      // cell 10: power or fuel rate
      let powerCell = row.append("td").classed("right-align building power-cell", true)
      powerCell.append("span").classed("fuel-icon", true)
      powerCell.append("tt").classed("power", true)

      // cell 11: popout
      row
        .append("td")
        .classed("popout pad item", true)
        .append("a")
        .attr("target", "_blank")
        .attr("title", "Open this item as a separate plan.")
        .append("svg")
        .classed("popout", true)
        .attr("viewBox", "0 0 24 24")
        .attr("width", 24)
        .attr("height", 24)
        .append("use")
        .attr("href", "images/icons.svg#popout")

      return row
    })
    .classed("nobuilding", (d) => d.building === null)
    .classed("nomodule", (d) => d.moduleSpec === null)
    .classed("noitem", (d) => d.item === null)
    .classed("target-output", (d) => d.item !== null && spec.buildTargets.some((target) => target.item === d.item))
    .classed("imported-output", (d) => d.item !== null && spec.ignore.has(d.item))
  row
    .selectAll("td.location-cell")
    .classed("hide", !showLocations)
    .attr("title", (d) => {
      if (d.recipe === null) {
        return null
      }
      let locations = getRecipeLocations(spec, d.recipe, d.building)
      return locations.length === 0 ? "Unavailable on selected locations" : formatLocationNames(locations)
    })
    .text((d) => getLocationCellText(spec, d.recipe, d.building))

  // Update row data.
  let itemRow = row.filter((d) => d.item !== null)
  let itemToggle = itemRow
    .selectAll("button.item-import-toggle")
    .classed("imported", (d) => spec.ignore.has(d.item))
    .attr("title", (d) =>
      spec.ignore.has(d.item) ? `Produce ${d.item.name} in this plan` : `Treat ${d.item.name} as imported`,
    )
    .attr("aria-label", (d) =>
      spec.ignore.has(d.item) ? `Produce ${d.item.name} in this plan` : `Treat ${d.item.name} as imported`,
    )
    .on("click", toggleIgnoreHandler)
  let itemIcon = itemToggle.select("span.item-icon")
  itemIcon.selectAll("img").remove()
  itemIcon
    .append((d) => {
      let icon = new ItemIcon(d.item)
      icon.setText(spec.ignore.has(d.item) ? "Imported." : "Produced in this plan.")
      return icon.icon.make(32)
    })
    .classed("ignore", (d) => spec.ignore.has(d.item))
  itemToggle.select("span.item-name").text((d) => d.item.name)
  itemToggle.select("span.item-state").text((d) => {
    let labels = []
    if (spec.buildTargets.some((target) => target.item === d.item)) labels.push("target")
    if (spec.ignore.has(d.item)) labels.push("imported")
    return labels.join(" · ")
  })
  itemRow.selectAll("tt.item-rate").text((d) => {
    let rate = totals.items.get(d.item)
    if (totals.surplus.has(d.item)) {
      rate = rate.sub(totals.surplus.get(d.item))
    }
    return spec.format.alignRate(rate)
  })
  itemRow
    .selectAll("tt.surplus-rate")
    .text((d) => spec.format.alignRate(totals.surplus.has(d.item) ? totals.surplus.get(d.item) : zero))
  let beltRow = itemRow.filter((d) => d.item.phase === "solid")
  beltRow
    .selectAll("td.logistics-cell")
    .attr("title", `Equivalent ${spec.belt.name} belts`)
    .selectAll("tt.belt-count")
    .text((d) => spec.format.alignCount(spec.getBeltCount(totals.items.get(d.item))))
  let pipeRow = itemRow.filter((d) => d.item.phase === "fluid")
  pipeRow
    .selectAll("td.logistics-cell")
    .attr("title", usesLegacyCalculation() ? "Legacy maximum pipe length" : null)
    .selectAll("tt.belt-count")
    .text((d) => pipeText(totals.items.get(d.item)))
  let itemBuildingCell = itemRow.selectAll("td.building-icon")
  itemBuildingCell.selectAll("*").remove()
  itemBuildingCell
    .filter((d) => getItemProductionRecipes(d.item).length > 0 && d.recipe !== null)
    .append((d) => makeRecipeSelector(d))

  let buildingRow = row.filter((d) => d.building !== null)
  let buildingCell = buildingRow.selectAll("td.building-icon")
  buildingCell.append((d) => {
    let compatibleBuildings = spec.getCompatibleBuildings(d.recipe)
    if (compatibleBuildings.length <= 1) {
      return d.building.icon.make(32)
    }
    return makeMachineSelector(d, compatibleBuildings)
  })
  buildingCell.append("span").text(" \u00d7")
  buildingRow
    .selectAll("tt.building-count")
    .text((d) => spec.format.alignCount(spec.getCount(d.recipe, totals.rates.get(d.recipe))))
  let moduleRow = row.filter((d) => d.moduleSpec !== null)
  let moduleCell = moduleRow.selectAll("td.module-cell")
  // XXX: Something's wrong with how I did the module dropdowns. Work around
  // the issue for now by re-rendering all of them on each update.
  moduleCell.selectAll("*").remove()
  moduleRow.selectAll("span.beacon-container").selectAll("*").remove()
  moduleDropdown(moduleCell, (d) => d.slots)
  moduleDropdown(moduleRow.selectAll("span.beacon-container"), (d) => d.beaconModules)
  moduleRow.selectAll("span.beacon-count input").attr("value", (d) => spec.format.count(d.moduleSpec.beaconCount))

  let fuelRow = buildingRow.filter((d) => d.building.fuel !== null)
  let fuelIcon = fuelRow.selectAll(".fuel-icon")
  fuelIcon.selectAll("*").remove()
  fuelIcon.append((d) => spec.getFuelForRecipe(d.recipe).icon.make(24))
  fuelIcon.append("span").text(" × ")
  fuelRow.selectAll("tt.power").text((d) => {
    let rate = totals.rates.get(d.recipe)
    let { fuel, power } = spec.getPowerUsage(d.recipe, rate)
    let recipeFuel = spec.getFuelForRecipe(d.recipe)
    return `${spec.format.alignRate(power.div(recipeFuel.value))}/${spec.format.rateName}`
  })
  let electricRow = buildingRow.filter((d) => d.building.fuel === null)
  electricRow.selectAll(".fuel-icon").selectAll("*").remove()
  electricRow.selectAll("tt.power").text((d) => {
    let rate = totals.rates.get(d.recipe)
    let { fuel, power } = spec.getPowerUsage(d.recipe, rate)
    return alignPower(power)
  })
  refreshRecipeSettings(spec)

  itemRow.selectAll("td.popout a").attr("href", (d) => {
    let rate = totals.items.get(d.item)
    let rates = [[d.item, rate]]
    return "#" + formatSettings(true, "totals", rates)
  })

  // Render breakdowns.
  itemRow = row.filter((d) => d.breakdown !== null)
  let breakdown = itemRow
    .select(function (this: HTMLTableRowElement) {
      let row = document.createElement("tr")
      this.parentElement?.insertBefore(row, this.nextSibling)
      return row
    })
    .classed("breakdown", true)
    .classed("breakdown-open", function (this: HTMLTableRowElement) {
      return this.previousElementSibling?.classList.contains("breakdown-open") ?? false
    })
  breakdown.append("td")
  row = breakdown
    .append("td")
    .attr("colspan", totalCols - 1)
    .append("table")
    .selectAll("tr")
    .data((d) => d.breakdown)
    .join("tr")
    .classed("breakdown-row", true)
    .classed("breakdown-first-output", (d) => d.divider)
  let bdIcons = row.append("td")
  bdIcons.append((d) => d.recipe.icon.make(32)).classed("item-icon", true)
  bdIcons
    .append("svg")
    .classed("usage-arrow", true)
    .attr("viewBox", "0 0 18 16")
    .attr("width", 18)
    .attr("height", 16)
    .append("use")
    .attr("href", "images/icons.svg#rightarrow")
  bdIcons.append((d) => d.item.icon.make(32)).classed("item-icon", true)
  row
    .append("td")
    .classed("right-align", true)
    .append("tt")
    .classed("item-rate pad-right", true)
    .text((d) => spec.format.alignRate(d.rate))
  beltRow = row.filter((d) => d.item.phase === "solid")
  let beltCell = beltRow.append("td")
  beltCell.append((d) => spec.belt.icon.make(32))
  beltCell.append("span").text(" \u00d7")
  beltRow
    .append("td")
    .classed("right-align", true)
    .append("tt")
    .classed("belt-count pad-right", true)
    .text((d) => spec.format.alignCount(d.rate.div(spec.belt.rate)))
  pipeRow = row.filter((d) => d.item.phase === "fluid")
  pipeRow.append("td").append((d) => new PipeIcon().icon.make(32))
  pipeRow.append("td")
  buildingCell = row
    .append("td")
    .filter((d) => d.building !== null)
    .classed("building", true)
  buildingCell.append((d) => d.building.icon.make(32))
  buildingCell.append("span").text(" \u00d7")
  row
    .append("td")
    .filter((d) => d.count !== null)
    .classed("building pad-right", true)
    .append("tt")
    .text((d) => spec.format.alignCount(d.count))
  row
    .append("td")
    .filter((d) => d.percent !== null)
    .classed("right-align", true)
    .append("tt")
    .text((d) => d.percent)
}

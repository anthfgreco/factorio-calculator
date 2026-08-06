import { create, select, selectAll, type BaseType, type Selection } from "d3"
import type { Instance } from "tippy.js"
import {
  FactorySpecification,
  getItemProductionRecipes,
  getRecipeLocations,
  setRecipeEnabled,
  spec,
} from "./factory.js"
import { one, powerRepresentation, Rational, zero } from "./math.js"
import {
  Building,
  Module,
  type ModuleDropdownCell,
  type ModuleDropdownOption,
  moduleDropdown,
  moduleRows,
  ModuleSpec,
  Planet,
  RocketSilo,
  type RocketLaunchStats,
} from "./models.js"
import { addInputs, Icon, makeDropdown, makePopover, type IconObject } from "./presentation.js"
import { DisabledRecipe, getRecipeSelectorGroups, Item, Recipe, type RecipeSelectorGroup } from "./recipes.js"
import { refreshRecipeSettings } from "./settings.js"
import { toggleIgnoreHandler, usesLegacyCalculation } from "./state.js"
import { formatSettings } from "./url-state.js"
import type { SolverItem, SolverRecipe, Totals } from "./solver.js"
import { getAssignedLocation, getCompatibleLocations as getPlanningLocations, getLogistics } from "./planning.js"

import { type FactoryRecipe, getRecipeGroups, isFactoryRecipe, isItem, topoSort } from "./results/grouping.js"
import { getFactorySummary } from "./results/summary.js"

type AnySelection<TDatum = unknown> = Selection<BaseType, TDatum, BaseType, unknown>
export { getRecipeGroups, topoSort } from "./results/grouping.js"
export { getFactorySummary } from "./results/summary.js"
export type { FactorySummary } from "./results/summary.js"

function requireNode<TNode extends Node>(node: TNode | null, label: string): TNode {
  if (node === null) throw new Error(`Unable to create ${label}`)
  return node
}

function getMapValue<TKey, TValue>(map: ReadonlyMap<TKey, TValue>, key: TKey): TValue | undefined {
  return map.get(key)
}

// -----------------------------------------------------------------------------
// Row recipe selector
// -----------------------------------------------------------------------------

let openItemKey: string | null = null
let dismissHandlerInstalled = false
const recipeSelectorInstances = new Set<Instance>()

function closeAll(except: Instance | null = null): void {
  if (except === null) {
    openItemKey = null
  }
  for (let instance of recipeSelectorInstances) {
    if (instance !== except) {
      instance.hide()
    }
  }
}

function installDismissHandler(): void {
  if (dismissHandlerInstalled) {
    return
  }
  dismissHandlerInstalled = true
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll()
    }
  })
}

interface RecipeSelectorRow {
  readonly item: Item
  readonly recipe: Recipe
}

export function makeRecipeSelector(row: RecipeSelectorRow): HTMLElement | null {
  const recipes = getItemProductionRecipes(row.item)
  if (recipes.length === 0) return null

  installDismissHandler()
  const details = create("details").classed("recipe-selector", true).property("open", false)
  const summary = details
    .append("summary")
    .attr("data-tooltip", `Enable or disable recipes for ${row.item.name}.`)
    .attr("aria-label", `Enable or disable recipes for ${row.item.name}.`)
    .on("click", (event: Event) => event.preventDefault())
  summary.append(() => row.item.icon.make(32, true))

  let menu: ReturnType<typeof create> | null = null
  const ensureMenu = (instance: Instance): void => {
    if (menu !== null) {
      instance.setContent(requireNode(menu.node(), "recipe selector menu"))
      return
    }
    menu = create("div").classed("recipe-selector-menu", true)
    menu.append("div").classed("recipe-selector-title", true).text(`Recipes for ${row.item.name}`)
    const groups = menu
      .selectAll<HTMLElement, RecipeSelectorGroup>("section.recipe-selector-group")
      .data(getRecipeSelectorGroups(recipes, row.recipe), (entry: RecipeSelectorGroup) => entry.key)
      .join("section")
      .classed("recipe-selector-group", true)
    groups
      .append("div")
      .classed("recipe-selector-group-title", true)
      .text((entry: RecipeSelectorGroup) => entry.name)
    const options = groups
      .selectAll<HTMLLabelElement, Recipe>("label")
      .data((entry: RecipeSelectorGroup) => entry.recipes)
      .join("label")
      .classed("recipe-selector-option", true)
      .classed("active", (recipe: Recipe) => recipe === row.recipe)
    options
      .append("input")
      .attr("type", "checkbox")
      .property("checked", (recipe: Recipe) => !spec.disable.has(recipe))
      .on("change", (event: Event, recipe: Recipe) => {
        event.stopPropagation()
        const target = event.target
        if (!(target instanceof HTMLInputElement)) return
        openItemKey = row.item.key
        setRecipeEnabled(spec, recipe, target.checked)
        refreshRecipeSettings(spec)
        spec.updateSolution()
      })
    options.append((recipe: Recipe) => recipe.icon.make(32))
    options.append("span").text((recipe: Recipe) => {
      const recipeDetails: string[] = []
      if (!recipe.time.isZero()) recipeDetails.push(`${recipe.time.toDecimal()} s`)
      if (spec.selectedPlanets.size > 0) {
        const count = getRecipeLocations(spec, recipe, spec.getBuilding(recipe)).length
        recipeDetails.push(`${count} selected location${count === 1 ? "" : "s"}`)
      }
      return recipeDetails.length > 0 ? `${recipe.name} — ${recipeDetails.join(", ")}` : recipe.name
    })
    instance.setContent(requireNode(menu.node(), "recipe selector menu"))
  }

  const detailsNode = requireNode(details.node(), "recipe selector")
  const instance = makePopover(detailsNode, " ", {
    appendTo: () => document.body,
    arrow: false,
    offset: [0, 8],
    placement: "right-start",
    showOnCreate: openItemKey === row.item.key,
    theme: "factorio-menu",
    onShow(instance) {
      ensureMenu(instance)
      closeAll(instance)
      openItemKey = row.item.key
      details.property("open", true)
    },
    onHide() {
      details.property("open", false)
      if (document.body.contains(detailsNode) && openItemKey === row.item.key) openItemKey = null
    },
    onDestroy(instance) {
      recipeSelectorInstances.delete(instance)
    },
  })
  recipeSelectorInstances.add(instance)
  return detailsNode
}

let machineSelectorCount = 0

interface MachineOption {
  readonly building: Building | null
  readonly displayBuilding: Building
  readonly label: string
}

interface MachineSelectorRow {
  readonly recipe: Recipe
  readonly building: Building
}

function makeMachineSelector(row: MachineSelectorRow, compatibleBuildings: readonly Building[]): HTMLElement {
  const automaticBuilding = spec.getAutomaticBuilding(row.recipe) ?? row.building
  const override = spec.getBuildingOverride(row.recipe)
  const label = (building: Building): string => {
    const details: string[] = []
    if (!building.speed.isZero()) details.push(`speed ${building.speed.toDecimal()}`)
    details.push(`${building.moduleSlots} module slot${building.moduleSlots === 1 ? "" : "s"}`)
    return `${building.name} — ${details.join(", ")}`
  }
  const options: MachineOption[] = [
    { building: null, displayBuilding: automaticBuilding, label: `Automatic (${label(automaticBuilding)})` },
    ...compatibleBuildings.map((building) => ({ building, displayBuilding: building, label: label(building) })),
  ]

  const root = create("span")
    .classed("machine-selector", true)
    .attr("aria-label", `Choose a machine for ${row.recipe.name}`)
  const choices = makeDropdown(root)
    .classed("machine-dropdown", true)
    .selectAll<HTMLDivElement, MachineOption>("div")
    .data(options)
    .join("div")
    .classed("machine-option", true)
  const labels = addInputs<MachineOption>(
    choices,
    `machine-selector-${machineSelectorCount++}`,
    (option) => option.building === override,
    (option) => {
      if (spec.setBuildingOverride(row.recipe, option.building)) spec.updateSolution()
    },
  )
  labels.append(function (option: MachineOption) {
    const icon = option.displayBuilding.icon.make(32, true)
    icon.removeAttribute("title")
    return icon
  })
  labels
    .append("span")
    .classed("machine-option-name", true)
    .text((option: MachineOption) => option.label)
  return requireNode(root.node(), "machine selector")
}

// -----------------------------------------------------------------------------
// Results table
// -----------------------------------------------------------------------------

export { powerRepresentation as powerRepr } from "./math.js"

function alignPower(value: Rational): string {
  if (value.isZero()) return "0 W"
  const { power, suffix } = powerRepresentation(value)
  return `${spec.format.alignCount(power)} ${suffix}`
}

type HeaderAlignment = "left" | "right" | "center"

class Header {
  constructor(
    readonly text: string,
    readonly colspan: number,
    readonly surplus = false,
    readonly title: string | null = null,
    readonly icon: Icon | null = null,
    readonly align: HeaderAlignment = "right",
  ) {}
}

function setLength<TValue>(values: TValue[], length: number, createValue: () => TValue): void {
  if (values.length > length) values.length = length
  while (values.length < length) values.push(createValue())
}

class BreakdownRow {
  constructor(
    readonly item: Item,
    readonly recipe: Recipe,
    readonly rate: Rational,
    readonly building: Building | null,
    readonly count: Rational | null,
    readonly percent: string | null = null,
    readonly divider = false,
  ) {}
}

function getBreakdown(item: Item, totals: Totals): BreakdownRow[] {
  const rows: BreakdownRow[] = []
  let found = false
  for (const recipe of item.recipes) {
    if (!totals.rates.has(recipe)) continue
    for (const ingredient of recipe.getIngredients()) {
      if (!isItem(ingredient.item)) continue
      const rate = totals.consumers.get(ingredient.item)?.get(recipe)
      if (rate === undefined) continue
      let building: Building | null = null
      let count: Rational | null = null
      const producers = totals.producers.get(ingredient.item)
      if (producers?.size === 1) {
        const producer = producers.keys().next().value
        if (producer instanceof Recipe) {
          const recipeRate = rate.div(producer.gives(ingredient.item))
          building = spec.getBuilding(producer)
          count = spec.getCount(producer, recipeRate)
        }
      }
      rows.push(new BreakdownRow(ingredient.item, recipe, rate, building, count))
      found = true
    }
  }

  const producers = totals.producers.get(item)
  const singleProducer = producers?.size === 1 ? producers.keys().next().value : undefined
  const singleRecipe = singleProducer instanceof Recipe ? singleProducer : null
  const amount = singleRecipe?.gives(item) ?? null
  const building = singleRecipe === null ? null : spec.getBuilding(singleRecipe)
  const itemConsumers = totals.consumers.get(item)
  const itemTotal = totals.items.get(item)
  if (itemConsumers === undefined || itemTotal === undefined || itemTotal.isZero()) return rows
  const hundred = Rational.from_float(100)
  for (const [consumer, rate] of itemConsumers) {
    if (!(consumer instanceof Recipe)) continue
    let count: Rational | null = null
    if (singleRecipe !== null && amount !== null) count = spec.getCount(singleRecipe, rate.div(amount))
    const percent = rate.div(itemTotal).mul(hundred)
    const percentText = percent.less(one) ? "<1%" : `${percent.toDecimal(0)}%`
    rows.push(new BreakdownRow(item, consumer, rate, building, count, percentText, found))
    found = false
  }
  return rows
}

class ModuleInput implements ModuleDropdownOption {
  private slot: ModuleSlot | null = null
  module: Module | null = null

  get cell(): ModuleSlot {
    if (this.slot === null) throw new Error("Module input is not attached to a slot")
    return this.slot
  }

  checked(): boolean {
    const cell = this.cell
    return cell.moduleSpec.getModule(cell.index) === this.module
  }

  choose(): void {
    const cell = this.cell
    const toUpdate = [cell.index]
    if (cell.index === 0) {
      const modules = cell.moduleSpec.modules
      const oldModule = modules[cell.index]
      for (let index = 1; index < modules.length; index++) {
        if (modules[index] === oldModule) toUpdate.push(index)
      }
    }
    let needsRecalculation = false
    for (const index of toUpdate) {
      needsRecalculation = cell.moduleSpec.setModule(index, this.module) || needsRecalculation
    }
    if (needsRecalculation || spec.isFactoryTarget(cell.moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
  }

  setData(slot: ModuleSlot, module: Module | null): void {
    this.slot = slot
    this.module = module
  }
}

let slotCount = 0

class ModuleSlot implements ModuleDropdownCell {
  readonly name = `moduleslot-${slotCount++}`
  moduleSpec: ModuleSpec
  index = 0
  readonly inputRows: ModuleInput[][] = []

  constructor(
    readonly group: DisplayGroup,
    readonly row: DisplayRow,
    moduleSpec: ModuleSpec,
  ) {
    this.moduleSpec = moduleSpec
    setLength(this.inputRows, moduleRows.length, () => [])
  }

  setData(moduleSpec: ModuleSpec, index: number): void {
    this.moduleSpec = moduleSpec
    this.index = index
    for (let rowIndex = 0; rowIndex < this.inputRows.length; rowIndex++) {
      const inputRow = this.inputRows[rowIndex]
      const modules = moduleRows[rowIndex]
      if (inputRow === undefined || modules === undefined) continue
      let inputIndex = 0
      for (const module of modules) {
        if (module !== null && !module.canUse(moduleSpec.recipe, moduleSpec.building)) continue
        const input = inputRow[inputIndex] ?? new ModuleInput()
        if (inputRow[inputIndex] === undefined) inputRow.push(input)
        input.setData(this, module)
        inputIndex++
      }
      inputRow.length = inputIndex
    }
  }
}

class BeaconInput implements ModuleDropdownOption {
  constructor(
    readonly cell: BeaconCell,
    readonly module: Module | null,
  ) {}

  checked(): boolean {
    return this.module === this.cell.row.moduleSpec?.beaconModules[this.cell.index]
  }

  choose(): void {
    const moduleSpec = this.cell.row.moduleSpec
    if (moduleSpec === null) return
    const toUpdate = [this.cell.index]
    if (this.cell.index === 0 && moduleSpec.beaconModules[0] === moduleSpec.beaconModules[1]) toUpdate.push(1)
    for (const index of toUpdate) moduleSpec.setBeaconModule(this.module, index)
    if (spec.isFactoryTarget(moduleSpec.recipe)) spec.updateSolution()
    else spec.display()
  }
}

let beaconCount = 0

class BeaconCell implements ModuleDropdownCell {
  readonly name = `beaconslot-${beaconCount++}`
  readonly inputRows: BeaconInput[][] = []

  constructor(
    readonly row: DisplayRow,
    readonly index: number,
  ) {}

  setData(moduleSpec: ModuleSpec | null): void {
    this.inputRows.length = 0
    if (moduleSpec === null) return
    for (const modules of moduleRows) {
      const inputRow = modules
        .filter(
          (module) => module === null || (module.canBeacon() && module.canUse(moduleSpec.recipe, moduleSpec.building)),
        )
        .map((module) => new BeaconInput(this, module))
      if (inputRow.length > 0) this.inputRows.push(inputRow)
    }
  }
}

class DisplayRow {
  item: Item | null = null
  recipe: FactoryRecipe | null = null
  building: Building | null = null
  moduleSpec: ModuleSpec | null = null
  single = false
  breakdown: BreakdownRow[] | null = null
  readonly slots: ModuleSlot[] = []
  readonly beaconModules: BeaconCell[] = [new BeaconCell(this, 0), new BeaconCell(this, 1)]

  setData(
    item: Item | null,
    recipe: FactoryRecipe | null,
    building: Building | null,
    moduleSpec: ModuleSpec | null,
    single: boolean,
    breakdown: BreakdownRow[] | null,
  ): void {
    this.item = item
    this.recipe = recipe
    this.building = building
    this.moduleSpec = moduleSpec
    this.single = single
    this.breakdown = breakdown
    for (const beaconCell of this.beaconModules) beaconCell.setData(moduleSpec)
  }
}

class DisplayGroup {
  readonly rows: DisplayRow[] = []

  setData(totals: Totals, itemValues: Iterable<Item>, recipeValues: Iterable<FactoryRecipe>): void {
    const items = [...itemValues]
    const recipes = [...recipeValues]
    if (items.length === 0) {
      this.rows.length = 0
      return
    }
    const length = Math.max(items.length, recipes.length)
    setLength(this.rows, length, () => new DisplayRow())
    for (let index = 0; index < length; index++) {
      const row = this.rows[index]
      if (row === undefined) continue
      const item = items[index] ?? null
      const recipe = recipes[index] ?? null
      let building: Building | null = null
      let moduleSpec: ModuleSpec | null = null
      if (recipe instanceof Recipe) {
        building = spec.getBuilding(recipe)
        if (building?.canBeacon()) moduleSpec = spec.getModuleSpec(recipe)
      }
      const moduleSlotCount = moduleSpec?.modules.length ?? 0
      setLength(row.slots, moduleSlotCount, () => {
        if (moduleSpec === null) throw new Error("Cannot create a module slot without a module specification")
        return new ModuleSlot(this, row, moduleSpec)
      })
      if (moduleSpec !== null) {
        for (let slotIndex = 0; slotIndex < moduleSlotCount; slotIndex++)
          row.slots[slotIndex]?.setData(moduleSpec, slotIndex)
      }
      const single = item !== null && recipe !== null && item.key === recipe.key
      row.setData(item, recipe, building, moduleSpec, single, item === null ? null : getBreakdown(item, totals))
    }
  }
}

export function resetDisplay(): void {
  selectAll("table#totals > tbody").remove()
  displayGroups = []
}

let displayGroups: DisplayGroup[] = []

function getDisplayGroups(totals: Totals): void {
  const recipes = [...totals.rates.keys()].filter(isFactoryRecipe).reverse()
  const groups = topoSort(getRecipeGroups(new Set(recipes)))
  setLength(displayGroups, groups.length, () => new DisplayGroup())
  groups.forEach((group, index) => {
    const items = new Set<Item>()
    for (const recipe of group) {
      for (const product of recipe.products) {
        if (isItem(product.item) && totals.items.has(product.item)) items.add(product.item)
      }
    }
    displayGroups[index]?.setData(totals, items, group)
  })
}

function toggleBreakdownHandler(this: Element): void {
  const row = this.parentElement
  const breakdownRow = row?.nextElementSibling
  if (row === null || breakdownRow === null || breakdownRow === undefined) return
  if (row.classList.contains("breakdown-open")) {
    row.classList.remove("breakdown-open")
    breakdownRow.classList.remove("breakdown-open")
  } else {
    row.classList.add("breakdown-open")
    breakdownRow.classList.add("breakdown-open")
  }
}

class ItemIcon implements IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon
  private readonly extra = create("span")

  constructor(readonly item: Item) {
    this.name = item.name
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }

  setText(text: string): void {
    this.extra.text(text)
  }

  renderTooltip(): HTMLElement {
    return this.item.renderTooltip(requireNode(this.extra.node(), "item status"))
  }
}

// All this pipe stuff is legacy code, irrelevant as of 2.0, but we might as
// well keep it around for legacy datasets.

// For pipe segment of the given length, returns maximum throughput as fluid/s.
function pipeThroughput(length: Rational): Rational {
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
function pipeLength(throughput: Rational): Rational | null {
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

function pipeValues(rate: Rational): { pipes: Rational; length: Rational } {
  let pipes = rate.div(maxPipeThroughput).ceil()
  let perPipeRate = rate.div(pipes)
  const maximumLength = pipeLength(perPipeRate)
  const length = maximumLength?.floor() ?? zero
  return { pipes: pipes, length: length }
}

function pipeText(rate: Rational): string {
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

class PipeIcon implements IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon

  constructor() {
    const item = spec.items.get("pipe")
    if (item === undefined) throw new Error("Missing pipe item")
    this.name = item.name
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
}

function requirePlanets(specification: FactorySpecification): ReadonlyMap<string, Planet> {
  if (specification.planets === null) throw new Error("Planet data is not initialized")
  return specification.planets
}

function requireItemRate(map: ReadonlyMap<SolverItem, Rational>, item: Item, label: string): Rational {
  const rate = map.get(item)
  if (rate === undefined) throw new Error(`Missing ${label} rate for ${item.key}`)
  return rate
}

function requireRecipeRate(map: ReadonlyMap<SolverRecipe, Rational>, recipe: FactoryRecipe, label: string): Rational {
  const rate = map.get(recipe)
  if (rate === undefined) throw new Error(`Missing ${label} rate for ${recipe.key}`)
  return rate
}

function requireRowItem(row: DisplayRow): Item {
  if (row.item === null) throw new Error("Display row has no item")
  return row.item
}

function requireRowRecipe(row: DisplayRow): Recipe {
  if (!(row.recipe instanceof Recipe)) throw new Error("Display row has no concrete recipe")
  return row.recipe
}

function requireRowBuilding(row: DisplayRow): Building {
  if (row.building === null) throw new Error("Display row has no building")
  return row.building
}

function requireRowModuleSpec(row: DisplayRow): ModuleSpec {
  if (row.moduleSpec === null) throw new Error("Display row has no module specification")
  return row.moduleSpec
}

function makeLocationSelector(row: DisplayRow): HTMLSelectElement {
  const recipe = requireRowRecipe(row)
  const building = row.building
  const compatible = getPlanningLocations(spec, recipe, building)
  const configured = spec.recipeLocations.get(recipe) ?? null
  const assigned = configured !== null && compatible.includes(configured) ? configured : null
  const automatic = getAssignedLocation(spec, recipe, building)
  const planets = requirePlanets(spec)
  const selector = create("select")
    .classed("recipe-location-selector", true)
    .attr("aria-label", `Choose production location for ${recipe.name}`)
    .on("change", (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLSelectElement)) return
      const location = target.value === "" ? null : (planets.get(target.value) ?? null)
      spec.setRecipeLocation(recipe, location)
      spec.updateSolution()
    })
  selector
    .append("option")
    .attr("value", "")
    .property("selected", assigned === null)
    .text(`Automatic (${automatic?.name ?? "unavailable"})`)
  selector
    .selectAll<HTMLOptionElement, Planet>("option.location")
    .data(compatible)
    .join("option")
    .classed("location", true)
    .attr("value", (location: Planet) => location.key)
    .property("selected", (location: Planet) => location === assigned)
    .text((location: Planet) => location.name)
  return requireNode(selector.node() as HTMLSelectElement | null, "location selector")
}

function formatLocationNames(locations: readonly Planet[]): string {
  return locations.map((location) => location.name).join(" / ")
}

function getLocationCellText(
  specification: FactorySpecification,
  recipe: FactoryRecipe | null,
  building: Building | null,
): string {
  if (!(recipe instanceof Recipe) || !recipe.isReal()) return ""
  const locations = getRecipeLocations(specification, recipe, building)
  if (locations.length === 0) return "Unavailable"
  if (locations.length === specification.selectedPlanets.size && locations.length > 2) return "Any selected"
  if (locations.length > 2) return `${locations.length} locations`
  return formatLocationNames(locations)
}

function getRocketStatsForRow(row: DisplayRow): RocketLaunchStats | null {
  if (!(row.recipe instanceof Recipe) || row.recipe.key !== "rocket-part") return null
  return row.building instanceof RocketSilo ? row.building.getLaunchStats(spec) : null
}

function isLaunchLimitedRow(row: DisplayRow): boolean {
  return getRocketStatsForRow(row)?.launchLimited ?? false
}

interface SummaryCard {
  readonly label: string
  readonly value: string
}

function renderFactorySummary(specification: FactorySpecification, totals: Totals): void {
  const summary = getFactorySummary(specification, totals)
  const root = select<HTMLElement, unknown>("#factory_summary").property("hidden", false)
  const totalPower = summary.electricalPower.add(summary.planning.beaconPower)
  const { power, suffix } = powerRepresentation(totalPower)
  const cards: SummaryCard[] = [
    { label: "Active recipes", value: String(summary.recipeCount) },
    { label: "Machines to place", value: summary.placedMachines.toDecimal(0) },
    { label: "Electric + beacon power", value: `${specification.format.count(power)} ${suffix}` },
  ]
  if (!summary.planning.pollution.isZero())
    cards.push({ label: "Pollution / min", value: specification.format.count(summary.planning.pollution) })
  if (!summary.planning.spores.isZero())
    cards.push({ label: "Spores / min", value: specification.format.count(summary.planning.spores) })
  if (summary.planning.rocket !== null) {
    cards.push({
      label: `Rocket launches / ${specification.format.rateName}`,
      value: specification.format.rate(summary.planning.rocket.launches),
    })
  }
  if (!summary.planning.aquiloHeat.isZero()) {
    const heat = powerRepresentation(summary.planning.aquiloHeat)
    cards.push({ label: "Aquilo heat", value: `${specification.format.count(heat.power)} ${heat.suffix}` })
  }
  if (summary.planning.transport.length > 0)
    cards.push({ label: "Cross-location flows", value: String(summary.planning.transport.length) })
  if (summary.importedItems.length > 0)
    cards.push({ label: "Imported items", value: String(summary.importedItems.length) })
  const lowest = summary.planning.freshness[0]
  if (lowest !== undefined) {
    cards.push({
      label: "Lowest freshness",
      value: `${(lowest.remaining.toFloat() * 100).toFixed(1)}% · ${lowest.item.name}`,
    })
  }
  for (const [fuel, rate] of [...summary.fuelRates].sort(([fuelA], [fuelB]) => fuelA.name.localeCompare(fuelB.name))) {
    cards.push({
      label: `${fuel.name} / ${specification.format.rateName}`,
      value: specification.format.rate(rate),
    })
  }
  const card = root
    .selectAll<HTMLDivElement, SummaryCard>("div.factory-summary-card")
    .data(cards, (entry: SummaryCard) => entry.label)
    .join("div")
    .classed("factory-summary-card", true)
  card
    .selectAll<HTMLDivElement, SummaryCard>("div.factory-summary-value")
    .data((entry: SummaryCard) => [entry])
    .join("div")
    .classed("factory-summary-value", true)
    .text((entry: SummaryCard) => entry.value)
  card
    .selectAll<HTMLDivElement, SummaryCard>("div.factory-summary-label")
    .data((entry: SummaryCard) => [entry])
    .join("div")
    .classed("factory-summary-label", true)
    .text((entry: SummaryCard) => entry.label)

  const warnings: string[] = []
  if (summary.planning.rocket?.launchLimited) {
    const rocket = summary.planning.rocket
    warnings.push(
      `Rocket silo launch-limited at ${specification.format.rate(rocket.animationLaunchRate)} launches/${specification.format.rateName} per silo; more speed will not increase throughput.`,
    )
  }
  for (const target of summary.planning.qualityTargets) {
    warnings.push(
      `${target.tier} ${target.item.name}: ${(target.probability.toFloat() * 100).toFixed(3)}% yield; ${specification.format.rate(target.totalProduction)}/${specification.format.rateName} total production required.`,
    )
  }
  if (summary.qualityRecipeCount > 0 && summary.planning.qualityTargets.length === 0) {
    warnings.push("Quality modules selected; choose a target quality to include its yield.")
  }
  const expired = summary.planning.freshness.filter((row) => row.expired)
  if (expired.length > 0)
    warnings.push(`Fully spoiled after the configured delay: ${expired.map((row) => row.item.name).join(", ")}.`)
  const agriculturalScience = summary.planning.freshness.find((row) => row.item.key === "agricultural-science-pack")
  if (agriculturalScience !== undefined && !specification.freshnessDelayMinutes.isZero()) {
    warnings.push(
      `Agricultural science after ${specification.freshnessDelayMinutes.toDecimal()} min: ${(agriculturalScience.remaining.toFloat() * 100).toFixed(1)}% effective.`,
    )
  }
  for (const row of summary.planning.asteroidConstraints.filter((entry) => entry.exceeded)) {
    warnings.push(
      `${row.item.name} cap exceeded: ${specification.format.rate(row.required)} required vs ${specification.format.rate(row.limit)} available/${specification.format.rateName}.`,
    )
  }
  if (!summary.planning.aquiloHeat.isZero())
    warnings.push("Aquilo heat excludes belts, pipes, inserters, pumps, tanks, and other logistics entities.")

  root
    .selectAll<HTMLDivElement, string>("div.factory-summary-warning")
    .data(warnings)
    .join("div")
    .classed("factory-summary-warning", true)
    .text((warning: string) => warning)
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null
  const code = error.code
  return typeof code === "string" ? code : null
}

export function displayCalculationError(_specification: FactorySpecification, error: unknown): void {
  const code = getErrorCode(error)
  const rawMessage = error instanceof Error ? error.message : String(error)
  let message = "The current settings could not produce a complete factory."
  let title = "Unable to calculate this factory"
  let guidance = "Check the target values, selected recipes, machines, locations, and resource priorities."

  if (code === "missing-recipe") {
    message = rawMessage
    guidance =
      "Choose a compatible production location above, enable a recipe in Settings, choose another recipe, or click the item icon in the Factory table to treat that item as imported."
  } else if (code === "infeasible") {
    message = "This combination of recipes and resource priorities cannot produce every requested output."
    guidance =
      "Review alternate recipes and resource priorities. A cyclic or multi-output chain may require at least one additional recipe or imported input."
  } else if (
    /cannot produce .* output with the current quality settings|No recipe is available to produce/i.test(rawMessage)
  ) {
    message = rawMessage
  } else if (/integer|number|denominator|divide|invalid/i.test(rawMessage)) {
    title = "Invalid numeric value"
    message = "One of the entered values is not a valid number."
    guidance = "Use a whole number, decimal, or fraction such as 60, 2.5, or 1/3."
  }

  const root = select<HTMLElement, unknown>("#calculation_error").property("hidden", false)
  root.select(".calculation-error-title").text(title)
  root.select(".calculation-error-message").text(message)
  root.select(".calculation-error-guidance").text(guidance)
  select("#factory_summary").property("hidden", true)
  select("table#totals").property("hidden", true)
}

export function displayItems(spec: FactorySpecification, totals: Totals): void {
  const belt = spec.belt
  if (belt === null) throw new Error("Belt data is not initialized")

  select("#calculation_error").property("hidden", true)
  select("table#totals").property("hidden", false)
  renderFactorySummary(spec, totals)
  const showLocations = spec.selectedPlanets.size > 1
  const showSurplus = totals.surplus.size > 0
  const headers: Header[] = [
    new Header("Item", 2, false, null, null, "left"),
    new Header(`Rate / ${spec.format.rateName}`, 1, false, null, null, "right"),
    ...(showSurplus ? [new Header(`Surplus / ${spec.format.rateName}`, 1, true, null, null, "right")] : []),
    new Header("Belts", 1, false, `Equivalent ${belt.name} belts at the selected rate`, belt.icon, "right"),
    new Header("Machines", 2, false, null, null, "center"),
    ...(showLocations ? [new Header("Location", 1, false, null, null, "left")] : []),
    new Header("Modules", 1, false, null, null, "left"),
    new Header("Beacons", 1, false, null, null, "left"),
    new Header("Power", 1, false, null, null, "right"),
    new Header("", 1, false, null, null, "center"),
  ]
  const totalCols = headers.reduce((sum, header) => sum + header.colspan, 0)

  const table = select<HTMLTableElement, unknown>("table#totals")
  table.classed("nosurplus", totals.surplus.size === 0)

  const headerRow = table
    .selectAll<HTMLTableRowElement, unknown>("thead tr")
    .classed("factory-header", true)
    .selectAll<HTMLTableCellElement, Header>("th")
    .data(headers)
  headerRow.exit().remove()
  const headerCell = headerRow
    .join("th")
    .classed("surplus", (header: Header) => header.surplus)
    .classed("align-left", (header: Header) => header.align === "left")
    .classed("align-center", (header: Header) => header.align === "center")
    .classed("align-right", (header: Header) => header.align === "right")
    .attr("colspan", (header: Header) => header.colspan)
    .attr("data-tooltip", (header: Header) => header.title)
  headerCell.each(function (this: Element, header: Header) {
    const cell = select(this)
    cell.selectAll("*").remove()
    const icon = header.icon
    if (icon !== null) cell.append(() => icon.make(18)).classed("header-icon", true)
    cell.append("span").text(header.text)
  })

  getDisplayGroups(totals)
  const rowGroup = table
    .selectAll<HTMLTableSectionElement, DisplayGroup>("tbody")
    .data(displayGroups)
    .join("tbody")
    .classed("display-group", true)
    .classed("multi", (group: DisplayGroup) => group.rows.length > 1)
  rowGroup.selectAll("tr.breakdown").remove()

  const displayRows = rowGroup
    .selectAll<HTMLTableRowElement, DisplayRow>("tr.display-row")
    .data<DisplayRow>((group: DisplayGroup) => group.rows)
    .join((enter) => {
      const rows = enter.append("tr").classed("display-row", true)

      rows
        .append("td")
        .classed("item", true)
        .on("click", function (this: Element) {
          toggleBreakdownHandler.call(this)
        })
        .append("svg")
        .classed("breakdown-arrow", true)
        .attr("viewBox", "0 0 16 16")
        .attr("width", 16)
        .attr("height", 16)
        .append("use")
        .attr("href", "images/icons.svg#right")

      const itemCell = rows.append("td").classed("item item-identity", true)
      const itemToggle = itemCell.append("button").classed("item-import-toggle", true).attr("type", "button")
      itemToggle.append("span").classed("item-icon", true)
      itemToggle.append("span").classed("item-name", true)
      itemToggle.append("span").classed("item-state", true)

      rows.append("td").classed("item right-align", true).append("tt").classed("item-rate", true)
      rows.append("td").classed("item surplus right-align", true).append("tt").classed("surplus-rate", true)
      rows
        .append("td")
        .classed("item right-align logistics-cell pad-right", true)
        .append("tt")
        .classed("belt-count", true)

      rows.append("td").classed("pad building building-icon leftmost right-align", true)
      rows.append("td").classed("right-align building", true).append("tt").classed("building-count", true)
      rows.append("td").classed("location-cell", true)
      rows.append("td").classed("pad building module module-cell", true)

      const beaconCell = rows.append("td").classed("pad building module beacon", true)
      const beaconControls = beaconCell.append("span").classed("beacon-controls", true)
      beaconControls.append("span").classed("beacon-container", true)
      const beaconCountSpan = beaconControls.append("span").classed("beacon-count", true)
      beaconCountSpan.append("span").text(" \u00d7 ")
      beaconCountSpan
        .append("input")
        .attr("type", "text")
        .attr("size", 3)
        .on("change", function (this: Element, event: Event, row: DisplayRow) {
          const target = event.target
          if (!(target instanceof HTMLInputElement)) return
          const moduleSpec = requireRowModuleSpec(row)
          const recipe = requireRowRecipe(row)
          moduleSpec.setBeaconCount(Rational.from_string(target.value))
          if (spec.isFactoryTarget(recipe)) spec.updateSolution()
          else spec.display()
        })

      const powerCell = rows.append("td").classed("right-align building power-cell", true)
      powerCell.append("span").classed("fuel-icon", true)
      powerCell.append("tt").classed("power", true)

      rows
        .append("td")
        .classed("popout pad item", true)
        .append("a")
        .attr("target", "_blank")
        .attr("data-tooltip", "Open this item as a separate plan.")
        .append("svg")
        .classed("popout", true)
        .attr("viewBox", "0 0 24 24")
        .attr("width", 24)
        .attr("height", 24)
        .append("use")
        .attr("href", "images/icons.svg#popout")

      return rows
    })
    .classed("nobuilding", (row: DisplayRow) => row.building === null)
    .classed("nomodule", (row: DisplayRow) => row.moduleSpec === null)
    .classed("noitem", (row: DisplayRow) => row.item === null)
    .classed(
      "target-output",
      (row: DisplayRow) => row.item !== null && spec.buildTargets.some((target) => target.item === row.item),
    )
    .classed("imported-output", (row: DisplayRow) => row.item !== null && spec.ignore.has(row.item))
    .classed("launch-limited", (row: DisplayRow) => isLaunchLimitedRow(row))

  const locationCell = displayRows
    .selectAll<HTMLTableCellElement, DisplayRow>("td.location-cell")
    .classed("hide", !showLocations)
  locationCell.selectAll("*").remove()
  locationCell
    .filter((row: DisplayRow) => row.recipe instanceof Recipe && row.recipe.isReal())
    .append((row: DisplayRow) => makeLocationSelector(row))
  locationCell
    .filter((row: DisplayRow) => !(row.recipe instanceof Recipe) || !row.recipe.isReal())
    .text((row: DisplayRow) => getLocationCellText(spec, row.recipe, row.building))

  const itemRows = displayRows.filter((row: DisplayRow) => row.item !== null)
  const itemToggle = itemRows
    .selectAll<HTMLButtonElement, DisplayRow>("button.item-import-toggle")
    .classed("imported", (row: DisplayRow) => spec.ignore.has(requireRowItem(row)))
    .attr("data-tooltip", (row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.ignore.has(item) ? `Produce ${item.name} in this plan` : `Treat ${item.name} as imported`
    })
    .attr("aria-label", (row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.ignore.has(item) ? `Produce ${item.name} in this plan` : `Treat ${item.name} as imported`
    })
    .on("click", (event: Event, row: DisplayRow) => toggleIgnoreHandler(event, { item: requireRowItem(row) }))
  const itemIcon = itemToggle.select<HTMLSpanElement>("span.item-icon")
  itemIcon.selectAll("img").remove()
  itemIcon
    .append((row: DisplayRow) => {
      const item = requireRowItem(row)
      const icon = new ItemIcon(item)
      icon.setText(spec.ignore.has(item) ? "Imported." : "Produced in this plan.")
      return icon.icon.make(32)
    })
    .classed("ignore", (row: DisplayRow) => spec.ignore.has(requireRowItem(row)))
  itemToggle.select<HTMLSpanElement>("span.item-name").text((row: DisplayRow) => requireRowItem(row).name)
  itemToggle.select<HTMLSpanElement>("span.item-state").text((row: DisplayRow) => {
    const item = requireRowItem(row)
    const labels: string[] = []
    if (spec.buildTargets.some((target) => target.item === item)) labels.push("target")
    if (spec.ignore.has(item)) labels.push("imported")
    if (isLaunchLimitedRow(row)) labels.push("launch-limited")
    return labels.join(" · ")
  })
  itemRows.selectAll<HTMLElement, DisplayRow>("tt.item-rate").text((row: DisplayRow) => {
    const item = requireRowItem(row)
    const rate = requireItemRate(totals.items, item, "item")
    const surplus = totals.surplus.get(item) ?? zero
    return spec.format.alignRate(rate.sub(surplus))
  })
  itemRows
    .selectAll<HTMLElement, DisplayRow>("tt.surplus-rate")
    .text((row: DisplayRow) => spec.format.alignRate(totals.surplus.get(requireRowItem(row)) ?? zero))

  const beltRows = itemRows.filter((row: DisplayRow) => requireRowItem(row).phase === "solid")
  beltRows
    .selectAll<HTMLTableCellElement, DisplayRow>("td.logistics-cell")
    .attr("data-tooltip", (row: DisplayRow) => {
      const item = requireRowItem(row)
      const rate = requireItemRate(totals.items, item, "item")
      const logistics = getLogistics(item, rate, spec)
      if (logistics === null) throw new Error(`Missing solid logistics report for ${item.key}`)
      return `Equivalent ${belt.name} belts at stack height ${spec.beltStackSize.toDecimal()}. ${spec.format.rate(logistics.stackRate)} stacks/${spec.format.rateName}; ${logistics.bufferSlots.toDecimal(0)} slots for a ${spec.bufferMinutes.toDecimal()} minute buffer; ${spec.format.count(logistics.wagonLoads)} cargo wagons/${spec.format.rateName}.`
    })
    .selectAll<HTMLElement, DisplayRow>("tt.belt-count")
    .text((row: DisplayRow) => {
      const item = requireRowItem(row)
      return spec.format.alignCount(spec.getBeltCount(requireItemRate(totals.items, item, "item")))
    })

  const pipeRows = itemRows.filter((row: DisplayRow) => requireRowItem(row).phase === "fluid")
  pipeRows
    .selectAll<HTMLTableCellElement, DisplayRow>("td.logistics-cell")
    .attr("data-tooltip", usesLegacyCalculation() ? "Legacy maximum pipe length" : null)
    .selectAll<HTMLElement, DisplayRow>("tt.belt-count")
    .text((row: DisplayRow) => pipeText(requireItemRate(totals.items, requireRowItem(row), "item")))

  const itemBuildingCell = itemRows.selectAll<HTMLTableCellElement, DisplayRow>("td.building-icon")
  itemBuildingCell.selectAll("*").remove()
  itemBuildingCell
    .filter(
      (row: DisplayRow) => getItemProductionRecipes(requireRowItem(row)).length > 0 && row.recipe instanceof Recipe,
    )
    .append((row: DisplayRow) => {
      const selector = makeRecipeSelector({ item: requireRowItem(row), recipe: requireRowRecipe(row) })
      return requireNode(selector, "recipe selector")
    })

  displayRows.selectAll("td.building-icon > :not(.recipe-selector)").remove()
  const buildingRows = displayRows.filter((row: DisplayRow) => row.building !== null && row.recipe instanceof Recipe)
  const buildingCell = buildingRows.selectAll<HTMLTableCellElement, DisplayRow>("td.building-icon")
  buildingCell.append((row: DisplayRow) => {
    const recipe = requireRowRecipe(row)
    const building = requireRowBuilding(row)
    const compatibleBuildings = spec.getCompatibleBuildings(recipe)
    if (compatibleBuildings.length <= 1) return building.icon.make(32)
    return makeMachineSelector({ recipe, building }, compatibleBuildings)
  })
  buildingCell.append("span").text(" \u00d7")
  buildingRows
    .selectAll<HTMLElement, DisplayRow>("tt.building-count")
    .attr("data-tooltip", (row: DisplayRow) => {
      const rocket = getRocketStatsForRow(row)
      if (rocket === null) return null
      const limit = `${spec.format.rate(rocket.animationLaunchRate)} launches/${spec.format.rateName} per silo`
      return rocket.launchLimited
        ? `Normal-quality launch animation limit: ${limit}. More speed does not increase steady-state throughput; productivity still reduces required crafts.`
        : `Maximum normal-quality buffered launch rate: ${limit}. Current rocket-part crafting is slower than the launch animation.`
    })
    .text((row: DisplayRow) => {
      const recipe = requireRowRecipe(row)
      return spec.format.alignCount(spec.getCount(recipe, requireRecipeRate(totals.rates, recipe, "recipe")))
    })

  const moduleRowsSelection = displayRows.filter((row: DisplayRow) => row.moduleSpec !== null)
  const moduleCell = moduleRowsSelection.selectAll<HTMLTableCellElement, DisplayRow>("td.module-cell")
  moduleCell.selectAll("*").remove()
  moduleRowsSelection.selectAll("span.beacon-container").selectAll("*").remove()
  moduleDropdown(moduleCell, (row: DisplayRow) => row.slots)
  moduleDropdown(
    moduleRowsSelection.selectAll<HTMLSpanElement, DisplayRow>("span.beacon-container"),
    (row: DisplayRow) => row.beaconModules,
  )
  moduleRowsSelection
    .selectAll<HTMLInputElement, DisplayRow>("span.beacon-count input")
    .attr("value", (row: DisplayRow) => spec.format.count(requireRowModuleSpec(row).beaconCount))

  const fuelRows = buildingRows.filter((row: DisplayRow) => requireRowBuilding(row).fuel !== null)
  const fuelIcon = fuelRows.selectAll<HTMLSpanElement, DisplayRow>(".fuel-icon")
  fuelIcon.selectAll("*").remove()
  fuelIcon.append((row: DisplayRow) => {
    const fuel = spec.getFuelForRecipe(requireRowRecipe(row))
    if (fuel === null) throw new Error(`Missing fuel for ${requireRowRecipe(row).key}`)
    return fuel.icon.make(24)
  })
  fuelIcon.append("span").text(" × ")
  fuelRows.selectAll<HTMLElement, DisplayRow>("tt.power").text((row: DisplayRow) => {
    const recipe = requireRowRecipe(row)
    const rate = requireRecipeRate(totals.rates, recipe, "recipe")
    const { power } = spec.getPowerUsage(recipe, rate)
    const recipeFuel = spec.getFuelForRecipe(recipe)
    if (recipeFuel === null) throw new Error(`Missing fuel for ${recipe.key}`)
    return `${spec.format.alignRate(power.div(recipeFuel.value))}/${spec.format.rateName}`
  })

  const electricRows = buildingRows.filter((row: DisplayRow) => requireRowBuilding(row).fuel === null)
  electricRows.selectAll(".fuel-icon").selectAll("*").remove()
  electricRows.selectAll<HTMLElement, DisplayRow>("tt.power").text((row: DisplayRow) => {
    const recipe = requireRowRecipe(row)
    const rate = requireRecipeRate(totals.rates, recipe, "recipe")
    return alignPower(spec.getPowerUsage(recipe, rate).power)
  })
  refreshRecipeSettings(spec)

  itemRows.selectAll<HTMLAnchorElement, DisplayRow>("td.popout a").attr("href", (row: DisplayRow) => {
    const item = requireRowItem(row)
    const rate = requireItemRate(totals.items, item, "item")
    const rates: readonly (readonly [Item, Rational])[] = [[item, rate]]
    return `#${formatSettings(true, "totals", rates)}`
  })

  const rowsWithBreakdowns = displayRows.filter((row: DisplayRow) => row.breakdown !== null)
  const breakdownContainers = rowsWithBreakdowns
    .select<HTMLTableRowElement>(function (this: Element) {
      const breakdown = document.createElement("tr")
      this.parentElement?.insertBefore(breakdown, this.nextSibling)
      return breakdown
    })
    .classed("breakdown", true)
    .classed("breakdown-open", function (this: Element) {
      return this.previousElementSibling?.classList.contains("breakdown-open") ?? false
    })
  breakdownContainers.append("td")
  const breakdownRows = breakdownContainers
    .append("td")
    .attr("colspan", totalCols - 1)
    .append("table")
    .selectAll<HTMLTableRowElement, BreakdownRow>("tr")
    .data<BreakdownRow>((row: DisplayRow) => row.breakdown ?? [])
    .join("tr")
    .classed("breakdown-row", true)
    .classed("breakdown-first-output", (row: BreakdownRow) => row.divider)

  const breakdownIcons = breakdownRows.append("td")
  breakdownIcons.append((row: BreakdownRow) => row.recipe.icon.make(32)).classed("item-icon", true)
  breakdownIcons
    .append("svg")
    .classed("usage-arrow", true)
    .attr("viewBox", "0 0 18 16")
    .attr("width", 18)
    .attr("height", 16)
    .append("use")
    .attr("href", "images/icons.svg#rightarrow")
  breakdownIcons.append((row: BreakdownRow) => row.item.icon.make(32)).classed("item-icon", true)
  breakdownRows
    .append("td")
    .classed("right-align", true)
    .append("tt")
    .classed("item-rate pad-right", true)
    .text((row: BreakdownRow) => spec.format.alignRate(row.rate))

  const breakdownBeltRows = breakdownRows.filter((row: BreakdownRow) => row.item.phase === "solid")
  const breakdownBeltCell = breakdownBeltRows.append("td")
  breakdownBeltCell.append(() => belt.icon.make(32))
  breakdownBeltCell.append("span").text(" \u00d7")
  breakdownBeltRows
    .append("td")
    .classed("right-align", true)
    .append("tt")
    .classed("belt-count pad-right", true)
    .text((row: BreakdownRow) => spec.format.alignCount(row.rate.div(belt.rate)))

  const breakdownPipeRows = breakdownRows.filter((row: BreakdownRow) => row.item.phase === "fluid")
  breakdownPipeRows.append("td").append(() => new PipeIcon().icon.make(32))
  breakdownPipeRows.append("td")

  const breakdownBuildingCell = breakdownRows
    .append("td")
    .filter((row: BreakdownRow) => row.building !== null)
    .classed("building", true)
  breakdownBuildingCell.append((row: BreakdownRow) => {
    if (row.building === null) throw new Error("Breakdown row has no building")
    return row.building.icon.make(32)
  })
  breakdownBuildingCell.append("span").text(" \u00d7")
  breakdownRows
    .append("td")
    .filter((row: BreakdownRow) => row.count !== null)
    .classed("building pad-right", true)
    .append("tt")
    .text((row: BreakdownRow) => {
      if (row.count === null) throw new Error("Breakdown row has no machine count")
      return spec.format.alignCount(row.count)
    })
  breakdownRows
    .append("td")
    .filter((row: BreakdownRow) => row.percent !== null)
    .classed("right-align", true)
    .append("tt")
    .text((row: BreakdownRow) => row.percent ?? "")
}

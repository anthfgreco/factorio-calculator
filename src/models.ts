import { create, select, type BaseType, type Selection } from "d3"
import { sorted, type CalculatorData, type SurfaceCondition as SurfaceConditionData } from "./data.js"
import { Formatter, half, one, powerRepresentation, Rational, zero } from "./math.js"
import { addInputs, Icon, makeDropdown, sprites } from "./presentation.js"
import type { Item, Recipe } from "./recipes.js"

// -----------------------------------------------------------------------------
// Runtime context
// -----------------------------------------------------------------------------

export interface ModelFactorySpecification {
  readonly items: Map<string, Item>
  readonly recipes: Map<string, Recipe>
  readonly format: Formatter
  readonly miningProd: Rational
  readonly defaultBeacon: readonly (Module | null)[]
  readonly defaultBeaconCount: Rational
  getBuilding(recipe: Recipe): Building | null
  getModuleSpec(recipe: Recipe): ModuleSpec | null
  getDefaultModule(recipe: Recipe, building: Building): Module | null
  getResourceYield(recipe: Recipe): Rational
  getFuelForRecipe(recipe: Recipe): Fuel | null
  getRecipeRate(recipe: Recipe): Rational | null
  getPowerUsage(recipe: Recipe, rate: Rational): { readonly fuel: string | null; readonly power: Rational }
  getProdEffect(recipe: Recipe): Rational
  notifyRecipeConfigurationChanged(recipe: Recipe): void
  recordRecipeConfigurationChange(recipe: Recipe): void
}

export interface ModelRuntimeContext {
  getSpecification(): ModelFactorySpecification
  useLegacyCalculation(): boolean
}

export type ConfigurationSource = "default" | "automatic-quality" | "user"

let context: ModelRuntimeContext | null = null

export function configureModelRuntime(nextContext: ModelRuntimeContext): void {
  context = nextContext
}

export function currentSpecification(): ModelFactorySpecification {
  if (context === null) {
    throw new Error("Model runtime has not been configured")
  }
  return context.getSpecification()
}

export function usesLegacyCalculation(): boolean {
  return context?.useLegacyCalculation() ?? false
}

export { getRecipeProductivityResearch } from "./models/productivity-research.js"
export type { RecipeProductivityResearch } from "./models/productivity-research.js"

export { getItemGroups } from "./models/item-groups.js"
export type { ItemGroups } from "./models/item-groups.js"

// -----------------------------------------------------------------------------
// Belts
// -----------------------------------------------------------------------------

export class Belt {
  readonly icon: Icon
  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly rate: Rational,
  ) {
    this.icon = new Icon(this)
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    t.append("b").text(`Max throughput: `)
    t.append("span").text(`${spec.format.rate(this.rate)}/${spec.format.longRate}`)
    return requireElement(t.node(), "tooltip")
  }
}

export function getBelts(data: CalculatorData): Map<string, Belt> {
  const beltObjs: Belt[] = []
  for (let beltInfo of data.belts) {
    // Belt speed is given in tiles/tick, which we can convert to
    // items/second as follows:
    //       tiles      ticks              32 pixels/tile
    // speed ----- * 60 ------ * 2 lanes * --------------
    //       tick       second             8 pixels/item
    let baseSpeed = Rational.from_float_approximate(beltInfo.speed)
    let speed = baseSpeed.mul(Rational.from_float(480))
    beltObjs.push(new Belt(beltInfo.key, beltInfo.localized_name.en, beltInfo.icon_col, beltInfo.icon_row, speed))
  }
  beltObjs.sort(function (a, b) {
    if (a.rate.less(b.rate)) {
      return -1
    } else if (b.rate.less(a.rate)) {
      return 1
    }
    return 0
  })
  const belts = new Map<string, Belt>()
  for (let belt of beltObjs) {
    belts.set(belt.key, belt)
  }
  return belts
}

// -----------------------------------------------------------------------------
// Fuels
// -----------------------------------------------------------------------------

const energySuffixes = ["J", "kJ", "MJ", "GJ", "TJ", "PJ"] as const

export class Fuel {
  readonly icon: Icon
  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly item: Item,
    readonly category: string,
    readonly value: Rational,
  ) {
    this.icon = new Icon(this)
  }
  valueString(): string {
    let x = this.value
    let thousand = Rational.from_float(1000)
    let i = 0
    while (thousand.less(x) && i < energySuffixes.length - 1) {
      x = x.div(thousand)
      i++
    }
    return x.toUpDecimal(0) + " " + energySuffixes[i]
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    t.append("b").text("Energy: ")
    t.append("span").text(self.valueString())
    return requireElement(t.node(), "tooltip")
  }
}

export class FuelCollection extends Map<string, Fuel> {
  readonly categories: Map<string, Fuel[]>

  constructor(categories: Map<string, Fuel[]>) {
    super()
    this.categories = categories
    for (let fuel of categories.get("chemical") ?? []) {
      this.set(fuel.key, fuel)
    }
  }

  getForCategory(category: string, selectedChemicalFuel: Fuel | null = null): Fuel | null {
    if (category === "chemical" && selectedChemicalFuel !== null) {
      return selectedChemicalFuel
    }
    return this.categories.get(category)?.[0] ?? null
  }
}

export function getFuel(data: CalculatorData, items: ReadonlyMap<string, Item>): FuelCollection {
  const fuelCategories = new Map<string, Fuel[]>()
  for (let d of data.fuel) {
    const item = requireItem(items, d.item_key)
    let fuel = new Fuel(
      d.item_key,
      item.name,
      item.icon_col,
      item.icon_row,
      item,
      d.category,
      Rational.from_float_approximate(d.value),
    )
    let f = fuelCategories.get(fuel.category)
    if (f === undefined) {
      f = []
      fuelCategories.set(fuel.category, f)
    }
    f.push(fuel)
  }
  for (const category of fuelCategories.values()) {
    category.sort(function (a, b) {
      if (a.value.less(b.value)) {
        return -1
      } else if (b.value.less(a.value)) {
        return 1
      }
      return 0
    })
  }
  return new FuelCollection(fuelCategories)
}

// -----------------------------------------------------------------------------
// Buildings
// -----------------------------------------------------------------------------

let thirty = Rational.from_float(30)

export class Building {
  readonly categories: Set<string>
  readonly conditions: readonly SurfaceConditionData[]
  readonly emissions: Readonly<Record<string, Rational>>
  readonly allowedEffects: Set<string> | null
  readonly icon: Icon

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    categories: readonly string[],
    readonly speed: Rational,
    readonly prodBonus: Rational,
    readonly moduleSlots: number,
    readonly power: Rational,
    readonly fuel: string | null,
    conditions: readonly SurfaceConditionData[] = [],
    allowedEffects: readonly string[] | Readonly<Record<string, boolean>> | null = null,
    emissions: Readonly<Record<string, number>> | null = null,
    readonly dropsFullBeltStacks = false,
  ) {
    this.categories = new Set(categories)
    this.conditions = conditions
    this.emissions = Object.fromEntries(
      Object.entries(emissions ?? {}).map(([pollutant, value]) => [pollutant, Rational.from_float_approximate(value)]),
    )
    this.allowedEffects =
      allowedEffects === null
        ? null
        : new Set(
            Array.isArray(allowedEffects)
              ? allowedEffects
              : Object.entries(allowedEffects)
                  .filter(([, enabled]) => enabled)
                  .map(([effect]) => effect),
          )
    this.icon = new Icon(this)
  }
  less(other: Building): boolean {
    if (!this.speed.equal(other.speed)) {
      return this.speed.less(other.speed)
    }
    return this.moduleSlots < other.moduleSlots
  }
  canCraft(recipe: Recipe): boolean {
    for (let category of recipe.categories) {
      if (this.categories.has(category)) {
        return true
      }
    }
    return false
  }
  allowedOn(location: Planet): boolean {
    return location.allowsConditions(this.conditions)
  }
  allowsModule(module: Module | null): boolean {
    if (module === null || this.allowedEffects === null) {
      return true
    }
    for (let effect of module.requiredEffectTypes()) {
      if (!this.allowedEffects.has(effect)) {
        return false
      }
    }
    return true
  }
  getCount(spec: ModelFactorySpecification, recipe: Recipe, rate: Rational): Rational {
    return rate.div(this.getRecipeRate(spec, recipe))
  }
  getRecipeRate(spec: ModelFactorySpecification, recipe: Recipe): Rational {
    let modules = spec.getModuleSpec(recipe)
    let speedEffect
    if (modules) {
      speedEffect = modules.speedEffect()
    } else {
      speedEffect = one
    }
    return recipe.time.reciprocate().mul(this.speed).mul(speedEffect)
  }
  canBeacon(): boolean {
    return this.moduleSlots > 0
  }
  prodEffect(_spec: ModelFactorySpecification): Rational {
    return this.prodBonus
  }
  drain(): Rational {
    return this.power.div(thirty)
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line = t.append("div")
    line.append("b").text("Energy consumption: ")
    let { power, suffix } = powerRepresentation(this.power)
    line.append("span").text(`${power.toDecimal(0)} ${suffix}`)
    line = t.append("div")
    line.append("b").text("Crafting speed: ")
    line.append("span").text(this.speed.toDecimal())
    line = t.append("div")
    line.append("b").text("Module slots: ")
    line.append("span").text(String(this.moduleSlots))
    return requireElement(t.node(), "tooltip")
  }
}

export class Miner extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    categories: readonly string[],
    readonly miningSpeed: Rational,
    moduleSlots: number,
    power: Rational,
    fuel: string | null,
    conditions: readonly SurfaceConditionData[] = [],
    allowedEffects: readonly string[] | null = null,
    emissions: Readonly<Record<string, number>> | null = null,
    dropsFullBeltStacks = false,
  ) {
    super(
      key,
      name,
      col,
      row,
      categories,
      zero,
      zero,
      moduleSlots,
      power,
      fuel,
      conditions,
      allowedEffects,
      emissions,
      dropsFullBeltStacks,
    )
  }
  override less(other: Building): boolean {
    return other instanceof Miner ? this.miningSpeed.less(other.miningSpeed) : super.less(other)
  }
  override drain(): Rational {
    return zero
  }
  override getRecipeRate(spec: ModelFactorySpecification, recipe: Recipe): Rational {
    let modules = spec.getModuleSpec(recipe)
    let speedEffect
    if (modules) {
      speedEffect = modules.speedEffect()
    } else {
      speedEffect = one
    }
    const miningTime = recipe.miningTime
    if (miningTime === undefined) {
      throw new Error(`Mining recipe ${recipe.key} is missing mining_time`)
    }
    let rate = this.miningSpeed.div(miningTime).mul(speedEffect)
    if (recipe.categories.has("basic-fluid")) {
      rate = rate.mul(spec.getResourceYield(recipe))
    }
    return rate
  }
  override prodEffect(spec: ModelFactorySpecification): Rational {
    return spec.miningProd
  }
  override renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line = t.append("div")
    line.append("b").text("Energy consumption: ")
    let { power, suffix } = powerRepresentation(this.power)
    line.append("span").text(`${power.toDecimal(0)} ${suffix}`)
    line = t.append("div")
    line.append("b").text("Mining speed: ")
    line.append("span").text(this.miningSpeed.toDecimal())
    line = t.append("div")
    line.append("b").text("Module slots: ")
    line.append("span").text(String(this.moduleSlots))
    return requireElement(t.node(), "tooltip")
  }
}

export class OffshorePump extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    readonly pumpingSpeed: Rational,
    conditions: readonly SurfaceConditionData[] = [],
  ) {
    super(key, name, col, row, ["offshore-pumping"], zero, zero, 0, zero, null, conditions)
  }
  override less(other: Building): boolean {
    return other instanceof OffshorePump ? this.pumpingSpeed.less(other.pumpingSpeed) : super.less(other)
  }
  override getRecipeRate(_spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return this.pumpingSpeed
  }
  override renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line = t.append("div")
    line.append("b").text("Pumping speed: ")
    line.append("span").text(`${spec.format.rate(this.pumpingSpeed)}/${spec.format.rateName}`)
    return requireElement(t.node(), "tooltip")
  }
}

let rocketLaunchDuration = Rational.from_floats(2434, 60)

export interface RocketLaunchConfiguration {
  readonly partsPerLaunch: Rational
  readonly launchCycle: Rational
  readonly buffered: boolean
}

export interface RocketLaunchStats {
  readonly part: Rational
  readonly launch: Rational
  readonly partsPerLaunch: Rational
  readonly craftsPerLaunch: Rational
  readonly craftingRate: Rational
  readonly effectivePartsPerCraft: Rational
  readonly craftingLaunchRate: Rational
  readonly animationLaunchRate: Rational
  readonly launchLimited: boolean
  readonly buffered: boolean
}

function getRocketLaunchStats(
  spec: ModelFactorySpecification,
  launchConfig: RocketLaunchConfiguration | null = null,
): RocketLaunchStats {
  const partRecipe = requireRecipe(spec.recipes, "rocket-part")
  const partFactory = spec.getBuilding(partRecipe)
  if (partFactory === null) throw new Error("Rocket-part recipe has no compatible silo")
  const partItem = requireItem(spec.items, "rocket-part")
  // gives() already includes module and researched recipe productivity.
  let effectivePartsPerCraft = partRecipe.gives(partItem)
  // The base rate at which the silo can complete rocket-part crafts.
  let craftingRate = Building.prototype.getRecipeRate.call(partFactory, spec, partRecipe)
  // Productivity reduces the number of recipe crafts required to fill a rocket.
  let partsPerLaunch = launchConfig?.partsPerLaunch ?? Rational.from_float(100)
  let craftsPerLaunch = partsPerLaunch.div(effectivePartsPerCraft)

  if (launchConfig?.buffered) {
    let craftingLaunchRate = craftingRate.div(craftsPerLaunch)
    let animationLaunchRate = launchConfig.launchCycle.reciprocate()
    let launchRate = Rational.min(craftingLaunchRate, animationLaunchRate)
    return {
      part: launchRate.mul(craftsPerLaunch),
      launch: launchRate,
      partsPerLaunch,
      craftsPerLaunch,
      craftingRate,
      effectivePartsPerCraft,
      craftingLaunchRate,
      animationLaunchRate,
      launchLimited: !craftingLaunchRate.less(animationLaunchRate),
      buffered: true,
    }
  }

  // Legacy datasets model the original serial build + animation cycle.
  let time = craftsPerLaunch.div(craftingRate).add(rocketLaunchDuration)
  let launchRate = time.reciprocate()
  return {
    part: craftsPerLaunch.div(time),
    launch: launchRate,
    partsPerLaunch,
    craftsPerLaunch,
    craftingRate,
    effectivePartsPerCraft,
    craftingLaunchRate: launchRate,
    animationLaunchRate: rocketLaunchDuration.reciprocate(),
    launchLimited: false,
    buffered: false,
  }
}

export class RocketLaunch extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    categories: readonly string[],
    speed: Rational,
    prodBonus: Rational,
    moduleSlots: number,
    power: Rational,
    fuel: string | null,
    readonly launchConfig: RocketLaunchConfiguration | null,
  ) {
    super(key, name, col, row, categories, speed, prodBonus, moduleSlots, power, fuel)
  }
  override getRecipeRate(spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return getRocketLaunchStats(spec, this.launchConfig).launch
  }
}

export class RocketSilo extends Building {
  constructor(
    key: string,
    name: string,
    col: number,
    row: number,
    categories: readonly string[],
    speed: Rational,
    prodBonus: Rational,
    moduleSlots: number,
    power: Rational,
    fuel: string | null,
    conditions: readonly SurfaceConditionData[],
    allowedEffects: readonly string[] | null,
    emissions: Readonly<Record<string, number>> | null,
    readonly launchConfig: RocketLaunchConfiguration | null,
  ) {
    super(
      key,
      name,
      col,
      row,
      categories,
      speed,
      prodBonus,
      moduleSlots,
      power,
      fuel,
      conditions,
      allowedEffects,
      emissions,
    )
  }
  override getRecipeRate(spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return getRocketLaunchStats(spec, this.launchConfig).part
  }
  getLaunchStats(spec: ModelFactorySpecification): RocketLaunchStats {
    return getRocketLaunchStats(spec, this.launchConfig)
  }
}

function renderTooltipBase(this: Building): HTMLElement {
  let self = this
  let t = create("div").classed("frame", true)
  let header = t.append("h3")
  header.append(() => self.icon.make(32, true))
  header.append("span").text(self.name)
  return requireElement(t.node(), "tooltip")
}

export function getBuildings(data: CalculatorData, items: ReadonlyMap<string, Item>): Building[] {
  const buildings: Building[] = []
  let launchConfig = data.rocket_launch
    ? {
        partsPerLaunch: Rational.from_float_approximate(data.rocket_launch.parts_per_launch),
        launchCycle: Rational.from_floats(data.rocket_launch.launch_cycle_ticks, 60),
        buffered: data.rocket_launch.buffered,
      }
    : null
  const reactorDef = requireItem(items, "nuclear-reactor")
  let reactor = new Building(
    "nuclear-reactor",
    reactorDef.name,
    reactorDef.icon_col,
    reactorDef.icon_row,
    ["nuclear"],
    one,
    zero,
    0,
    zero,
    null,
  )
  reactor.renderTooltip = renderTooltipBase
  buildings.push(reactor)
  const boilerItem = requireItem(items, "boiler")
  const boilerDef = data.boilers.find((entry) => entry.key === "boiler")
  if (boilerDef === undefined) throw new Error("Dataset is missing the base boiler")
  let boiler_energy = Rational.from_float(boilerDef.energy_consumption)
  let boiler = new Building(
    "boiler",
    boilerItem.name,
    boilerItem.icon_col,
    boilerItem.icon_row,
    ["boiler"],
    one,
    zero,
    0,
    boiler_energy,
    "chemical",
    //boilerDef.target_temperature,
  )
  boiler.renderTooltip = renderTooltipBase
  buildings.push(boiler)
  const siloDef = requireItem(items, "rocket-silo")
  let launch = new RocketLaunch(
    "rocket-silo",
    siloDef.name,
    siloDef.icon_col,
    siloDef.icon_row,
    ["rocket-launch"],
    one,
    zero,
    0,
    zero,
    null,
    launchConfig,
  )
  launch.renderTooltip = renderTooltipBase
  buildings.push(launch)
  for (let d of data.crafting_machines) {
    const fuel = d.energy_source?.type === "burner" ? (d.energy_source.fuel_category ?? null) : null
    let prod = zero
    if (d.prod_bonus) {
      prod = Rational.from_float_approximate(d.prod_bonus)
    }
    buildings.push(
      new Building(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.crafting_categories ?? [],
        Rational.from_float_approximate(d.crafting_speed ?? 1),
        prod,
        d.module_slots ?? 0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        fuel,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
        d.energy_source?.emissions_per_minute ?? null,
        d.drops_full_belt_stacks ?? false,
      ),
    )
  }
  for (let d of data.rocket_silo ?? []) {
    buildings.push(
      new RocketSilo(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.crafting_categories ?? [],
        Rational.from_float_approximate(d.crafting_speed ?? 1),
        zero,
        d.module_slots ?? 0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        null,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
        d.energy_source?.emissions_per_minute ?? null,
        launchConfig,
      ),
    )
  }
  for (let d of data.offshore_pumps ?? []) {
    // Pumping speed is given in units/tick.
    let speed = Rational.from_float_approximate(d.pumping_speed).mul(Rational.from_float(60))
    buildings.push(
      new OffshorePump(d.key, d.localized_name.en, d.icon_col, d.icon_row, speed, d.surface_conditions ?? []),
    )
  }
  for (let d of data.mining_drills) {
    const fuel = d.energy_source?.type === "burner" ? (d.energy_source.fuel_category ?? null) : null
    buildings.push(
      new Miner(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.resource_categories,
        Rational.from_float_approximate(d.mining_speed),
        d.module_slots ?? 0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        fuel,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
        d.energy_source?.emissions_per_minute ?? null,
        d.drops_full_belt_stacks ?? false,
      ),
    )
  }
  for (let d of data.agricultural_tower ?? []) {
    buildings.push(
      new Building(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        ["agriculture"],
        Rational.from_float(47),
        zero,
        0,
        Rational.from_float_approximate(d.energy_usage ?? 0),
        null,
        d.surface_conditions ?? [],
        d.allowed_effects ?? [],
        d.energy_source?.emissions_per_minute ?? null,
      ),
    )
  }
  return buildings
}

// -----------------------------------------------------------------------------
// Modules and beacons
// -----------------------------------------------------------------------------

let hundred = Rational.from_float(100)
function percent(x: Rational): string {
  let sign = ""
  if (!x.less(zero)) {
    sign = "+"
  }
  return `${sign}${x.mul(hundred).toDecimal()}%`
}

export class Module {
  readonly effectTypes = new Set<string>()
  readonly icon: Icon

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly category: string | undefined,
    readonly order: string,
    readonly productivity: Rational,
    readonly quality: Rational,
    readonly speed: Rational,
    readonly power: Rational,
    readonly pollution: Rational,
  ) {
    // Pollution is retained in the dataset but does not affect production rates.
    if (!power.isZero()) {
      this.effectTypes.add("consumption")
    }
    if (!speed.isZero()) {
      this.effectTypes.add("speed")
    }
    if (!productivity.isZero()) {
      this.effectTypes.add("productivity")
    }
    if (!quality.isZero() || category === "quality") {
      this.effectTypes.add("quality")
    }
    if (!pollution.isZero()) {
      this.effectTypes.add("pollution")
    }

    this.icon = new Icon(this)
  }
  // This naming scheme is some older cruft, which works in the vanilla
  // dataset, but it's possible other datasets would render it unworkable.
  shortName(): string {
    return `${this.key.at(0) ?? ""}${this.key.at(-1) ?? ""}`
  }
  requiredEffectTypes(): Set<string> {
    const effects = new Set<string>(this.effectTypes)
    // Speed modules reduce quality in Factorio 2.1, but that penalty does not
    // require a machine or beacon to advertise support for positive quality.
    if (this.quality.less(zero)) {
      effects.delete("quality")
    }
    return effects
  }
  canUse(recipe: Recipe, building: Building | null = null): boolean {
    if (building !== null && !building.allowsModule(this)) {
      return false
    }
    if (this.hasProdEffect() && !recipe.allow_productivity) {
      return false
    }
    if ((this.category === "quality" || zero.less(this.quality)) && recipe.allow_quality === false) {
      return false
    }
    return true
  }
  canBeacon(): boolean {
    for (let effect of this.requiredEffectTypes()) {
      if (!beaconAllowedEffects.has(effect)) {
        return false
      }
    }
    return true
  }
  hasProdEffect(): boolean {
    return !this.productivity.isZero()
  }
  hasQualityEffect(): boolean {
    return !this.quality.isZero() || this.category === "quality"
  }
  renderTooltip(): HTMLElement {
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append("span").text(self.name)
    let line
    if (!this.power.isZero()) {
      line = t.append("div")
      line.append("b").text("Energy consumption: ")
      line.append("span").text(percent(this.power))
    }
    if (!this.speed.isZero()) {
      line = t.append("div")
      line.append("b").text("Speed: ")
      line.append("span").text(percent(this.speed))
    }
    if (!this.productivity.isZero()) {
      line = t.append("div")
      line.append("b").text("Productivity: ")
      line.append("span").text(percent(this.productivity))
    }
    if (!this.quality.isZero()) {
      line = t.append("div")
      line.append("b").text("Quality: ")
      line.append("span").text(percent(this.quality))
    }
    if (!this.pollution.isZero()) {
      line = t.append("div")
      line.append("b").text("Pollution: ")
      line.append("span").text(percent(this.pollution))
    }
    return requireElement(t.node(), "tooltip")
  }
}

export interface ModuleDropdownOption {
  readonly cell: { readonly name: string }
  readonly module: Module | null
  checked(): boolean
  choose(): void
}

export interface ModuleDropdownCell {
  readonly inputRows: readonly (readonly ModuleDropdownOption[])[]
}

export function moduleDropdown<GElement extends Element, TDatum, PElement extends BaseType, PDatum>(
  selector: Selection<GElement, TDatum, PElement, PDatum>,
  data:
    | readonly ModuleDropdownCell[]
    | ((datum: TDatum, index: number, groups: GElement[]) => readonly ModuleDropdownCell[]),
): void {
  selector.each(function (datum, index, groups) {
    const cells = typeof data === "function" ? data(datum, index, Array.from(groups)) : data
    renderModuleDropdown(this, cells)
  })
}

function renderModuleDropdown(element: Element, data: readonly ModuleDropdownCell[]): void {
  const selector = select(element)
  let moduleDropdownSpan = selector
    .selectAll<HTMLSpanElement, ModuleDropdownCell>("span.module-wrapper")
    .data(data)
    .join((enter) => {
      const wrappers = enter.append("span").classed("module-wrapper", true)
      wrappers.each(function (this: Element) {
        makeDropdown(select(this))
      })
      return wrappers
    })
  let moduleDropdown = moduleDropdownSpan.selectAll<HTMLDivElement, ModuleDropdownCell>("div.dropdown")
  moduleDropdown
    .selectAll<HTMLDivElement, readonly ModuleDropdownOption[]>("div.moduleRow")
    .data<readonly ModuleDropdownOption[]>((cell) => cell.inputRows)
    .join("div")
    .classed("moduleRow", true)
    .selectAll<HTMLSpanElement, ModuleDropdownOption>("span.input")
    .data<ModuleDropdownOption>((options) => options)
    .join(
      (enter) => {
        const inputs = enter.append("span").classed("input", true)
        const label = addInputs(
          inputs,
          (option) => option.cell.name,
          (option) => option.checked(),
          (option) => option.choose(),
        )
        label.append(function (this: Element, option: ModuleDropdownOption) {
          if (option.module === null) {
            const sprite = sprites.get("slot_icon_module")
            if (sprite === undefined) {
              throw new Error("Missing slot_icon_module sprite")
            }
            return sprite.icon.make(32)
          }
          const tooltipTarget = this.parentElement?.parentElement?.parentElement ?? undefined
          return option.module.icon.make(32, false, tooltipTarget)
        })
        return inputs
      },
      (update) => {
        update
          .selectAll<HTMLInputElement, ModuleDropdownOption>("input")
          .property("checked", (option: ModuleDropdownOption) => option.checked())
        return update
      },
    )
}

const MIN_SPEED_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POWER_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POLLUTION_EFFECT = Rational.from_floats(1, 5) // 20%

// ModuleSpec represents the set of modules (including beacons) configured for
// a given recipe.
export class ModuleSpec {
  building: Building | null = null
  readonly modules: (Module | null)[] = []
  moduleSource: ConfigurationSource = "default"
  readonly beaconModules: (Module | null)[]
  beaconCount: Rational

  constructor(
    readonly recipe: Recipe,
    readonly owner: ModelFactorySpecification,
  ) {
    this.beaconModules = owner.defaultBeacon.map((module) => (module === null || module.canBeacon() ? module : null))
    this.beaconCount = owner.defaultBeaconCount
  }
  setBuilding(building: Building, spec: ModelFactorySpecification): void {
    this.building = building
    if (this.modules.length > building.moduleSlots) {
      this.modules.length = building.moduleSlots
    }
    let toAdd = spec.getDefaultModule(this.recipe, building)
    for (let i = 0; i < this.modules.length; i++) {
      const module = this.modules[i]
      if (module !== undefined && module !== null && !module.canUse(this.recipe, building)) {
        this.modules[i] = toAdd
      }
    }
    while (this.modules.length < building.moduleSlots) {
      this.modules.push(toAdd)
    }
    for (let i = 0; i < this.beaconModules.length; i++) {
      const module = this.beaconModules[i]
      if (module !== undefined && module !== null && (!module.canBeacon() || !module.canUse(this.recipe, building))) {
        this.beaconModules[i] = null
      }
    }
  }
  getModule(index: number): Module | null | undefined {
    return this.modules[index]
  }
  // Returns true if the module change requires a recalculation.
  setModule(index: number, module: Module | null, source: ConfigurationSource = "user"): boolean {
    if (index >= this.modules.length) {
      return false
    }
    if (module !== null && !module.canUse(this.recipe, this.building)) {
      return false
    }
    let oldModule = this.modules[index]
    const needRecalc = Boolean(
      (oldModule !== undefined && oldModule !== null && (oldModule.hasProdEffect() || oldModule.hasQualityEffect())) ||
      (module !== null && (module.hasProdEffect() || module.hasQualityEffect())),
    )
    this.modules[index] = module
    if (source !== "default") {
      this.moduleSource = source
    }
    if (source === "user") {
      this.owner?.notifyRecipeConfigurationChanged?.(this.recipe)
    } else if (source === "automatic-quality") {
      this.owner?.recordRecipeConfigurationChange?.(this.recipe)
    }
    return needRecalc
  }
  setBeaconModule(module: Module | null, i: number): void {
    this.beaconModules[i] =
      module === null || (module.canBeacon() && module.canUse(this.recipe, this.building)) ? module : null
  }
  setBeaconCount(count: Rational): void {
    this.beaconCount = count
  }

  speedEffect(): Rational {
    let speed = one
    for (let module of this.modules) {
      if (!module) {
        continue
      }
      speed = speed.add(module.speed)
    }
    if (this.modules.length > 0) {
      for (let module of this.beaconModules) {
        if (module === null) {
          continue
        }
        let beacon = module.speed.mul(this.beaconCount).mul(beaconEffect)
        if (!usesLegacyCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        speed = speed.add(beacon)
      }
    }
    return Rational.max(speed, MIN_SPEED_EFFECT)
  }
  prodEffect(spec: ModelFactorySpecification): Rational {
    let prod = one
    for (let module of this.modules) {
      if (!module) {
        continue
      }
      prod = prod.add(module.productivity)
    }
    if (this.building === null) {
      throw new Error(`Module specification for ${this.recipe.key} has no building`)
    }
    prod = prod.add(this.building.prodEffect(spec))
    return prod
  }
  powerEffect(_spec: ModelFactorySpecification): Rational {
    let power = one
    for (let module of this.modules) {
      if (!module) {
        continue
      }
      power = power.add(module.power)
    }
    if (this.modules.length > 0) {
      for (let module of this.beaconModules) {
        if (module === null) {
          continue
        }
        let beacon = module.power.mul(this.beaconCount).mul(beaconEffect)
        if (!usesLegacyCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        power = power.add(beacon)
      }
    }
    return Rational.max(power, MIN_POWER_EFFECT)
  }
  pollutionEffect(): Rational {
    let pollution = one
    for (let module of this.modules) {
      if (module) pollution = pollution.add(module.pollution)
    }
    if (this.modules.length > 0) {
      for (let module of this.beaconModules) {
        if (module === null) continue
        let beacon = module.pollution.mul(this.beaconCount).mul(beaconEffect)
        if (!usesLegacyCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        pollution = pollution.add(beacon)
      }
    }
    return Rational.max(pollution, MIN_POLLUTION_EFFECT)
  }
}

export let moduleRows: (Module | null)[][] = [[null]]
export let shortModules = new Map<string, Module>()

let beaconProfile: Rational[] | null = null
let beaconEffect = one
let beaconAllowedEffects = new Set(["consumption", "speed", "pollution"])

function getBeaconProfileEffect(count: Rational): Rational {
  if (beaconProfile === null || beaconProfile.length === 0) {
    return one
  }
  const index = Math.min(Math.max(count.ceil().toFloat() - 1, 0), beaconProfile.length - 1)
  return beaconProfile[index] ?? one
}

export function getBeaconPower(data: CalculatorData): Rational {
  return Rational.from_float_approximate(data.beacon.energy_usage ?? 0)
}

export function getModules(data: CalculatorData, items: ReadonlyMap<string, Item>): Map<string, Module> {
  const modules = new Map<string, Module>()
  for (let d of data.modules) {
    const item = requireItem(items, d.item_key)
    let effect = d.effect
    let category = d.category
    let order = item.order
    let speed = Rational.from_float_approximate(effect.speed || 0)
    let productivity = Rational.from_float_approximate(effect.productivity || 0)
    let quality = Rational.from_float_approximate(effect.quality || 0)
    let power = Rational.from_float_approximate(effect.consumption || 0)
    let pollution = Rational.from_float_approximate(effect.pollution || 0)
    modules.set(
      d.item_key,
      new Module(
        d.item_key,
        item.name,
        item.icon_col,
        item.icon_row,
        category,
        order,
        productivity,
        quality,
        speed,
        power,
        pollution,
      ),
    )
  }
  let sortedModules = sorted(modules.values(), (m) => m.order)
  moduleRows = [[null]]
  shortModules = new Map<string, Module>()
  let category = null
  for (let module of sortedModules) {
    if (module.category !== category) {
      category = module.category
      moduleRows.push([])
    }
    const currentRow = moduleRows.at(-1)
    if (currentRow === undefined) throw new Error("Module row initialization failed")
    currentRow.push(module)
    let shortName = module.shortName()
    if (shortModules.has(shortName)) {
      // This does not occur in the vanilla data, but let's plan ahead.
      module.shortName = function (): string {
        return this.key
      }
      shortName = module.key
    }
    shortModules.set(shortName, module)
  }
  beaconAllowedEffects = new Set(data.beacon.allowed_effects ?? ["consumption", "speed", "pollution"])
  beaconEffect = Rational.from_float_approximate(data.beacon.distribution_effectivity)
  if (usesLegacyCalculation() || !data.beacon.profile) {
    beaconProfile = null
  } else {
    beaconProfile = []
    for (let x of data.beacon.profile) {
      beaconProfile.push(Rational.from_float_approximate(x))
    }
  }
  return modules
}

// -----------------------------------------------------------------------------
// Planets and surfaces
// -----------------------------------------------------------------------------

export class Planet {
  readonly disable = new Set<Recipe>()
  readonly icon: Icon
  constructor(
    readonly key: string,
    readonly name: string,
    readonly order: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly resources: Set<Recipe>,
    readonly properties: Map<string, number>,
    readonly pollutantType: string | null = null,
  ) {
    this.icon = new Icon(this)
  }
  allowsConditions(conditions: readonly SurfaceConditionData[]): boolean {
    for (let condition of conditions ?? []) {
      let value = this.properties.get(condition.property)
      if (value === undefined) {
        value = defaultProperties.get(condition.property) ?? 0
      }
      let aboveMinimum = true
      let belowMaximum = true
      if (condition.min !== undefined) {
        aboveMinimum = value >= condition.min
      }
      if (condition.max !== undefined) {
        belowMaximum = value <= condition.max
      }
      if (!(aboveMinimum && belowMaximum)) {
        return false
      }
    }
    return true
  }
  allowsRecipe(recipe: Recipe): boolean {
    if (recipe.isResource()) {
      return this.resources.has(recipe)
    }
    return this.allowsConditions(recipe.conditions)
  }
  allowsBuilding(building: Building): boolean {
    return building.allowedOn(this)
  }
  allows(recipe: Recipe, buildings: readonly Building[]): boolean {
    if (!this.allowsRecipe(recipe)) {
      return false
    }
    if (recipe.isResource() || recipe.categories.size === 0) {
      return true
    }
    return buildings.some((building) => building.canCraft(recipe) && this.allowsBuilding(building))
  }
}

let defaultProperties = new Map<string, number>()

const RECYCLING_ROOT_KEYS = new Set(["scrap"])

function traverseRecycling(recipe: Recipe, found: Set<Recipe>): void {
  for (let { item } of recipe.products) {
    for (let subrecipe of item.uses) {
      if (subrecipe.key.endsWith("-recycling")) {
        if (!found.has(subrecipe)) {
          found.add(subrecipe)
          traverseRecycling(subrecipe, found)
        }
      }
    }
  }
}

export function getPlanets(
  data: CalculatorData,
  recipes: ReadonlyMap<string, Recipe>,
  buildings: readonly Building[],
): Map<string, Planet> | null {
  if (!data.planets) {
    // For legacy 1.1 datasets.
    return null
  }
  defaultProperties = new Map<string, number>()
  for (let { name, default_value } of data.surface_properties ?? []) {
    defaultProperties.set(name, default_value)
  }

  const planets = new Map<string, Planet>()
  for (let d of data.planets) {
    const resources = new Set<Recipe>()
    const roots = new Set<Recipe>()
    for (let key of (d.resources.resource ?? []).concat(d.resources.offshore ?? []).concat(d.resources.plants ?? [])) {
      const r = requireRecipe(recipes, key)
      resources.add(r)
      if (RECYCLING_ROOT_KEYS.has(key)) {
        roots.add(r)
      }
    }
    const properties = new Map<string, number>()
    for (let key in d.surface_properties) {
      const value = d.surface_properties[key]
      if (value !== undefined) {
        properties.set(key, value)
      }
    }
    let planet = new Planet(
      d.key,
      d.localized_name.en,
      d.order,
      d.icon_col,
      d.icon_row,
      resources,
      properties,
      d.pollutant_type ?? null,
    )
    for (let recipe of recipes.values()) {
      if (!planet.allows(recipe, buildings) || recipe.key.endsWith("-recycling")) {
        planet.disable.add(recipe)
      }
      if (roots.size > 0) {
        const recycling = new Set<Recipe>()
        for (let root of roots) {
          traverseRecycling(root, recycling)
        }
        for (let recycle of recycling) {
          planet.disable.delete(recycle)
        }
      }
    }
    planets.set(planet.key, planet)
  }
  return planets
}

function requireElement<T extends Element>(element: T | null, label: string): T {
  if (element === null) throw new Error(`Unable to create ${label}`)
  return element
}

function requireItem(items: ReadonlyMap<string, Item>, key: string): Item {
  const item = items.get(key)
  if (item === undefined) throw new Error(`Dataset is missing required item ${key}`)
  return item
}

function requireRecipe(recipes: ReadonlyMap<string, Recipe>, key: string): Recipe {
  const recipe = recipes.get(key)
  if (recipe === undefined) throw new Error(`Dataset is missing required recipe ${key}`)
  return recipe
}

import { sorted } from "./data.js"
import { half, one, powerRepresentation, Rational, zero } from "./math.js"
import { addInputs, Icon, makeDropdown, sprites } from "./presentation.js"

// -----------------------------------------------------------------------------
// Runtime context
// -----------------------------------------------------------------------------

export interface ModelRuntimeContext {
  getSpecification(): any
  useLegacyCalculation(): boolean
}

let context: ModelRuntimeContext | null = null

export function configureModelRuntime(nextContext: ModelRuntimeContext): void {
  context = nextContext
}

export function currentSpecification(): any {
  if (context === null) {
    throw new Error("Model runtime has not been configured")
  }
  return context.getSpecification()
}

export function usesLegacyCalculation(): boolean {
  return context?.useLegacyCalculation() ?? false
}

// -----------------------------------------------------------------------------
// Recipe productivity research
// -----------------------------------------------------------------------------

export function getRecipeProductivityResearch(data, recipes) {
  let result = new Map<string, any>()
  for (let entry of data.recipe_productivity_research ?? []) {
    let effects = new Map<any, Rational>()
    for (let effect of entry.effects) {
      let recipe = recipes.get(effect.recipe)
      if (recipe !== undefined) {
        effects.set(recipe, Rational.from_float_approximate(effect.change))
      }
    }
    let research = {
      key: entry.key,
      name: entry.localized_name.en,
      icon_col: entry.icon_col,
      icon_row: entry.icon_row,
      effects,
      icon: null as Icon | null,
    }
    research.icon = new Icon(research)
    result.set(entry.key, research)
  }
  return result
}

// -----------------------------------------------------------------------------
// Item groups
// -----------------------------------------------------------------------------

// Sorts items into their groups and subgroups. Used chiefly by the target
// dropdown.
export function getItemGroups(items, data) {
  // {groupName: {subgroupName: [item]}}
  let itemGroupMap = new Map()
  for (let [itemKey, item] of items) {
    let group = itemGroupMap.get(item.group)
    if (group === undefined) {
      group = new Map()
      itemGroupMap.set(item.group, group)
    }
    let subgroup = group.get(item.subgroup)
    if (subgroup === undefined) {
      subgroup = []
      group.set(item.subgroup, subgroup)
    }
    subgroup.push(item)
  }
  let itemGroups = []
  let groupNames = sorted(itemGroupMap.keys(), function (k) {
    return data.groups[k].order
  })
  for (let groupName of groupNames) {
    let subgroupNames = sorted(itemGroupMap.get(groupName).keys(), function (k) {
      return data.groups[groupName].subgroups[k]
    })
    let group = []
    itemGroups.push(group)
    for (let subgroupName of subgroupNames) {
      let items = itemGroupMap.get(groupName).get(subgroupName)
      items = sorted(items, function (item) {
        return item.order
      })
      group.push(items)
    }
  }
  return itemGroups
}

// -----------------------------------------------------------------------------
// Belts
// -----------------------------------------------------------------------------

class Belt {
  [key: string]: any
  constructor(key, name, col, row, rate) {
    this.key = key
    this.name = name
    this.rate = rate
    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
  renderTooltip() {
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
    t.append("b").text(`Max throughput: `)
    t.append(() => new Text(`${spec.format.rate(this.rate)}/${spec.format.longRate}`))
    return t.node()
  }
}

export function getBelts(data) {
  let beltObjs = []
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
  let belts = new Map()
  for (let belt of beltObjs) {
    belts.set(belt.key, belt)
  }
  return belts
}

// -----------------------------------------------------------------------------
// Fuels
// -----------------------------------------------------------------------------

let energySuffixes = ["J", "kJ", "MJ", "GJ", "TJ", "PJ"]

export class Fuel {
  [key: string]: any
  constructor(key, name, col, row, item, category, value) {
    this.key = key
    this.name = name
    this.item = item
    this.category = category
    this.value = value

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
  valueString() {
    let x = this.value
    let thousand = Rational.from_float(1000)
    let i = 0
    while (thousand.less(x) && i < energySuffixes.length - 1) {
      x = x.div(thousand)
      i++
    }
    return x.toUpDecimal(0) + " " + energySuffixes[i]
  }
  renderTooltip() {
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
    t.append("b").text("Energy: ")
    t.append(() => new Text(self.valueString()))
    return t.node()
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

export function getFuel(data, items) {
  let fuelCategories = new Map()
  for (let d of data.fuel) {
    let item = items.get(d.item_key)
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
  for (let [categoryKey, category] of fuelCategories) {
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

class Building {
  [key: string]: any
  constructor(
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
    conditions = [],
    allowedEffects = null,
  ) {
    this.key = key
    this.name = name
    this.categories = new Set(categories)
    this.speed = speed
    this.prodBonus = prodBonus
    this.moduleSlots = moduleSlots
    this.power = power
    this.fuel = fuel
    this.conditions = conditions ?? []
    if (allowedEffects === null || allowedEffects === undefined) {
      this.allowedEffects = null
    } else if (Array.isArray(allowedEffects)) {
      this.allowedEffects = new Set(allowedEffects)
    } else {
      this.allowedEffects = new Set(
        Object.entries(allowedEffects)
          .filter(([, enabled]) => enabled)
          .map(([effect]) => effect),
      )
    }

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
  less(other) {
    if (!this.speed.equal(other.speed)) {
      return this.speed.less(other.speed)
    }
    return this.moduleSlots < other.moduleSlots
  }
  canCraft(recipe) {
    for (let category of recipe.categories) {
      if (this.categories.has(category)) {
        return true
      }
    }
    return false
  }
  allowedOn(location) {
    return location.allowsConditions(this.conditions)
  }
  allowsModule(module) {
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
  getCount(spec, recipe, rate) {
    return rate.div(this.getRecipeRate(spec, recipe))
  }
  getRecipeRate(spec, recipe) {
    let modules = spec.getModuleSpec(recipe)
    let speedEffect
    if (modules) {
      speedEffect = modules.speedEffect()
    } else {
      speedEffect = one
    }
    return recipe.time.reciprocate().mul(this.speed).mul(speedEffect)
  }
  canBeacon() {
    return this.moduleSlots > 0
  }
  prodEffect(spec) {
    return this.prodBonus
  }
  drain() {
    return this.power.div(thirty)
  }
  renderTooltip() {
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
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
    return t.node()
  }
}

class Miner extends Building {
  [key: string]: any
  constructor(
    key,
    name,
    col,
    row,
    categories,
    miningSpeed,
    moduleSlots,
    power,
    fuel,
    conditions = [],
    allowedEffects = null,
  ) {
    super(key, name, col, row, categories, zero, zero, moduleSlots, power, fuel, conditions, allowedEffects)
    this.miningSpeed = miningSpeed
  }
  less(other) {
    return this.miningSpeed.less(other.miningSpeed)
  }
  drain() {
    return zero
  }
  getRecipeRate(spec, recipe) {
    let modules = spec.getModuleSpec(recipe)
    let speedEffect
    if (modules) {
      speedEffect = modules.speedEffect()
    } else {
      speedEffect = one
    }
    return this.miningSpeed.div(recipe.miningTime).mul(speedEffect)
  }
  prodEffect(spec) {
    return spec.miningProd
  }
  renderTooltip() {
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
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
    return t.node()
  }
}

class OffshorePump extends Building {
  [key: string]: any
  constructor(key, name, col, row, pumpingSpeed, conditions = []) {
    super(key, name, col, row, ["offshore-pumping"], zero, zero, 0, zero, null, conditions)
    this.pumpingSpeed = pumpingSpeed
  }
  less(other) {
    return this.pumpingSpeed.less(other.pumpingSpeed)
  }
  getRecipeRate(spec, recipe) {
    return this.pumpingSpeed
  }
  renderTooltip() {
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
    let line = t.append("div")
    line.append("b").text("Pumping speed: ")
    line.append("span").text(`${spec.format.rate(this.pumpingSpeed)}/${spec.format.rateName}`)
    return t.node()
  }
}

let rocketLaunchDuration = Rational.from_floats(2434, 60)

function launchRate(spec) {
  let partRecipe = spec.recipes.get("rocket-part")
  let partFactory = spec.getBuilding(partRecipe)
  let partItem = spec.items.get("rocket-part")
  let gives = partRecipe.gives(partItem)
  // The base rate at which the silo can make rocket parts.
  let rate = Building.prototype.getRecipeRate.call(partFactory, spec, partRecipe)
  // Number of times to complete the rocket part recipe per launch.
  let perLaunch = Rational.from_float(100).div(gives)
  // Total length of time required to launch a rocket.
  let time = perLaunch.div(rate).add(rocketLaunchDuration)
  let launchRate = time.reciprocate()
  let partRate = perLaunch.div(time)
  return { part: partRate, launch: launchRate }
}

class RocketLaunch extends Building {
  [key: string]: any
  getRecipeRate(spec, recipe) {
    return launchRate(spec).launch
  }
}

class RocketSilo extends Building {
  [key: string]: any
  getRecipeRate(spec, recipe) {
    return launchRate(spec).part
  }
}

function renderTooltipBase(this: any) {
  let self = this
  let t = d3.create("div").classed("frame", true)
  let header = t.append("h3")
  header.append(() => self.icon.make(32, true))
  header.append(() => new Text(self.name))
  return t.node()
}

export function getBuildings(data, items) {
  let buildings = []
  let reactorDef = items.get("nuclear-reactor")
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
  let boilerItem = items.get("boiler")
  let boilerDef
  for (let d of data.boilers) {
    if (d.key === "boiler") {
      boilerDef = d
      break
    }
  }
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
  let siloDef = items.get("rocket-silo")
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
  )
  launch.renderTooltip = renderTooltipBase
  buildings.push(launch)
  for (let d of data.crafting_machines) {
    let fuel = null
    if (d.energy_source && d.energy_source.type === "burner") {
      fuel = d.energy_source.fuel_category
    }
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
        d.crafting_categories,
        Rational.from_float_approximate(d.crafting_speed),
        prod,
        d.module_slots,
        Rational.from_float_approximate(d.energy_usage),
        fuel,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
      ),
    )
  }
  for (let d of data.rocket_silo) {
    buildings.push(
      new RocketSilo(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.crafting_categories,
        Rational.from_float_approximate(d.crafting_speed),
        zero,
        d.module_slots,
        Rational.from_float_approximate(d.energy_usage),
        null,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
      ),
    )
  }
  for (let d of data.offshore_pumps) {
    // Pumping speed is given in units/tick.
    let speed = Rational.from_float_approximate(d.pumping_speed).mul(Rational.from_float(60))
    buildings.push(
      new OffshorePump(d.key, d.localized_name.en, d.icon_col, d.icon_row, speed, d.surface_conditions ?? []),
    )
  }
  for (let d of data.mining_drills) {
    if (d.key == "pumpjack") {
      continue
    }
    let fuel = null
    if (d.energy_source && d.energy_source.type === "burner") {
      fuel = d.energy_source.fuel_category
    }
    buildings.push(
      new Miner(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.resource_categories,
        Rational.from_float_approximate(d.mining_speed),
        d.module_slots,
        Rational.from_float_approximate(d.energy_usage),
        fuel,
        d.surface_conditions ?? [],
        d.allowed_effects ?? null,
      ),
    )
  }
  return buildings
}

// -----------------------------------------------------------------------------
// Modules and beacons
// -----------------------------------------------------------------------------

let hundred = Rational.from_float(100)
function percent(x) {
  let sign = ""
  if (!x.less(zero)) {
    sign = "+"
  }
  return `${sign}${x.mul(hundred).toDecimal()}%`
}

class Module {
  [key: string]: any
  constructor(key, name, col, row, category, order, productivity, quality, speed, power, pollution) {
    // Pollution is retained in the dataset but does not affect production rates.
    this.key = key
    this.name = name
    this.category = category
    this.order = order
    this.productivity = productivity
    this.quality = quality
    this.speed = speed
    this.power = power
    this.pollution = pollution
    this.effectTypes = new Set()
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

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
  // This naming scheme is some older cruft, which works in the vanilla
  // dataset, but it's possible other datasets would render it unworkable.
  shortName() {
    return this.key[0] + this.key[this.key.length - 1]
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
  canUse(recipe, building = null) {
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
  canBeacon() {
    for (let effect of this.requiredEffectTypes()) {
      if (!beaconAllowedEffects.has(effect)) {
        return false
      }
    }
    return true
  }
  hasProdEffect() {
    return !this.productivity.isZero()
  }
  hasQualityEffect() {
    return !this.quality.isZero() || this.category === "quality"
  }
  renderTooltip() {
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
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
    return t.node()
  }
}

export function moduleDropdown(selector, data) {
  let moduleDropdownSpan = selector
    .selectAll("span.module-wrapper")
    .data(data)
    .join((enter) => {
      let s = enter.append("span").classed("module-wrapper", true)
      makeDropdown(s)
      return s
    })
  let moduleDropdown = moduleDropdownSpan.selectAll("div.dropdown")
  moduleDropdown
    .selectAll("div.moduleRow")
    .data((d) => d.inputRows)
    .join("div")
    .classed("moduleRow", true)
    .selectAll("span.input")
    .data((d) => d)
    .join(
      (enter) => {
        let s = enter.append("span").classed("input", true)
        let label = addInputs(
          s,
          (d) => d.cell.name,
          (d) => d.checked(),
          (d) => d.choose(),
        )
        label.append(function (this: HTMLElement, d) {
          if (d.module === null) {
            return sprites.get("slot_icon_module").icon.make(32)
          } else {
            return d.module.icon.make(32, false, this.parentNode.parentNode.parentNode)
          }
        })
        return s
      },
      (update) => {
        update.selectAll("input").property("checked", (d) => d.checked())
        return update
      },
    )
}

const MIN_SPEED_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POWER_EFFECT = Rational.from_floats(1, 5) // 20%

// ModuleSpec represents the set of modules (including beacons) configured for
// a given recipe.
export class ModuleSpec {
  [key: string]: any
  constructor(recipe, spec) {
    this.recipe = recipe
    this.building = null
    this.modules = []
    this.beaconModules = spec.defaultBeacon.map((module) => (module === null || module.canBeacon() ? module : null))
    this.beaconCount = spec.defaultBeaconCount
  }
  setBuilding(building, spec) {
    this.building = building
    if (this.modules.length > building.moduleSlots) {
      this.modules.length = building.moduleSlots
    }
    let toAdd = spec.getDefaultModule(this.recipe, building)
    for (let i = 0; i < this.modules.length; i++) {
      let module = this.modules[i]
      if (module !== null && !module.canUse(this.recipe, building)) {
        this.modules[i] = toAdd
      }
    }
    while (this.modules.length < building.moduleSlots) {
      this.modules.push(toAdd)
    }
    for (let i = 0; i < this.beaconModules.length; i++) {
      let module = this.beaconModules[i]
      if (module !== null && (!module.canBeacon() || !module.canUse(this.recipe, building))) {
        this.beaconModules[i] = null
      }
    }
  }
  getModule(index) {
    return this.modules[index]
  }
  // Returns true if the module change requires a recalculation.
  setModule(index, module) {
    if (index >= this.modules.length) {
      return false
    }
    if (module !== null && !module.canUse(this.recipe, this.building)) {
      return false
    }
    let oldModule = this.modules[index]
    let needRecalc = (oldModule && oldModule.hasProdEffect()) || (module && module.hasProdEffect())
    this.modules[index] = module
    return needRecalc
  }
  setBeaconModule(module, i) {
    this.beaconModules[i] =
      module === null || (module.canBeacon() && module.canUse(this.recipe, this.building)) ? module : null
  }
  setBeaconCount(count) {
    this.beaconCount = count
  }

  speedEffect() {
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
          let i = this.beaconCount.ceil().toFloat() - 1
          if (i >= beaconProfile.length) {
            i = beaconProfile.length - 1
          }
          beacon = beacon.mul(beaconProfile[i])
        }
        speed = speed.add(beacon)
      }
    }
    return Rational.max(speed, MIN_SPEED_EFFECT)
  }
  prodEffect(spec) {
    let prod = one
    for (let module of this.modules) {
      if (!module) {
        continue
      }
      prod = prod.add(module.productivity)
    }
    prod = prod.add(this.building.prodEffect(spec))
    return prod
  }
  powerEffect(spec) {
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
          let i = this.beaconCount.ceil().toFloat() - 1
          if (i >= beaconProfile.length) {
            i = beaconProfile.length - 1
          }
          beacon = beacon.mul(beaconProfile[i])
        }
        power = power.add(beacon)
      }
    }
    return Rational.max(power, MIN_POWER_EFFECT)
  }
}

export let moduleRows = null
export let shortModules = null

let beaconProfile
let beaconEffect
let beaconAllowedEffects = new Set(["consumption", "speed", "pollution"])

export function getModules(data, items) {
  let modules = new Map()
  for (let d of data.modules) {
    let item = items.get(d.item_key)
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
  shortModules = new Map()
  let category = null
  for (let module of sortedModules) {
    if (module.category !== category) {
      category = module.category
      moduleRows.push([])
    }
    moduleRows[moduleRows.length - 1].push(module)
    let shortName = module.shortName()
    if (shortModules.has(shortName)) {
      // This does not occur in the vanilla data, but let's plan ahead.
      module.shortName = function () {
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

class SurfaceProperty {
  [key: string]: any
}

class Planet {
  [key: string]: any
  constructor(key, name, order, col, row, resources, properties) {
    this.key = key
    this.name = name
    this.order = order
    this.resources = resources
    this.properties = properties
    this.disable = new Set()

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
  allowsConditions(conditions) {
    for (let condition of conditions ?? []) {
      let value = this.properties.get(condition.property)
      if (value === undefined) {
        value = defaultProperties.get(condition.property)
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
  allowsRecipe(recipe) {
    if (recipe.isResource()) {
      return this.resources.has(recipe)
    }
    return this.allowsConditions(recipe.conditions)
  }
  allowsBuilding(building) {
    return building.allowedOn(this)
  }
  allows(recipe, buildings) {
    if (!this.allowsRecipe(recipe)) {
      return false
    }
    if (recipe.isResource() || recipe.categories.size === 0) {
      return true
    }
    return buildings.some((building) => building.canCraft(recipe) && this.allowsBuilding(building))
  }
}

let defaultProperties

const RECYCLING_ROOT_KEYS = new Set(["scrap"])

function traverseRecycling(recipe, found) {
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

export function getPlanets(data, recipes, buildings) {
  if (!data.planets) {
    // For legacy 1.1 datasets.
    return null
  }
  defaultProperties = new Map()
  for (let { name, default_value } of data.surface_properties) {
    defaultProperties.set(name, default_value)
  }

  let planets = new Map()
  for (let d of data.planets) {
    let resources = new Set()
    let roots = new Set()
    for (let key of d.resources.resource.concat(d.resources.offshore).concat(d.resources.plants)) {
      let r = recipes.get(key)
      resources.add(r)
      if (RECYCLING_ROOT_KEYS.has(key)) {
        roots.add(r)
      }
    }
    let properties = new Map()
    for (let key in d.surface_properties) {
      let value = d.surface_properties[key]
      properties.set(key, value)
    }
    let planet = new Planet(d.key, d.localized_name.en, d.order, d.icon_col, d.icon_row, resources, properties)
    for (let recipe of recipes.values()) {
      if (!planet.allows(recipe, buildings) || recipe.key.endsWith("-recycling")) {
        planet.disable.add(recipe)
      }
      if (roots.size > 0) {
        let recycling = new Set()
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

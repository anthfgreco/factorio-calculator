import { Formatter, half, one, Rational, zero } from "./math.js"
import { ModuleSpec, type Fuel, type FuelCollection } from "./models.js"
import type { PriorityList } from "./priorities.js"
import {
  applyPriorities,
  buildDefaultPriorityArray,
  restoreDefaultPriorities,
  isValidPriorityKey as validatePriorityKey,
} from "./priorities.js"
import {
  getRecipeGraph as buildRecipeGraph,
  disableRecipe,
  enableRecipe,
  getEnabledRecipes,
  getEnabledUses,
  isItemDisabled as itemIsDisabled,
  isFactoryTarget as recipeIsFactoryTarget,
} from "./recipes.js"
import { solve } from "./solver.js"
import { getQualityTargetMultiplier } from "./planning.js"

// -----------------------------------------------------------------------------
// Calculator defaults
// -----------------------------------------------------------------------------

export const DEFAULT_ITEM_KEY = "advanced-circuit"
export const DEFAULT_PLANET = "nauvis"
export const DEFAULT_BELT = "transport-belt"
export const DEFAULT_FUEL = "coal"
export const DEFAULT_BUILDING_KEYS = new Set(["assembling-machine-1", "electric-furnace", "electric-mining-drill"])

// -----------------------------------------------------------------------------
// Factory rendering port
// -----------------------------------------------------------------------------

/**
 * Browser-facing operations required by the calculator application model.
 *
 * The application layer depends on this port, not on D3 or concrete DOM
 * renderers. Headless tests omit the port entirely.
 */
export interface FactoryViewPort {
  createBuildTarget(index: number, itemKey: string, item: unknown, itemGroups: unknown): any
  mountBuildTarget(target: any): void
  removeBuildTarget(target: any): void
  renderSolution(specification: unknown, totals: unknown): void
  renderCalculationError(specification: unknown, error: unknown): void
  persistUrlState(): void
  renderDebug(): void
}

// -----------------------------------------------------------------------------
// Building groups
// -----------------------------------------------------------------------------

export function getCategories(value) {
  let categories = value.categories ?? value.category
  if (categories === undefined || categories === null) {
    return []
  }
  if (typeof categories === "string") {
    return [categories]
  }
  return categories
}

export function buildingCanCraft(building, recipe) {
  let buildingCategories = getCategories(building)
  for (let category of getCategories(recipe)) {
    if (typeof buildingCategories.has === "function") {
      if (buildingCategories.has(category)) {
        return true
      }
    } else if ([...buildingCategories].includes(category)) {
      return true
    }
  }
  return false
}

class BuildingSet {
  [key: string]: any
  categories = new Set()
  buildings = new Set()

  constructor(building = null) {
    if (building !== null) {
      for (let category of building.categories) {
        this.categories.add(category)
      }
      this.buildings.add(building)
    }
  }

  merge(other) {
    for (let category of other.categories) {
      this.categories.add(category)
    }
    for (let building of other.buildings) {
      this.buildings.add(building)
    }
  }

  overlaps(other) {
    return [...this.categories].some((category) => other.categories.has(category))
  }
}

export function buildingSort(buildings) {
  buildings.sort((a, b) => {
    if (a.less(b)) {
      return -1
    }
    if (b.less(a)) {
      return 1
    }
    return 0
  })
}

class BuildingGroup {
  [key: string]: any
  constructor(buildingSet) {
    this.buildings = [...buildingSet]
    buildingSort(this.buildings)
    this.building = this.getDefault()
    this.selectedBuildings = new Set([this.building])
  }

  getDefault() {
    return this.buildings.find((building) => DEFAULT_BUILDING_KEYS.has(building.key)) ?? this.buildings.at(-1)
  }

  getBuilding(recipe, available: (building: any) => boolean = () => true) {
    let fallback = null
    let selected = null
    for (let building of this.buildings) {
      if (buildingCanCraft(building, recipe) && available(building)) {
        fallback = building
        if (this.selectedBuildings.has(building)) {
          selected = building
        }
      }
    }
    return selected ?? fallback
  }
}

function mergeBuildingSet(sets: Set<any>, buildingSet: any) {
  for (let other of [...sets]) {
    if (buildingSet.overlaps(other)) {
      buildingSet.merge(other)
      sets.delete(other)
    }
  }
  sets.add(buildingSet)
}

export function getBuildingGroups(buildings, recipes) {
  let sets = new Set<any>()
  for (let building of buildings) {
    mergeBuildingSet(sets, new BuildingSet(building))
  }

  // Multi-category recipes link equivalent crafting-machine groups.
  for (let recipe of recipes) {
    let categories = [...getCategories(recipe)]
    if (categories.length < 2) {
      continue
    }
    let set = new BuildingSet()
    for (let category of categories) {
      set.categories.add(category)
    }
    mergeBuildingSet(sets, set)
  }

  let groups = new Map()
  for (let { categories, buildings: groupBuildings } of sets) {
    if (groupBuildings.size === 0) {
      continue
    }
    let group = new BuildingGroup(groupBuildings)
    for (let category of categories) {
      groups.set(category, group)
    }
  }
  return groups
}

// -----------------------------------------------------------------------------
// Location policy
// -----------------------------------------------------------------------------

export function syncLocationDisabledRecipes(specification) {
  let selected = [...specification.selectedPlanets]
  let unavailable =
    selected.length === 0
      ? new Set()
      : selected
          .slice(1)
          .reduce(
            (intersection, location) => new Set([...intersection].filter((recipe) => location.disable.has(recipe))),
            new Set(selected[0].disable),
          )

  specification.planetaryBaseline = unavailable
  for (let recipe of [...specification.disable]) {
    if (!unavailable.has(recipe)) {
      specification.setEnable(recipe)
    }
  }
  for (let recipe of unavailable) {
    if (!specification.disable.has(recipe)) {
      specification.setDisable(recipe)
    }
  }
}

export function isDefaultLocationSelection(specification): boolean {
  if (!specification.planets || specification.planets.size === 1) {
    return true
  }
  let selected = [...specification.selectedPlanets]
  return selected.length === 1 && selected[0].key === DEFAULT_PLANET
}

export function getUserRecipeOverrides(specification) {
  if (!specification.planetaryBaseline) {
    return { disable: specification.disable, enable: new Set() }
  }
  return {
    disable: new Set([...specification.disable].filter((recipe) => !specification.planetaryBaseline.has(recipe))),
    enable: new Set([...specification.planetaryBaseline].filter((recipe) => !specification.disable.has(recipe))),
  }
}

export function selectOnlyLocation(specification, location): void {
  specification.selectedPlanets.clear()
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function selectLocation(specification, location): void {
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function unselectLocation(specification, location): void {
  specification.selectedPlanets.delete(location)
  syncLocationDisabledRecipes(specification)
}

export function getRecipeLocations(specification, recipe, building = null) {
  if (!specification.selectedPlanets || specification.selectedPlanets.size === 0) {
    return []
  }

  let result = []
  for (let location of specification.selectedPlanets) {
    if (!location.allowsRecipe(recipe)) {
      continue
    }
    if (building !== null && !location.allowsBuilding(building)) {
      continue
    }
    result.push(location)
  }
  result.sort((a, b) => a.order.localeCompare(b.order))
  return result
}

// -----------------------------------------------------------------------------
// Recipe selection commands
// -----------------------------------------------------------------------------

export function getItemProductionRecipes(item) {
  return item.recipes.filter((recipe) => !recipe.isDisable() && recipe.isReal() && recipe.isNetProducer(item))
}

export function setRecipeEnabled(spec, recipe, enabled) {
  if (enabled) {
    spec.setEnable(recipe)
  } else {
    spec.setDisable(recipe)
  }
}

// -----------------------------------------------------------------------------
// Factory specification
// -----------------------------------------------------------------------------

export class FactorySpecification {
  view: FactoryViewPort | null
  items: Map<string, any> | null
  recipes: Map<string, any> | null
  modules: Map<string, any> | null
  planets: Map<string, any> | null
  buildings: Map<string, any> | null
  buildingKeys: Map<string, any> | null
  buildingOverrides: Map<any, any>
  belts: Map<string, any> | null
  fuels: FuelCollection | null
  itemGroups: any
  buildTargets: any[]
  spec: Map<any, any>
  defaultModule: any
  secondaryDefaultModule: any
  defaultBeacon: any[]
  defaultBeaconCount: Rational
  belt: any
  fuel: Fuel | null
  miningProd: Rational | null
  recipeProductivityResearch: Map<string, any>
  recipeProductivityLevels: Map<string, number>
  recipeProductivityEffects: Map<any, { researchKey: string; change: Rational }[]>
  minerSettings: Map<any, { miner: any; purity: any }>
  ignore: Set<any>
  disable: Set<any>
  selectedPlanets: Set<any>
  planetaryBaseline: Set<any> | null
  priority: PriorityList | null
  defaultPriority: Map<any, Rational>[] | null
  beltStackSize: Rational
  bufferMinutes: Rational
  freshnessDelayMinutes: Rational
  resourceYields: Map<any, Rational>
  asteroidLimits: Map<string, Rational>
  recipeLocations: Map<any, any>
  beaconPower: Rational
  maxQualityLevel: number
  format: Formatter
  lastTotals: any
  lastError: unknown
  lastPartial: any
  lastTableau: any
  lastMetadata: any
  lastSolution: any
  debug: boolean

  constructor(view: FactoryViewPort | null = null) {
    this.view = view
    // Game data definitions
    this.items = null
    this.recipes = null
    this.modules = null
    this.planets = null
    this.buildings = null
    this.buildingKeys = null
    this.buildingOverrides = new Map()
    this.belts = null
    this.fuels = null

    this.itemGroups = null

    this.buildTargets = []

    // Maps recipe to ModuleSpec
    this.spec = new Map()
    this.defaultModule = null
    this.secondaryDefaultModule = null
    this.defaultBeacon = [null, null]
    this.defaultBeaconCount = zero

    this.belt = null

    this.fuel = null

    this.miningProd = null
    this.recipeProductivityResearch = new Map()
    this.recipeProductivityLevels = new Map()
    this.recipeProductivityEffects = new Map()
    this.minerSettings = new Map()

    this.ignore = new Set()
    this.disable = new Set()
    this.selectedPlanets = new Set()
    this.planetaryBaseline = null

    this.priority = null
    this.defaultPriority = null

    this.beltStackSize = one
    this.bufferMinutes = one
    this.freshnessDelayMinutes = zero
    this.resourceYields = new Map()
    this.asteroidLimits = new Map()
    this.recipeLocations = new Map()
    this.beaconPower = zero
    this.maxQualityLevel = 4

    this.format = new Formatter()

    this.lastTotals = null
    this.lastError = null

    this.lastPartial = null
    this.lastTableau = null
    this.lastMetadata = null
    this.lastSolution = null

    this.debug = false
  }
  setData(
    items,
    recipes,
    planets,
    modules,
    buildings,
    belts,
    fuels,
    itemGroups,
    recipeProductivityResearch = new Map(),
    beaconPower = zero,
  ) {
    this.items = items
    this.recipes = recipes
    this.planets = planets
    this.modules = modules
    this.buildings = getBuildingGroups(buildings, recipes.values())
    this.buildingKeys = new Map()
    for (let building of buildings) {
      this.buildingKeys.set(building.key, building)
    }
    this.belts = belts
    this.belt = belts.get(DEFAULT_BELT)
    this.fuels = fuels
    this.fuel = fuels.get(DEFAULT_FUEL)
    this.miningProd = zero
    this.recipeProductivityResearch = recipeProductivityResearch
    this.recipeProductivityLevels.clear()
    this.recipeProductivityEffects.clear()
    for (let research of recipeProductivityResearch.values()) {
      for (let [recipe, change] of research.effects) {
        let effects = this.recipeProductivityEffects.get(recipe)
        if (effects === undefined) {
          effects = []
          this.recipeProductivityEffects.set(recipe, effects)
        }
        effects.push({ researchKey: research.key, change })
      }
    }
    this.itemGroups = itemGroups
    this.beaconPower = beaconPower
    this.defaultPriority = this.getDefaultPriorityArray()
    this.priority = null
  }
  setDefaultDisable() {
    this.disable.clear()
  }
  setDisable(recipe) {
    disableRecipe(this, recipe)
  }
  setEnable(recipe) {
    enableRecipe(this, recipe)
  }
  isDefaultPlanet() {
    return isDefaultLocationSelection(this)
  }
  getNetDisable() {
    return getUserRecipeOverrides(this)
  }
  selectOnePlanet(planet) {
    selectOnlyLocation(this, planet)
  }
  selectPlanet(planet) {
    selectLocation(this, planet)
  }
  unselectPlanet(planet) {
    unselectLocation(this, planet)
  }
  getDefaultPriorityArray() {
    return buildDefaultPriorityArray(this)
  }
  setDefaultPriority() {
    restoreDefaultPriorities(this)
  }
  isValidPriorityKey(key) {
    return validatePriorityKey(this, key)
  }
  setPriorities(tiers) {
    applyPriorities(this, tiers)
  }
  isDefaultPriority() {
    return this.priority.equalArray(this.defaultPriority)
  }
  getUses(item) {
    return getEnabledUses(this, item)
  }
  isItemDisabled(item) {
    return itemIsDisabled(this, item)
  }
  getRecipes(item) {
    return getEnabledRecipes(this, item)
  }
  getRecipeGraph(items) {
    return buildRecipeGraph(this, items)
  }
  isFactoryTarget(recipe) {
    return recipeIsFactoryTarget(this, recipe)
  }
  isBuildingAvailable(building, recipe) {
    if (!this.selectedPlanets || this.selectedPlanets.size === 0) {
      return true
    }
    for (let location of this.selectedPlanets) {
      if (location.allowsRecipe(recipe) && location.allowsBuilding(building)) {
        return true
      }
    }
    return false
  }
  getCompatibleBuildings(recipe, availableOnly = true) {
    for (let category of getCategories(recipe)) {
      let group = this.buildings.get(category)
      if (group !== undefined) {
        return group.buildings.filter(
          (building) =>
            buildingCanCraft(building, recipe) && (!availableOnly || this.isBuildingAvailable(building, recipe)),
        )
      }
    }
    return []
  }
  getAutomaticBuilding(recipe) {
    for (let category of getCategories(recipe)) {
      let group = this.buildings.get(category)
      if (group !== undefined) {
        return group.getBuilding(recipe, (building) => this.isBuildingAvailable(building, recipe))
      }
    }
    return null
  }
  getBuildingOverride(recipe) {
    return this.buildingOverrides.get(recipe) ?? null
  }
  getBuilding(recipe) {
    return this.getBuildingOverride(recipe) ?? this.getAutomaticBuilding(recipe)
  }
  setBuildingOverride(recipe, building) {
    if (building !== null && (!buildingCanCraft(building, recipe) || !this.isBuildingAvailable(building, recipe))) {
      return false
    }

    if (building === null) {
      this.buildingOverrides.delete(recipe)
    } else {
      this.buildingOverrides.set(recipe, building)
    }

    let moduleSpec = this.spec.get(recipe)
    let selectedBuilding = this.getBuilding(recipe)
    if (moduleSpec !== undefined && selectedBuilding !== null && moduleSpec.building !== selectedBuilding) {
      moduleSpec.setBuilding(selectedBuilding, this)
    }
    return true
  }
  getBuildingGroup(building) {
    const category = String(Array.from(building.categories)[0])
    return this.buildings.get(category)
  }
  setMinimumBuilding(building) {
    let group = this.getBuildingGroup(building)
    group.building = building
    group.selectedBuildings = new Set([building])
    this.updateBuildingGroup(group)
  }
  setAutomaticBuildingEnabled(building, enabled) {
    let group = this.getBuildingGroup(building)
    if (enabled) {
      group.selectedBuildings.add(building)
    } else if (group.selectedBuildings.size === 1) {
      return false
    } else {
      group.selectedBuildings.delete(building)
    }
    this.updateBuildingGroup(group)
    return true
  }
  isAutomaticBuildingEnabled(building) {
    return this.getBuildingGroup(building).selectedBuildings.has(building)
  }
  updateBuildingGroup(group) {
    for (let [recipe, moduleSpec] of this.spec) {
      let g = null
      for (let category of getCategories(recipe)) {
        g = this.buildings.get(category)
        if (g !== undefined) {
          break
        }
      }
      if (group === g && !this.buildingOverrides.has(recipe)) {
        let b = this.getBuilding(recipe)
        if (b !== null) {
          moduleSpec.setBuilding(b, this)
        }
      }
    }
  }
  initModuleSpec(recipe, building) {
    if (!this.spec.has(recipe) && building !== null && building.canBeacon()) {
      let m = new ModuleSpec(recipe, this)
      m.setBuilding(building, this)
      this.spec.set(recipe, m)
      return m
    }
  }
  populateModuleSpec(totals) {
    for (let [recipe, rate] of totals.rates) {
      let building = this.getBuilding(recipe)
      this.initModuleSpec(recipe, building)
    }
  }
  getModuleSpec(recipe) {
    let building = this.getBuilding(recipe)
    let m = this.spec.get(recipe)
    if (m === undefined) {
      return this.initModuleSpec(recipe, building)
    }
    if (building !== null && m.building !== building) {
      m.setBuilding(building, this)
    }
    return m
  }
  getProdEffect(recipe) {
    let m = this.getModuleSpec(recipe)
    let effect = m === undefined ? one : m.prodEffect(this)
    let bonus = effect.sub(one).add(this.getRecipeProductivityBonus(recipe))
    if (recipe.maximumProductivity != null) {
      bonus = Rational.min(bonus, recipe.maximumProductivity)
    }
    return one.add(bonus)
  }
  getRecipeProductivityLevel(researchKey: string): number {
    return this.recipeProductivityLevels.get(researchKey) ?? 0
  }
  setRecipeProductivityLevel(researchKey: string, level: number): boolean {
    if (!this.recipeProductivityResearch.has(researchKey)) {
      return false
    }
    let normalizedLevel = Number.isFinite(level) ? Math.max(0, level) : 0
    if (normalizedLevel === 0) {
      this.recipeProductivityLevels.delete(researchKey)
    } else {
      this.recipeProductivityLevels.set(researchKey, normalizedLevel)
    }
    return true
  }
  getRecipeProductivityBonus(recipe): Rational {
    let bonus = zero
    for (let effect of this.recipeProductivityEffects.get(recipe) ?? []) {
      let level = this.getRecipeProductivityLevel(effect.researchKey)
      bonus = bonus.add(effect.change.mul(Rational.from_float_approximate(level)))
    }
    return bonus
  }
  setDefaultModule(module) {
    for (let [recipe, moduleSpec] of this.spec) {
      for (let i = 0; i < moduleSpec.modules.length; i++) {
        if (moduleSpec.modules[i] !== this.defaultModule) {
          continue
        }
        if (module === null || module.canUse(recipe, moduleSpec.building)) {
          moduleSpec.modules[i] = module
        } else if (
          this.secondaryDefaultModule === null ||
          this.secondaryDefaultModule.canUse(recipe, moduleSpec.building)
        ) {
          moduleSpec.modules[i] = this.secondaryDefaultModule
        } else {
          moduleSpec.modules[i] = null
        }
      }
    }
    this.defaultModule = module
  }
  setSecondaryDefaultModule(module) {
    if (this.secondaryDefaultModule !== this.defaultModule) {
      for (let [recipe, moduleSpec] of this.spec) {
        for (let i = 0; i < moduleSpec.modules.length; i++) {
          let m = moduleSpec.modules[i]
          if (m === this.secondaryDefaultModule) {
            moduleSpec.modules[i] = !module || module.canUse(recipe, moduleSpec.building) ? module : null
          }
        }
      }
    }
    this.secondaryDefaultModule = module
  }
  // Gets the default module for this recipe, given the current
  // default/secondary settings.
  getDefaultModule(recipe, building = this.getBuilding(recipe)) {
    if (this.defaultModule === null || this.defaultModule.canUse(recipe, building)) {
      return this.defaultModule
    }
    if (this.secondaryDefaultModule === null || this.secondaryDefaultModule.canUse(recipe, building)) {
      return this.secondaryDefaultModule
    }
    return null
  }
  isDefaultDefaultBeacon() {
    return this.defaultBeacon[0] === null && this.defaultBeacon[1] === null
  }
  setDefaultBeacon(module, i) {
    let compatibleModule = module === null || module.canBeacon() ? module : null
    for (let moduleSpec of this.spec.values()) {
      let currentModule = moduleSpec.beaconModules[i]
      if (currentModule === this.defaultBeacon[i]) {
        moduleSpec.beaconModules[i] =
          compatibleModule === null || compatibleModule.canUse(moduleSpec.recipe, moduleSpec.building)
            ? compatibleModule
            : null
      }
    }
    this.defaultBeacon[i] = compatibleModule
  }
  setDefaultBeaconCount(count) {
    for (let [recipe, moduleSpec] of this.spec) {
      if (moduleSpec.beaconCount.equal(this.defaultBeaconCount)) {
        moduleSpec.beaconCount = count
      }
    }
    this.defaultBeaconCount = count
  }
  // Returns the recipe-rate at which a single building can produce a recipe.
  // Returns null for recipes that do not have a building.
  getRecipeRate(recipe) {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return null
    }
    return building.getRecipeRate(this, recipe)
  }
  setMiner(recipe, miner, purity) {
    this.minerSettings.set(recipe, { miner, purity })
  }
  getCount(recipe, rate) {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return zero
    }
    return building.getCount(this, recipe, rate)
  }
  getResourceYield(recipe) {
    return this.resourceYields.get(recipe) ?? one
  }
  setResourceYield(recipe, value) {
    this.resourceYields.set(recipe, Rational.max(Rational.from_floats(1, 100), value))
  }
  setRecipeLocation(recipe, location) {
    if (location === null) this.recipeLocations.delete(recipe)
    else this.recipeLocations.set(recipe, location)
  }
  getBeltCount(rate) {
    return rate.div(this.belt.rate.mul(this.beltStackSize))
  }
  getFuelForBuilding(building) {
    if (building === null || building.fuel === null || this.fuels === null) {
      return null
    }
    let fuel = this.fuels.getForCategory(building.fuel, this.fuel)
    if (fuel === null) {
      throw new Error(`No fuel item is available for the ${building.fuel} fuel category`)
    }
    return fuel
  }
  getFuelForRecipe(recipe) {
    return this.getFuelForBuilding(this.getBuilding(recipe))
  }
  getPowerUsage(recipe, rate) {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return { fuel: null, power: zero }
    }
    let count = this.getCount(recipe, rate)
    let modules = this.getModuleSpec(recipe)
    let powerEffect
    if (modules) {
      powerEffect = modules.powerEffect(this)
    } else {
      powerEffect = one
    }
    let power = building.power.mul(count).mul(powerEffect)
    if (building.fuel !== null) {
      return { fuel: building.fuel, power }
    }
    power = power.add(building.drain().mul(count.ceil()))
    return { fuel: "electric", power: power }
  }
  addTarget(itemKey = DEFAULT_ITEM_KEY) {
    let item = this.items.get(itemKey)
    if (this.view === null) {
      throw new Error("Build targets require a configured FactoryViewPort")
    }
    let target = this.view.createBuildTarget(this.buildTargets.length, itemKey, item, this.itemGroups)
    this.buildTargets.push(target)
    this.view.mountBuildTarget(target)
    return target
  }
  removeTarget(target) {
    this.buildTargets.splice(target.index, 1)
    for (let i = target.index; i < this.buildTargets.length; i++) {
      this.buildTargets[i].index--
    }
    this.view?.removeBuildTarget(target)
  }
  toggleIgnore(item) {
    let updateTargets = false
    if (this.ignore.has(item)) {
      this.ignore.delete(item)
      if (!this.isItemDisabled(item)) {
        this.priority.removeRecipe(item.disableRecipe)
        updateTargets = true
      }
    } else {
      this.ignore.add(item)
      if (!this.isItemDisabled(item)) {
        let level = this.priority.getFirstLevel()
        let makeNew = true
        for (let r of level) {
          if (r.recipe.isDisable()) {
            makeNew = false
            break
          }
        }
        if (makeNew) {
          level = this.priority.addPriorityBefore(level)
        }
        let hundred = Rational.from_float(100)
        this.priority.addRecipe(item.disableRecipe, hundred, level)
        updateTargets = true
      }
    }
    if (updateTargets) {
      // Update build targets.
      for (let target of this.buildTargets) {
        if (target.item === item) {
          target.displayRecipes()
          target.rateChanged()
        }
      }
    }
  }
  solve() {
    let outputs = []
    for (let target of this.buildTargets) {
      let item = target.item
      let rate = target.getRate()
      let recipe
      if (target.changedBuilding) {
        recipe = target.recipe
      } else {
        recipe = null
      }
      if (target.qualityLevel > 0) {
        let qualityRecipe = target.recipe ?? this.getRecipes(item)[0]
        if (qualityRecipe === undefined) {
          throw new Error(`No recipe is available to produce ${item.name} at the selected quality.`)
        }
        rate = rate.mul(getQualityTargetMultiplier(this, qualityRecipe, target.qualityLevel))
        recipe = qualityRecipe
      }
      outputs.push([item, rate, recipe])
    }
    // JS isn't good at using tuples as Map keys/Set items, so just do this
    // quadratically. It's fine.
    let dedupedOutputs = []
    outer: for (let [origItem, origRate, origRecipe] of outputs) {
      for (let i = 0; i < dedupedOutputs.length; i++) {
        let { item, rate, recipe } = dedupedOutputs[i]
        if (recipe === origRecipe && item === origItem) {
          rate = rate.add(origRate)
          dedupedOutputs[i] = { item, rate, recipe }
          continue outer
        }
      }
      dedupedOutputs.push({
        item: origItem,
        rate: origRate,
        recipe: origRecipe,
      })
    }
    let totals = solve(this as any, dedupedOutputs)
    return totals
  }
  persistUrlState() {
    this.view?.persistUrlState()
  }
  // Backward-compatible name used by existing event handlers.
  setHash() {
    this.persistUrlState()
  }
  // The top-level calculation function. Called whenever the solution
  // requires recalculation.
  updateSolution() {
    try {
      this.lastTotals = this.solve()
      this.lastError = null
      this.populateModuleSpec(this.lastTotals)
      this.display()
    } catch (error) {
      this.lastTotals = null
      this.lastError = error
      this.view?.renderCalculationError(this, error)
      this.persistUrlState()
      if (this.debug) {
        this.view?.renderDebug()
      }
    }
  }
  // Re-renders the current solution, without re-computing it.
  //
  // This is useful for when settings can be applied without altering the
  // solution. In general, if something would alter recipe-rate ratios, then
  // it requires a new solution. If it only alters building counts (e.g.
  // from changing the speed of a building), then we need merely re-display
  // the existing solution.
  display() {
    // Update build target text boxes, if needed.
    for (let target of this.buildTargets) {
      target.getRate()
    }
    if (this.lastTotals === null) {
      if (this.lastError !== null) {
        this.view?.renderCalculationError(this, this.lastError)
      }
    } else {
      this.view?.renderSolution(this, this.lastTotals)
    }
    this.persistUrlState()

    if (this.debug) {
      this.view?.renderDebug()
    }
  }
}

// -----------------------------------------------------------------------------
// Factory store
// -----------------------------------------------------------------------------

let configuredView: FactoryViewPort | null = null

export let spec = new FactorySpecification()

export function configureFactoryView(view: FactoryViewPort) {
  configuredView = view
  spec.view = view
}

export function resetSpec() {
  spec = new FactorySpecification(configuredView)
  return spec
}

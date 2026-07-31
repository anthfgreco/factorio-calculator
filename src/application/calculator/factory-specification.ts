import { Formatter } from "../../core/format/formatter.js"
import { ModuleSpec } from "../../runtime/module.js"
import { Rational, zero, half, one } from "../../core/math/rational.js"
import { solve } from "../../core/solver/solve.js"
import { DEFAULT_BELT, DEFAULT_FUEL, DEFAULT_ITEM_KEY, DEFAULT_PLANET } from "./defaults.js"
import { getBuildingGroups, getCategories } from "./building-groups.js"
import {
  getUserRecipeOverrides,
  isDefaultLocationSelection,
  selectLocation,
  selectOnlyLocation,
  unselectLocation,
} from "./location-policy.js"
import {
  applyPriorities,
  buildDefaultPriorityArray,
  isValidPriorityKey as validatePriorityKey,
  restoreDefaultPriorities,
} from "./priority-policy.js"
import {
  disableRecipe,
  enableRecipe,
  getEnabledRecipes,
  getEnabledUses,
  getRecipeGraph as buildRecipeGraph,
  isFactoryTarget as recipeIsFactoryTarget,
  isItemDisabled as itemIsDisabled,
} from "./recipe-policy.js"
import type { FactoryViewPort } from "./factory-view.js"
import type { PriorityList } from "./priority-model.js"

export class FactorySpecification {
  view: FactoryViewPort | null
  items: Map<string, any> | null
  recipes: Map<string, any> | null
  modules: Map<string, any> | null
  planets: Map<string, any> | null
  buildings: Map<string, any> | null
  buildingKeys: Map<string, any> | null
  belts: Map<string, any> | null
  fuels: Map<string, any> | null
  itemGroups: any
  buildTargets: any[]
  spec: Map<any, any>
  defaultModule: any
  secondaryDefaultModule: any
  defaultBeacon: any[]
  defaultBeaconCount: Rational
  belt: any
  fuel: any
  miningProd: Rational | null
  minerSettings: Map<any, { miner: any; purity: any }>
  ignore: Set<any>
  disable: Set<any>
  selectedPlanets: Set<any>
  planetaryBaseline: Set<any> | null
  priority: PriorityList | null
  defaultPriority: Map<any, Rational>[] | null
  format: Formatter
  lastTotals: any
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
    this.minerSettings = new Map()

    this.ignore = new Set()
    this.disable = new Set()
    this.selectedPlanets = new Set()
    this.planetaryBaseline = null

    this.priority = null
    this.defaultPriority = null

    this.format = new Formatter()

    this.lastTotals = null

    this.lastPartial = null
    this.lastTableau = null
    this.lastMetadata = null
    this.lastSolution = null

    this.debug = false
  }
  setData(items, recipes, planets, modules, buildings, belts, fuels, itemGroups) {
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
    this.itemGroups = itemGroups
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
  getBuilding(recipe) {
    for (let category of getCategories(recipe)) {
      let group = this.buildings.get(category)
      if (group !== undefined) {
        return group.getBuilding(recipe, (building) => this.isBuildingAvailable(building, recipe))
      }
    }
    return null
  }
  getBuildingGroup(building) {
    const category = String(Array.from(building.categories)[0])
    return this.buildings.get(category)
  }
  setMinimumBuilding(building) {
    let group = this.getBuildingGroup(building)
    group.building = building
    for (let [recipe, moduleSpec] of this.spec) {
      let g = null
      for (let category of getCategories(recipe)) {
        g = this.buildings.get(category)
        if (g !== undefined) {
          break
        }
      }
      if (group === g) {
        let b = this.getBuilding(recipe)
        moduleSpec.setBuilding(b, this)
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
    if (m === undefined) {
      return one
    }
    return this.getModuleSpec(recipe).prodEffect(this)
  }
  setDefaultModule(module) {
    for (let [recipe, moduleSpec] of this.spec) {
      for (let i = 0; i < moduleSpec.modules.length; i++) {
        let m = moduleSpec.modules[i]
        if (m === this.defaultModule && (!module || module.canUse(recipe))) {
          moduleSpec.modules[i] = module
        } else if (
          m === this.defaultModule &&
          (!this.secondaryDefaultModule || this.secondaryDefaultModule.canUse(recipe))
        ) {
          moduleSpec.modules[i] = this.secondaryDefaultModule
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
          if (m === this.secondaryDefaultModule && (!module || module.canUse(recipe))) {
            moduleSpec.modules[i] = module
          }
        }
      }
    }
    this.secondaryDefaultModule = module
  }
  // Gets the default module for this recipe, given the current
  // default/secondary settings.
  getDefaultModule(recipe) {
    if (this.defaultModule === null || this.defaultModule.canUse(recipe)) {
      return this.defaultModule
    }
    if (this.secondaryDefaultModule === null || this.secondaryDefaultModule.canUse(recipe)) {
      return this.secondaryDefaultModule
    }
    return null
  }
  isDefaultDefaultBeacon() {
    return this.defaultBeacon[0] === null && this.defaultBeacon[1] === null
  }
  setDefaultBeacon(module, i) {
    for (let [recipe, moduleSpec] of this.spec) {
      let m = moduleSpec.beaconModules[i]
      if (m === this.defaultBeacon[i] && (!module || module.canUse(recipe))) {
        moduleSpec.beaconModules[i] = module
      }
    }
    this.defaultBeacon[i] = module
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
  getBeltCount(rate) {
    return rate.div(this.belt.rate)
  }
  getPowerUsage(recipe, rate) {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return { fuel: null, power: zero }
    }
    let count = this.getCount(recipe, rate)
    if (building.fuel !== null) {
      return { fuel: building.fuel, power: building.power.mul(count) }
    }
    let modules = this.getModuleSpec(recipe)
    let powerEffect
    if (modules) {
      powerEffect = modules.powerEffect(this)
    } else {
      powerEffect = one
    }
    let power = building.power.mul(count).mul(powerEffect).add(building.drain().mul(count.ceil()))
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
    this.lastTotals = this.solve()
    this.populateModuleSpec(this.lastTotals)
    this.display()
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
    this.view?.renderSolution(this, this.lastTotals)
    this.persistUrlState()

    if (this.debug) {
      this.view?.renderDebug()
    }
  }
}

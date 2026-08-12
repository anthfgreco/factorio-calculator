import { Formatter, half, Matrix, one, Rational, zero } from "./math.js"
import {
  Belt,
  Building,
  type ConfigurationSource,
  type Fuel,
  type FuelCollection,
  type ItemGroups,
  Miner,
  Module,
  ModuleSpec,
  Planet,
  Quality,
  normalQuality,
  type RecipeProductivityResearch,
} from "./models.js"
import { PriorityList, type PrioritizedRecipe } from "./priorities.js"
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
import { DisabledRecipe, Item, Recipe } from "./recipes.js"
import {
  solve,
  type SolverItem,
  type SolverOutput,
  type SolverRecipe,
  type SolverSpec,
  type SolverTarget,
  type Totals,
} from "./solver.js"
import { getQualityTargetMultiplier, type QualityTargetFeasibility } from "./planning.js"

// -----------------------------------------------------------------------------
// Calculator defaults
// -----------------------------------------------------------------------------

export const DEFAULT_ITEM_KEY = "advanced-circuit"
export const DEFAULT_PLANET = "nauvis"
export const DEFAULT_BELT = "transport-belt"
export const DEFAULT_FUEL = "coal"
export const DEFAULT_BUILDING_KEYS = new Set([
  "assembling-machine-1",
  "chemical-plant",
  "stone-furnace",
  "electric-mining-drill",
])

// -----------------------------------------------------------------------------
// Factory application contracts
// -----------------------------------------------------------------------------

export type FactoryRecipe = Recipe | DisabledRecipe
export type TargetBasis = "machines" | "rate" | "belts"
export type BeltStackPolicy = "auto" | "stacked" | "unstacked"

export function isBeltStackPolicy(value: string): value is BeltStackPolicy {
  return value === "auto" || value === "stacked" || value === "unstacked"
}

export interface FactoryBuildTarget {
  index: number
  itemKey: string
  item: Item
  recipe: Recipe | null
  readonly changedBuilding: boolean
  basis: TargetBasis
  buildings: Rational
  rate: Rational
  belts: Rational
  qualityLevel: number
  readonly defaultRecipe: Recipe | null
  getRate(): Rational
  getBuildingCountInput(): string
  getBeltCountInput(): string
  setBuildings(value: string, recipe: Recipe | null): void
  setRate(value: string): void
  setBelts(value: string): void
  setQuality(level: number | string): void
  displayRecipes(): void
  rateChanged(): void
  invalidateQualityUndo?(recipe: Recipe): void
}

export interface RecipeConfigurationSnapshot {
  readonly hasBuildingOverride: boolean
  readonly buildingOverride: Building | null
  readonly buildingOverrideSource: ConfigurationSource
  readonly revision: number
  readonly machineQualityOverride: Quality | null
  readonly moduleSpec: {
    readonly object: ModuleSpec
    readonly building: Building | null
    readonly modules: readonly (Module | null)[]
    readonly moduleQualities: readonly Quality[]
    readonly moduleQualityOverrides: readonly number[]
    readonly moduleSource: ConfigurationSource
    readonly beaconModules: readonly (Module | null)[]
    readonly beaconModuleQualities: readonly Quality[]
    readonly beaconModuleQualityOverrides: readonly number[]
    readonly beaconQuality: Quality
    readonly beaconQualityOverride: boolean
    readonly beaconCount: Rational
  } | null
}

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
  createBuildTarget(index: number, itemKey: string, item: Item, itemGroups: ItemGroups): FactoryBuildTarget
  mountBuildTarget(target: FactoryBuildTarget): void
  removeBuildTarget(target: FactoryBuildTarget): void
  renderSolution(specification: FactorySpecification, totals: Totals): void
  renderCalculationError(specification: FactorySpecification, error: unknown): void
  persistUrlState(): void
  renderDebug(): void
}

// -----------------------------------------------------------------------------
// Building groups
// -----------------------------------------------------------------------------

export interface CategoryOwner {
  readonly categories?: Iterable<string> | string
  readonly category?: string | null
}

export function getCategories(value: CategoryOwner): string[] {
  const categories = value.categories ?? value.category
  if (categories === undefined || categories === null) return []
  return typeof categories === "string" ? [categories] : [...categories]
}

export function buildingCanCraft(building: Building, recipe: Recipe): boolean {
  return getCategories(recipe).some((category) => building.categories.has(category))
}

class BuildingSet {
  readonly categories = new Set<string>()
  readonly buildings = new Set<Building>()

  constructor(building: Building | null = null) {
    if (building !== null) {
      for (const category of building.categories) this.categories.add(category)
      this.buildings.add(building)
    }
  }

  merge(other: BuildingSet): void {
    for (const category of other.categories) this.categories.add(category)
    for (const building of other.buildings) this.buildings.add(building)
  }

  overlaps(other: BuildingSet): boolean {
    return [...this.categories].some((category) => other.categories.has(category))
  }
}

export function buildingSort(buildings: Building[]): void {
  buildings.sort((a, b) => (a.less(b) ? -1 : b.less(a) ? 1 : 0))
}

export class BuildingGroup {
  readonly buildings: Building[]
  building: Building
  selectedBuildings: Set<Building>

  constructor(buildingSet: Iterable<Building>) {
    this.buildings = [...buildingSet]
    buildingSort(this.buildings)
    const defaultBuildings = this.getDefaults()
    const defaultBuilding = defaultBuildings[0]
    if (defaultBuilding === undefined) throw new Error("Building group cannot be empty")
    this.building = defaultBuilding
    this.selectedBuildings = new Set(defaultBuildings)
  }

  getDefaults(): Building[] {
    const defaults = this.buildings.filter((building) => DEFAULT_BUILDING_KEYS.has(building.key))
    if (defaults.length > 0) return defaults
    const fallback = this.buildings.at(-1)
    return fallback === undefined ? [] : [fallback]
  }

  getDefault(): Building | null {
    return this.getDefaults()[0] ?? null
  }

  getBuilding(recipe: Recipe, available: (building: Building) => boolean = () => true): Building | null {
    let fallback: Building | null = null
    let selected: Building | null = null
    for (const building of this.buildings) {
      if (buildingCanCraft(building, recipe) && available(building)) {
        fallback = building
        if (this.selectedBuildings.has(building)) selected = building
      }
    }
    return selected ?? fallback
  }
}

function mergeBuildingSet(sets: Set<BuildingSet>, buildingSet: BuildingSet): void {
  for (const other of [...sets]) {
    if (buildingSet.overlaps(other)) {
      buildingSet.merge(other)
      sets.delete(other)
    }
  }
  sets.add(buildingSet)
}

export function getBuildingGroups(
  buildings: readonly Building[],
  recipes: Iterable<Recipe>,
): Map<string, BuildingGroup> {
  const sets = new Set<BuildingSet>()
  for (const building of buildings) mergeBuildingSet(sets, new BuildingSet(building))

  for (const recipe of recipes) {
    const categories = getCategories(recipe)
    if (categories.length < 2) continue
    const set = new BuildingSet()
    for (const category of categories) set.categories.add(category)
    mergeBuildingSet(sets, set)
  }

  const groups = new Map<string, BuildingGroup>()
  for (const { categories, buildings: groupBuildings } of sets) {
    if (groupBuildings.size === 0) continue
    const group = new BuildingGroup(groupBuildings)
    for (const category of categories) groups.set(category, group)
  }
  return groups
}

// -----------------------------------------------------------------------------
// Location policy
// -----------------------------------------------------------------------------

export function syncLocationDisabledRecipes(specification: FactorySpecification): void {
  const selected = [...specification.selectedPlanets]
  const first = selected[0]
  const unavailable =
    first === undefined
      ? new Set<Recipe>()
      : selected
          .slice(1)
          .reduce(
            (intersection, location) => new Set([...intersection].filter((recipe) => location.disable.has(recipe))),
            new Set(first.disable),
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

export function isDefaultLocationSelection(specification: FactorySpecification): boolean {
  if (!specification.planets || specification.planets.size === 1) {
    return true
  }
  const selected = [...specification.selectedPlanets]
  return selected.length === 1 && selected[0]?.key === DEFAULT_PLANET
}

export function getUserRecipeOverrides(specification: FactorySpecification): {
  disable: Set<Recipe>
  enable: Set<Recipe>
} {
  if (!specification.planetaryBaseline) {
    return { disable: specification.disable, enable: new Set<Recipe>() }
  }
  const baseline = specification.planetaryBaseline
  return {
    disable: new Set([...specification.disable].filter((recipe) => !baseline.has(recipe))),
    enable: new Set([...baseline].filter((recipe) => !specification.disable.has(recipe))),
  }
}

export function selectOnlyLocation(specification: FactorySpecification, location: Planet): void {
  specification.selectedPlanets.clear()
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function selectLocation(specification: FactorySpecification, location: Planet): void {
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function unselectLocation(specification: FactorySpecification, location: Planet): void {
  specification.selectedPlanets.delete(location)
  syncLocationDisabledRecipes(specification)
}

export function getRecipeLocations(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building | null = null,
): Planet[] {
  if (!specification.selectedPlanets || specification.selectedPlanets.size === 0) {
    return []
  }

  const result: Planet[] = []
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

export function getItemProductionRecipes(item: Item): Recipe[] {
  return item.recipes.filter((recipe) => !recipe.isDisable() && recipe.isReal() && recipe.isNetProducer(item))
}

export function setRecipeEnabled(specification: FactorySpecification, recipe: Recipe, enabled: boolean): void {
  if (enabled) {
    specification.setEnable(recipe)
  } else {
    specification.setDisable(recipe)
  }
}

// -----------------------------------------------------------------------------
// Factory specification
// -----------------------------------------------------------------------------

function replaceMap<TKey, TValue>(target: Map<TKey, TValue>, source: ReadonlyMap<TKey, TValue>): void {
  target.clear()
  for (const [key, value] of source) target.set(key, value)
}

export class FactorySpecification {
  view: FactoryViewPort | null
  readonly items = new Map<string, Item>()
  readonly recipes = new Map<string, Recipe>()
  readonly modules = new Map<string, Module>()
  readonly qualities = new Map<string, Quality>()
  readonly qualityTiers: Quality[] = []
  planets: Map<string, Planet> | null = null
  readonly buildings = new Map<string, BuildingGroup>()
  readonly buildingKeys = new Map<string, Building>()
  readonly buildingOverrides = new Map<Recipe, Building>()
  readonly buildingOverrideSources = new Map<Recipe, ConfigurationSource>()
  readonly machineQualityOverrides = new Map<Recipe, Quality>()
  readonly recipeConfigurationRevisions = new Map<Recipe, number>()
  readonly belts = new Map<string, Belt>()
  fuels: FuelCollection | null = null
  itemGroups: ItemGroups = []
  readonly buildTargets: FactoryBuildTarget[] = []
  readonly spec = new Map<Recipe, ModuleSpec>()
  defaultModule: Module | null = null
  secondaryDefaultModule: Module | null = null
  defaultMachineQuality: Quality = normalQuality
  defaultModuleQuality: Quality = normalQuality
  defaultBeaconQuality: Quality = normalQuality
  readonly defaultBeacon: (Module | null)[] = [null, null]
  defaultBeaconCount = zero
  belt: Belt | null = null
  fuel: Fuel | null = null
  miningProd = zero
  recipeProductivityResearch = new Map<string, RecipeProductivityResearch>()
  readonly recipeProductivityLevels = new Map<string, number>()
  readonly recipeProductivityEffects = new Map<Recipe, { researchKey: string; change: Rational }[]>()
  readonly minerSettings = new Map<Recipe, { miner: Miner; purity: Rational }>()
  readonly ignore = new Set<Item>()
  readonly disable = new Set<Recipe>()
  readonly selectedPlanets = new Set<Planet>()
  planetaryBaseline: Set<Recipe> | null = null
  priority = new PriorityList()
  defaultPriority: Map<PrioritizedRecipe, Rational>[] = []
  beltStackSize = one
  beltStackDefaultPolicy: BeltStackPolicy = "auto"
  readonly beltStackOverrides = new Map<Item, BeltStackPolicy>()
  bufferMinutes = one
  freshnessDelayMinutes = zero
  readonly resourceYields = new Map<Recipe, Rational>()
  readonly asteroidLimits = new Map<string, Rational>()
  readonly recipeLocations = new Map<Recipe, Planet>()
  beaconPower = zero
  maxQualityLevel = 4
  readonly format = new Formatter()
  lastTotals: Totals | null = null
  lastError: unknown = null
  lastPartial: unknown = null
  lastTableau: Matrix | null = null
  lastMetadata: unknown = null
  lastSolution: Matrix | null = null
  debug = false
  private readonly stateListeners = new Set<() => void>()
  private stateRevision = 0

  constructor(view: FactoryViewPort | null = null) {
    this.view = view
  }
  get revision(): number {
    return this.stateRevision
  }
  subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }
  notifyStateChanged(): void {
    this.stateRevision++
    for (const listener of this.stateListeners) listener()
  }
  setData(
    items: ReadonlyMap<string, Item>,
    recipes: ReadonlyMap<string, Recipe>,
    planets: Map<string, Planet> | null,
    modules: ReadonlyMap<string, Module>,
    buildings: readonly Building[],
    belts: ReadonlyMap<string, Belt>,
    fuels: FuelCollection,
    itemGroups: ItemGroups,
    recipeProductivityResearch: Map<string, RecipeProductivityResearch> = new Map(),
    beaconPower: Rational = zero,
    qualities: ReadonlyMap<string, Quality> = new Map([[normalQuality.key, normalQuality]]),
  ): void {
    replaceMap(this.items, items)
    replaceMap(this.recipes, recipes)
    this.planets = planets
    replaceMap(this.modules, modules)
    replaceMap(this.qualities, qualities)
    this.qualityTiers.splice(
      0,
      this.qualityTiers.length,
      ...[...qualities.values()].sort((a, b) => a.order.localeCompare(b.order)),
    )
    const normal = this.qualities.get("normal") ?? this.qualityTiers[0] ?? normalQuality
    this.defaultMachineQuality = normal
    this.defaultModuleQuality = normal
    this.defaultBeaconQuality = normal
    this.machineQualityOverrides.clear()
    replaceMap(this.buildings, getBuildingGroups(buildings, recipes.values()))
    this.buildingKeys.clear()
    for (const building of buildings) this.buildingKeys.set(building.key, building)
    replaceMap(this.belts, belts)
    this.belt = this.belts.get(DEFAULT_BELT) ?? null
    this.fuels = fuels
    this.fuel = fuels.get(DEFAULT_FUEL) ?? null
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
    this.priority = new PriorityList()
    this.notifyStateChanged()
  }
  setDefaultDisable(): void {
    this.disable.clear()
  }
  setDisable(recipe: Recipe): void {
    disableRecipe(this, recipe)
  }
  setEnable(recipe: Recipe): void {
    enableRecipe(this, recipe)
  }
  isDefaultPlanet(): boolean {
    return isDefaultLocationSelection(this)
  }
  getNetDisable(): { disable: Set<Recipe>; enable: Set<Recipe> } {
    return getUserRecipeOverrides(this)
  }
  selectOnePlanet(planet: Planet): void {
    selectOnlyLocation(this, planet)
  }
  selectPlanet(planet: Planet): void {
    selectLocation(this, planet)
  }
  unselectPlanet(planet: Planet): void {
    unselectLocation(this, planet)
  }
  getDefaultPriorityArray(): Map<PrioritizedRecipe, Rational>[] {
    return buildDefaultPriorityArray(this)
  }
  setDefaultPriority(): void {
    restoreDefaultPriorities(this)
  }
  isValidPriorityKey(key: string): boolean {
    return validatePriorityKey(this, key)
  }
  setPriorities(tiers: readonly (readonly (readonly [string, Rational])[])[]): void {
    applyPriorities(this, tiers)
  }
  isDefaultPriority(): boolean {
    return this.priority.equalArray(this.defaultPriority)
  }
  getUses(item: Item): Recipe[] {
    return getEnabledUses(this, item)
  }
  isItemDisabled(item: Item): boolean {
    return itemIsDisabled(this, item)
  }
  getRecipes(item: Item): FactoryRecipe[] {
    return getEnabledRecipes(this, item)
  }
  getRecipeGraph(items: ReadonlyMap<Item, Rational>): Set<FactoryRecipe> {
    return buildRecipeGraph(this, items)
  }
  isFactoryTarget(recipe: Recipe): boolean {
    return recipeIsFactoryTarget(this, recipe)
  }
  isBuildingAvailable(building: Building, recipe: Recipe): boolean {
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
  getCompatibleBuildings(recipe: Recipe, availableOnly = true): Building[] {
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
  getAutomaticBuilding(recipe: Recipe): Building | null {
    for (let category of getCategories(recipe)) {
      let group = this.buildings.get(category)
      if (group !== undefined) {
        return group.getBuilding(recipe, (building) => this.isBuildingAvailable(building, recipe))
      }
    }
    return null
  }
  getBuildingOverride(recipe: Recipe): Building | null {
    return this.buildingOverrides.get(recipe) ?? null
  }
  getBuildingOverrideSource(recipe: Recipe): ConfigurationSource {
    if (!this.buildingOverrides.has(recipe)) return "default"
    return this.buildingOverrideSources.get(recipe) ?? "user"
  }
  getBuilding(recipe: Recipe): Building | null {
    return this.getBuildingOverride(recipe) ?? this.getAutomaticBuilding(recipe)
  }
  getNormalQuality(): Quality {
    return this.qualities.get("normal") ?? this.qualityTiers[0] ?? normalQuality
  }
  getQualityIndex(quality: Quality): number {
    return Math.max(0, this.qualityTiers.indexOf(quality))
  }
  getAvailableQualities(): readonly Quality[] {
    return this.qualityTiers.slice(0, this.maxQualityLevel + 1)
  }
  setMaxQualityLevel(level: number): void {
    const maximum = Math.max(0, this.qualityTiers.length - 1)
    this.maxQualityLevel = Number.isFinite(level) ? Math.min(maximum, Math.max(0, Math.floor(level))) : maximum
    const normal = this.getNormalQuality()
    const available = new Set(this.getAvailableQualities())
    if (!available.has(this.defaultMachineQuality)) this.defaultMachineQuality = normal
    if (!available.has(this.defaultModuleQuality)) this.defaultModuleQuality = normal
    if (!available.has(this.defaultBeaconQuality)) this.defaultBeaconQuality = normal
    for (const [recipe, quality] of this.machineQualityOverrides) {
      if (!available.has(quality)) this.machineQualityOverrides.delete(recipe)
    }
    for (const moduleSpec of this.spec.values()) {
      for (let index = 0; index < moduleSpec.moduleQualities.length; index++) {
        if (!available.has(moduleSpec.moduleQualities[index] ?? normal)) {
          moduleSpec.moduleQualities[index] = normal
          moduleSpec.moduleQualityOverrides.delete(index)
        }
      }
      for (let index = 0; index < moduleSpec.beaconModuleQualities.length; index++) {
        if (!available.has(moduleSpec.beaconModuleQualities[index] ?? normal)) {
          moduleSpec.beaconModuleQualities[index] = normal
          moduleSpec.beaconModuleQualityOverrides.delete(index)
        }
      }
      if (!available.has(moduleSpec.beaconQuality)) {
        moduleSpec.beaconQuality = normal
        moduleSpec.beaconQualityOverride = false
      }
    }
  }
  private getMachineQualityRecipe(recipe: Recipe): Recipe {
    return recipe.key === "rocket-launch" ? (this.recipes.get("rocket-part") ?? recipe) : recipe
  }
  getMachineQuality(recipe: Recipe): Quality {
    return this.machineQualityOverrides.get(this.getMachineQualityRecipe(recipe)) ?? this.defaultMachineQuality
  }
  setMachineQuality(recipe: Recipe, quality: Quality, source: ConfigurationSource = "user"): void {
    const qualityRecipe = this.getMachineQualityRecipe(recipe)
    if (quality === this.defaultMachineQuality) this.machineQualityOverrides.delete(qualityRecipe)
    else this.machineQualityOverrides.set(qualityRecipe, quality)
    if (source === "user") this.notifyRecipeConfigurationChanged(recipe)
    else this.recordRecipeConfigurationChange(recipe)
    if (qualityRecipe !== recipe) this.recordRecipeConfigurationChange(qualityRecipe)
  }
  setDefaultMachineQuality(quality: Quality): void {
    this.defaultMachineQuality = quality
    this.notifyStateChanged()
  }
  setDefaultModuleQuality(quality: Quality): void {
    for (const moduleSpec of this.spec.values()) {
      for (let index = 0; index < moduleSpec.moduleQualities.length; index++) {
        if (!moduleSpec.moduleQualityOverrides.has(index)) moduleSpec.moduleQualities[index] = quality
      }
      for (let index = 0; index < moduleSpec.beaconModuleQualities.length; index++) {
        if (!moduleSpec.beaconModuleQualityOverrides.has(index)) moduleSpec.beaconModuleQualities[index] = quality
      }
    }
    this.defaultModuleQuality = quality
    this.notifyStateChanged()
  }
  setDefaultBeaconQuality(quality: Quality): void {
    for (const moduleSpec of this.spec.values()) {
      if (!moduleSpec.beaconQualityOverride) moduleSpec.beaconQuality = quality
    }
    this.defaultBeaconQuality = quality
    this.notifyStateChanged()
  }
  setBuildingOverride(recipe: Recipe, building: Building | null, source: ConfigurationSource = "user"): boolean {
    if (building !== null && (!buildingCanCraft(building, recipe) || !this.isBuildingAvailable(building, recipe))) {
      return false
    }

    if (building === null) {
      this.buildingOverrides.delete(recipe)
      this.buildingOverrideSources.delete(recipe)
    } else {
      this.buildingOverrides.set(recipe, building)
      this.buildingOverrideSources.set(recipe, source)
    }

    let moduleSpec = this.spec.get(recipe)
    let selectedBuilding = this.getBuilding(recipe)
    if (moduleSpec !== undefined && selectedBuilding !== null && moduleSpec.building !== selectedBuilding) {
      moduleSpec.setBuilding(selectedBuilding, this)
    }
    if (source === "user") this.notifyRecipeConfigurationChanged(recipe)
    else this.recordRecipeConfigurationChange(recipe)
    return true
  }
  recordRecipeConfigurationChange(recipe: Recipe): void {
    this.recipeConfigurationRevisions.set(recipe, (this.recipeConfigurationRevisions.get(recipe) ?? 0) + 1)
  }
  notifyRecipeConfigurationChanged(recipe: Recipe): void {
    this.recordRecipeConfigurationChange(recipe)
    for (const target of this.buildTargets) {
      if (target.recipe === recipe) {
        target.invalidateQualityUndo?.(recipe)
      }
    }
  }
  captureRecipeConfiguration(recipe: Recipe): RecipeConfigurationSnapshot {
    const moduleSpec = this.spec.get(recipe)
    return {
      hasBuildingOverride: this.buildingOverrides.has(recipe),
      buildingOverride: this.buildingOverrides.get(recipe) ?? null,
      buildingOverrideSource: this.getBuildingOverrideSource(recipe),
      machineQualityOverride: this.machineQualityOverrides.get(this.getMachineQualityRecipe(recipe)) ?? null,
      revision: this.getRecipeConfigurationRevision(recipe),
      moduleSpec:
        moduleSpec === undefined
          ? null
          : {
              object: moduleSpec,
              building: moduleSpec.building,
              modules: [...moduleSpec.modules],
              moduleQualities: [...moduleSpec.moduleQualities],
              moduleQualityOverrides: [...moduleSpec.moduleQualityOverrides],
              moduleSource: moduleSpec.moduleSource,
              beaconModules: [...moduleSpec.beaconModules],
              beaconModuleQualities: [...moduleSpec.beaconModuleQualities],
              beaconModuleQualityOverrides: [...moduleSpec.beaconModuleQualityOverrides],
              beaconQuality: moduleSpec.beaconQuality,
              beaconQualityOverride: moduleSpec.beaconQualityOverride,
              beaconCount: moduleSpec.beaconCount,
            },
    }
  }
  restoreRecipeConfiguration(recipe: Recipe, snapshot: RecipeConfigurationSnapshot): void {
    const qualityRecipe = this.getMachineQualityRecipe(recipe)
    if (snapshot.machineQualityOverride === null) this.machineQualityOverrides.delete(qualityRecipe)
    else this.machineQualityOverrides.set(qualityRecipe, snapshot.machineQualityOverride)
    if (snapshot.hasBuildingOverride) {
      if (snapshot.buildingOverride === null) throw new Error("Invalid building override snapshot")
      this.buildingOverrides.set(recipe, snapshot.buildingOverride)
      this.buildingOverrideSources.set(recipe, snapshot.buildingOverrideSource)
    } else {
      this.buildingOverrides.delete(recipe)
      this.buildingOverrideSources.delete(recipe)
    }

    if (snapshot.moduleSpec === null) {
      this.spec.delete(recipe)
      return
    }

    const moduleSpec = snapshot.moduleSpec.object
    moduleSpec.building = snapshot.moduleSpec.building
    moduleSpec.modules.splice(0, moduleSpec.modules.length, ...snapshot.moduleSpec.modules)
    moduleSpec.moduleQualities.splice(0, moduleSpec.moduleQualities.length, ...snapshot.moduleSpec.moduleQualities)
    moduleSpec.moduleQualityOverrides.clear()
    for (const index of snapshot.moduleSpec.moduleQualityOverrides) moduleSpec.moduleQualityOverrides.add(index)
    moduleSpec.moduleSource = snapshot.moduleSpec.moduleSource
    moduleSpec.beaconModules.splice(0, moduleSpec.beaconModules.length, ...snapshot.moduleSpec.beaconModules)
    moduleSpec.beaconModuleQualities.splice(
      0,
      moduleSpec.beaconModuleQualities.length,
      ...snapshot.moduleSpec.beaconModuleQualities,
    )
    moduleSpec.beaconModuleQualityOverrides.clear()
    for (const index of snapshot.moduleSpec.beaconModuleQualityOverrides) {
      moduleSpec.beaconModuleQualityOverrides.add(index)
    }
    moduleSpec.beaconQuality = snapshot.moduleSpec.beaconQuality
    moduleSpec.beaconQualityOverride = snapshot.moduleSpec.beaconQualityOverride
    moduleSpec.beaconCount = snapshot.moduleSpec.beaconCount
    this.spec.set(recipe, moduleSpec)
  }
  getRecipeConfigurationFingerprint(recipe: Recipe): string {
    const moduleSpec = this.spec.get(recipe)
    const moduleKey = (module: Module | Building | null | undefined): string | null =>
      module === null || module === undefined ? null : module.key
    return JSON.stringify({
      buildingOverride: this.buildingOverrides.has(recipe) ? (this.buildingOverrides.get(recipe)?.key ?? null) : null,
      buildingOverrideSource: this.getBuildingOverrideSource(recipe),
      machineQuality: this.getMachineQuality(recipe).key,
      moduleBuilding: moduleKey(moduleSpec?.building),
      modules: moduleSpec?.modules?.map(moduleKey) ?? null,
      moduleQualities: moduleSpec?.moduleQualities.map((quality) => quality.key) ?? null,
      moduleQualityOverrides:
        moduleSpec === undefined ? null : [...moduleSpec.moduleQualityOverrides].sort((a, b) => a - b),
      moduleSource: moduleSpec?.moduleSource ?? "default",
      beaconModules: moduleSpec?.beaconModules?.map(moduleKey) ?? null,
      beaconModuleQualities: moduleSpec?.beaconModuleQualities.map((quality) => quality.key) ?? null,
      beaconModuleQualityOverrides:
        moduleSpec === undefined ? null : [...moduleSpec.beaconModuleQualityOverrides].sort((a, b) => a - b),
      beaconQuality: moduleSpec?.beaconQuality.key ?? null,
      beaconQualityOverride: moduleSpec?.beaconQualityOverride ?? false,
      beaconCount: moduleSpec?.beaconCount?.toString() ?? null,
    })
  }
  getRecipeConfigurationRevision(recipe: Recipe): number {
    return this.recipeConfigurationRevisions.get(recipe) ?? 0
  }
  applyQualityTargetConfiguration(recipe: Recipe, recommendation: QualityTargetFeasibility): boolean {
    if (recommendation?.status !== "auto-configurable") return false
    const { building, module, slotCount } = recommendation
    if (!this.setBuildingOverride(recipe, building, "automatic-quality")) return false
    const moduleSpec = this.getModuleSpec(recipe)
    if (moduleSpec === null || moduleSpec.building !== building || !module.canUse(recipe, building)) return false
    for (let index = 0; index < slotCount; index++) {
      if (!moduleSpec.setModule(index, module, "automatic-quality")) {
        // setModule returns false when an effect-neutral module is selected;
        // the assignment is still valid, so only reject an unavailable slot.
        if (moduleSpec.getModule(index) !== module) return false
      }
    }
    moduleSpec.moduleSource = "automatic-quality"
    return true
  }
  getBuildingGroup(building: Building): BuildingGroup {
    const category = building.categories.values().next().value
    const group = category === undefined ? undefined : this.buildings.get(category)
    if (group === undefined) throw new Error(`No building group found for ${building.key}`)
    return group
  }
  setMinimumBuilding(building: Building): void {
    let group = this.getBuildingGroup(building)
    group.building = building
    group.selectedBuildings = new Set([building])
    this.updateBuildingGroup(group)
  }
  setAutomaticBuildingPreferences(buildings: readonly Building[]): void {
    const selections = new Map<BuildingGroup, Building[]>()
    for (let building of buildings) {
      let group = this.getBuildingGroup(building)
      let selected = selections.get(group)
      if (selected === undefined) {
        selected = []
        selections.set(group, selected)
      }
      selected.push(building)
    }

    for (const group of new Set<BuildingGroup>(this.buildings.values())) {
      const selected = selections.get(group) ?? group.getDefaults()
      const minimum = selected[0]
      if (minimum === undefined) continue
      this.setMinimumBuilding(minimum)
      for (let building of selected.slice(1)) {
        this.setAutomaticBuildingEnabled(building, true)
      }
    }
  }
  resetAutomaticBuildingPreferences(): void {
    this.setAutomaticBuildingPreferences([])
  }
  clearBuildingOverrides(): void {
    for (let recipe of [...this.buildingOverrides.keys()]) {
      this.setBuildingOverride(recipe, null)
    }
  }
  setAutomaticBuildingEnabled(building: Building, enabled: boolean): boolean {
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
  isAutomaticBuildingEnabled(building: Building): boolean {
    return this.getBuildingGroup(building).selectedBuildings.has(building)
  }
  updateBuildingGroup(group: BuildingGroup): void {
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
  initModuleSpec(recipe: Recipe, building: Building | null): ModuleSpec | null {
    if (!this.spec.has(recipe) && building !== null && building.canBeacon()) {
      const moduleSpec = new ModuleSpec(recipe, this)
      moduleSpec.setBuilding(building, this)
      this.spec.set(recipe, moduleSpec)
      return moduleSpec
    }
    return null
  }
  populateModuleSpec(totals: Totals): void {
    for (const recipe of totals.rates.keys()) {
      if (!(recipe instanceof Recipe)) continue
      const building = this.getBuilding(recipe)
      this.initModuleSpec(recipe, building)
    }
  }
  getModuleSpec(recipe: Recipe): ModuleSpec | null {
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
  getProdEffect(recipe: Recipe): Rational {
    let m = this.getModuleSpec(recipe)
    const effect = m === null ? one : m.prodEffect(this)
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
  getRecipeProductivityBonus(recipe: Recipe): Rational {
    let bonus = zero
    for (let effect of this.recipeProductivityEffects.get(recipe) ?? []) {
      let level = this.getRecipeProductivityLevel(effect.researchKey)
      bonus = bonus.add(effect.change.mul(Rational.from_float_approximate(level)))
    }
    return bonus
  }
  setDefaultModule(module: Module | null): void {
    for (let [recipe, moduleSpec] of this.spec) {
      if (moduleSpec.moduleSource !== "default") continue
      let changed = false
      for (let i = 0; i < moduleSpec.modules.length; i++) {
        if (moduleSpec.modules[i] !== this.defaultModule) {
          continue
        }
        if (module === null || module.canUse(recipe, moduleSpec.building)) {
          moduleSpec.modules[i] = module
          changed = true
        } else if (
          this.secondaryDefaultModule === null ||
          this.secondaryDefaultModule.canUse(recipe, moduleSpec.building)
        ) {
          moduleSpec.modules[i] = this.secondaryDefaultModule
          changed = true
        } else {
          moduleSpec.modules[i] = null
          changed = true
        }
      }
      if (changed) this.notifyRecipeConfigurationChanged(recipe)
    }
    this.defaultModule = module
  }
  setSecondaryDefaultModule(module: Module | null): void {
    if (this.secondaryDefaultModule !== this.defaultModule) {
      for (let [recipe, moduleSpec] of this.spec) {
        if (moduleSpec.moduleSource !== "default") continue
        let changed = false
        for (let i = 0; i < moduleSpec.modules.length; i++) {
          let m = moduleSpec.modules[i]
          if (m === this.secondaryDefaultModule) {
            moduleSpec.modules[i] = !module || module.canUse(recipe, moduleSpec.building) ? module : null
            changed = true
          }
        }
        if (changed) this.notifyRecipeConfigurationChanged(recipe)
      }
    }
    this.secondaryDefaultModule = module
  }
  // Gets the default module for this recipe, given the current
  // default/secondary settings.
  getDefaultModule(recipe: Recipe, building: Building | null = this.getBuilding(recipe)): Module | null {
    if (this.defaultModule === null || this.defaultModule.canUse(recipe, building)) {
      return this.defaultModule
    }
    if (this.secondaryDefaultModule === null || this.secondaryDefaultModule.canUse(recipe, building)) {
      return this.secondaryDefaultModule
    }
    return null
  }
  isDefaultDefaultBeacon(): boolean {
    return this.defaultBeacon[0] === null && this.defaultBeacon[1] === null
  }
  setDefaultBeacon(module: Module | null, i: number): void {
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
  setDefaultBeaconCount(count: Rational): void {
    for (let [recipe, moduleSpec] of this.spec) {
      if (moduleSpec.beaconCount.equal(this.defaultBeaconCount)) {
        moduleSpec.beaconCount = count
      }
    }
    this.defaultBeaconCount = count
  }
  // Returns the recipe-rate at which a single building can produce a recipe.
  // Returns null for recipes that do not have a building.
  getRecipeRate(recipe: Recipe): Rational | null {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return null
    }
    return building.getRecipeRate(this, recipe)
  }
  setMiner(recipe: Recipe, miner: Miner, purity: Rational): void {
    this.minerSettings.set(recipe, { miner, purity })
  }
  getCount(recipe: Recipe, rate: Rational): Rational {
    let building = this.getBuilding(recipe)
    if (building === null) {
      return zero
    }
    return building.getCount(this, recipe, rate)
  }
  getResourceYield(recipe: Recipe): Rational {
    return this.resourceYields.get(recipe) ?? one
  }
  setResourceYield(recipe: Recipe, value: Rational): void {
    this.resourceYields.set(recipe, Rational.max(Rational.from_floats(1, 100), value))
  }
  setRecipeLocation(recipe: Recipe, location: Planet | null): void {
    if (location === null) this.recipeLocations.delete(recipe)
    else this.recipeLocations.set(recipe, location)
  }
  getBeltStackPolicy(item: Item): BeltStackPolicy {
    return this.beltStackOverrides.get(item) ?? this.beltStackDefaultPolicy
  }
  getBeltStackPolicySource(item: Item): "default" | "override" {
    return this.beltStackOverrides.has(item) ? "override" : "default"
  }
  setBeltStackOverride(item: Item, policy: BeltStackPolicy | null): void {
    if (policy === null) this.beltStackOverrides.delete(item)
    else this.beltStackOverrides.set(item, policy)
  }
  isItemAutomaticallyBeltStacked(item: Item, recipe: Recipe | null = null): boolean {
    if (recipe !== null) return this.getBuilding(recipe)?.dropsFullBeltStacks ?? false
    const producers = this.lastTotals?.producers.get(item)
    if (producers === undefined || producers.size === 0) return false
    for (const producer of producers.keys()) {
      if (!(producer instanceof Recipe) || !(this.getBuilding(producer)?.dropsFullBeltStacks ?? false)) return false
    }
    return true
  }
  getEffectiveBeltStackSize(item: Item, recipe: Recipe | null = null): Rational {
    const policy = this.getBeltStackPolicy(item)
    if (policy === "stacked" || (policy === "auto" && this.isItemAutomaticallyBeltStacked(item, recipe))) {
      return this.beltStackSize
    }
    return one
  }
  getBeltCount(item: Item, rate: Rational, recipe: Recipe | null = null): Rational {
    if (this.belt === null) throw new Error("No transport belt is selected")
    return rate.div(this.belt.rate.mul(this.getEffectiveBeltStackSize(item, recipe)))
  }
  getRateForBeltCount(item: Item, beltCount: Rational, recipe: Recipe | null = null): Rational {
    if (this.belt === null) throw new Error("No transport belt is selected")
    return this.belt.rate.mul(this.getEffectiveBeltStackSize(item, recipe)).mul(beltCount)
  }
  getFuelForBuilding(building: Building | null): Fuel | null {
    if (building === null || building.fuel === null || this.fuels === null) {
      return null
    }
    let fuel = this.fuels.getForCategory(building.fuel, this.fuel)
    if (fuel === null) {
      throw new Error(`No fuel item is available for the ${building.fuel} fuel category`)
    }
    return fuel
  }
  getFuelForRecipe(recipe: Recipe): Fuel | null {
    return this.getFuelForBuilding(this.getBuilding(recipe))
  }
  getPowerUsage(recipe: Recipe, rate: Rational): { fuel: string | null; power: Rational } {
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
    const quality = this.getMachineQuality(recipe)
    let power = building.powerForQuality(quality).mul(count).mul(powerEffect)
    if (building.fuel !== null) {
      return { fuel: building.fuel, power }
    }
    power = power.add(building.drainForQuality(quality).mul(count.ceil()))
    return { fuel: "electric", power: power }
  }
  addTarget(itemKey = DEFAULT_ITEM_KEY): FactoryBuildTarget {
    const item = this.items.get(itemKey)
    if (item === undefined) throw new Error(`Unknown target item: ${itemKey}`)
    if (this.view === null) {
      throw new Error("Build targets require a configured FactoryViewPort")
    }
    let target = this.view.createBuildTarget(this.buildTargets.length, itemKey, item, this.itemGroups)
    this.buildTargets.push(target)
    this.view.mountBuildTarget(target)
    return target
  }
  removeTarget(target: FactoryBuildTarget): void {
    this.buildTargets.splice(target.index, 1)
    for (let i = target.index; i < this.buildTargets.length; i++) {
      const current = this.buildTargets[i]
      if (current !== undefined) current.index--
    }
    this.view?.removeBuildTarget(target)
  }
  toggleIgnore(item: Item): void {
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
        let makeNew = level === null
        for (const r of level ?? []) {
          if (r.recipe.isDisable()) {
            makeNew = false
            break
          }
        }
        if (makeNew || level === null) level = this.priority.addPriorityBefore(level)
        const hundred = Rational.from_float(100)
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
  private createSolverSpec(): SolverSpec {
    const owner = this
    const targets: SolverTarget[] = this.buildTargets.map((target) => ({
      item: target.item,
      recipe: target.recipe,
      changedBuilding: target.changedBuilding,
    }))
    return {
      ignore: new Set<SolverItem>(this.ignore),
      buildTargets: targets,
      priority: this.priority,
      get lastPartial() {
        return owner.lastPartial
      },
      set lastPartial(value: unknown) {
        owner.lastPartial = value
      },
      get lastTableau() {
        return owner.lastTableau
      },
      set lastTableau(value: Matrix | null) {
        owner.lastTableau = value
      },
      get lastMetadata() {
        return owner.lastMetadata
      },
      set lastMetadata(value: unknown) {
        owner.lastMetadata = value
      },
      get lastSolution() {
        return owner.lastSolution
      },
      set lastSolution(value: Matrix | null) {
        owner.lastSolution = value
      },
      getRecipes(item: SolverItem): SolverRecipe[] {
        if (!(item instanceof Item)) throw new Error("Solver received an unknown item model")
        return [...owner.getRecipes(item)]
      },
      getRecipeGraph(items: Map<SolverItem, Rational>): Set<SolverRecipe> {
        const domainItems = new Map<Item, Rational>()
        for (const [item, rate] of items) {
          if (!(item instanceof Item)) throw new Error("Solver graph contains an unknown item model")
          domainItems.set(item, rate)
        }
        return new Set<SolverRecipe>(owner.getRecipeGraph(domainItems))
      },
      getProdEffect(recipe: SolverRecipe): Rational {
        return recipe instanceof Recipe ? owner.getProdEffect(recipe) : one
      },
      getBuilding(recipe: SolverRecipe) {
        return recipe instanceof Recipe ? owner.getBuilding(recipe) : null
      },
      getFuelForRecipe(recipe: SolverRecipe) {
        return recipe instanceof Recipe ? owner.getFuelForRecipe(recipe) : null
      },
    }
  }

  solve(): Totals {
    const outputs: SolverOutput[] = []
    for (const target of this.buildTargets) {
      const item = target.item
      let rate = target.getRate()
      let recipe: Recipe | null = target.changedBuilding ? target.recipe : null
      if (target.qualityLevel > 0) {
        const qualityRecipe =
          target.recipe ?? this.getRecipes(item).find((candidate) => candidate instanceof Recipe) ?? null
        if (qualityRecipe === null) {
          throw new Error(`No recipe is available to produce ${item.name} at the selected quality.`)
        }
        rate = rate.mul(getQualityTargetMultiplier(this, qualityRecipe, target.qualityLevel))
        recipe = qualityRecipe
      }
      outputs.push({ item, rate, recipe })
    }

    const dedupedOutputs: SolverOutput[] = []
    outer: for (const output of outputs) {
      for (let index = 0; index < dedupedOutputs.length; index++) {
        const existing = dedupedOutputs[index]
        if (existing !== undefined && existing.recipe === output.recipe && existing.item === output.item) {
          dedupedOutputs[index] = { ...existing, rate: existing.rate.add(output.rate) }
          continue outer
        }
      }
      dedupedOutputs.push(output)
    }
    return solve(this.createSolverSpec(), dedupedOutputs)
  }
  persistUrlState(): void {
    this.view?.persistUrlState()
  }
  // Backward-compatible name used by existing event handlers.
  setHash(): void {
    this.persistUrlState()
  }
  // The top-level calculation function. Called whenever the solution
  // requires recalculation.
  updateSolution(): void {
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
      this.notifyStateChanged()
    }
  }
  // Re-renders the current solution, without re-computing it.
  //
  // This is useful for when settings can be applied without altering the
  // solution. In general, if something would alter recipe-rate ratios, then
  // it requires a new solution. If it only alters building counts (e.g.
  // from changing the speed of a building), then we need merely re-display
  // the existing solution.
  display(): void {
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
    this.notifyStateChanged()
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

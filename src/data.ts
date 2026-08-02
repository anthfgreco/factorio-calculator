// -----------------------------------------------------------------------------
// Dataset contracts
// -----------------------------------------------------------------------------

export interface LocalizedName {
  en: string
  [locale: string]: string
}

export interface SpriteReference {
  icon_col: number
  icon_row: number
}

export interface SurfaceCondition {
  property: string
  min?: number
  max?: number
}

export interface EnergySourceData {
  type?: string
  fuel_category?: string
  emissions_per_minute?: Record<string, number>
}

export interface ItemData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  order: string
  subgroup: string
  group: string
  type: string
  stack_size?: number
}

export interface RecipeAmountData {
  name: string
  amount?: number
  amount_min?: number
  amount_max?: number
  probability?: number
  independent_probability?: number
  shared_probability?: {
    min?: number
    max?: number
  }
  extra_count_fraction?: number
  ignored_by_productivity?: number
}

export interface RecipeData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  categories?: string[]
  category?: string
  energy_required: number
  ingredients: RecipeAmountData[]
  results: RecipeAmountData[]
  allow_productivity: boolean
  allow_quality?: boolean
  maximum_productivity?: number
  order: string
  subgroup: string
  surface_conditions?: SurfaceCondition[]
}

export interface RecipeProductivityEffectData {
  recipe: string
  change: number
}

export interface RecipeProductivityResearchData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  effects: RecipeProductivityEffectData[]
}

export interface MachineData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  allowed_effects?: string[]
  crafting_categories?: string[]
  crafting_speed?: number
  energy_source?: EnergySourceData
  energy_usage?: number
  module_slots?: number
  prod_bonus?: number
  surface_conditions?: SurfaceCondition[]
}

export interface MiningDrillData extends MachineData {
  mining_speed: number
  resource_categories: string[]
  takes_fluid: boolean
}

export interface BeltData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  speed: number
}

export interface FuelData {
  category: string
  item_key: string
  value: number
}

export interface ModuleEffectData {
  consumption?: number
  pollution?: number
  productivity?: number
  quality?: number
  speed?: number
}

export interface ModuleData {
  category?: string
  effect: ModuleEffectData
  item_key: string
}

export interface ResourceData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  category?: string
  fluid_amount?: number
  mining_time: number
  required_fluid?: string
  results: RecipeAmountData[]
}

export interface PlanetResourceData {
  resource?: string[]
  offshore?: string[]
  plants?: string[]
}

export interface PlanetData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  order: string
  resources: PlanetResourceData
  surface_properties: Record<string, number>
}

export interface SpriteSheetData {
  hash: string
  width: number
  height: number
  extra: Record<string, SpriteReference & { name: string }>
}

export interface ItemGroupData {
  order?: string
  subgroups: Record<string, string>
}

/** Browser-ready dataset consumed by the calculator runtime. */
export interface CalculatorData {
  game_version?: string
  game_build?: number
  experimental?: boolean
  source?: string
  mods?: string[]
  recipe_aliases?: Record<string, string>
  groups: Record<string, ItemGroupData>
  items: ItemData[]
  recipes: RecipeData[]
  crafting_machines: MachineData[]
  mining_drills: MiningDrillData[]
  rocket_silo?: MachineData[]
  belts: BeltData[]
  fuel: FuelData[]
  modules: ModuleData[]
  recipe_productivity_research?: RecipeProductivityResearchData[]
  resources: ResourceData[]
  planets?: PlanetData[]
  sprites: SpriteSheetData
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Dataset validation
// -----------------------------------------------------------------------------

export class DatasetValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`)
    this.name = "DatasetValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DatasetValidationError(path, "expected an object")
  }
  return value
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DatasetValidationError(path, "expected an array")
  }
  return value
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DatasetValidationError(path, "expected a non-empty string")
  }
  return value
}

function requireNonnegativeNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DatasetValidationError(path, "expected a nonnegative finite number")
  }
  return value
}

function validateKeyedEntries(value: unknown, path: string): void {
  for (let [index, entry] of requireArray(value, path).entries()) {
    let record = requireRecord(entry, `${path}[${index}]`)
    requireString(record.key, `${path}[${index}].key`)
  }
}

function validateRecipes(value: unknown): void {
  for (let [index, entry] of requireArray(value, "recipes").entries()) {
    let path = `recipes[${index}]`
    let recipe = requireRecord(entry, path)
    requireString(recipe.key, `${path}.key`)
    requireArray(recipe.ingredients, `${path}.ingredients`)
    requireArray(recipe.results, `${path}.results`)
    if (recipe.categories !== undefined && !Array.isArray(recipe.categories)) {
      throw new DatasetValidationError(`${path}.categories`, "expected an array")
    }
    if (recipe.allow_productivity !== undefined && typeof recipe.allow_productivity !== "boolean") {
      throw new DatasetValidationError(`${path}.allow_productivity`, "expected a boolean")
    }
    if (recipe.allow_quality !== undefined && typeof recipe.allow_quality !== "boolean") {
      throw new DatasetValidationError(`${path}.allow_quality`, "expected a boolean")
    }
    if (recipe.maximum_productivity !== undefined) {
      requireNonnegativeNumber(recipe.maximum_productivity, `${path}.maximum_productivity`)
    }
  }
}

function validateRecipeProductivityResearch(value: unknown): void {
  for (let [index, entry] of requireArray(value, "recipe_productivity_research").entries()) {
    let path = `recipe_productivity_research[${index}]`
    let research = requireRecord(entry, path)
    requireString(research.key, `${path}.key`)
    let localizedName = requireRecord(research.localized_name, `${path}.localized_name`)
    requireString(localizedName.en, `${path}.localized_name.en`)
    requireNonnegativeNumber(research.icon_col, `${path}.icon_col`)
    requireNonnegativeNumber(research.icon_row, `${path}.icon_row`)
    for (let [effectIndex, entryEffect] of requireArray(research.effects, `${path}.effects`).entries()) {
      let effectPath = `${path}.effects[${effectIndex}]`
      let effect = requireRecord(entryEffect, effectPath)
      requireString(effect.recipe, `${effectPath}.recipe`)
      requireNonnegativeNumber(effect.change, `${effectPath}.change`)
    }
  }
}

function validateMachines(value: unknown, path: string): void {
  for (let [index, entry] of requireArray(value, path).entries()) {
    let machinePath = `${path}[${index}]`
    let machine = requireRecord(entry, machinePath)
    requireString(machine.key, `${machinePath}.key`)
    if (machine.allowed_effects !== undefined) {
      let effects = requireArray(machine.allowed_effects, `${machinePath}.allowed_effects`)
      for (let [effectIndex, effect] of effects.entries()) {
        requireString(effect, `${machinePath}.allowed_effects[${effectIndex}]`)
      }
    }
  }
}

function validateModules(value: unknown): void {
  for (let [index, entry] of requireArray(value, "modules").entries()) {
    let path = `modules[${index}]`
    let module = requireRecord(entry, path)
    requireString(module.item_key, `${path}.item_key`)
    requireRecord(module.effect, `${path}.effect`)
  }
}

/** Validate untrusted JSON once at the application boundary. */
export function parseCalculatorData(value: unknown): CalculatorData {
  let data = requireRecord(value, "dataset")
  validateKeyedEntries(data.items, "items")
  validateRecipes(data.recipes)
  validateMachines(data.crafting_machines, "crafting_machines")
  validateMachines(data.mining_drills, "mining_drills")
  validateKeyedEntries(data.belts, "belts")
  requireArray(data.fuel, "fuel")
  validateModules(data.modules)
  if (data.recipe_productivity_research !== undefined) {
    validateRecipeProductivityResearch(data.recipe_productivity_research)
  }
  requireArray(data.resources, "resources")
  requireRecord(data.groups, "groups")
  requireRecord(data.sprites, "sprites")
  return data as unknown as CalculatorData
}

// -----------------------------------------------------------------------------
// Stable sorting
// -----------------------------------------------------------------------------

export function sorted(collection: Iterable<any> | readonly any[], key?: (value: any) => any): any[] {
  const values = Array.isArray(collection) ? [...collection] : Array.from(collection)
  const indexes = values.map((_, index) => index)
  const keyValues: any[] = key ? values.map(key) : values
  indexes.sort((a, b) => {
    const x = keyValues[a]
    const y = keyValues[b]
    if (x < y) {
      return -1
    }
    if (x > y) {
      return 1
    }
    return 0
  })
  return indexes.map((index) => values[index])
}

// -----------------------------------------------------------------------------
// Item search
// -----------------------------------------------------------------------------

const ITEM_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "electronic-circuit": ["green circuit", "green circuits", "green chip", "green chips"],
  "advanced-circuit": ["red circuit", "red circuits", "red chip", "red chips"],
  "processing-unit": ["blue circuit", "blue circuits", "blue chip", "blue chips"],

  "firearm-magazine": ["yellow magazine", "yellow magazines"],
  "piercing-rounds-magazine": ["red magazine", "red magazines"],
  "uranium-rounds-magazine": ["green magazine", "green magazines"],

  "automation-science-pack": ["red"],
  "logistic-science-pack": ["green"],
  "military-science-pack": ["grey", "gray", "black"],
  "chemical-science-pack": ["blue"],
  "production-science-pack": ["purple"],
  "utility-science-pack": ["yellow"],
  "space-science-pack": ["white"],
  "metallurgic-science-pack": ["orange"],
  "electromagnetic-science-pack": ["pink", "magenta"],
  "agricultural-science-pack": ["lime", "light green"],
  "cryogenic-science-pack": ["cyan", "light blue", "blue"],
  "promethium-science-pack": ["black", "dark blue", "dark purple"],

  "transport-belt": ["yellow belt", "yellow belts"],
  "fast-transport-belt": ["red belt", "red belts"],
  "express-transport-belt": ["blue belt", "blue belts"],
  "turbo-transport-belt": ["green belt", "green belts"],
  "underground-belt": ["yellow underground", "yellow underground belt", "yellow underground belts"],
  "fast-underground-belt": ["red underground", "red underground belt", "red underground belts"],
  "express-underground-belt": ["blue underground", "blue underground belt", "blue underground belts"],
  "turbo-underground-belt": ["green underground", "green underground belt", "green underground belts"],
  splitter: ["yellow splitter", "yellow splitters"],
  "fast-splitter": ["red splitter", "red splitters"],
  "express-splitter": ["blue splitter", "blue splitters"],
  "turbo-splitter": ["green splitter", "green splitters"],

  "low-density-structure": ["lds"],
  "construction-robot": ["construction bot", "construction bots", "conbot", "conbots"],
  "logistic-robot": ["logistic bot", "logistic bots", "logistics bot", "logistics bots", "logibot", "logibots"],
  "copper-cable": ["copper wire", "copper wires"],
  "iron-gear-wheel": ["gears"],
}

interface SearchableItem {
  key: string
  name: string
}

/**
 * Normalize punctuation and whitespace consistently for both queries and item
 * names. Keeping word boundaries supports token searches such as "fast belt",
 * while compact matching supports both "underground belt" and
 * "undergroundbelt".
 */
export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function itemMatchesSearch(item: SearchableItem, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const terms = [item.name, ...(ITEM_SEARCH_ALIASES[item.key] ?? [])]
  const normalizedTerms = terms.map(normalizeSearchText)
  const compactQuery = compactSearchText(normalizedQuery)

  // Preserve the original substring-search behavior after applying identical
  // normalization to the query and candidate text.
  if (normalizedTerms.some((term) => compactSearchText(term).includes(compactQuery))) {
    return true
  }

  // Also allow words to be separated by other words or span the official name
  // and an alias, e.g. "fast belt" or "red science".
  const queryTokens = normalizedQuery.split(" ")
  return queryTokens.every((token) => normalizedTerms.some((term) => term.includes(token)))
}

// -----------------------------------------------------------------------------
// Location display queries
// -----------------------------------------------------------------------------

interface LocationRecipeLike {
  isNetProducer(item: LocationItemLike): boolean
}

interface LocationItemLike {
  recipes: LocationRecipeLike[]
}

interface LocationLike {
  key: string
  name: string
  order: number
  disable: Set<LocationRecipeLike>
}

interface LocationSpecificationLike {
  planets?: Map<string, LocationLike>
  planetaryBaseline?: Set<LocationRecipeLike>
  ignore: Set<LocationItemLike>
  disable: Set<LocationRecipeLike>
  selectedPlanets: Iterable<LocationLike>
}

function sortedLocations(locations: Iterable<LocationLike>): LocationLike[] {
  return [...locations].sort((a, b) => a.order - b.order)
}

function locationName(location: LocationLike, indefinite = false) {
  if (indefinite && location.key === "space-platform") {
    return "a Space platform"
  }
  return location.name
}

export function formatLocationList(locations: Iterable<LocationLike>, conjunction = "or", indefinite = false): string {
  const names = [...locations].map((location) => locationName(location, indefinite))
  if (names.length === 0) {
    return ""
  }
  if (names.length === 1) {
    return names[0]
  }
  if (names.length === 2) {
    return `${names[0]} ${conjunction} ${names[1]}`
  }
  return `${names.slice(0, -1).join(", ")}, ${conjunction} ${names[names.length - 1]}`
}

export function getUnavailableLocationInfo(spec: LocationSpecificationLike, item: LocationItemLike) {
  const planets = spec.planets
  const planetaryBaseline = spec.planetaryBaseline
  if (!planets || planets.size <= 1 || !planetaryBaseline || spec.ignore.has(item)) {
    return null
  }

  const recipes = item.recipes.filter((recipe) => recipe.isNetProducer(item))
  if (recipes.length === 0 || recipes.some((recipe) => !spec.disable.has(recipe))) {
    return null
  }

  // Only show this message when the selected locations are the reason every
  // real production recipe is disabled. Manually-disabled recipes should not
  // be presented as a location problem.
  if (!recipes.every((recipe) => planetaryBaseline.has(recipe))) {
    return null
  }

  const allLocations = Array.from(planets.values())
  const compatibleLocations = sortedLocations(
    allLocations.filter((location) => recipes.some((recipe) => !location.disable.has(recipe))),
  )
  if (compatibleLocations.length === 0) {
    return null
  }

  return {
    selectedLocations: sortedLocations(spec.selectedPlanets),
    compatibleLocations,
  }
}

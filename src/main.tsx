import { deflateRaw, inflateRaw } from "pako"
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

declare global {
  interface Window {
    spec: FactorySpecification
  }
}

// Inline styles own component layout. This tiny React-rendered stylesheet is
// reserved for resets, pseudo states, density variables, and media queries.
const BASE_CSS = String.raw`
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; margin: 0; }
html { color-scheme: dark; scrollbar-gutter: stable; }
body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.42; color: #c8c8c8; background: #171717; font-variant-numeric: tabular-nums; }
button, input, select { font: inherit; }
button:not(:disabled):hover { border-color: var(--accent) !important; }
button:disabled { cursor: not-allowed !important; opacity: 0.5; }
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
a { color: var(--accent); text-decoration: underline; text-underline-offset: 0.18em; }
summary { list-style-position: outside; }
[data-density="compact"] { --cell-padding: 1.5px 5px; --panel-padding: 6px; --layout-gap: 5px; }
[data-density="comfortable"] { --cell-padding: 7px 6px; --panel-padding: 10px; --layout-gap: 9px; }
.target-header, .target-grid { grid-template-columns: 32px 220px 110px 72px 88px 88px; }
.target-grid > label > span:first-child, .target-output > span:first-child { display: none; }
.planner-toolbar > label > span { font-size: 11.52px !important; text-transform: uppercase; letter-spacing: 0.04em; }
.density-switch label { position: relative; display: inline-block; }
.density-switch input { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.density-switch input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.density-switch input:checked + span { color: var(--bright); border-bottom-color: var(--accent); }
.icon-choice:hover > span { background: var(--bright) !important; }
.icon-choice > input:checked + span { background: var(--accent) !important; }
.icon-choice > input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.factory-table tbody tr:hover > td { background: rgba(255,255,255,0.025); }
.factory-table .target-output-row > td:first-child { border-left: 2px solid var(--accent); }
.factory-table td, .factory-table th { white-space: nowrap; }
.factory-table .item-name { white-space: nowrap; }
.factory-table .belt-controls { flex-wrap: nowrap !important; }
[data-density="compact"] .factory-table td.factory-modules,
[data-density="compact"] .factory-table td.factory-beacons { padding-top: 4.65px !important; padding-bottom: 4.65px !important; }
.compact-icon-select select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.icon-picker > button:hover, .icon-picker[data-open="true"] > button { outline: 2px solid var(--accent); outline-offset: 1px; border-radius: 3px; }
.help-table th, .help-table td { border-bottom: 1px solid var(--rule); }
.help-table tbody tr:last-child td { border-bottom: 0; }
.settings-columns { align-items: start; }
.recipe-tile[aria-pressed="false"] { filter: grayscale(1); opacity: 0.28; }
@media (max-width: 900px) {
  .planner-toolbar { align-items: flex-start !important; }
}
@media (max-width: 760px) {
  .calculator-app { padding: 0.6rem !important; }
  .target-header { display: none !important; }
  .target-grid { grid-template-columns: 32px minmax(0, calc(100% - 44.8px)) !important; align-items: start !important; width: 100% !important; margin-top: 5.7px !important; }
  .target-grid > label > span:first-child { display: block; }
  .target-output > span:first-child { display: none !important; }
  .target-output { grid-column: 2; width: calc(100% - 3.2px) !important; }
  .target-item-picker-panel { left: -40px !important; width: calc(100vw - 20px) !important; }
  .target-quality { grid-column: 2; max-width: 192px; }
  .target-machines { grid-column: 2; width: calc(50% - 4px); }
  .target-rate { grid-column: 2; width: calc(50% - 4px); margin-left: calc(50% + 4px); margin-top: -53px; }
  .target-belts { grid-column: 2; max-width: 135px; margin-top: -11px; }
  .target-warning { grid-column: 1 / -1 !important; margin-left: 40px; }
  .planner-toolbar { display: grid !important; justify-items: start; gap: 10.5px !important; }
  .planner-toolbar > label { display: grid !important; grid-template-columns: auto 158px; align-items: center; gap: 8px; width: max-content !important; padding-left: 0 !important; border-left: 0 !important; }
  .planner-toolbar > label select { width: 158px !important; }
  .location-selector { grid-template-columns: minmax(0, 1fr) !important; }
  .location-selector > * { grid-column: 1 !important; grid-row: auto !important; }
  .planner-actions { margin-left: 0 !important; }
  .tabs { flex-wrap: nowrap !important; gap: 13.6px !important; width: max-content; min-width: 100%; }
  .factory-summary { align-items: flex-start !important; flex-direction: column; gap: 3px !important; }
  .factory-summary-card { width: auto; }
  .factory-table .factory-surplus { display: none; }
  .factory-table th:first-child, .factory-table td:first-child,
  .factory-table th:nth-child(2), .factory-table td:nth-child(2) { position: sticky; z-index: 2; background: var(--dark); }
  .factory-table th:first-child, .factory-table td:first-child { left: 0; }
  .factory-table th:nth-child(2), .factory-table td:nth-child(2) { left: 25px; }
  .factory-table { font-size: 13px !important; }
  .factory-table th:nth-child(2) { width: 165px !important; }
  .factory-table th:nth-child(3) { width: 80px !important; }
  .factory-table th:nth-child(4) { width: 105px !important; }
  .factory-table .item-name { max-width: none; }
  .settings-row { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
  .settings-columns { grid-template-columns: minmax(0, 1fr) !important; }
  .changelog-entry { grid-template-columns: minmax(0, 1fr) !important; gap: 5px !important; }
}
`

// region data.ts
// Dataset contracts

export interface LocalizedName {
  en: string
  [locale: string]: string
}

export interface SpriteReference {
  icon_col: number
  icon_row: number
}

export interface SurfaceConditionData {
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
  surface_conditions?: SurfaceConditionData[]
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
  drops_full_belt_stacks?: boolean
  energy_source?: EnergySourceData
  energy_usage?: number
  module_slots?: number
  prod_bonus?: number
  surface_conditions?: SurfaceConditionData[]
}

export interface MiningDrillData extends MachineData {
  mining_speed: number
  resource_drain_rate_percent?: number
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
  quality_effects?: Record<string, ModuleEffectData>
  item_key: string
}

export interface QualityData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  level: number
  order: string
  color: string
  crafting_speed_multiplier: number
  module_effect_multiplier: number
  beacon_power_usage_multiplier: number
  mining_drill_resource_drain_multiplier: number
}

export interface PlantData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  order?: string
  seed: string
  growth_ticks: number
  results: RecipeAmountData[]
  harvest_emissions?: Record<string, number>
  surface_conditions?: SurfaceConditionData[]
}

export interface SpoilageData {
  from_item: string
  to_item: string
  time: number
}

export interface AgriculturalTowerData extends MachineData {
  radius?: number
}

export interface BeaconData {
  energy_usage?: number
  distribution_effectivity: number
  distribution_effectivity_bonus_per_quality_level?: number
  profile?: number[]
  allowed_effects?: string[]
}

export interface ResourceData extends SpriteReference {
  order?: string
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
  pollutant_type?: string
  resources: PlanetResourceData
  surface_properties: Record<string, number>
}

export interface BoilerData {
  key: string
  energy_consumption: number
  target_temperature: number
}

export interface FluidData {
  item_key: string
  default_temperature: number
  heat_capacity: number
}

export interface OffshorePumpData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  pumping_speed: number
  surface_conditions?: SurfaceConditionData[]
}

export interface SurfacePropertyData {
  name: string
  default_value: number
}

export interface RocketLaunchData {
  parts_per_launch: number
  launch_cycle_ticks: number
  launch_cycle_ticks_by_quality?: Record<string, number>
  buffered: boolean
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
  offshore_pumps?: OffshorePumpData[]
  surface_properties?: SurfacePropertyData[]
  rocket_launch?: RocketLaunchData
  belts: BeltData[]
  fuel: FuelData[]
  modules: ModuleData[]
  qualities?: QualityData[]
  recipe_productivity_research?: RecipeProductivityResearchData[]
  resources: ResourceData[]
  boilers: BoilerData[]
  fluids: FluidData[]
  plants?: PlantData[]
  spoilage?: SpoilageData[]
  agricultural_tower?: AgriculturalTowerData[]
  beacon: BeaconData
  planets?: PlanetData[]
  sprites: SpriteSheetData
  [key: string]: unknown
}

// External data checks

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

function requirePositiveNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new DatasetValidationError(path, "expected a positive finite number")
  }
  return value
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DatasetValidationError(path, "expected a finite number")
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

function validateOptionalNonnegativeNumber(record: Record<string, unknown>, key: string, path: string): void {
  if (record[key] !== undefined) {
    requireNonnegativeNumber(record[key], `${path}.${key}`)
  }
}

function validateItems(value: unknown): void {
  for (let [index, entry] of requireArray(value, "items").entries()) {
    let path = `items[${index}]`
    let item = requireRecord(entry, path)
    requireString(item.key, `${path}.key`)
    validateOptionalNonnegativeNumber(item, "stack_size", path)
  }
}

function validateEnergySource(value: unknown, path: string): void {
  if (value === undefined) return
  let source = requireRecord(value, path)
  if (source.emissions_per_minute === undefined) return
  let emissions = requireRecord(source.emissions_per_minute, `${path}.emissions_per_minute`)
  for (let [pollutant, amount] of Object.entries(emissions)) {
    requireFiniteNumber(amount, `${path}.emissions_per_minute.${pollutant}`)
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
    validateEnergySource(machine.energy_source, `${machinePath}.energy_source`)
    if (machine.allowed_effects !== undefined) {
      let effects = requireArray(machine.allowed_effects, `${machinePath}.allowed_effects`)
      for (let [effectIndex, effect] of effects.entries()) {
        requireString(effect, `${machinePath}.allowed_effects[${effectIndex}]`)
      }
    }
    if (machine.drops_full_belt_stacks !== undefined && typeof machine.drops_full_belt_stacks !== "boolean") {
      throw new DatasetValidationError(`${machinePath}.drops_full_belt_stacks`, "expected a boolean")
    }
    if (machine.resource_drain_rate_percent !== undefined) {
      requirePositiveNumber(machine.resource_drain_rate_percent, `${machinePath}.resource_drain_rate_percent`)
    }
  }
}

function validatePlants(value: unknown): void {
  for (let [index, entry] of requireArray(value, "plants").entries()) {
    let path = `plants[${index}]`
    let plant = requireRecord(entry, path)
    requireString(plant.key, `${path}.key`)
    requireString(plant.seed, `${path}.seed`)
    requireNonnegativeNumber(plant.growth_ticks, `${path}.growth_ticks`)
    requireArray(plant.results, `${path}.results`)
    if (plant.harvest_emissions !== undefined) {
      let emissions = requireRecord(plant.harvest_emissions, `${path}.harvest_emissions`)
      for (let [pollutant, amount] of Object.entries(emissions)) {
        requireFiniteNumber(amount, `${path}.harvest_emissions.${pollutant}`)
      }
    }
  }
}

function validateRocketLaunch(value: unknown): void {
  let launch = requireRecord(value, "rocket_launch")
  requirePositiveNumber(launch.parts_per_launch, "rocket_launch.parts_per_launch")
  requirePositiveNumber(launch.launch_cycle_ticks, "rocket_launch.launch_cycle_ticks")
  if (launch.launch_cycle_ticks_by_quality !== undefined) {
    for (const [quality, ticks] of Object.entries(
      requireRecord(launch.launch_cycle_ticks_by_quality, "rocket_launch.launch_cycle_ticks_by_quality"),
    )) {
      requirePositiveNumber(ticks, `rocket_launch.launch_cycle_ticks_by_quality.${quality}`)
    }
  }
  if (typeof launch.buffered !== "boolean") {
    throw new DatasetValidationError("rocket_launch.buffered", "expected a boolean")
  }
}

function validatePlanets(value: unknown): void {
  for (let [index, entry] of requireArray(value, "planets").entries()) {
    let path = `planets[${index}]`
    let planet = requireRecord(entry, path)
    requireString(planet.key, `${path}.key`)
    if (planet.pollutant_type !== undefined) {
      requireString(planet.pollutant_type, `${path}.pollutant_type`)
    }
  }
}

function validateSpoilage(value: unknown): void {
  for (let [index, entry] of requireArray(value, "spoilage").entries()) {
    let path = `spoilage[${index}]`
    let spoilage = requireRecord(entry, path)
    requireString(spoilage.from_item, `${path}.from_item`)
    requireString(spoilage.to_item, `${path}.to_item`)
    requireNonnegativeNumber(spoilage.time, `${path}.time`)
  }
}

function validateBeacon(value: unknown): void {
  let beacon = requireRecord(value, "beacon")
  requireNonnegativeNumber(beacon.distribution_effectivity, "beacon.distribution_effectivity")
  validateOptionalNonnegativeNumber(beacon, "energy_usage", "beacon")
  validateOptionalNonnegativeNumber(beacon, "distribution_effectivity_bonus_per_quality_level", "beacon")
  if (beacon.profile !== undefined) {
    for (let [index, effectivity] of requireArray(beacon.profile, "beacon.profile").entries()) {
      requireNonnegativeNumber(effectivity, `beacon.profile[${index}]`)
    }
  }
}

function validateModules(value: unknown): void {
  for (let [index, entry] of requireArray(value, "modules").entries()) {
    let path = `modules[${index}]`
    let module = requireRecord(entry, path)
    requireString(module.item_key, `${path}.item_key`)
    const validateEffect = (value: unknown, effectPath: string): void => {
      for (const [effect, amount] of Object.entries(requireRecord(value, effectPath))) {
        requireFiniteNumber(amount, `${effectPath}.${effect}`)
      }
    }
    validateEffect(module.effect, `${path}.effect`)
    if (module.quality_effects !== undefined) {
      for (const [quality, effect] of Object.entries(
        requireRecord(module.quality_effects, `${path}.quality_effects`),
      )) {
        validateEffect(effect, `${path}.quality_effects.${quality}`)
      }
    }
  }
}

function validateQualities(value: unknown): void {
  for (let [index, entry] of requireArray(value, "qualities").entries()) {
    let path = `qualities[${index}]`
    let quality = requireRecord(entry, path)
    requireString(quality.key, `${path}.key`)
    requireNonnegativeNumber(quality.level, `${path}.level`)
    requireString(quality.order, `${path}.order`)
    requireString(quality.color, `${path}.color`)
    const localizedName = requireRecord(quality.localized_name, `${path}.localized_name`)
    requireString(localizedName.en, `${path}.localized_name.en`)
    requireNonnegativeNumber(quality.icon_col, `${path}.icon_col`)
    requireNonnegativeNumber(quality.icon_row, `${path}.icon_row`)
    requirePositiveNumber(quality.crafting_speed_multiplier, `${path}.crafting_speed_multiplier`)
    requirePositiveNumber(quality.module_effect_multiplier, `${path}.module_effect_multiplier`)
    requirePositiveNumber(quality.beacon_power_usage_multiplier, `${path}.beacon_power_usage_multiplier`)
    requirePositiveNumber(
      quality.mining_drill_resource_drain_multiplier,
      `${path}.mining_drill_resource_drain_multiplier`,
    )
  }
}

/** Validate untrusted JSON once at the application boundary. */
export function parseCalculatorData(value: unknown): CalculatorData {
  let data = requireRecord(value, "dataset")
  validateItems(data.items)
  validateRecipes(data.recipes)
  validateMachines(data.crafting_machines, "crafting_machines")
  validateMachines(data.mining_drills, "mining_drills")
  if (data.agricultural_tower !== undefined) {
    validateMachines(data.agricultural_tower, "agricultural_tower")
  }
  validateKeyedEntries(data.belts, "belts")
  requireArray(data.fuel, "fuel")
  validateModules(data.modules)
  if (data.qualities !== undefined) validateQualities(data.qualities)
  validateBeacon(data.beacon)
  if (data.recipe_productivity_research !== undefined) {
    validateRecipeProductivityResearch(data.recipe_productivity_research)
  }
  if (data.rocket_launch !== undefined) validateRocketLaunch(data.rocket_launch)
  requireArray(data.resources, "resources")
  if (data.plants !== undefined) validatePlants(data.plants)
  if (data.spoilage !== undefined) validateSpoilage(data.spoilage)
  if (data.planets !== undefined) validatePlanets(data.planets)
  requireRecord(data.groups, "groups")
  requireRecord(data.sprites, "sprites")
  // Validation above establishes the runtime dataset contract at this untrusted JSON boundary.
  return data as CalculatorData
}

// Stable sorting

export type SortKey = string | number | bigint | boolean

export function sorted<T>(collection: Iterable<T> | readonly T[], key?: (value: T) => SortKey): T[] {
  const values: T[] = Array.isArray(collection) ? [...collection] : Array.from(collection)
  const indexes = values.map((_, index) => index)
  const keyValues: readonly SortKey[] = key ? values.map(key) : values.map((value) => String(value))
  indexes.sort((a, b) => {
    const x = keyValues[a]!
    const y = keyValues[b]!
    if (x < y) {
      return -1
    }
    if (x > y) {
      return 1
    }
    return 0
  })
  return indexes.map((index) => values[index]!)
}

// Item search

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

// Location display queries

interface LocationRecipeLike<TItem> {
  isNetProducer(item: TItem): boolean
}

interface LocationItemLike<TRecipe> {
  recipes: TRecipe[]
}

interface LocationLike<TRecipe> {
  key: string
  name: string
  order: string | number
  disable: Set<TRecipe>
}

interface LocationSpecificationLike<TItem, TRecipe, TLocation> {
  planets?: Map<string, TLocation> | null
  planetaryBaseline?: Set<TRecipe> | null
  ignore: Set<TItem>
  disable: Set<TRecipe>
  selectedPlanets: Iterable<TLocation>
}

function sortedLocations<TRecipe, TLocation extends LocationLike<TRecipe>>(
  locations: Iterable<TLocation>,
): TLocation[] {
  return [...locations].sort((a, b) => String(a.order).localeCompare(String(b.order)))
}

function locationName<TRecipe>(location: LocationLike<TRecipe>, indefinite = false) {
  if (indefinite && location.key === "space-platform") {
    return "a Space platform"
  }
  return location.name
}

export function formatLocationList<TRecipe>(
  locations: Iterable<LocationLike<TRecipe>>,
  conjunction = "or",
  indefinite = false,
): string {
  const names = [...locations].map((location) => locationName(location, indefinite))
  if (names.length === 0) {
    return ""
  }
  if (names.length === 1) {
    return names[0]!
  }
  if (names.length === 2) {
    return `${names[0]!} ${conjunction} ${names[1]!}`
  }
  return `${names.slice(0, -1).join(", ")}, ${conjunction} ${names[names.length - 1]!}`
}

export function getUnavailableLocationInfo<
  TItem extends LocationItemLike<TRecipe>,
  TRecipe extends LocationRecipeLike<TItem>,
  TLocation extends LocationLike<TRecipe>,
>(spec: LocationSpecificationLike<TItem, TRecipe, TLocation>, item: TItem) {
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
// endregion data.ts

// region math.ts
// Exact integer helpers

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function removeCanadianGrouping(value: string): string {
  return value.replace(/,(?=\d{3}(?:,|\.\d|\/|\s|\+|$))/g, "")
}

export function formatCanadianNumber(value: string): string {
  return value.replace(
    /(^|[^\d.])(-?)(\d+)(?=\.|\/|\s|\+|$)/g,
    (_match, prefix: string, sign: string, digits: string) => {
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      return `${prefix}${sign}${grouped}`
    },
  )
}

// Exact rational arithmetic

export class Rational {
  public readonly p: bigint
  public readonly q: bigint

  constructor(numerator: bigint, denominator: bigint) {
    let p = numerator
    let q = denominator
    if (q < 0n) {
      p = -p
      q = -q
    }
    if (p === 0n && q !== 0n) {
      this.p = 0n
      this.q = 1n
      return
    }
    if (q === 1n) {
      this.p = p
      this.q = q
      return
    }
    const gcd = greatestCommonDivisor(p < 0n ? -p : p, q)
    if (gcd > 1n) {
      p /= gcd
      q /= gcd
    }
    this.p = p
    this.q = q
  }

  toFloat(): number {
    return Number(this.p) / Number(this.q)
  }

  toString(): string {
    return this.q === 1n ? this.p.toString() : `${this.p}/${this.q}`
  }

  toDecimal(maxDigits = 3, roundingFactor: Rational | null = null): string {
    let digits = maxDigits ?? 3
    const rounding = roundingFactor ?? new Rational(5n, 10n ** BigInt(digits + 1))
    let sign = ""
    let value: Rational = this
    if (value.less(zero)) {
      sign = "-"
      value = zero.sub(value)
    }
    value = value.add(rounding)

    let quotient = value.p / value.q
    let remainder = value.p % value.q
    const integerPart = quotient.toString()
    let decimalPart = ""
    let roundingNumerator = rounding.p
    const roundingDenominator = rounding.q
    const equalsRounding = () => remainder * roundingDenominator === roundingNumerator * value.q

    while (digits > 0 && !equalsRounding()) {
      const scaledRemainder = remainder * 10n
      decimalPart += (scaledRemainder / value.q).toString()
      remainder = scaledRemainder % value.q
      roundingNumerator *= 10n
      digits--
    }
    if (equalsRounding()) {
      decimalPart = decimalPart.replace(/0+$/, "")
    }
    return decimalPart === "" ? sign + integerPart : `${sign}${integerPart}.${decimalPart}`
  }

  toUpDecimal(maxDigits = 3): string {
    let fraction = new Rational(1n, 10n ** BigInt(maxDigits))
    let { remainder } = this.divmod(fraction)
    let value = remainder.isZero() ? this : this.add(fraction)
    return value.toDecimal(maxDigits, zero)
  }

  toMixed(): string {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    if (quotient === 0n || remainder === 0n) {
      return this.toString()
    }
    return `${quotient} + ${remainder}/${this.q}`
  }

  isZero(): boolean {
    return this.p === 0n
  }

  isOne(): boolean {
    return this.p === 1n && this.q === 1n
  }

  isInteger(): boolean {
    return this.q === 1n
  }

  ceil(): Rational {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    const result = new Rational(quotient, 1n)
    return remainder === 0n ? result : result.add(one)
  }

  floor(): Rational {
    const quotient = this.p / this.q
    const remainder = this.p % this.q
    const result = new Rational(quotient, 1n)
    return result.less(zero) && remainder !== 0n ? result.sub(one) : result
  }

  equal(other: Rational): boolean {
    return this.p === other.p && this.q === other.q
  }

  less(other: Rational): boolean {
    return this.p * other.q < this.q * other.p
  }

  abs(): Rational {
    return this.less(zero) ? this.mul(minusOne) : this
  }

  add(other: Rational): Rational {
    if (this.isZero()) return other
    if (other.isZero()) return this
    if (this.q === other.q) {
      return new Rational(this.p + other.p, this.q)
    }
    return new Rational(this.p * other.q + this.q * other.p, this.q * other.q)
  }

  sub(other: Rational): Rational {
    if (other.isZero()) return this
    if (this.q === other.q) {
      return new Rational(this.p - other.p, this.q)
    }
    return new Rational(this.p * other.q - this.q * other.p, this.q * other.q)
  }

  subProduct(left: Rational, right: Rational): Rational {
    if (left.isZero() || right.isZero()) return this
    const productNumerator = left.p * right.p
    const productDenominator = left.q * right.q
    return new Rational(this.p * productDenominator - this.q * productNumerator, this.q * productDenominator)
  }

  mul(other: Rational): Rational {
    if (this.isZero() || other.isZero()) {
      return zero
    }
    if (this.isOne()) {
      return other
    }
    if (other.isOne()) {
      return this
    }
    return new Rational(this.p * other.p, this.q * other.q)
  }

  div(other: Rational): Rational {
    return new Rational(this.p * other.q, this.q * other.p)
  }

  divmod(other: Rational): { quotient: Rational; remainder: Rational } {
    let quotient = this.div(other).floor()
    return { quotient, remainder: this.sub(other.mul(quotient)) }
  }

  reciprocate(): Rational {
    return new Rational(this.q, this.p)
  }

  pow(exponent: number): Rational {
    return new Rational(this.p ** BigInt(exponent), this.q ** BigInt(exponent))
  }

  static max(a: Rational, b: Rational): Rational {
    return a.less(b) ? b : a
  }

  static min(a: Rational, b: Rational): Rational {
    return a.less(b) ? a : b
  }

  static from_decimal(value: string): Rational {
    value = removeCanadianGrouping(value)
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1 || decimalIndex === value.length - 1) {
      return new Rational(BigInt(value), 1n)
    }
    let integerPart = new Rational(BigInt(value.slice(0, decimalIndex)), 1n)
    let numerator = BigInt(value.slice(decimalIndex + 1))
    let denominator = 10n ** BigInt(value.length - decimalIndex - 1)
    return integerPart.add(new Rational(numerator, denominator))
  }

  static from_string(value: string): Rational {
    value = removeCanadianGrouping(value)
    let slashIndex = value.indexOf("/")
    if (slashIndex === -1) {
      return Rational.from_decimal(value)
    }
    let plusIndex = value.indexOf("+")
    let denominator = BigInt(value.slice(slashIndex + 1))
    let numerator =
      plusIndex === -1
        ? BigInt(value.slice(0, slashIndex))
        : BigInt(value.slice(plusIndex + 1, slashIndex)) + BigInt(value.slice(0, plusIndex)) * denominator
    return new Rational(numerator, denominator)
  }

  static from_integer(value: number): Rational {
    return Rational.from_floats(value, 1)
  }

  static from_float(value: number): Rational {
    if (value === 0 || !Number.isFinite(value) || Number.isNaN(value)) {
      return zero
    }
    if (Number.isInteger(value)) {
      return Rational.from_integer(value)
    }
    let absolute = Math.abs(value)
    let exponent = Math.max(-1023, Math.floor(Math.log2(absolute)) + 1)
    let floatPart = absolute * 2 ** -exponent
    for (let i = 0; i < 300 && floatPart !== Math.floor(floatPart); i++) {
      floatPart *= 2
      exponent--
    }
    let numerator = BigInt(floatPart)
    let denominator = 1n
    if (exponent > 0) {
      numerator <<= BigInt(exponent)
    } else {
      denominator <<= BigInt(-exponent)
    }
    if (value < 0) {
      numerator = -numerator
    }
    return new Rational(numerator, denominator)
  }

  static from_float_approximate(value: number): Rational {
    if (Number.isInteger(value)) {
      return Rational.from_floats(value, 1)
    }
    let result = new Rational(BigInt(Math.round(value * 100000)), 100000n)
    let { quotient, remainder } = result.divmod(one)
    if (remainder.equal(_oneThirdApproximation)) {
      return quotient.add(oneThird)
    }
    if (remainder.equal(_twoThirdsApproximation)) {
      return quotient.add(twoThirds)
    }
    return result
  }

  static from_floats(numerator: number, denominator: number): Rational {
    return new Rational(BigInt(numerator), BigInt(denominator))
  }
}

const _oneThirdApproximation = new Rational(33333n, 100000n)
const _twoThirdsApproximation = new Rational(33333n, 50000n)

export const minusOne = new Rational(-1n, 1n)
export const zero = new Rational(0n, 1n)
export const one = new Rational(1n, 1n)
export const half = new Rational(1n, 2n)
export const oneThird = new Rational(1n, 3n)
export const twoThirds = new Rational(2n, 3n)

// Matrix arithmetic

/** Mutable M×N matrix backed by a row-major Rational array. */
export class Matrix {
  public readonly mat: Rational[]

  constructor(
    public readonly rows: number,
    public readonly cols: number,
    mat?: Rational[],
  ) {
    this.mat = mat ?? Array.from({ length: rows * cols }, () => zero)
  }

  toString(): string {
    let widths = Array.from({ length: this.cols }, (_, col) => {
      let width = 0
      for (let row = 0; row < this.rows; row++) {
        width = Math.max(width, this.index(row, col).toDecimal(3).length)
      }
      return width
    })
    let lines: string[] = []
    for (let row = 0; row < this.rows; row++) {
      let line: string[] = []
      for (let col = 0; col < this.cols; col++) {
        line.push(this.index(row, col).toDecimal(3).padStart(widths[col]!))
      }
      lines.push(line.join(" "))
    }
    return lines.join("\n")
  }

  copy(): Matrix {
    return new Matrix(this.rows, this.cols, this.mat.slice())
  }

  index(row: number, col: number): Rational {
    const value = this.mat[row * this.cols + col]
    if (value === undefined) {
      throw new RangeError(`Matrix index out of bounds: row ${row}, column ${col}`)
    }
    return value
  }

  setIndex(row: number, col: number, value: Rational): void {
    this.mat[row * this.cols + col] = value
  }

  addIndex(row: number, col: number, value: Rational): void {
    this.setIndex(row, col, this.index(row, col).add(value))
  }

  /** Multiply every positive element in a column in place. */
  mulPosColumn(col: number, value: Rational): void {
    for (let row = 0; row < this.rows; row++) {
      let current = this.index(row, col)
      if (zero.less(current)) {
        this.setIndex(row, col, current.mul(value))
      }
    }
  }

  mulRow(row: number, value: Rational): void {
    for (let col = 0; col < this.cols; col++) {
      this.setIndex(row, col, this.index(row, col).mul(value))
    }
  }

  appendColumn(column: readonly Rational[]): Matrix {
    if (column.length !== this.rows) {
      throw new Error(`Expected ${this.rows} column values, received ${column.length}`)
    }
    let mat: Rational[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        mat.push(this.index(row, col))
      }
      mat.push(column[row]!)
    }
    return new Matrix(this.rows, this.cols + 1, mat)
  }

  appendColumns(count: number): Matrix {
    let mat: Rational[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        mat.push(this.index(row, col))
      }
      for (let col = 0; col < count; col++) {
        mat.push(zero)
      }
    }
    return new Matrix(this.rows, this.cols + count, mat)
  }

  setColumn(col: number, column: readonly Rational[]): void {
    if (column.length !== this.rows) {
      throw new Error(`Expected ${this.rows} column values, received ${column.length}`)
    }
    for (let row = 0; row < this.rows; row++) {
      this.setIndex(row, col, column[row]!)
    }
  }

  zeroColumn(col: number): void {
    for (let row = 0; row < this.rows; row++) {
      this.setIndex(row, col, zero)
    }
  }

  zeroRow(row: number): void {
    for (let col = 0; col < this.cols; col++) {
      this.setIndex(row, col, zero)
    }
  }

  swapRows(left: number, right: number): void {
    for (let col = 0; col < this.cols; col++) {
      let temp = this.index(left, col)
      this.setIndex(left, col, this.index(right, col))
      this.setIndex(right, col, temp)
    }
  }

  /** Reduce the matrix in place and return pivot column indexes. */
  rref(): number[] {
    let pivotRow = 0
    let pivotCol = 0
    let pivots: number[] = []
    while (pivotCol < this.cols && pivotRow < this.rows) {
      let pivotValue = zero
      let pivotOffset = 0
      for (; pivotOffset < this.rows - pivotRow; pivotOffset++) {
        pivotValue = this.index(pivotRow + pivotOffset, pivotCol)
        if (!pivotValue.isZero()) {
          break
        }
      }
      if (pivotOffset === this.rows - pivotRow) {
        pivotCol++
        continue
      }
      pivots.push(pivotCol)
      if (pivotOffset !== 0) {
        this.swapRows(pivotRow, pivotRow + pivotOffset)
      }
      for (let row = 0; row < this.rows; row++) {
        if (row === pivotRow) {
          continue
        }
        let value = this.index(row, pivotCol)
        if (value.isZero()) {
          continue
        }
        for (let col = 0; col < this.cols; col++) {
          let next = pivotValue.mul(this.index(row, col)).sub(value.mul(this.index(pivotRow, col)))
          this.setIndex(row, col, next)
        }
      }
      pivotRow++
    }
    for (let row = 0; row < pivots.length; row++) {
      let col = pivots[row]!
      let pivotValue = this.index(row, col)
      this.setIndex(row, col, one)
      for (let nextCol = col + 1; nextCol < this.cols; nextCol++) {
        this.setIndex(row, nextCol, this.index(row, nextCol).div(pivotValue))
      }
    }
    return pivots
  }
}

// Simplex primitive

function pivot(tableau: Matrix, row: number, col: number): void {
  let pivotValue = tableau.index(row, col)
  const pivotColumns: number[] = []
  for (let currentCol = 0; currentCol < tableau.cols; currentCol++) {
    if (currentCol === col) {
      tableau.setIndex(row, currentCol, one)
      continue
    }
    const value = tableau.index(row, currentCol)
    if (value.isZero()) continue
    tableau.setIndex(row, currentCol, value.div(pivotValue))
    pivotColumns.push(currentCol)
  }
  for (let otherRow = 0; otherRow < tableau.rows; otherRow++) {
    if (otherRow === row) {
      continue
    }
    let ratio = tableau.index(otherRow, col)
    if (ratio.isZero()) {
      continue
    }
    tableau.setIndex(otherRow, col, zero)
    for (const currentCol of pivotColumns) {
      let next = tableau.index(otherRow, currentCol).subProduct(tableau.index(row, currentCol), ratio)
      tableau.setIndex(otherRow, currentCol, next)
    }
  }
}

function pivotColumn(tableau: Matrix, col: number): number | null {
  let bestRatio: Rational | null = null
  let bestRow: number | null = null
  for (let row = 0; row < tableau.rows - 1; row++) {
    let coefficient = tableau.index(row, col)
    if (!zero.less(coefficient)) {
      continue
    }
    let ratio = tableau.index(row, tableau.cols - 1).div(coefficient)
    if (bestRatio === null || ratio.less(bestRatio)) {
      bestRatio = ratio
      bestRow = row
    }
  }
  if (bestRow !== null) {
    pivot(tableau, bestRow, col)
  }
  return bestRow
}

/** Solve a canonical simplex tableau in place. */
export function simplex(tableau: Matrix): void {
  while (true) {
    let minimum: Rational | null = null
    let minimumColumn: number | null = null
    for (let col = 0; col < tableau.cols - 1; col++) {
      let value = tableau.index(tableau.rows - 1, col)
      if (minimum === null || value.less(minimum)) {
        minimum = value
        minimumColumn = col
      }
    }
    if (minimum === null || minimumColumn === null || !minimum.less(zero)) {
      return
    }
    if (pivotColumn(tableau, minimumColumn) === null) {
      throw new Error("Simplex tableau is unbounded for the selected pivot column")
    }
  }
}

// Display formatting

export const DEFAULT_RATE = "m"
export const DEFAULT_RATE_PRECISION = 3
export const DEFAULT_COUNT_PRECISION = 1
export const DEFAULT_FORMAT = "decimal"

export type DisplayRate = "s" | "m" | "h"
export type DisplayFormat = "decimal" | "rational"

const displayRates = new Map<DisplayRate, Rational>([
  ["s", one],
  ["m", Rational.from_float(60)],
  ["h", Rational.from_float(3600)],
])

export const longRateNames = new Map<DisplayRate, string>([
  ["s", "second"],
  ["m", "minute"],
  ["h", "hour"],
])

export class Formatter {
  rateName: DisplayRate = DEFAULT_RATE
  longRate = longRateNames.get(DEFAULT_RATE)!
  rateFactor = displayRates.get(DEFAULT_RATE)!
  displayFormat: DisplayFormat = DEFAULT_FORMAT
  ratePrecision = DEFAULT_RATE_PRECISION
  countPrecision = DEFAULT_COUNT_PRECISION

  setDisplayRate(rate: DisplayRate): void {
    this.rateName = rate
    this.longRate = longRateNames.get(rate)!
    this.rateFactor = displayRates.get(rate)!
  }

  private align(value: string, precision: number): string {
    if (this.displayFormat === "rational") {
      return value
    }
    let decimalIndex = value.indexOf(".")
    if (decimalIndex === -1) {
      decimalIndex = value.length
    }
    let padding = precision - value.length + decimalIndex + (precision > 0 ? 1 : 0)
    return value + "\u00A0".repeat(Math.max(0, padding))
  }

  rate(rate: Rational): string {
    let scaled = rate.mul(this.rateFactor)
    const value = this.displayFormat === "rational" ? scaled.toMixed() : scaled.toDecimal(this.ratePrecision)
    return formatCanadianNumber(value)
  }

  alignRate(rate: Rational): string {
    return this.align(this.rate(rate), this.ratePrecision)
  }

  count(count: Rational): string {
    const value = this.displayFormat === "rational" ? count.toMixed() : count.toUpDecimal(this.countPrecision)
    return formatCanadianNumber(value)
  }

  alignCount(count: Rational): string {
    return this.align(this.count(count), this.countPrecision)
  }
}

// Power formatting

const powerSuffixes = ["W", "kW", "MW", "GW", "TW", "PW"] as const

export function powerRepresentation(value: Rational): {
  power: Rational
  suffix: string
} {
  let thousand = Rational.from_float(1000)
  let power = value
  let suffixIndex = 0
  while (thousand.less(power) && suffixIndex < powerSuffixes.length - 1) {
    power = power.div(thousand)
    suffixIndex++
  }
  return { power, suffix: powerSuffixes[suffixIndex]! }
}
// endregion math.ts

// region solver/contracts.ts
/**
 * A normalized item amount used by recipes and solver graph edges.
 *
 * The core intentionally keeps `item` generic: the solver only relies on
 * stable item identity, while the browser domain layer supplies the concrete
 * item model.
 */
export class Ingredient<TItem = unknown, TAmount = unknown> {
  constructor(
    public readonly item: TItem,
    public readonly amount: TAmount,
    public readonly productivityAmount: TAmount | null = null,
  ) {}
}

export interface SolverIngredient {
  item: SolverItem
  amount: Rational
  productivityAmount?: Rational | null
}

export interface SolverRecipe {
  key?: string
  name: string
  ingredients: readonly SolverIngredient[]
  products: readonly SolverIngredient[]
  getIngredients(): readonly SolverIngredient[]
  gives(item: SolverItem): Rational
  isReal(): boolean
  isDisable?(): boolean
  isResource?(): boolean
}

export interface SolverItem {
  key?: string
  name?: string
  recipes: SolverRecipe[]
  uses: SolverRecipe[]
  disableRecipe: SolverRecipe
}

export interface SolverTarget {
  item: SolverItem
  recipe: SolverRecipe | null
  changedBuilding: boolean
}

export interface SolverPriorityEntry {
  recipe: SolverRecipe
  weight: Rational
}

export interface SolverBuilding {
  fuel: string | null
}

export interface SolverFuel {
  item: SolverItem
}

export interface SolverSpec {
  ignore: Set<SolverItem>
  buildTargets: SolverTarget[]
  priority: Iterable<Iterable<SolverPriorityEntry>>
  getRecipes(item: SolverItem): SolverRecipe[]
  getRecipeGraph(items: Map<SolverItem, Rational>): Set<SolverRecipe>
  getProdEffect(recipe: SolverRecipe): Rational
  getBuilding(recipe: SolverRecipe): SolverBuilding | null
  getFuelForRecipe(recipe: SolverRecipe): SolverFuel | null
}

export interface SolverOutput {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe | null
}
// endregion solver/contracts.ts

// region solver/errors.ts
export class SolverFailure extends Error {
  readonly code: "missing-recipe" | "infeasible"
  readonly item: SolverItem | null

  constructor(code: "missing-recipe" | "infeasible", message: string, item: SolverItem | null = null) {
    super(message)
    this.name = "SolverFailure"
    this.code = code
    this.item = item
  }
}
// endregion solver/errors.ts

// region solver.ts
// Cycle detection

function fuelConsumers(spec: SolverSpec, recipes: Set<SolverRecipe>, item: SolverItem): SolverRecipe[] {
  return [...recipes].filter((recipe) => spec.getFuelForRecipe(recipe)?.item === item)
}

function neighboringRecipes(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  invert: boolean,
): Set<SolverRecipe> {
  let result = new Set<SolverRecipe>()
  let itemAmounts = invert ? recipe.products : recipe.getIngredients()
  for (let { item } of itemAmounts) {
    let candidates: SolverRecipe[] = invert ? item.uses : item.recipes
    if (invert) {
      candidates = candidates.concat(fuelConsumers(spec, recipes, item))
    }
    for (let candidate of candidates) {
      if (recipes.has(candidate)) {
        result.add(candidate)
      }
    }
  }
  return result
}

function effectiveProductAmount(spec: SolverSpec, recipe: SolverRecipe, product: SolverIngredient): Rational {
  let productivity = spec.getProdEffect(recipe)
  if (!one.less(productivity)) {
    return product.amount
  }

  let productivityAmount = product.productivityAmount ?? null
  if (productivityAmount === null) {
    productivityAmount = product.amount
    for (let ingredient of recipe.getIngredients()) {
      if (ingredient.item === product.item) {
        productivityAmount = productivityAmount.sub(ingredient.amount)
      }
    }
    if (productivityAmount.less(zero)) {
      return product.amount
    }
  }

  return product.amount.add(productivityAmount.mul(productivity.sub(one)))
}

function visit(
  spec: SolverSpec,
  recipes: Set<SolverRecipe>,
  recipe: SolverRecipe,
  seen: Set<SolverRecipe>,
  invert: boolean,
): SolverRecipe[] {
  if (seen.has(recipe)) {
    return []
  }
  seen.add(recipe)
  let result: SolverRecipe[] = []
  for (let neighbor of neighboringRecipes(spec, recipes, recipe, invert)) {
    result.push(...visit(spec, recipes, neighbor, seen, invert))
  }
  result.push(recipe)
  return result
}

function isSelfCycle(component: readonly SolverRecipe[]): boolean {
  const recipe = component[0]
  if (recipe === undefined) return false
  let products = new Set<SolverItem>(recipe.products.map(({ item }) => item))
  return recipe.getIngredients().some(({ item }) => products.has(item))
}

export function getCycleRecipes(spec: SolverSpec, recipes: Set<SolverRecipe>): Set<SolverRecipe> {
  let seen = new Set<SolverRecipe>()
  let ordered: SolverRecipe[] = []
  for (let recipe of recipes) {
    ordered.push(...visit(spec, recipes, recipe, seen, false))
  }

  let result = new Set<SolverRecipe>()
  seen = new Set<SolverRecipe>()
  for (let index = ordered.length - 1; index >= 0; index--) {
    const root = ordered[index]
    if (root === undefined) continue
    if (seen.has(root)) {
      continue
    }
    let component = visit(spec, recipes, root, seen, true)
    if (component.length > 1 || isSelfCycle(component)) {
      for (let recipe of component) {
        result.add(recipe)
      }
    }
  }
  return result
}

// Solver totals

function addRate<TKey>(map: Map<TKey, Rational>, key: TKey, rate: Rational): void {
  map.set(key, (map.get(key) ?? zero).add(rate))
}

function setNested<TKey1, TKey2>(
  map: Map<TKey1, Map<TKey2, Rational>>,
  key1: TKey1,
  key2: TKey2,
  value: Rational,
): void {
  let nested = map.get(key1)
  if (nested === undefined) {
    nested = new Map<TKey2, Rational>()
    map.set(key1, nested)
  }
  nested.set(key2, value)
}

export interface ProportionateLink {
  item: SolverItem
  from: SolverRecipe
  to: SolverRecipe
  rate: Rational
  fuel: boolean
}

export class Totals {
  readonly items = new Map<SolverItem, Rational>()
  readonly producers = new Map<SolverItem, Map<SolverRecipe, Rational>>()
  readonly consumers = new Map<SolverItem, Map<SolverRecipe, Rational>>()
  readonly proportionate: ProportionateLink[] = []

  constructor(
    spec: SolverSpec,
    public readonly products: Map<SolverItem, Rational>,
    public readonly rates: Map<SolverRecipe, Rational>,
    public readonly surplus: Map<SolverItem, Rational>,
    public readonly extra: Map<SolverItem, SolverRecipe>,
  ) {
    for (let [recipe, rate] of rates) {
      for (let ingredient of recipe.getIngredients()) {
        let itemRate = rate.mul(ingredient.amount)
        setNested(this.consumers, ingredient.item, recipe, itemRate)
        addRate(this.items, ingredient.item, itemRate)
      }
      for (let product of recipe.products) {
        setNested(this.producers, product.item, recipe, rate.mul(recipe.gives(product.item)))
      }
    }

    for (let [recipe, recipeRate] of rates) {
      let ingredients = recipe.getIngredients()
      for (let index = 0; index < ingredients.length; index++) {
        const ingredient = ingredients[index]
        if (ingredient === undefined) continue
        let totalRate = this.items.get(ingredient.item)
        if (totalRate === undefined || totalRate.isZero()) {
          continue
        }
        let ratio = recipeRate.mul(ingredient.amount).div(totalRate)
        let sourceRecipes = spec.getRecipes(ingredient.item)
        let extraRecipe = extra.get(ingredient.item)
        if (extraRecipe !== undefined) {
          sourceRecipes.push(extraRecipe)
        }
        for (let sourceRecipe of sourceRecipes) {
          let sourceRate = rates.get(sourceRecipe)
          if (sourceRate === undefined) {
            continue
          }
          this.proportionate.push({
            item: ingredient.item,
            from: sourceRecipe,
            to: recipe,
            rate: sourceRate.mul(sourceRecipe.gives(ingredient.item)).mul(ratio),
            fuel: index >= recipe.ingredients.length,
          })
        }
      }
    }
  }
}

function requireMapValue<TKey, TValue>(map: ReadonlyMap<TKey, TValue>, key: TKey, label: string): TValue {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Missing ${label}`)
  return value
}

// Factory solver

class OutputRecipe implements SolverRecipe {
  readonly name: string = "output"
  readonly products: readonly Ingredient<SolverItem, Rational>[] = []
  readonly ingredients: readonly Ingredient<SolverItem, Rational>[]

  constructor(outputs: Iterable<[SolverItem, Rational]>) {
    this.ingredients = [...outputs].map(([item, rate]) => new Ingredient(item, rate))
  }

  getIngredients(): readonly Ingredient<SolverItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }
}

class SurplusRecipe extends OutputRecipe {
  override readonly name = "surplus"
}

interface UnfinishedTarget {
  item: SolverItem
  rate: Rational
  recipe: SolverRecipe
}

class PartialResult {
  readonly recipeRates = new Map<SolverRecipe, Rational>()
  readonly remaining = new Map<SolverItem, Rational>()
  targets: UnfinishedTarget[] = []

  add(recipe: SolverRecipe, rate: Rational): void {
    this.recipeRates.set(recipe, (this.recipeRates.get(recipe) ?? zero).add(rate))
  }

  remainder(item: SolverItem, rate: Rational): void {
    this.remaining.set(item, (this.remaining.get(item) ?? zero).add(rate))
  }

  unfinishedTarget(item: SolverItem, rate: Rational, recipe: SolverRecipe): void {
    this.targets.push({ item, rate, recipe })
  }

  combine(other: PartialResult): void {
    for (let [recipe, rate] of other.recipeRates) {
      this.add(recipe, rate)
    }
    for (let [item, rate] of other.remaining) {
      this.remainder(item, rate)
    }
    this.targets.push(...other.targets)
  }
}

function traverse(
  spec: SolverSpec,
  cyclic: Set<SolverRecipe>,
  item: SolverItem,
  rate: Rational,
  forcedRecipe: SolverRecipe | null = null,
): PartialResult {
  let result = new PartialResult()
  let recipe = forcedRecipe
  if (recipe === null) {
    let itemRecipes = spec.getRecipes(item)
    if (itemRecipes.length === 0) {
      throw new SolverFailure(
        "missing-recipe",
        `No enabled production recipe can make ${item.name ?? item.key ?? "unknown item"}.`,
        item,
      )
    }
    const onlyRecipe = itemRecipes[0]
    if (onlyRecipe === undefined) {
      throw new SolverFailure(
        "missing-recipe",
        `No enabled production recipe can make ${item.name ?? item.key ?? "unknown item"}.`,
        item,
      )
    }
    if (itemRecipes.length > 1 || onlyRecipe.products.length > 1 || cyclic.has(onlyRecipe)) {
      result.remainder(item, rate)
      return result
    }
    recipe = onlyRecipe
  } else if (recipe.products.length > 1 || cyclic.has(recipe)) {
    result.remainder(item, rate)
    result.unfinishedTarget(item, rate, recipe)
    return result
  }

  let recipeRate = rate.div(recipe.gives(item))
  result.add(recipe, recipeRate)
  if (spec.ignore.has(item)) {
    return result
  }
  for (let ingredient of recipe.getIngredients()) {
    result.combine(traverse(spec, cyclic, ingredient.item, recipeRate.mul(ingredient.amount)))
  }
  return result
}

function recursiveSolve(spec: SolverSpec, cyclic: Set<SolverRecipe>, outputs: readonly SolverOutput[]): PartialResult {
  let result = new PartialResult()
  for (let { item, rate, recipe } of outputs) {
    result.combine(traverse(spec, cyclic, item, rate, recipe))
  }
  return result
}

function mergeOutputs(outputs: readonly SolverOutput[]): Map<SolverItem, Rational> {
  let merged = new Map<SolverItem, Rational>()
  for (let { item, rate } of outputs) {
    merged.set(item, (merged.get(item) ?? zero).add(rate))
  }
  return merged
}

/** Solve target outputs into recipe rates and proportional material flows. */
export function solve(spec: SolverSpec, fullOutputs: readonly SolverOutput[]): Totals {
  let outputs = mergeOutputs(fullOutputs)
  let recipes = spec.getRecipeGraph(outputs)
  let cyclic = getCycleRecipes(spec, recipes)
  let partialSolution = recursiveSolve(spec, cyclic, fullOutputs)
  let solution = partialSolution.recipeRates
  if (partialSolution.remaining.size === 0) {
    solution.set(new OutputRecipe(outputs), one)
    return new Totals(spec, outputs, solution, new Map(), new Map())
  }

  recipes = spec.getRecipeGraph(partialSolution.remaining)

  let targetItemMap = new Map<SolverItem, SolverRecipe>()
  for (let target of spec.buildTargets) {
    if (target.changedBuilding && target.recipe !== null) {
      targetItemMap.set(target.item, target.recipe)
    }
  }

  let maxPriorityRecipes = new Map<SolverItem, SolverRecipe>()
  for (let recipe of recipes) {
    if (!cyclic.has(recipe)) {
      continue
    }
    for (let { item } of recipe.getIngredients()) {
      if (recipes.has(item.disableRecipe)) {
        continue
      }
      let candidate = item.recipes.some((subrecipe) => cyclic.has(subrecipe))
      let outside = item.recipes.some((subrecipe) => !cyclic.has(subrecipe) && recipes.has(subrecipe))
      if (candidate && (targetItemMap.has(item) || !outside)) {
        maxPriorityRecipes.set(item, item.disableRecipe)
      }
    }
  }
  for (let recipe of maxPriorityRecipes.values()) {
    recipes.add(recipe)
  }

  let products = new Set<SolverItem>()
  let items: SolverItem[] = []
  let itemColumns = new Map<SolverItem, number>()
  let recipeArray: SolverRecipe[] = []
  let recipeRows = new Map<SolverRecipe, number>()
  for (let recipe of recipes) {
    recipeRows.set(recipe, recipeArray.length)
    recipeArray.push(recipe)
    for (let product of recipe.products) {
      if (!products.has(product.item)) {
        itemColumns.set(product.item, items.length)
        items.push(product.item)
      }
      products.add(product.item)
    }
  }

  let columns = items.length + partialSolution.targets.length + recipeArray.length + 3
  let rows = recipeArray.length + 2
  let tableau = new Matrix(rows, columns)
  let taxColumn = items.length + partialSolution.targets.length

  for (let [row, recipe] of recipeArray.entries()) {
    for (let product of recipe.products) {
      tableau.setIndex(
        row,
        requireMapValue(itemColumns, product.item, "product item column"),
        effectiveProductAmount(spec, recipe, product),
      )
    }
    for (let ingredient of recipe.getIngredients()) {
      tableau.addIndex(
        row,
        requireMapValue(itemColumns, ingredient.item, "ingredient item column"),
        zero.sub(ingredient.amount),
      )
    }
    tableau.setIndex(row, taxColumn, minusOne)
    tableau.setIndex(row, taxColumn + row + 1, one)
  }

  for (let [index, target] of partialSolution.targets.entries()) {
    const row = requireMapValue(recipeRows, target.recipe, "target recipe row")
    let col = items.length + index
    const itemCol = requireMapValue(itemColumns, target.item, "target item column")
    tableau.setIndex(row, col, tableau.index(row, itemCol))
    tableau.setIndex(rows - 1, col, zero.sub(target.rate))
  }

  tableau.setIndex(rows - 2, taxColumn, one)
  tableau.setIndex(rows - 1, columns - 2, one)

  for (let [item, rate] of partialSolution.remaining) {
    tableau.setIndex(rows - 1, requireMapValue(itemColumns, item, "remaining item column"), zero.sub(rate))
  }

  let minimum: Rational | null = null
  let maximum = zero
  for (let coefficient of tableau.mat) {
    if (coefficient.isZero()) {
      continue
    }
    let absolute = coefficient.abs()
    if (minimum === null || absolute.less(minimum)) {
      minimum = absolute
    }
    if (maximum.less(absolute)) {
      maximum = absolute
    }
  }
  if (minimum === null) {
    throw new Error("Cannot solve an empty recipe tableau")
  }
  let two = Rational.from_float(2)
  let costRatio = maximum.div(minimum).mul(two)
  if (costRatio.less(two)) {
    costRatio = two
  }
  tableau.setIndex(rows - 2, columns - 1, one)
  let priorityCost = costRatio
  for (let level of spec.priority) {
    let normalizedTotal = zero
    let minimumWeight: Rational | null = null
    for (let { weight } of level) {
      if (minimumWeight === null || weight.less(minimumWeight)) {
        minimumWeight = weight
      }
    }
    if (minimumWeight === null) {
      continue
    }
    for (let { recipe, weight } of level) {
      let row = recipeRows.get(recipe)
      if (row === undefined) {
        continue
      }
      let normalizedWeight = weight.div(minimumWeight)
      normalizedTotal = normalizedTotal.add(normalizedWeight)
      tableau.setIndex(row, columns - 1, tableau.index(row, columns - 1).add(priorityCost.mul(normalizedWeight)))
    }
    if (!normalizedTotal.isZero()) {
      priorityCost = priorityCost.mul(costRatio).mul(normalizedTotal)
    }
  }
  for (let recipe of maxPriorityRecipes.values()) {
    tableau.setIndex(requireMapValue(recipeRows, recipe, "priority recipe row"), columns - 1, priorityCost)
  }

  try {
    simplex(tableau)
  } catch {
    throw new SolverFailure(
      "infeasible",
      "This combination of recipes and resource priorities cannot produce every requested output.",
    )
  }
  for (let [row, recipe] of recipeArray.entries()) {
    let rate = tableau.index(tableau.rows - 1, taxColumn + row + 1)
    if (zero.less(rate)) {
      solution.set(recipe, (solution.get(recipe) ?? zero).add(rate))
    }
  }
  solution.set(new OutputRecipe(outputs), one)

  let surplus = new Map<SolverItem, Rational>()
  for (let [index, item] of items.entries()) {
    let rate = tableau.index(tableau.rows - 1, index)
    if (zero.less(rate)) {
      surplus.set(item, rate)
    }
  }
  if (surplus.size > 0) {
    solution.set(new SurplusRecipe(surplus), one)
  }
  return new Totals(spec, outputs, solution, surplus, maxPriorityRecipes)
}
// endregion solver.ts

// region presentation.ts
// Sprite metadata is data. React owns rendering, focus, labels, and tooltips.

export const PX_WIDTH = 32
export const PX_HEIGHT = 32

export interface IconObject {
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
}

export interface SpriteStyle {
  readonly width: number
  readonly height: number
  readonly backgroundImage: string
  readonly backgroundPosition: string
  readonly backgroundRepeat: "no-repeat"
  readonly backgroundSize: string
  readonly display: "inline-block"
  readonly flex: "0 0 auto"
}

export class Icon {
  readonly name: string

  constructor(
    readonly obj: IconObject,
    name?: string,
  ) {
    this.name = name ?? obj.name
  }

  style(size = 32): SpriteStyle {
    const ratio = size / PX_WIDTH
    return {
      width: size,
      height: size,
      backgroundImage: `url(images/sprite-sheet-${sheetHash}.webp)`,
      backgroundPosition: `${-this.obj.icon_col * PX_WIDTH * ratio}px ${-this.obj.icon_row * PX_HEIGHT * ratio}px`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${sheetWidth * ratio}px ${sheetHeight * ratio}px`,
      display: "inline-block",
      flex: "0 0 auto",
    }
  }
}

export class Sprite implements IconObject {
  readonly icon: Icon

  constructor(
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
  ) {
    this.icon = new Icon(this)
  }
}

export let sprites = new Map<string, Sprite>()
export let sheetHash = ""
export let sheetWidth = 0
export let sheetHeight = 0

export function getSprites(data: CalculatorData): void {
  sheetHash = data.sprites.hash
  sheetWidth = data.sprites.width
  sheetHeight = data.sprites.height
  sprites = new Map(
    Object.entries(data.sprites.extra).map(([key, value]) => [
      key,
      new Sprite(value.name, value.icon_col, value.icon_row),
    ]),
  )
}
// endregion presentation.ts

// region models/productivity-research.ts
export interface RecipeProductivityResearch {
  readonly key: string
  readonly name: string
  readonly icon_col: number
  readonly icon_row: number
  readonly effects: Map<Recipe, Rational>
  readonly icon: Icon
}

export function getRecipeProductivityResearch(
  data: CalculatorData,
  recipes: ReadonlyMap<string, Recipe>,
): Map<string, RecipeProductivityResearch> {
  const result = new Map<string, RecipeProductivityResearch>()
  for (let entry of data.recipe_productivity_research ?? []) {
    const effects = new Map<Recipe, Rational>()
    for (let effect of entry.effects) {
      let recipe = recipes.get(effect.recipe)
      if (recipe !== undefined) {
        effects.set(recipe, Rational.from_float_approximate(effect.change))
      }
    }
    const iconTarget = {
      key: entry.key,
      name: entry.localized_name.en,
      icon_col: entry.icon_col,
      icon_row: entry.icon_row,
      effects,
    }
    const research: RecipeProductivityResearch = {
      ...iconTarget,
      icon: new Icon(iconTarget),
    }
    result.set(entry.key, research)
  }
  return result
}
// endregion models/productivity-research.ts

// region models/item-groups.ts
// Sorts items into their groups and subgroups. Used chiefly by the target
// dropdown.
export type ItemGroups = Item[][][]

export function getItemGroups(items: ReadonlyMap<string, Item>, data: CalculatorData): ItemGroups {
  // {groupName: {subgroupName: [item]}}
  const itemGroupMap = new Map<string, Map<string, Item[]>>()
  for (const item of items.values()) {
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
  const itemGroups: ItemGroups = []
  let groupNames = sorted(itemGroupMap.keys(), function (k) {
    return data.groups[k]?.order ?? k
  })
  for (let groupName of groupNames) {
    const groupMap = itemGroupMap.get(groupName)
    if (groupMap === undefined) continue
    const subgroupNames = sorted(groupMap.keys(), (key) => data.groups[groupName]?.subgroups[key] ?? key)
    const group: Item[][] = []
    itemGroups.push(group)
    for (let subgroupName of subgroupNames) {
      const subgroupItems = groupMap.get(subgroupName) ?? []
      const items = sorted(subgroupItems, function (item) {
        return item.order
      })
      group.push(items)
    }
  }
  return itemGroups
}
// endregion models/item-groups.ts

// region models.ts
// Runtime context

export interface ModelFactorySpecification {
  readonly items: Map<string, Item>
  readonly recipes: Map<string, Recipe>
  readonly format: Formatter
  readonly miningProd: Rational
  readonly defaultBeacon: readonly (Module | null)[]
  readonly defaultBeaconCount: Rational
  readonly defaultModuleQuality?: Quality
  readonly defaultBeaconQuality?: Quality
  getMachineQuality?(recipe: Recipe): Quality
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

export class Quality {
  readonly icon: Icon

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly level: number,
    readonly order: string,
    readonly color: string,
    readonly craftingSpeedMultiplier: Rational,
    readonly moduleEffectMultiplier: Rational,
    readonly beaconPowerUsageMultiplier: Rational,
    readonly miningDrillResourceDrainMultiplier: Rational,
  ) {
    this.icon = new Icon(this)
  }
}

export const normalQuality = new Quality("normal", "Normal", 0, 0, 0, "a", "#b3b3b3", one, one, one, one)

function qualitySixth(value: number): Rational {
  const numerator = Math.round(value * 6)
  return Math.abs(value - numerator / 6) < 1e-9
    ? Rational.from_floats(numerator, 6)
    : Rational.from_float_approximate(value)
}

export function getQualities(data: CalculatorData): Map<string, Quality> {
  const qualities = new Map<string, Quality>()
  for (const entry of data.qualities ?? []) {
    qualities.set(
      entry.key,
      new Quality(
        entry.key,
        entry.localized_name.en,
        entry.icon_col,
        entry.icon_row,
        entry.level,
        entry.order,
        entry.color,
        Rational.from_float_approximate(entry.crafting_speed_multiplier),
        Rational.from_float_approximate(entry.module_effect_multiplier),
        qualitySixth(entry.beacon_power_usage_multiplier),
        qualitySixth(entry.mining_drill_resource_drain_multiplier),
      ),
    )
  }
  if (qualities.size === 0 && data.mods?.includes("quality")) {
    const fallback = [
      ["normal", "Normal", 0, "a", "#b3b3b3"],
      ["uncommon", "Uncommon", 1, "b", "#2ba53d"],
      ["rare", "Rare", 2, "c", "#1968b2"],
      ["epic", "Epic", 3, "d", "#8900b2"],
      ["legendary", "Legendary", 5, "e", "#b26800"],
    ] as const
    for (const [key, name, level, order, color] of fallback) {
      const multiplier = Rational.from_floats(10 + 3 * level, 10)
      const sixth = Rational.from_floats(Math.max(1, 6 - level), 6)
      qualities.set(key, new Quality(key, name, 0, 0, level, order, color, multiplier, multiplier, sixth, sixth))
    }
  }
  if (qualities.size === 0) qualities.set(normalQuality.key, normalQuality)
  return qualities
}

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

export function usesLegacyModelCalculation(): boolean {
  return context?.useLegacyCalculation() ?? false
}

// Belts

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

// Fuels

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
}

export class FuelCollection extends Map<string, Fuel> {
  readonly categories: Map<string, Fuel[]>

  constructor(categories: Map<string, Fuel[]>) {
    super()
    this.categories = categories
    for (const fuel of categories.get("chemical") ?? []) this.set(fuel.key, fuel)
  }

  getForCategory(category: string, selectedChemicalFuel: Fuel | null = null): Fuel | null {
    if (category === "chemical" && selectedChemicalFuel !== null) return selectedChemicalFuel
    return this.categories.get(category)?.[0] ?? null
  }
}
export function getFuel(data: CalculatorData, items: ReadonlyMap<string, Item>): FuelCollection {
  const fuelCategories = new Map<string, Fuel[]>()
  for (let d of data.fuel) {
    const item = requireModelItem(items, d.item_key)
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

// Buildings

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
    readonly qualityCraftingSpeed = true,
    readonly qualityPowerThroughput = false,
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
    const quality = spec.getMachineQuality?.(recipe) ?? normalQuality
    const qualitySpeed = this.qualityCraftingSpeed ? quality.craftingSpeedMultiplier : one
    return recipe.time.reciprocate().mul(this.speed).mul(qualitySpeed).mul(speedEffect)
  }
  supportsEquipmentQuality(): boolean {
    return this.qualityCraftingSpeed
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
  powerForQuality(quality: Quality): Rational {
    return this.qualityPowerThroughput ? this.power.mul(quality.craftingSpeedMultiplier) : this.power
  }
  drainForQuality(quality: Quality): Rational {
    const drain = this.drain()
    return this.qualityPowerThroughput ? drain.mul(quality.craftingSpeedMultiplier) : drain
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
    readonly resourceDrainRate: Rational = one,
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
  override supportsEquipmentQuality(): boolean {
    return true
  }
  getResourceDrainRate(spec: ModelFactorySpecification, recipe: Recipe): Rational {
    const quality = spec.getMachineQuality?.(recipe) ?? normalQuality
    return this.resourceDrainRate.mul(quality.miningDrillResourceDrainMultiplier)
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
  override supportsEquipmentQuality(): boolean {
    return false
  }
  override getRecipeRate(_spec: ModelFactorySpecification, _recipe: Recipe): Rational {
    return this.pumpingSpeed
  }
}

let rocketLaunchDuration = Rational.from_floats(2434, 60)

export interface RocketLaunchConfiguration {
  readonly partsPerLaunch: Rational
  readonly launchCycle: Rational
  readonly launchCyclesByQuality: ReadonlyMap<string, Rational>
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
  const partItem = requireModelItem(spec.items, "rocket-part")
  // gives() already includes module and researched recipe productivity.
  let effectivePartsPerCraft = partRecipe.gives(partItem)
  // The base rate at which the silo can complete rocket-part crafts.
  let craftingRate = Building.prototype.getRecipeRate.call(partFactory, spec, partRecipe)
  // Productivity reduces the number of recipe crafts required to fill a rocket.
  let partsPerLaunch = launchConfig?.partsPerLaunch ?? Rational.from_float(100)
  let craftsPerLaunch = partsPerLaunch.div(effectivePartsPerCraft)

  if (launchConfig?.buffered) {
    let craftingLaunchRate = craftingRate.div(craftsPerLaunch)
    const quality = spec.getMachineQuality?.(partRecipe) ?? normalQuality
    const launchCycle = launchConfig.launchCyclesByQuality.get(quality.key) ?? launchConfig.launchCycle
    let animationLaunchRate = launchCycle.reciprocate()
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

export function getBuildings(data: CalculatorData, items: ReadonlyMap<string, Item>): Building[] {
  const buildings: Building[] = []
  let launchConfig = data.rocket_launch
    ? {
        partsPerLaunch: Rational.from_float_approximate(data.rocket_launch.parts_per_launch),
        launchCycle: Rational.from_floats(data.rocket_launch.launch_cycle_ticks, 60),
        launchCyclesByQuality: new Map(
          Object.entries(data.rocket_launch.launch_cycle_ticks_by_quality ?? {}).map(([key, ticks]) => [
            key,
            Rational.from_floats(ticks, 60),
          ]),
        ),
        buffered: data.rocket_launch.buffered,
      }
    : null
  const reactorDef = requireModelItem(items, "nuclear-reactor")
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
    [],
    null,
    null,
    false,
    true,
    true,
  )
  buildings.push(reactor)
  const boilerItem = requireModelItem(items, "boiler")
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
    [],
    null,
    null,
    false,
    true,
    true,
    //boilerDef.target_temperature,
  )
  buildings.push(boiler)
  const siloDef = requireModelItem(items, "rocket-silo")
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
        Rational.from_floats(d.resource_drain_rate_percent ?? 100, 100),
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
        false,
        false,
      ),
    )
  }
  return buildings
}

// Modules and beacons

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
    readonly qualityEffects: ReadonlyMap<
      string,
      {
        readonly productivity: Rational
        readonly quality: Rational
        readonly speed: Rational
        readonly power: Rational
        readonly pollution: Rational
      }
    > = new Map(),
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
  private effectFor(quality: Quality): {
    readonly productivity: Rational
    readonly quality: Rational
    readonly speed: Rational
    readonly power: Rational
    readonly pollution: Rational
  } {
    const generated = this.qualityEffects.get(quality.key)
    if (generated !== undefined) return generated
    const scale = (value: Rational, beneficial: boolean, precision: number): Rational => {
      if (!beneficial || quality.level === 0) return value
      const negative = value.less(zero)
      const magnitude = negative ? zero.sub(value) : value
      const rounded = magnitude
        .mul(quality.moduleEffectMultiplier)
        .mul(Rational.from_integer(precision))
        .floor()
        .div(Rational.from_integer(precision))
      return negative ? zero.sub(rounded) : rounded
    }
    return {
      productivity: scale(this.productivity, zero.less(this.productivity), 100),
      quality: scale(this.quality, zero.less(this.quality), 1000),
      speed: scale(this.speed, zero.less(this.speed), 100),
      power: scale(this.power, this.power.less(zero), 100),
      pollution: scale(this.pollution, this.pollution.less(zero), 100),
    }
  }
  productivityFor(quality: Quality): Rational {
    return this.effectFor(quality).productivity
  }
  qualityFor(quality: Quality): Rational {
    return this.effectFor(quality).quality
  }
  speedFor(quality: Quality): Rational {
    return this.effectFor(quality).speed
  }
  powerFor(quality: Quality): Rational {
    return this.effectFor(quality).power
  }
  pollutionFor(quality: Quality): Rational {
    return this.effectFor(quality).pollution
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
}

const MIN_SPEED_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POWER_EFFECT = Rational.from_floats(1, 5) // 20%
const MIN_POLLUTION_EFFECT = Rational.from_floats(1, 5) // 20%

// ModuleSpec represents the set of modules (including beacons) configured for
// a given recipe.
export class ModuleSpec {
  building: Building | null = null
  readonly modules: (Module | null)[] = []
  readonly moduleQualities: Quality[] = []
  readonly moduleQualityOverrides = new Set<number>()
  moduleSource: ConfigurationSource = "default"
  readonly beaconModules: (Module | null)[]
  readonly beaconModuleQualities: Quality[]
  readonly beaconModuleQualityOverrides = new Set<number>()
  beaconQuality: Quality
  beaconQualityOverride = false
  beaconCount: Rational

  constructor(
    readonly recipe: Recipe,
    readonly owner: ModelFactorySpecification,
  ) {
    this.beaconModules = owner.defaultBeacon.map((module) => (module === null || module.canBeacon() ? module : null))
    this.beaconModuleQualities = owner.defaultBeacon.map(() => owner.defaultModuleQuality ?? normalQuality)
    this.beaconQuality = owner.defaultBeaconQuality ?? normalQuality
    this.beaconCount = owner.defaultBeaconCount
  }
  setBuilding(building: Building, spec: ModelFactorySpecification): void {
    this.building = building
    if (this.modules.length > building.moduleSlots) {
      this.modules.length = building.moduleSlots
      this.moduleQualities.length = building.moduleSlots
      for (const index of this.moduleQualityOverrides) {
        if (index >= building.moduleSlots) this.moduleQualityOverrides.delete(index)
      }
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
      this.moduleQualities.push(spec.defaultModuleQuality ?? normalQuality)
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
  setModuleQuality(index: number, quality: Quality, source: ConfigurationSource = "user"): boolean {
    if (index >= this.modules.length) return false
    this.moduleQualities[index] = quality
    if (source === "default" || quality === this.owner.defaultModuleQuality) this.moduleQualityOverrides.delete(index)
    else this.moduleQualityOverrides.add(index)
    if (source !== "default") this.moduleSource = source
    if (source === "user") this.owner.notifyRecipeConfigurationChanged(this.recipe)
    else this.owner.recordRecipeConfigurationChange(this.recipe)
    const module = this.modules[index]
    return module !== null && module !== undefined && (module.hasProdEffect() || module.hasQualityEffect())
  }
  restoreModuleQualityOverride(index: number, quality: Quality): void {
    if (index >= this.modules.length) return
    this.moduleQualities[index] = quality
    this.moduleQualityOverrides.add(index)
    this.owner.recordRecipeConfigurationChange(this.recipe)
  }
  setBeaconModule(module: Module | null, i: number): void {
    this.beaconModules[i] =
      module === null || (module.canBeacon() && module.canUse(this.recipe, this.building)) ? module : null
  }
  setBeaconModuleQuality(quality: Quality, index: number): void {
    this.beaconModuleQualities[index] = quality
    if (quality === this.owner.defaultModuleQuality) this.beaconModuleQualityOverrides.delete(index)
    else this.beaconModuleQualityOverrides.add(index)
    this.owner.notifyRecipeConfigurationChanged(this.recipe)
  }
  restoreBeaconModuleQualityOverride(quality: Quality, index: number): void {
    if (index >= this.beaconModuleQualities.length) return
    this.beaconModuleQualities[index] = quality
    this.beaconModuleQualityOverrides.add(index)
    this.owner.recordRecipeConfigurationChange(this.recipe)
  }
  setBeaconQuality(quality: Quality): void {
    this.beaconQuality = quality
    this.beaconQualityOverride = quality !== this.owner.defaultBeaconQuality
    this.owner.notifyRecipeConfigurationChanged(this.recipe)
  }
  restoreBeaconQualityOverride(quality: Quality): void {
    this.beaconQuality = quality
    this.beaconQualityOverride = true
    this.owner.recordRecipeConfigurationChange(this.recipe)
  }
  setBeaconCount(count: Rational): void {
    this.beaconCount = count
  }

  qualityEffect(): Rational {
    let quality = zero
    for (const [index, module] of this.modules.entries()) {
      if (module !== null && module !== undefined) {
        quality = quality.add(module.qualityFor(this.moduleQualities[index] ?? normalQuality))
      }
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) continue
        let beacon = module
          .qualityFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        quality = quality.add(beacon)
      }
    }
    return Rational.max(zero, Rational.min(one, quality))
  }

  speedEffect(): Rational {
    let speed = one
    for (const [index, module] of this.modules.entries()) {
      if (!module) {
        continue
      }
      speed = speed.add(module.speedFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) {
          continue
        }
        let beacon = module
          .speedFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        speed = speed.add(beacon)
      }
    }
    return Rational.max(speed, MIN_SPEED_EFFECT)
  }
  prodEffect(spec: ModelFactorySpecification): Rational {
    let prod = one
    for (const [index, module] of this.modules.entries()) {
      if (!module) {
        continue
      }
      prod = prod.add(module.productivityFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.building === null) {
      throw new Error(`Module specification for ${this.recipe.key} has no building`)
    }
    prod = prod.add(this.building.prodEffect(spec))
    return prod
  }
  powerEffect(_spec: ModelFactorySpecification): Rational {
    let power = one
    for (const [index, module] of this.modules.entries()) {
      if (!module) {
        continue
      }
      power = power.add(module.powerFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) {
          continue
        }
        let beacon = module
          .powerFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
          beacon = beacon.mul(getBeaconProfileEffect(this.beaconCount))
        }
        power = power.add(beacon)
      }
    }
    return Rational.max(power, MIN_POWER_EFFECT)
  }
  pollutionEffect(): Rational {
    let pollution = one
    for (const [index, module] of this.modules.entries()) {
      if (module) pollution = pollution.add(module.pollutionFor(this.moduleQualities[index] ?? normalQuality))
    }
    if (this.modules.length > 0) {
      for (const [index, module] of this.beaconModules.entries()) {
        if (module === null) continue
        let beacon = module
          .pollutionFor(this.beaconModuleQualities[index] ?? normalQuality)
          .mul(this.beaconCount)
          .mul(getBeaconEffect(this.beaconQuality))
        if (!usesLegacyModelCalculation()) {
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
let beaconEffectBonusPerQualityLevel = zero
let beaconAllowedEffects = new Set(["consumption", "speed", "pollution"])

function getBeaconProfileEffect(count: Rational): Rational {
  if (beaconProfile === null || beaconProfile.length === 0) {
    return one
  }
  const index = Math.min(Math.max(count.ceil().toFloat() - 1, 0), beaconProfile.length - 1)
  return beaconProfile[index] ?? one
}

export function getBeaconEffect(quality: Quality): Rational {
  return beaconEffect.add(beaconEffectBonusPerQualityLevel.mul(Rational.from_integer(quality.level)))
}

export function getDatasetBeaconPower(data: CalculatorData): Rational {
  return Rational.from_float_approximate(data.beacon.energy_usage ?? 0)
}

export function getModules(data: CalculatorData, items: ReadonlyMap<string, Item>): Map<string, Module> {
  const modules = new Map<string, Module>()
  for (let d of data.modules) {
    const item = requireModelItem(items, d.item_key)
    let effect = d.effect
    let category = d.category
    let order = item.order
    let speed = Rational.from_float_approximate(effect.speed || 0)
    let productivity = Rational.from_float_approximate(effect.productivity || 0)
    let quality = Rational.from_float_approximate(effect.quality || 0)
    let power = Rational.from_float_approximate(effect.consumption || 0)
    let pollution = Rational.from_float_approximate(effect.pollution || 0)
    const qualityEffects = new Map(
      Object.entries(d.quality_effects ?? {}).map(([qualityKey, qualityEffect]) => [
        qualityKey,
        {
          productivity: Rational.from_float_approximate(qualityEffect.productivity ?? 0),
          quality: Rational.from_float_approximate(qualityEffect.quality ?? 0),
          speed: Rational.from_float_approximate(qualityEffect.speed ?? 0),
          power: Rational.from_float_approximate(qualityEffect.consumption ?? 0),
          pollution: Rational.from_float_approximate(qualityEffect.pollution ?? 0),
        },
      ]),
    )
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
        qualityEffects,
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
  beaconEffectBonusPerQualityLevel = Rational.from_float_approximate(
    data.beacon.distribution_effectivity_bonus_per_quality_level ?? (data.mods?.includes("quality") ? 0.2 : 0),
  )
  if (usesLegacyModelCalculation() || !data.beacon.profile) {
    beaconProfile = null
  } else {
    beaconProfile = []
    for (let x of data.beacon.profile) {
      beaconProfile.push(Rational.from_float_approximate(x))
    }
  }
  return modules
}

// Planets and surfaces

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

function requireModelItem(items: ReadonlyMap<string, Item>, key: string): Item {
  const item = items.get(key)
  if (item === undefined) throw new Error(`Dataset is missing required item ${key}`)
  return item
}

function requireRecipe(recipes: ReadonlyMap<string, Recipe>, key: string): Recipe {
  const recipe = recipes.get(key)
  if (recipe === undefined) throw new Error(`Dataset is missing required recipe ${key}`)
  return recipe
}
// endregion models.ts

// region priorities.ts
export type PrioritizedRecipe = Recipe | DisabledRecipe

// Priority model

export interface PrioritySpecification {
  priority: PriorityList
  readonly defaultPriority: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]
  readonly recipes: Map<string, Recipe>
  readonly items: Map<string, Item>
  isItemDisabled(item: Item): boolean
}

export class PriorityResource {
  level: PriorityLevel | null = null

  constructor(
    public readonly recipe: PrioritizedRecipe,
    public weight: Rational,
  ) {}
}

export class PriorityLevel implements Iterable<PriorityResource> {
  readonly resources: PriorityResource[] = []

  constructor(readonly list: PriorityList) {}

  [Symbol.iterator](): ArrayIterator<PriorityResource> {
    return this.resources[Symbol.iterator]()
  }

  equalMap(expected: ReadonlyMap<PrioritizedRecipe, Rational>): boolean {
    if (expected.size !== this.resources.length) {
      return false
    }
    return this.resources.every(({ recipe, weight }) => expected.get(recipe)?.equal(weight) === true)
  }

  has(resource: PriorityResource): boolean {
    return resource.level === this
  }

  isEmpty(): boolean {
    return this.resources.length === 0
  }

  insertSorted(resource: PriorityResource): void {
    this.list.moveResource(resource, this)
  }
}

export class PriorityList implements Iterable<PriorityLevel> {
  readonly priorities: PriorityLevel[] = []
  private readonly listeners = new Set<() => void>()
  private notificationDepth = 0
  private notificationPending = false;

  [Symbol.iterator](): ArrayIterator<PriorityLevel> {
    return this.priorities[Symbol.iterator]()
  }

  static getDefaultArray(recipes: ReadonlyMap<string, Recipe>): Map<PrioritizedRecipe, Rational>[] {
    const levels: Map<PrioritizedRecipe, Rational>[] = []
    for (const recipe of recipes.values()) {
      if (!recipe.isResource()) {
        continue
      }
      const priority = recipe.defaultPriority ?? 0
      while (levels.length <= priority) {
        levels.push(new Map())
      }
      const level = levels[priority]
      if (level === undefined || recipe.defaultWeight === undefined) {
        throw new Error(`Resource recipe ${recipe.key} is missing a default priority weight`)
      }
      level.set(recipe, recipe.defaultWeight)
    }
    return levels
  }

  static fromArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): PriorityList {
    const priority = new PriorityList()
    priority.batch(() => {
      for (const recipes of levels) {
        const level = priority.addPriorityBefore(null)
        for (const [recipe, weight] of recipes) {
          priority.addRecipe(recipe, weight, level)
        }
      }
    })
    return priority
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  batch(operation: () => void): void {
    this.notificationDepth++
    try {
      operation()
    } finally {
      this.notificationDepth--
      if (this.notificationDepth === 0 && this.notificationPending) {
        this.notificationPending = false
        this.notify()
      }
    }
  }

  applyArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): void {
    this.batch(() => {
      for (let index = 0; index < levels.length; index++) {
        while (this.priorities.length <= index) {
          this.addPriorityBefore(null)
        }
        const level = this.priorities[index]
        const recipes = levels[index]
        if (level === undefined || recipes === undefined) continue
        for (const [recipe, weight] of recipes) {
          const resource = this.getResource(recipe)
          if (resource === null) {
            this.addRecipe(recipe, weight, level)
          } else {
            resource.weight = weight
            this.moveResource(resource, level)
          }
        }
      }
    })
  }

  equalArray(levels: readonly ReadonlyMap<PrioritizedRecipe, Rational>[]): boolean {
    return (
      levels.length === this.priorities.length &&
      levels.every((level, index) => this.priorities[index]?.equalMap(level) === true)
    )
  }

  addPriorityBefore(level: PriorityLevel | null): PriorityLevel {
    const newLevel = new PriorityLevel(this)
    if (level === null) {
      this.priorities.push(newLevel)
    } else {
      const index = this.priorities.indexOf(level)
      if (index === -1) {
        throw new Error("Cannot insert a priority before a level that is not in this list")
      }
      this.priorities.splice(index, 0, newLevel)
    }
    this.changed()
    return newLevel
  }

  getFirstLevel(): PriorityLevel | null {
    return this.priorities[0] ?? null
  }

  getLastLevel(): PriorityLevel | null {
    return this.priorities.at(-1) ?? null
  }

  setPriority(resource: PriorityResource, level: PriorityLevel): void {
    this.moveResource(resource, level)
  }

  setWeight(resource: PriorityResource, weight: Rational): void {
    resource.weight = weight
    if (resource.level !== null) {
      this.moveResource(resource, resource.level)
    } else {
      this.changed()
    }
  }

  addRecipe(recipe: PrioritizedRecipe, weight: Rational, level: PriorityLevel): PriorityResource {
    const existing = this.getResource(recipe)
    if (existing !== null) {
      existing.weight = weight
      this.moveResource(existing, level)
      return existing
    }
    const resource = new PriorityResource(recipe, weight)
    this.insertIntoLevel(resource, level)
    this.changed()
    return resource
  }

  getResource(recipe: PrioritizedRecipe): PriorityResource | null {
    for (const level of this.priorities) {
      const resource = level.resources.find((candidate) => candidate.recipe === recipe)
      if (resource !== undefined) {
        return resource
      }
    }
    return null
  }

  getWeight(recipe: PrioritizedRecipe): Rational {
    const resource = this.getResource(recipe)
    if (resource === null) {
      throw new Error(`Recipe ${recipe?.key ?? "<unknown>"} is missing from resource priorities`)
    }
    return resource.weight
  }

  removeRecipe(recipe: PrioritizedRecipe): void {
    const resource = this.getResource(recipe)
    if (resource !== null) {
      this.removeResource(resource)
    }
  }

  removeResource(resource: PriorityResource): void {
    const level = resource.level
    if (level === null) {
      return
    }
    const index = level.resources.indexOf(resource)
    if (index !== -1) {
      level.resources.splice(index, 1)
    }
    resource.level = null
    this.removeEmptyLevels()
    this.changed()
  }

  moveResource(resource: PriorityResource, level: PriorityLevel): void {
    if (level.list !== this) {
      throw new Error("Cannot move a resource to a priority level from another list")
    }
    const currentLevel = resource.level
    if (currentLevel !== null) {
      const index = currentLevel.resources.indexOf(resource)
      if (index !== -1) {
        currentLevel.resources.splice(index, 1)
      }
    }
    this.insertIntoLevel(resource, level)
    this.removeEmptyLevels()
    this.changed()
  }

  private insertIntoLevel(resource: PriorityResource, level: PriorityLevel): void {
    resource.level = level
    const index = level.resources.findIndex((candidate) => resource.weight.less(candidate.weight))
    if (index === -1) {
      level.resources.push(resource)
    } else {
      level.resources.splice(index, 0, resource)
    }
  }

  private removeEmptyLevels(): void {
    for (let index = this.priorities.length - 1; index >= 0; index--) {
      const level = this.priorities[index]
      if (level !== undefined && level.isEmpty()) this.priorities.splice(index, 1)
    }
  }

  private changed(): void {
    if (this.notificationDepth > 0) {
      this.notificationPending = true
      return
    }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

// Priority policy

export interface PriorityMutationList {
  getResource(recipe: PrioritizedRecipe): PriorityResource | null
  getLastLevel(): PriorityLevel | null
  addPriorityBefore(level: PriorityLevel | null): PriorityLevel
  addRecipe(recipe: PrioritizedRecipe, weight: Rational, level: PriorityLevel): PriorityResource
  removeRecipe(recipe: PrioritizedRecipe): void
}

export const DISABLED_RECIPE_PREFIX = "D-"

export function addItemToMaximumPriority(specification: { readonly priority: PriorityMutationList }, item: Item): void {
  if (specification.priority.getResource(item.disableRecipe) !== null) {
    return
  }
  let level = specification.priority.getLastLevel()
  if (level === null || ![...level].some((resource) => resource.recipe.isDisable())) {
    level = specification.priority.addPriorityBefore(null)
  }
  specification.priority.addRecipe(item.disableRecipe, Rational.from_float(100), level)
}

export function buildDefaultPriorityArray(specification: PrioritySpecification): Map<PrioritizedRecipe, Rational>[] {
  const levels: Map<PrioritizedRecipe, Rational>[] = []
  for (let recipe of specification.recipes.values()) {
    if (recipe.defaultPriority === undefined) {
      continue
    }
    while (levels.length <= recipe.defaultPriority) {
      levels.push(new Map())
    }
    let weight = recipe.defaultWeight
    const product = recipe.products[0]
    const level = levels[recipe.defaultPriority]
    if (weight === undefined || product === undefined || level === undefined) {
      throw new Error(`Recipe ${recipe.key} has incomplete priority metadata`)
    }
    if (product.item.phase === "fluid") weight = weight.div(Rational.from_float(10))
    level.set(recipe, weight)
  }
  return levels
}

export function restoreDefaultPriorities(specification: PrioritySpecification): void {
  specification.priority = PriorityList.fromArray(specification.defaultPriority)
  for (let item of specification.items.values()) {
    if (specification.isItemDisabled(item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
}

export function isValidPriorityKey(specification: PrioritySpecification, key: string): boolean {
  if (key.startsWith(DISABLED_RECIPE_PREFIX)) {
    return specification.items.has(key.slice(DISABLED_RECIPE_PREFIX.length))
  }
  return specification.recipes.get(key)?.defaultPriority !== undefined
}

export function applyPriorities(
  specification: PrioritySpecification,
  tiers: readonly (readonly (readonly [string, Rational])[])[],
): void {
  let levels = tiers.map((tier) => {
    let level = new Map()
    for (let [recipeKey, weight] of tier) {
      let recipe: PrioritizedRecipe | undefined = specification.recipes.get(recipeKey)
      if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
        recipe = specification.items.get(recipeKey.slice(DISABLED_RECIPE_PREFIX.length))?.disableRecipe
      }
      if (recipe === undefined) throw new Error(`Unknown priority recipe: ${recipeKey}`)
      level.set(recipe, weight)
    }
    return level
  })
  specification.priority.applyArray(levels)
}

// React renders and edits PriorityList directly.
// endregion priorities.ts

// region recipes.ts
function requireItem(items: ReadonlyMap<string, Item>, key: string): Item {
  const item = items.get(key)
  if (item === undefined) throw new Error(`Dataset is missing required item ${key}`)
  return item
}

// Items

export type ItemPhase = "solid" | "fluid" | "abstract"

export class Item {
  readonly recipes: Recipe[] = []
  readonly uses: Recipe[] = []
  readonly icon: Icon
  readonly disableRecipe: DisabledRecipe
  spoilTime: Rational | null = null
  spoilResult: Item | null = null

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly phase: ItemPhase,
    readonly group: string,
    readonly subgroup: string,
    readonly order: string,
    readonly stackSize = 1,
  ) {
    this.icon = new Icon(this)

    this.disableRecipe = new DisabledRecipe(this)
  }
  allRecipes(): (Recipe | DisabledRecipe)[] {
    return [...this.recipes, this.disableRecipe]
  }
  addRecipe(recipe: Recipe): void {
    this.recipes.push(recipe)
  }
  addUse(recipe: Recipe): void {
    this.uses.push(recipe)
  }
}

export function getItems(data: CalculatorData): Map<string, Item> {
  const items = new Map<string, Item>()
  for (let d of data.items) {
    if (!d.localized_name) {
      console.log("bad item:", d)
      continue
    }
    const phase: ItemPhase = d.type === "fluid" ? "fluid" : "solid"
    items.set(
      d.key,
      new Item(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        phase,
        d.group,
        d.subgroup,
        d.order,
        d.stack_size ?? 1,
      ),
    )
  }
  let cycleKey = "nuclear-reactor-cycle"
  const reactor = requireItem(items, "nuclear-reactor")
  items.set(
    cycleKey,
    new Item(
      cycleKey,
      "Nuclear reactor cycle",
      reactor.icon_col,
      reactor.icon_row,
      "abstract",
      "production",
      "energy",
      "f[nuclear-energy]-d[reactor-cycle]",
    ),
  )
  return items
}

export class SurfaceCondition {
  readonly min?: number
  readonly max?: number

  constructor(
    readonly property: string,
    min: number | undefined,
    max: number | undefined,
  ) {
    if (min !== undefined) this.min = min
    if (max !== undefined) this.max = max
  }
}

export class Recipe implements SolverRecipe {
  readonly categories: Set<string>
  readonly category: string | null
  readonly icon: Icon
  readonly allow_productivity: boolean
  readonly allow_quality: boolean
  readonly defaultPriority: number | undefined = undefined
  readonly defaultWeight: Rational | undefined = undefined
  readonly processKind: string | undefined = undefined
  readonly harvestEmissions: Readonly<Record<string, Rational>> | undefined = undefined
  readonly miningTime: Rational | undefined = undefined

  constructor(
    readonly key: string,
    readonly name: string,
    readonly order: string | null,
    readonly icon_col: number,
    readonly icon_row: number,
    allowProductivity: boolean,
    allowQuality: boolean | undefined,
    categories: string | readonly string[] | null | undefined,
    readonly time: Rational,
    readonly ingredients: Ingredient<Item, Rational>[],
    readonly products: Ingredient<Item, Rational>[],
    readonly conditions: SurfaceCondition[] = [],
    readonly maximumProductivity: Rational | null = null,
  ) {
    this.allow_productivity = allowProductivity
    this.allow_quality = allowQuality !== false
    const normalizedCategories =
      categories === undefined || categories === null ? [] : typeof categories === "string" ? [categories] : categories
    this.categories = new Set(normalizedCategories)
    // Retain the old property for third-party consumers. Internal code
    // uses categories so Factorio 2.1 recipes can be made in any eligible
    // machine category.
    this.category = this.categories.values().next().value ?? null
    for (let ing of ingredients) {
      ing.item.addUse(this)
    }
    for (let ing of products) {
      ing.item.addRecipe(this)
    }

    const primaryProduct = products[0]
    if (primaryProduct === undefined) throw new Error(`Recipe ${key} has no products`)
    this.icon = new Icon(this, primaryProduct.item.name)
  }
  fuelIngredient(): Ingredient<Item, Rational>[] {
    let spec = currentSpecification()
    let building = spec.getBuilding(this)
    let fuel = spec.getFuelForRecipe(this)
    if (building === null || fuel === null) {
      return []
    }
    // baseRate = craft/s
    // basePower = J/s
    // perCraftEnergy = J/s / craft/s = J/craft
    // fuel.value = J/i
    // fuelAmount = J/craft / J/i = i/craft
    const baseRate = spec.getRecipeRate(this)
    if (baseRate === null) {
      throw new Error(`Recipe ${this.key} has no machine rate`)
    }
    let basePower = spec.getPowerUsage(this, baseRate).power
    let perCraftEnergy = basePower.div(baseRate)
    let fuelAmount = perCraftEnergy.div(fuel.value)
    return [new Ingredient(fuel.item, fuelAmount)]
  }
  getIngredients(): Ingredient<Item, Rational>[] {
    return this.ingredients.concat(this.fuelIngredient())
  }
  gives(item: Item): Rational {
    let spec = currentSpecification()
    let prodEffect = spec.getProdEffect(this).sub(one)
    for (let ing of this.products) {
      if (ing.item === item) {
        if (!prodEffect.isZero()) {
          let productiveAmount = ing.productivityAmount
          if (productiveAmount === null) {
            // Compatibility with older datasets that did not
            // export ignored_by_productivity. Their return products
            // were represented by subtracting same-item inputs.
            productiveAmount = ing.amount.sub(this.uses(item))
            if (productiveAmount.less(zero)) {
              return ing.amount
            }
          }
          return ing.amount.add(productiveAmount.mul(prodEffect))
        }
        return ing.amount
      }
    }
    throw new Error("recipe does not give item")
  }
  // There's an asymmetry with gives() here: It returns zero if the recipe
  // does not have this item as an ingredient.
  uses(item: Item): Rational {
    for (let ing of this.getIngredients()) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    return zero
  }
  isNetProducer(item: Item): boolean {
    let amount = this.gives(item)
    return zero.less(amount.sub(this.uses(item)))
  }
  isResource(): boolean {
    return false
  }
  isReal(): boolean {
    return true
  }
  isDisable(): boolean {
    return false
  }
}

const ASTEROID_CHUNK_RESOURCE_KEYS = new Set([
  "carbonic-asteroid-chunk",
  "metallic-asteroid-chunk",
  "oxide-asteroid-chunk",
  "promethium-asteroid-chunk",
])

// Pseudo-recipe representing the ex nihilo production of items with all
// recipes disabled.
export class DisabledRecipe implements SolverRecipe {
  readonly key: string
  readonly name: string
  readonly categories = new Set<string>()
  readonly category: null = null
  readonly ingredients: Ingredient<Item, Rational>[] = []
  readonly products: Ingredient<Item, Rational>[]
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon

  constructor(item: Item) {
    this.key = DISABLED_RECIPE_PREFIX + item.key
    this.name = item.name
    this.products = [new Ingredient(item, one)]
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
  getIngredients(): Ingredient<Item, Rational>[] {
    return this.ingredients
  }
  gives(item: Item): Rational {
    for (let ing of this.products) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    throw new Error(`Disabled recipe ${this.key} does not produce ${item.key}`)
  }
  isResource(): boolean {
    return false
  }
  isReal(): boolean {
    return true
  }
  isDisable(): boolean {
    return true
  }
}

function getResultProbability(result: RecipeAmountData): number | null {
  let probability = result.independent_probability ?? result.probability ?? 1
  if (result.shared_probability !== undefined) {
    let min = result.shared_probability.min ?? 0
    let max = result.shared_probability.max ?? 1
    probability *= max - min
  }
  return probability === 1 ? null : probability
}

function applyResultProbability(amount: Rational, result: RecipeAmountData): Rational {
  let probability = getResultProbability(result)
  if (probability !== null) {
    amount = amount.mul(Rational.from_float_approximate(probability))
  }
  return amount
}

export function getExpectedResultAmount(result: RecipeAmountData): Rational {
  let amount
  if (result.amount !== undefined) {
    amount = Rational.from_float_approximate(result.amount)
  } else if (result.amount_min !== undefined || result.amount_max !== undefined) {
    const min = result.amount_min ?? result.amount_max
    const max = result.amount_max ?? result.amount_min
    if (min === undefined || max === undefined) throw new Error("Recipe result range is incomplete")
    amount = Rational.from_float_approximate((min + max) / 2)
  } else {
    amount = one
  }

  if (result.extra_count_fraction !== undefined) {
    amount = amount.add(Rational.from_float_approximate(result.extra_count_fraction))
  }

  return applyResultProbability(amount, result)
}

function getProductivityAmount(result: RecipeAmountData, totalAmount: Rational): Rational | null {
  if (result.ignored_by_productivity === undefined) {
    return null
  }
  let ignored = Rational.from_float_approximate(result.ignored_by_productivity)
  ignored = applyResultProbability(ignored, result)
  return totalAmount.sub(ignored)
}

function makeRecipe(_data: CalculatorData, items: Map<string, Item>, d: RecipeData): Recipe | null {
  let time = Rational.from_float_approximate(d.energy_required)
  const products: Ingredient<Item, Rational>[] = []
  for (let result of d.results) {
    const item = items.get(result.name)
    if (item === undefined) return null
    let amount = getExpectedResultAmount(result)
    products.push(new Ingredient(item, amount, getProductivityAmount(result, amount)))
  }
  const ingredients: Ingredient<Item, Rational>[] = []
  for (let { name, amount } of d.ingredients) {
    const item = items.get(name)
    if (!item) {
      return null
    }
    if (amount === undefined) return null
    ingredients.push(new Ingredient(item, Rational.from_float_approximate(amount)))
  }
  const conditions: SurfaceCondition[] = []
  if (d.surface_conditions) {
    for (let { property, min, max } of d.surface_conditions) {
      conditions.push(new SurfaceCondition(property, min, max))
    }
  }
  return new Recipe(
    d.key,
    d.localized_name.en,
    d.order,
    d.icon_col,
    d.icon_row,
    d.allow_productivity,
    d.allow_quality,
    d.categories ?? d.category,
    time,
    ingredients,
    products,
    conditions,
    Rational.from_float_approximate(d.maximum_productivity ?? 3),
  )
}

export class RecipeMap extends Map<string, Recipe> {
  private readonly aliases: Map<string, string>

  constructor(aliases: Record<string, string> | undefined) {
    super()
    this.aliases = new Map(Object.entries(aliases ?? {}))
  }
  resolveKey(key: string): string {
    return this.aliases.get(key) ?? key
  }
  override get(key: string): Recipe | undefined {
    return super.get(this.resolveKey(key))
  }
  override has(key: string): boolean {
    return super.has(this.resolveKey(key))
  }
}

export class ResourceRecipe extends Recipe {
  override readonly defaultPriority: number
  override readonly defaultWeight: Rational

  constructor(item: Item, category: string | null, priority: number, weight: Rational) {
    super(
      item.key,
      item.name,
      item.order,
      item.icon_col,
      item.icon_row,
      true,
      true,
      category,
      zero,
      [],
      [new Ingredient(item, one)],
      [],
    )
    this.defaultPriority = priority
    this.defaultWeight = weight
  }
  override isResource(): boolean {
    return true
  }
}

export class SpoilageRecipe extends Recipe {
  override readonly processKind = "spoilage"

  constructor(from_item: Item, to_item: Item, spoilTime: Rational) {
    let key = `${from_item.key}-spoilage`
    let name = `${from_item.name} to ${to_item.name} (Spoilage)`
    super(
      key,
      name,
      null,
      to_item.icon_col,
      to_item.icon_row,
      false,
      true,
      null,
      spoilTime,
      [new Ingredient(from_item, one)],
      [new Ingredient(to_item, one)],
      [],
    )
  }
}

export class PlantRecipe extends Recipe {
  override readonly processKind = "growth"
  override readonly harvestEmissions: Readonly<Record<string, Rational>>
  override readonly defaultPriority = 1
  override readonly defaultWeight = Rational.from_float(100)

  constructor(
    key: string,
    name: string,
    order: string | null,
    col: number,
    row: number,
    seed: Item,
    results: Ingredient<Item, Rational>[],
    conditions: SurfaceCondition[],
    growthTime: Rational,
    harvestEmissions: Readonly<Record<string, number>> = {},
  ) {
    super(
      key,
      name,
      order,
      col,
      row,
      false,
      true,
      "agriculture",
      growthTime,
      [new Ingredient(seed, one)],
      results,
      conditions,
    )
    this.harvestEmissions = Object.fromEntries(
      Object.entries(harvestEmissions).map(([pollutant, amount]) => [
        pollutant,
        Rational.from_float_approximate(amount),
      ]),
    )
  }
  override isResource(): boolean {
    return true
  }
}

export class MiningRecipe extends Recipe {
  override readonly miningTime: Rational
  override readonly defaultPriority = 1
  override readonly defaultWeight = Rational.from_float(100)

  constructor(
    key: string,
    name: string,
    order: string | null,
    col: number,
    row: number,
    category: string,
    miningTime: Rational,
    ingredients: Ingredient<Item, Rational>[] | null,
    products: Ingredient<Item, Rational>[],
  ) {
    if (!ingredients) {
      ingredients = []
    }
    super(key, name, order, col, row, true, true, category, zero, ingredients, products, [])
    this.miningTime = miningTime
  }
  override isResource(): boolean {
    return true
  }
}

export class OffshorePumpRecipe extends Recipe {
  override readonly defaultPriority = 0
  override readonly defaultWeight = Rational.from_float(100)

  constructor(key: string, name: string, order: string | null, col: number, row: number, product: Item) {
    super(key, name, order, col, row, false, true, "offshore-pumping", zero, [], [new Ingredient(product, one)], [])
  }
  override isResource(): boolean {
    return true
  }
}

function getSteam(data: CalculatorData): [Rational, Rational] {
  let R = Rational.from_float
  let boilerDef = data.boilers.find((entry) => entry.key === "boiler")
  let water = data.fluids.find((entry) => entry.item_key === "water")
  let steam = data.fluids.find((entry) => entry.item_key === "steam")
  if (boilerDef === undefined || water === undefined || steam === undefined) {
    throw new Error("Dataset is missing the base boiler, water, or steam prototype")
  }
  let power = R(boilerDef.energy_consumption)
  let tempDelta = R(boilerDef.target_temperature).sub(R(water.default_temperature))
  // heat_capacity is denominated in J/degrees C/unit.
  let waterCap = R(water.heat_capacity)
  let steamCap = R(steam.heat_capacity)
  // water/second
  let waterRate = power.div(tempDelta.mul(waterCap))
  // steam/second
  let steamRate = power.div(tempDelta.mul(steamCap))
  return [waterRate, steamRate]
}

export function getRecipes(data: CalculatorData, items: Map<string, Item>): RecipeMap {
  let hundred = Rational.from_float(100)
  let recipes = new RecipeMap(data.recipe_aliases)
  let reactor = requireItem(items, "nuclear-reactor")
  let used_cell_name = "used-up-uranium-fuel-cell"
  if (!items.has(used_cell_name)) {
    used_cell_name = "depleted-uranium-fuel-cell"
  }
  recipes.set(
    "nuclear-reactor-cycle",
    new Recipe(
      "nuclear-reactor-cycle",
      "Nuclear reactor cycle",
      reactor.order,
      reactor.icon_col,
      reactor.icon_row,
      false,
      true,
      "nuclear",
      Rational.from_float(200),
      [new Ingredient(requireItem(items, "uranium-fuel-cell"), one)],
      [
        new Ingredient(requireItem(items, used_cell_name), one),
        new Ingredient(requireItem(items, "nuclear-reactor-cycle"), one),
      ],
    ),
  )
  if (items.has("satellite")) {
    let rocket = requireItem(items, "rocket-silo")
    recipes.set(
      "rocket-launch",
      new Recipe(
        "rocket-launch",
        "Rocket launch",
        rocket.order,
        rocket.icon_col,
        rocket.icon_row,
        false,
        true,
        "rocket-launch",
        one,
        [
          new Ingredient(
            requireItem(items, "rocket-part"),
            Rational.from_float_approximate(data.rocket_launch?.parts_per_launch ?? 100),
          ),
          new Ingredient(requireItem(items, "satellite"), one),
        ],
        [new Ingredient(requireItem(items, "space-science-pack"), Rational.from_float(1000))],
      ),
    )
  }
  let steam = requireItem(items, "steam")
  let [waterRate, steamRate] = getSteam(data)
  recipes.set(
    "steam",
    new Recipe(
      "steam",
      "Steam",
      steam.order,
      steam.icon_col,
      steam.icon_row,
      false,
      true,
      "boiler",
      one,
      [new Ingredient(requireItem(items, "water"), waterRate)],
      [new Ingredient(requireItem(items, "steam"), steamRate)],
    ),
  )
  for (let d of data.recipes) {
    /*if (d.key.endsWith("-recycling")) {
            continue
        }*/
    let r = makeRecipe(data, items, d)
    if (r) {
      recipes.set(d.key, r)
    }
  }
  for (let d of data.resources) {
    let category = d.category
    if (!category) {
      category = "basic-solid"
    }
    if (category === "basic-fluid") {
      const products: Ingredient<Item, Rational>[] = []
      for (let result of d.results) {
        products.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
      }
      recipes.set(
        d.key,
        new MiningRecipe(
          d.key,
          d.localized_name.en,
          d.order ?? null,
          d.icon_col,
          d.icon_row,
          category,
          Rational.from_float_approximate(d.mining_time),
          [],
          products,
        ),
      )
      continue
    }
    let ingredients = null
    if (d.required_fluid !== undefined && d.fluid_amount !== undefined) {
      ingredients = [
        new Ingredient(requireItem(items, d.required_fluid), Rational.from_float_approximate(d.fluid_amount / 10)),
      ]
    }
    const products: Ingredient<Item, Rational>[] = []
    for (let result of d.results) {
      products.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
    }
    recipes.set(
      d.key,
      new MiningRecipe(
        d.key,
        d.localized_name.en,
        d.order ?? null,
        d.icon_col,
        d.icon_row,
        category,
        Rational.from_float_approximate(d.mining_time),
        ingredients,
        products,
      ),
    )
  }
  const offshoreItems = new Set<string>()
  if (data.planets) {
    for (let planet of data.planets) {
      for (let key of planet.resources.offshore ?? []) {
        offshoreItems.add(key)
      }
    }
  } else {
    offshoreItems.add("water")
  }
  for (let key of offshoreItems) {
    const item = requireItem(items, key)
    const r = new OffshorePumpRecipe(key, item.name, item.order, item.icon_col, item.icon_row, item)
    if (recipes.has(key)) {
      console.log("duplicate key:", key)
    }
    recipes.set(key, r)
  }
  if (data.plants) {
    for (let plant of data.plants) {
      const results: Ingredient<Item, Rational>[] = []
      for (let result of plant.results) {
        results.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
      }
      const conditions: SurfaceCondition[] = []
      if (plant.surface_conditions) {
        for (let { property, min, max } of plant.surface_conditions) {
          conditions.push(new SurfaceCondition(property, min, max))
        }
      }
      let r = new PlantRecipe(
        plant.key,
        plant.localized_name.en,
        plant.order ?? null,
        plant.icon_col,
        plant.icon_row,
        requireItem(items, plant.seed),
        results,
        conditions,
        Rational.from_float_approximate(plant.growth_ticks / 60),
        plant.harvest_emissions ?? {},
      )
      recipes.set(plant.key, r)
    }
  }
  if (data.spoilage) {
    for (let spoil of data.spoilage) {
      const from_item = requireItem(items, spoil.from_item)
      const to_item = requireItem(items, spoil.to_item)
      let spoilTime = Rational.from_float_approximate(spoil.time / 60)
      from_item.spoilTime = spoilTime
      from_item.spoilResult = to_item
      let r = new SpoilageRecipe(from_item, to_item, spoilTime)
      recipes.set(r.key, r)
    }
  }
  // Asteroid chunks are gathered directly by platform collectors. They may
  // also be returned by processing recipes, so they need explicit resource
  // recipes even though they already have other producers.
  for (let itemKey of ASTEROID_CHUNK_RESOURCE_KEYS) {
    let item = items.get(itemKey)
    if (item !== undefined && !recipes.has(itemKey)) {
      recipes.set(itemKey, new ResourceRecipe(item, null, 1, hundred))
    }
  }

  // Reap items both produced by no recipes and consumed by no recipes.
  let reapItems = []
  for (const [itemKey, item] of items) {
    if (item.recipes.length === 0 && item.uses.length === 0) {
      reapItems.push(itemKey)
    } else if (item.recipes.length === 0) {
      console.log("item with no recipes:", item)
      let priority = ASTEROID_CHUNK_RESOURCE_KEYS.has(itemKey) ? 1 : 2
      recipes.set(itemKey, new ResourceRecipe(item, null, priority, hundred))
    }
  }
  for (let key of reapItems) {
    items.delete(key)
  }
  return recipes
}

export interface RecipeSettingsSpecification {
  readonly recipes: Map<string, Recipe>
  readonly buildingKeys: Map<string, { readonly name: string; canCraft(recipe: Recipe): boolean }> | null
  readonly planetaryBaseline: Set<Recipe> | null
  readonly disable: Set<Recipe>
  readonly ignore: Set<Item>
  readonly buildTargets: readonly {
    readonly item: Item
    readonly recipe: Recipe | null
    readonly changedBuilding: boolean
    displayRecipes(): void
  }[]
  readonly priority: PriorityMutationList
}

// Recipe settings queries

const CATEGORY_ORDER = new Map([
  ["resources", 0],
  ["crafting", 10],
  ["advanced-crafting", 11],
  ["crafting-with-fluid", 12],
  ["smelting", 20],
  ["metallurgy", 21],
  ["chemistry", 30],
  ["oil-processing", 31],
  ["organic", 40],
  ["captive-spawner-process", 41],
  ["electromagnetics", 50],
  ["cryogenics", 60],
  ["crushing", 70],
  ["centrifuging", 80],
  ["rocket-building", 90],
  ["hand-crafting", 100],
  ["other", 1000],
])

function compactRecipeSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function humanizeRecipeCategory(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function isRecyclingRecipe(recipe: Recipe): boolean {
  return recipe.categories?.has("recycling") || recipe.category === "recycling" || recipe.key.endsWith("-recycling")
}

export interface RecipeSelectorGroup {
  readonly key: string
  readonly name: string
  readonly recipes: Recipe[]
}

export function getRecipeSelectorGroups(recipes: readonly Recipe[], activeRecipe: Recipe): RecipeSelectorGroup[] {
  function orderGroup(groupRecipes: readonly Recipe[]): Recipe[] {
    return [...groupRecipes].sort((recipeA, recipeB) => {
      if (recipeA === activeRecipe) {
        return -1
      }
      if (recipeB === activeRecipe) {
        return 1
      }
      const nameOrder = recipeA.name.localeCompare(recipeB.name)
      return nameOrder === 0 ? recipeA.key.localeCompare(recipeB.key) : nameOrder
    })
  }

  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  return [
    {
      key: "production",
      name: "Production",
      recipes: orderGroup(productionRecipes),
    },
    {
      key: "recycling",
      name: "Recycling",
      recipes: orderGroup(recyclingRecipes),
    },
  ].filter((group) => group.recipes.length > 0)
}

export function getRecipeSettingsCategory(recipe: Recipe): string {
  if (recipe.isResource?.()) {
    return "resources"
  }
  return recipe.category ?? recipe.categories?.values().next().value ?? "other"
}

function getCompatibleBuildingNames(spec: RecipeSettingsSpecification, recipe: Recipe): string[] {
  const names = []
  for (const building of spec.buildingKeys?.values?.() ?? []) {
    if (building.canCraft?.(recipe)) {
      names.push(building.name)
    }
  }
  return names
}

export function recipeMatchesSettingsSearch(spec: RecipeSettingsSpecification, recipe: Recipe, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const values = [
    recipe.name,
    recipe.key,
    humanizeRecipeCategory(getRecipeSettingsCategory(recipe)),
    ...recipe.products.map(({ item }) => item.name),
    ...recipe.products.map(({ item }) => item.key),
    ...recipe.getIngredients().map(({ item }) => item.name),
    ...recipe.getIngredients().map(({ item }) => item.key),
    ...getCompatibleBuildingNames(spec, recipe),
  ]
  const normalizedValues = values.map(normalizeSearchText)
  const compactQuery = compactRecipeSearchText(normalizedQuery)

  if (normalizedValues.some((value) => compactRecipeSearchText(value).includes(compactQuery))) {
    return true
  }

  return normalizedQuery.split(" ").every((token) => normalizedValues.some((value) => value.includes(token)))
}

export function getConfigurableRecipes(spec: RecipeSettingsSpecification): Recipe[] {
  return [...spec.recipes.values()].filter((recipe) => recipe.isReal() && !recipe.isDisable())
}

export function isRecipeUnavailable(spec: RecipeSettingsSpecification, recipe: Recipe): boolean {
  return spec.planetaryBaseline?.has(recipe) ?? false
}

export function recipeVisibleInSettings(
  spec: RecipeSettingsSpecification,
  recipe: Recipe,
  options: {
    searchText: string
    showUnavailable: boolean
  },
) {
  return (
    (options.showUnavailable || !isRecipeUnavailable(spec, recipe)) &&
    recipeMatchesSettingsSearch(spec, recipe, options.searchText)
  )
}

function categorySortKey(category: string) {
  return CATEGORY_ORDER.get(category) ?? 500
}

export interface RecipeSettingsGroup {
  readonly category: string
  readonly name: string
  readonly recipes: Recipe[]
}

export function groupRecipesForSettings(recipes: readonly Recipe[]): RecipeSettingsGroup[] {
  const groups = new Map<string, Recipe[]>()
  for (const recipe of recipes) {
    const category = getRecipeSettingsCategory(recipe)
    const group = groups.get(category) ?? []
    group.push(recipe)
    groups.set(category, group)
  }

  return [...groups.entries()]
    .sort(([categoryA], [categoryB]) => {
      const order = categorySortKey(categoryA) - categorySortKey(categoryB)
      return order === 0 ? categoryA.localeCompare(categoryB) : order
    })
    .map(([category, categoryRecipes]) => ({
      category,
      name: humanizeRecipeCategory(category),
      recipes: sorted(categoryRecipes, (recipe) => recipe.order ?? recipe.name),
    }))
}

// Recipe policy

function refreshTargetsForItems(specification: RecipeSettingsSpecification, items: ReadonlySet<Item>): void {
  for (let target of specification.buildTargets) {
    if (items.has(target.item)) {
      target.displayRecipes()
    }
  }
}

export function disableRecipe(specification: RecipeSettingsSpecification, recipe: Recipe): void {
  if (specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<Item>()
  let affectedItems = new Set<Item>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.add(recipe)
  for (let item of candidateItems) {
    if (isItemDisabled(specification, item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function enableRecipe(specification: RecipeSettingsSpecification, recipe: Recipe): void {
  if (!specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<Item>()
  let affectedItems = new Set<Item>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.delete(recipe)
  for (let item of candidateItems) {
    if (!isItemDisabled(specification, item)) {
      specification.priority.removeRecipe(item.disableRecipe)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function getEnabledUses(specification: RecipeSettingsSpecification, item: Item): Recipe[] {
  return item.uses.filter((recipe) => !specification.disable.has(recipe))
}

export function isItemDisabled(specification: RecipeSettingsSpecification, item: Item): boolean {
  return !item.recipes.some((recipe) => !specification.disable.has(recipe) && recipe.isNetProducer(item))
}

export function getEnabledRecipes(specification: RecipeSettingsSpecification, item: Item): (Recipe | DisabledRecipe)[] {
  let enabled = item.recipes.filter((recipe) => !specification.disable.has(recipe))
  if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
    return enabled
  }
  return [
    item.disableRecipe,
    ...enabled.filter((recipe) => recipe.products.some((product) => !specification.ignore.has(product.item))),
  ]
}

function addItemGraph(
  specification: RecipeSettingsSpecification,
  item: Item,
  graph: Set<Recipe | DisabledRecipe>,
): void {
  for (let recipe of getEnabledRecipes(specification, item)) {
    if (graph.has(recipe)) {
      continue
    }
    graph.add(recipe)
    for (let ingredient of recipe.getIngredients()) {
      addItemGraph(specification, ingredient.item, graph)
    }
  }
}

export function getRecipeGraph(
  specification: RecipeSettingsSpecification,
  items: ReadonlyMap<Item, Rational>,
): Set<Recipe | DisabledRecipe> {
  const graph = new Set<Recipe | DisabledRecipe>()
  for (let item of items.keys()) {
    addItemGraph(specification, item, graph)
  }
  return graph
}

export function isFactoryTarget(specification: RecipeSettingsSpecification, recipe: Recipe): boolean {
  return specification.buildTargets.some((target) => target.recipe === recipe && target.changedBuilding)
}
// endregion recipes.ts

// region quality/contracts.ts
export type QualityOptimizationObjective = "configured" | "quality-modules" | "materials" | "machines" | "power"
export type QualityPlannerObjective = "quality-modules" | "materials" | "machines" | "power"
export type QualityPlanProfile = "planet" | "vulcanus"

export function isQualityPlannerObjective(value: string): value is QualityPlannerObjective {
  return value === "quality-modules" || value === "materials" || value === "machines" || value === "power"
}

export interface QualifiedItemAmount {
  readonly item: Item
  readonly qualityLevel: number
  readonly amount: Rational
}

export interface QualityTierConfiguration {
  readonly qualityLevel: number
  readonly building: Building | null
  readonly machineQuality: Quality
  readonly modules: readonly (Module | null)[]
  readonly moduleQualities: readonly Quality[]
  readonly beaconModules: readonly (Module | null)[]
  readonly beaconModuleQualities: readonly Quality[]
  readonly beaconQuality: Quality
  readonly beaconCount: Rational
  readonly qualityChance: Rational
  readonly productivity: Rational
  readonly speedEffect: Rational
  readonly powerEffect: Rational
}

export interface SelfRecyclingLegendaryMetrics {
  readonly item: Item
  readonly recyclerRecipe: Recipe
  readonly outputPerSecondPerMachine: Rational
  readonly sourceQualityChance: Rational
  readonly recyclerQualityChance: Rational
  readonly score: Rational
  readonly legendaryPerMinutePerMachine: Rational
}

export interface QualityOperationRate {
  readonly recipe: Recipe
  readonly qualityLevel: number
  readonly rate: Rational
  readonly machineCount: Rational
  readonly power: Rational
  readonly kind: "craft" | "recycle" | "source" | "dispose"
  readonly sourcePurpose?: "utility" | "quality"
  readonly configuration: QualityTierConfiguration
  readonly selfRecyclingLegendary?: SelfRecyclingLegendaryMetrics
}

export interface QualityTargetPlan {
  readonly profile: QualityPlanProfile
  readonly planetKey: string
  readonly objective: QualityOptimizationObjective
  readonly item: Item
  readonly recipe: Recipe
  readonly recyclerRecipe: Recipe | null
  readonly qualityLevel: number
  readonly requested: Rational
  readonly firstPassChance: Rational
  readonly freshInputs: readonly QualifiedItemAmount[]
  readonly importedInputs: readonly QualifiedItemAmount[]
  readonly fluidInputs: readonly QualifiedItemAmount[]
  readonly surplusOutputs: readonly QualifiedItemAmount[]
  readonly operations: readonly QualityOperationRate[]
  readonly totalCrafts: Rational
  readonly totalRecycles: Rational
  readonly totalMachineCount: Rational
  readonly totalQualityModules: Rational
  readonly totalPower: Rational
  readonly warnings: readonly string[]
}
// endregion quality/contracts.ts

// region quality/math.ts
const CONTINUATION_CHANCE = Rational.from_floats(1, 10)
const STOP_AFTER_UPGRADE_CHANCE = Rational.from_floats(9, 10)

/**
 * Exact probability that one quality roll moves an item from `fromLevel` to
 * `toLevel`. Levels are sequential quality indexes, not prototype level
 * values (Legendary is index 4 even though its prototype level is 5).
 */
export function qualityTransitionProbability(
  chance: Rational,
  fromLevel: number,
  toLevel: number,
  maxLevel: number,
): Rational {
  if (fromLevel < 0 || toLevel < fromLevel || maxLevel < 0 || fromLevel > maxLevel || toLevel > maxLevel) {
    return zero
  }
  if (fromLevel === maxLevel) return toLevel === maxLevel ? one : zero

  const normalizedChance = Rational.max(zero, Rational.min(one, chance))
  if (toLevel === fromLevel) return one.sub(normalizedChance)

  const upgrades = toLevel - fromLevel
  const repeated = CONTINUATION_CHANCE.pow(upgrades - 1)
  return toLevel === maxLevel
    ? normalizedChance.mul(repeated)
    : normalizedChance.mul(STOP_AFTER_UPGRADE_CHANCE).mul(repeated)
}

export function qualityTransitionDistribution(
  chance: Rational,
  fromLevel: number,
  maxLevel: number,
): readonly Rational[] {
  return Array.from({ length: maxLevel + 1 }, (_, toLevel) =>
    qualityTransitionProbability(chance, fromLevel, toLevel, maxLevel),
  )
}

/**
 * Eventual Legendary chance for an item that starts at Normal and is recycled
 * into itself at exactly 25% until it reaches Legendary. This is the closed
 * form of the same absorbing quality flow used by recyclerClosure().
 */
export function quarterSelfRecycleLegendaryProbability(
  sourceQualityChance: Rational,
  recyclerQualityChance: Rational,
): Rational {
  const source = Rational.max(zero, Rational.min(one, sourceQualityChance))
  const recycler = Rational.max(zero, Rational.min(one, recyclerQualityChance))
  const three = Rational.from_integer(3)
  const ten = Rational.from_integer(10)
  return source
    .mul(three)
    .add(recycler)
    .mul(recycler.mul(ten).add(three).pow(3))
    .div(Rational.from_integer(1000).mul(recycler.add(three).pow(4)))
}

/**
 * Relative Legendary-throughput score for the same 25% self-recycling case.
 * With a fixed recycler setup, higher is always better. Quality chances are
 * fractions here; multiply the result by 100 to show the familiar percent-
 * point score T × (Q% + R% / 3).
 */
export function quarterSelfRecycleLegendaryScore(
  outputPerSecond: Rational,
  sourceQualityChance: Rational,
  recyclerQualityChance: Rational,
): Rational {
  const source = Rational.max(zero, Rational.min(one, sourceQualityChance))
  const recycler = Rational.max(zero, Rational.min(one, recyclerQualityChance))
  return outputPerSecond.mul(source.add(recycler.div(Rational.from_integer(3))))
}

/** Solve A x = b exactly. Throws for singular or underdetermined systems. */
export function solveExactLinearSystem(
  coefficients: readonly (readonly Rational[])[],
  rhs: readonly Rational[],
): Rational[] {
  const size = coefficients.length
  if (size === 0 || rhs.length !== size || coefficients.some((row) => row.length !== size)) {
    throw new Error("Quality flow requires a non-empty square linear system")
  }

  const augmented = new Matrix(size, size + 1)
  for (let row = 0; row < size; row++) {
    const coefficientRow = coefficients[row]
    if (coefficientRow === undefined) throw new Error("Missing quality-flow coefficient row")
    for (let column = 0; column < size; column++) {
      const value = coefficientRow[column]
      if (value === undefined) throw new Error("Missing quality-flow coefficient")
      augmented.setIndex(row, column, value)
    }
    const result = rhs[row]
    if (result === undefined) throw new Error("Missing quality-flow result")
    augmented.setIndex(row, size, result)
  }

  const pivots = augmented.rref()
  if (pivots.length !== size || pivots.some((pivot, index) => pivot !== index)) {
    throw new Error("Quality flow contains a neutral or non-consuming cycle")
  }
  return Array.from({ length: size }, (_, row) => augmented.index(row, size))
}

function bigintGcd(left: bigint, right: bigint): bigint {
  left = left < 0n ? -left : left
  right = right < 0n ? -right : right
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function bigintLcm(left: bigint, right: bigint): bigint {
  return (left / bigintGcd(left, right)) * right
}

/**
 * Solve A x = b exactly with fraction-free Bareiss elimination.
 *
 * This avoids constructing and reducing a Rational for every cell update in
 * the larger optimal-basis certification systems used by the quality solver.
 */
export function solveExactLinearSystemFractionFree(
  coefficients: readonly (readonly Rational[])[],
  rhs: readonly Rational[],
): Rational[] {
  const size = coefficients.length
  if (size === 0 || rhs.length !== size || coefficients.some((row) => row.length !== size)) {
    throw new Error("Quality flow requires a non-empty square linear system")
  }

  const matrix = coefficients.map((sourceRow, row) => {
    const result = rhs[row]
    if (result === undefined) throw new Error("Missing quality-flow result")
    let denominator = result.q
    for (const value of sourceRow) denominator = bigintLcm(denominator, value.q)
    return [...sourceRow, result].map((value) => value.p * (denominator / value.q))
  })

  let previousPivot = 1n
  for (let pivotIndex = 0; pivotIndex < size - 1; pivotIndex++) {
    let pivotRow = pivotIndex
    while (pivotRow < size && matrix[pivotRow]?.[pivotIndex] === 0n) pivotRow++
    if (pivotRow === size) throw new Error("Quality flow contains a neutral or non-consuming cycle")
    if (pivotRow !== pivotIndex) {
      const current = matrix[pivotIndex]
      const replacement = matrix[pivotRow]
      if (current === undefined || replacement === undefined) throw new Error("Missing quality-flow row")
      matrix[pivotIndex] = replacement
      matrix[pivotRow] = current
    }

    const pivot = matrix[pivotIndex]?.[pivotIndex]
    const pivotValues = matrix[pivotIndex]
    if (pivot === undefined || pivot === 0n || pivotValues === undefined) {
      throw new Error("Quality flow contains a neutral or non-consuming cycle")
    }
    for (let row = pivotIndex + 1; row < size; row++) {
      const rowValues = matrix[row]
      const factor = rowValues?.[pivotIndex]
      if (rowValues === undefined || factor === undefined) throw new Error("Missing quality-flow coefficient")
      for (let column = pivotIndex + 1; column <= size; column++) {
        const value = rowValues[column]
        const pivotValue = pivotValues[column]
        if (value === undefined || pivotValue === undefined) throw new Error("Missing quality-flow coefficient")
        const numerator = value * pivot - factor * pivotValue
        if (numerator % previousPivot !== 0n) throw new Error("Fraction-free quality elimination lost exactness")
        rowValues[column] = numerator / previousPivot
      }
      rowValues[pivotIndex] = 0n
    }
    previousPivot = pivot
  }

  const solution = Array.from({ length: size }, () => zero)
  for (let row = size - 1; row >= 0; row--) {
    const rowValues = matrix[row]
    const diagonal = rowValues?.[row]
    const result = rowValues?.[size]
    if (rowValues === undefined || diagonal === undefined || result === undefined || diagonal === 0n) {
      throw new Error("Quality flow contains a neutral or non-consuming cycle")
    }
    let remainder = new Rational(result, 1n)
    for (let column = row + 1; column < size; column++) {
      const coefficient = rowValues[column]
      const value = solution[column]
      if (coefficient === undefined || value === undefined) throw new Error("Missing quality-flow coefficient")
      if (coefficient !== 0n) remainder = remainder.sub(new Rational(coefficient, 1n).mul(value))
    }
    solution[row] = remainder.div(new Rational(diagonal, 1n))
  }
  return solution
}
// endregion quality/math.ts

// region planning/contracts.ts
export const QUALITY_TIERS = ["Normal", "Uncommon", "Rare", "Epic", "Legendary"] as const

export interface PlanningTarget {
  readonly item: Item
  readonly recipe: Recipe | null
  readonly qualityLevel: number
  getRate(): Rational
}

export interface PlanningSpecification extends ModelFactorySpecification {
  readonly spec: ReadonlyMap<Recipe, ModuleSpec>
  readonly defaultModule: Module | null
  readonly maxQualityLevel: number
  readonly modules: ReadonlyMap<string, Module>
  readonly selectedPlanets: ReadonlySet<Planet>
  readonly recipeLocations: ReadonlyMap<Recipe, Planet>
  readonly asteroidLimits: ReadonlyMap<string, Rational>
  readonly freshnessDelayMinutes: Rational
  readonly bufferMinutes: Rational
  readonly beaconPower: Rational
  readonly buildTargets: readonly PlanningTarget[]
  readonly qualityPlans: readonly QualityTargetPlan[]
  getBuildingOverrideSource(recipe: Recipe): "default" | "automatic-quality" | "user"
  getBuildingOverride(recipe: Recipe): Building | null
  getCompatibleBuildings(recipe: Recipe, availableOnly?: boolean): Building[]
  getCount(recipe: Recipe, rate: Rational): Rational
  getRecipes(item: Item): (Recipe | DisabledRecipe)[]
}

export interface TransportFlow {
  readonly from: Planet
  readonly to: Planet
  readonly item: Item
  rate: Rational
  readonly fuel: boolean
}

export interface AsteroidConstraintRow {
  readonly item: Item
  readonly required: Rational
  readonly limit: Rational
  readonly exceeded: boolean
}

export interface FreshnessRow {
  readonly item: Item
  readonly remaining: Rational
  readonly effectiveRate: Rational
  readonly expired: boolean
}

export interface PollutionComponents {
  readonly machine: Rational
  readonly process: Rational
  readonly total: Rational
}

export type QualityTargetFeasibility =
  | {
      status: "feasible"
      qualityChance: Rational
    }
  | {
      status: "auto-configurable"
      building: Building
      module: Module
      slotCount: number
    }
  | {
      status: "conflict"
      building: Building | null
      module: Module | null
      reason: "explicit-building" | "explicit-modules"
    }
  | {
      status: "unavailable"
      reason: "no-compatible-building" | "no-module-slots" | "no-quality-module" | "module-incompatible"
    }
// endregion planning/contracts.ts

// region planning.ts
const AQUILO_MACHINE_HEAT_KW: Readonly<Record<string, number>> = {
  "offshore-pump": 0,
  pumpjack: 50,
  "oil-refinery": 200,
  foundry: 300,
  "rocket-silo": 300,
}

const DEFAULT_AQUILO_MACHINE_HEAT_KW = 100
const AQUILO_BEACON_HEAT_W = Rational.from_integer(400_000)

function isQualityModule(module: Module | null | undefined): module is Module {
  return module !== null && module !== undefined && module.quality !== undefined && zero.less(module.quality)
}

function moduleTier(module: Module | null | undefined): number {
  if (module === null || module === undefined) return 1
  const match = String(module.key ?? "").match(/(\d+)$/)
  return match === null ? 1 : Number(match[1])
}

function getModuleSpecWithoutMutation(specification: PlanningSpecification, recipe: Recipe): ModuleSpec | null {
  return specification.spec?.get(recipe) ?? null
}

export function qualityProbability(chance: Rational, targetLevel: number, maxLevel: number): Rational {
  if (targetLevel <= 0) return one
  return qualityTransitionProbability(chance, 0, targetLevel, maxLevel)
}

export function getRecipeQualityChance(specification: PlanningSpecification, recipe: Recipe): Rational {
  if (!recipe.allow_quality) return zero
  const building = specification.getBuilding(recipe)
  if (building === null || building.moduleSlots <= 0) return zero

  const configured = getModuleSpecWithoutMutation(specification, recipe)
  if (configured?.building === building) return configured.qualityEffect()

  // Preserve the non-mutating planning boundary while still applying default
  // beaconed speed-module penalties to recipes whose ModuleSpec has not yet
  // been materialized by the Factory table.
  const defaults = new ModuleSpec(recipe, specification)
  defaults.setBuilding(building, specification)
  return defaults.qualityEffect()
}

function chooseQualityModule(
  specification: PlanningSpecification,
  recipe: Recipe,
  building: Building,
  moduleSpec: ModuleSpec | null,
  qualityModules: readonly Module[],
): Module | null {
  const compatible = qualityModules.filter((module) => module.canUse(recipe, building))
  if (compatible.length === 0) return null

  const existing = moduleSpec?.modules?.find(
    (module) => isQualityModule(module) && module.canUse(recipe, building) && compatible.includes(module),
  )
  if (existing !== undefined) return existing

  const defaultModule = specification.defaultModule
  if (isQualityModule(defaultModule) && compatible.includes(defaultModule)) {
    return defaultModule
  }

  if (defaultModule !== null && defaultModule !== undefined) {
    const preferredTier = moduleTier(defaultModule)
    const sameTier = compatible.find((module) => moduleTier(module) === preferredTier)
    if (sameTier !== undefined) return sameTier

    const lowerTiers = compatible
      .filter((module) => moduleTier(module) < preferredTier)
      .sort((a, b) => moduleTier(b) - moduleTier(a))
    if (lowerTiers.length > 0) return lowerTiers[0] ?? null
  }

  return [...compatible].sort((a, b) => moduleTier(a) - moduleTier(b))[0] ?? null
}

export function getQualityTargetFeasibility(
  specification: PlanningSpecification,
  recipe: Recipe | null | undefined,
  qualityLevel: number,
  options: { ignoreExplicit?: boolean } = {},
): QualityTargetFeasibility {
  if (qualityLevel <= 0) {
    return { status: "feasible", qualityChance: one }
  }

  if (recipe === null || recipe === undefined || qualityLevel > specification.maxQualityLevel) {
    return { status: "unavailable", reason: "no-quality-module" }
  }

  const qualityChance = getRecipeQualityChance(specification, recipe)
  if (!qualityProbability(qualityChance, qualityLevel, specification.maxQualityLevel).isZero()) {
    return { status: "feasible", qualityChance }
  }

  const currentBuilding = specification.getBuilding(recipe)
  const moduleSpec = getModuleSpecWithoutMutation(specification, recipe)
  const buildingOverrideSource = specification.getBuildingOverrideSource(recipe)
  if (!options.ignoreExplicit && buildingOverrideSource === "user") {
    return {
      status: "conflict",
      building: currentBuilding,
      module: moduleSpec?.modules?.find((module) => module !== null) ?? null,
      reason: "explicit-building",
    }
  }
  if (!options.ignoreExplicit && moduleSpec?.moduleSource === "user") {
    return {
      status: "conflict",
      building: currentBuilding,
      module: moduleSpec.modules.find((module) => module !== null) ?? null,
      reason: "explicit-modules",
    }
  }

  const compatibleBuildings = specification.getCompatibleBuildings(recipe, true)
  if (compatibleBuildings.length === 0) {
    return { status: "unavailable", reason: "no-compatible-building" }
  }

  const qualityModules = [...specification.modules.values()].filter(isQualityModule)
  if (qualityModules.length === 0) {
    return { status: "unavailable", reason: "no-quality-module" }
  }

  const orderedBuildings =
    currentBuilding !== null && compatibleBuildings.includes(currentBuilding)
      ? [currentBuilding, ...compatibleBuildings.filter((building) => building !== currentBuilding)]
      : compatibleBuildings
  let moduleCapableBuilding = false
  for (const building of orderedBuildings) {
    if (building.moduleSlots <= 0) continue
    moduleCapableBuilding = true
    const module = chooseQualityModule(specification, recipe, building, moduleSpec, qualityModules)
    if (module !== null) {
      return {
        status: "auto-configurable",
        building,
        module,
        slotCount: building.moduleSlots,
      }
    }
  }

  if (!moduleCapableBuilding) {
    return { status: "unavailable", reason: "no-module-slots" }
  }
  return { status: "unavailable", reason: "module-incompatible" }
}

export function getCompatibleLocations(
  specification: PlanningSpecification,
  recipe: Recipe,
  building: Building | null = null,
): Planet[] {
  if (!specification.selectedPlanets?.size || !recipe.isReal() || recipe.isDisable()) return []
  return [...specification.selectedPlanets]
    .filter((location) => location.allowsRecipe(recipe) && (building === null || location.allowsBuilding(building)))
    .sort((a, b) => String(a.order).localeCompare(String(b.order)))
}

export function getAssignedLocation(
  specification: PlanningSpecification,
  recipe: Recipe,
  building: Building | null = null,
): Planet | null {
  const compatible = getCompatibleLocations(specification, recipe, building)
  const assigned = specification.recipeLocations.get(recipe)
  if (assigned && compatible.includes(assigned)) return assigned
  return compatible[0] ?? null
}

export function getTransportFlows(specification: PlanningSpecification, totals: Totals): TransportFlow[] {
  const flows = new Map<string, TransportFlow>()
  for (const link of totals.proportionate) {
    if (!(link.from instanceof Recipe) || !(link.to instanceof Recipe) || !(link.item instanceof Item)) continue
    if (!link.from.isReal() || !link.to.isReal() || link.from.isDisable() || link.to.isDisable()) continue
    const from = getAssignedLocation(specification, link.from, specification.getBuilding(link.from))
    const to = getAssignedLocation(specification, link.to, specification.getBuilding(link.to))
    if (!from || !to || from === to) continue
    const key = `${from.key}\u0000${to.key}\u0000${link.item.key}`
    const existing = flows.get(key)
    if (existing) {
      existing.rate = existing.rate.add(link.rate)
    } else {
      flows.set(key, {
        from,
        to,
        item: link.item,
        rate: link.rate,
        fuel: link.fuel,
      })
    }
  }
  return [...flows.values()].sort((a, b) =>
    `${a.from.order}:${a.to.order}:${a.item.order}`.localeCompare(`${b.from.order}:${b.to.order}:${b.item.order}`),
  )
}

export function getAsteroidConstraintReport(
  specification: PlanningSpecification,
  totals: Totals,
): AsteroidConstraintRow[] {
  const report: AsteroidConstraintRow[] = []
  for (const [itemKey, limit] of specification.asteroidLimits) {
    const item = specification.items.get(itemKey)
    if (!item) continue
    const required = totals.items.get(item) ?? zero
    report.push({ item, required, limit, exceeded: limit.less(required) })
  }
  return report
}

export function getFreshnessReport(specification: PlanningSpecification, totals: Totals): FreshnessRow[] {
  const delaySeconds = specification.freshnessDelayMinutes.mul(Rational.from_float(60))
  const rows: FreshnessRow[] = []
  for (const [item, rate] of totals.items) {
    if (!(item instanceof Item)) continue
    if (!item.spoilTime || item.spoilTime.isZero()) continue
    const remaining = Rational.max(zero, one.sub(delaySeconds.div(item.spoilTime)))
    const effectiveRate = item.key === "agricultural-science-pack" ? rate.mul(remaining) : rate
    rows.push({ item, remaining, effectiveRate, expired: remaining.isZero() })
  }
  return rows.sort((a, b) => a.remaining.toFloat() - b.remaining.toFloat())
}

function buildingEmissions(building: Building | null, pollutant: string): Rational {
  const value = building?.emissions?.[pollutant] ?? zero
  return value instanceof Rational ? value : Rational.from_float_approximate(value)
}

function recipeEmissions(recipe: Recipe, pollutant: string): Rational {
  const value = recipe.harvestEmissions?.[pollutant] ?? zero
  return value instanceof Rational ? value : Rational.from_float_approximate(value)
}

export function getPollutionComponents(
  specification: PlanningSpecification,
  recipe: Recipe,
  rate: Rational,
  pollutant = "pollution",
): PollutionComponents {
  const building = specification.getBuilding(recipe)
  if (!building) return { machine: zero, process: zero, total: zero }

  const location = getAssignedLocation(specification, recipe, building)
  if (location !== null && location.pollutantType !== pollutant) {
    return { machine: zero, process: zero, total: zero }
  }

  let count = specification.getCount(recipe, rate)
  // Agricultural towers emit spores continuously, including while waiting for
  // plants to mature. Their fixed emissions therefore scale with placed towers,
  // not average tower utilization.
  if (recipe.processKind === "growth" && pollutant === "spores") count = count.ceil()

  const moduleSpec = specification.getModuleSpec(recipe)
  const pollutionEffect = moduleSpec?.pollutionEffect() ?? one
  const consumptionEffect = moduleSpec?.powerEffect(specification) ?? one
  const machine = buildingEmissions(building, pollutant).mul(count).mul(consumptionEffect).mul(pollutionEffect)
  const process = recipeEmissions(recipe, pollutant).mul(rate).mul(Rational.from_float(60))
  return { machine, process, total: machine.add(process) }
}

export function getPollution(
  specification: PlanningSpecification,
  recipe: Recipe,
  rate: Rational,
  pollutant = "pollution",
): Rational {
  return getPollutionComponents(specification, recipe, rate, pollutant).total
}

export function getRocketLaunchReport(specification: PlanningSpecification, totals: Totals) {
  const recipe = specification.recipes.get("rocket-part")
  if (!recipe) return null
  const rate = totals.rates.get(recipe)
  if (!rate || rate.isZero()) return null
  const building = specification.getBuilding(recipe)
  const stats = building instanceof RocketSilo ? building.getLaunchStats(specification) : null
  if (!stats) return null

  const exactSilos = specification.getCount(recipe, rate)
  const placedSilos = exactSilos.ceil()
  return {
    recipe,
    building,
    recipeRate: rate,
    exactSilos,
    placedSilos,
    launches: rate.div(stats.craftsPerLaunch),
    placedLaunchCapacity: stats.launch.mul(placedSilos),
    ...stats,
  }
}

export function getBeaconPower(specification: PlanningSpecification, recipe: Recipe, rate: Rational): Rational {
  const moduleSpec = specification.getModuleSpec(recipe)
  if (!moduleSpec || moduleSpec.beaconCount.isZero() || specification.beaconPower.isZero()) return zero
  if (!moduleSpec.beaconModules.some((module) => module !== null)) return zero
  const placedMachines = specification.getCount(recipe, rate).ceil()
  return specification.beaconPower
    .mul(moduleSpec.beaconQuality.beaconPowerUsageMultiplier)
    .mul(placedMachines)
    .mul(moduleSpec.beaconCount)
}

export function getAquiloHeat(specification: PlanningSpecification, recipe: Recipe, rate: Rational): Rational {
  const building = specification.getBuilding(recipe)
  if (!building) return zero
  const location = getAssignedLocation(specification, recipe, building)
  if (location?.key !== "aquilo") return zero
  let heatKw = AQUILO_MACHINE_HEAT_KW[building.key]
  if (heatKw === undefined) {
    if (building.fuel !== null || building.key === "heating-tower") return zero
    heatKw = DEFAULT_AQUILO_MACHINE_HEAT_KW
  }
  return Rational.from_float(heatKw * 1000).mul(specification.getCount(recipe, rate).ceil())
}

export function getPlanningSummary(specification: PlanningSpecification, totals: Totals) {
  let beaconPower = zero
  let pollution = zero
  let spores = zero
  let pollutionMachine = zero
  let pollutionProcess = zero
  let sporeMachine = zero
  let sporeProcess = zero
  let aquiloHeat = zero
  const perLocation = new Map<
    Planet,
    {
      location: Planet
      machines: Rational
      electricPower: Rational
      beaconPower: Rational
      pollution: Rational
      spores: Rational
      heat: Rational
    }
  >()

  for (const [recipe, rate] of totals.rates) {
    if (!(recipe instanceof Recipe) || !recipe.isReal() || recipe.isDisable()) continue
    const building = specification.getBuilding(recipe)
    const location = getAssignedLocation(specification, recipe, building)
    const count = building ? specification.getCount(recipe, rate) : zero
    const machinePower = specification.getPowerUsage(recipe, rate)
    const recipeBeaconPower = getBeaconPower(specification, recipe, rate)
    const pollutionComponents = getPollutionComponents(specification, recipe, rate, "pollution")
    const sporeComponents = getPollutionComponents(specification, recipe, rate, "spores")
    const recipePollution = pollutionComponents.total
    const recipeSpores = sporeComponents.total
    let recipeHeat = getAquiloHeat(specification, recipe, rate)
    if (location?.key === "aquilo" && !recipeBeaconPower.isZero()) {
      const moduleSpec = specification.getModuleSpec(recipe)
      if (moduleSpec !== null) {
        recipeHeat = recipeHeat.add(
          AQUILO_BEACON_HEAT_W.mul(moduleSpec.beaconCount).mul(specification.getCount(recipe, rate).ceil()),
        )
      }
    }

    beaconPower = beaconPower.add(recipeBeaconPower)
    pollution = pollution.add(recipePollution)
    spores = spores.add(recipeSpores)
    pollutionMachine = pollutionMachine.add(pollutionComponents.machine)
    pollutionProcess = pollutionProcess.add(pollutionComponents.process)
    sporeMachine = sporeMachine.add(sporeComponents.machine)
    sporeProcess = sporeProcess.add(sporeComponents.process)
    aquiloHeat = aquiloHeat.add(recipeHeat)

    if (location) {
      const current = perLocation.get(location) ?? {
        location,
        machines: zero,
        electricPower: zero,
        beaconPower: zero,
        pollution: zero,
        spores: zero,
        heat: zero,
      }
      current.machines = current.machines.add(count.ceil())
      if (machinePower.fuel === "electric") current.electricPower = current.electricPower.add(machinePower.power)
      current.beaconPower = current.beaconPower.add(recipeBeaconPower)
      current.pollution = current.pollution.add(recipePollution)
      current.spores = current.spores.add(recipeSpores)
      current.heat = current.heat.add(recipeHeat)
      perLocation.set(location, current)
    }
  }

  return {
    beaconPower,
    pollution,
    spores,
    emissions: {
      pollution: {
        machine: pollutionMachine,
        process: pollutionProcess,
        total: pollution,
      },
      spores: { machine: sporeMachine, process: sporeProcess, total: spores },
    },
    rocket: getRocketLaunchReport(specification, totals),
    aquiloHeat,
    perLocation: [...perLocation.values()].sort((a, b) =>
      String(a.location.order).localeCompare(String(b.location.order)),
    ),
    transport: getTransportFlows(specification, totals),
    freshness: getFreshnessReport(specification, totals),
    asteroidConstraints: getAsteroidConstraintReport(specification, totals),
    qualityPlans: specification.qualityPlans,
  }
}
// endregion planning.ts

// region quality/graph.ts
export type QualityGraphOperationKind = "craft" | "recycle" | "source"

class QualityDisableRecipe implements SolverRecipe {
  readonly name: string
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[] = []
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[] = []

  constructor(readonly item: QualityGraphItem) {
    this.name = `Disable ${item.name}`
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }

  isDisable(): boolean {
    return true
  }
}

export class QualityGraphItem implements SolverItem {
  readonly recipes: QualityGraphRecipe[] = []
  readonly uses: QualityGraphRecipe[] = []
  readonly disableRecipe: SolverRecipe
  readonly key: string
  readonly name: string

  constructor(
    readonly item: Item,
    readonly qualityLevel: number | null,
    key: string,
    name: string,
  ) {
    this.key = key
    this.name = name
    this.disableRecipe = new QualityDisableRecipe(this)
  }
}

export interface QualityGraphRecipeMetadata {
  readonly baseRecipe: Recipe | null
  readonly qualityLevel: number | null
  readonly kind: QualityGraphOperationKind
  readonly recycleRatesByQuality?: readonly Rational[]
  readonly keepLevel?: number
  readonly sourceItem?: Item
  readonly configurationKey?: string
}

export interface QualityGraphSolution {
  readonly rates: ReadonlyMap<QualityGraphRecipe, Rational>
  readonly surplus: ReadonlyMap<QualityGraphItem, Rational>
}

export interface QualityGraphOptimizer {
  solve(graph: QualityGraph, output: QualityGraphItem, rate: Rational): QualityGraphSolution | null
}

export class QualityGraphRecipe implements SolverRecipe {
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[]
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[]

  constructor(
    readonly key: string,
    readonly name: string,
    ingredients: Iterable<Ingredient<QualityGraphItem, Rational>>,
    products: Iterable<Ingredient<QualityGraphItem, Rational>>,
    readonly metadata: QualityGraphRecipeMetadata,
  ) {
    this.ingredients = [...ingredients].filter(({ amount }) => !amount.isZero())
    this.products = [...products].filter(({ amount }) => !amount.isZero())
    for (const ingredient of this.ingredients) ingredient.item.uses.push(this)
    for (const product of this.products) product.item.recipes.push(this)
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(item: SolverItem): Rational {
    let amount = zero
    for (const product of this.products) {
      if (product.item === item) amount = amount.add(product.amount)
    }
    return amount
  }

  isReal(): boolean {
    return false
  }

  isDisable(): boolean {
    return false
  }

  isResource(): boolean {
    return this.metadata.kind === "source"
  }
}

export class QualityGraph {
  readonly items = new Map<string, QualityGraphItem>()
  readonly recipes: QualityGraphRecipe[] = []
  readonly sourceRecipes: QualityGraphRecipe[] = []
  readonly priorityLevels: Map<QualityGraphRecipe, Rational>[] = []

  item(baseItem: Item, qualityLevel: number | null): QualityGraphItem {
    const key = qualityLevel === null ? baseItem.key : `${baseItem.key}@q${qualityLevel}`
    let item = this.items.get(key)
    if (item === undefined) {
      const suffix = qualityLevel === null ? "" : ` quality ${qualityLevel}`
      item = new QualityGraphItem(baseItem, qualityLevel, key, `${baseItem.name}${suffix}`)
      this.items.set(key, item)
    }
    return item
  }

  recipe(
    key: string,
    name: string,
    ingredients: Iterable<Ingredient<QualityGraphItem, Rational>>,
    products: Iterable<Ingredient<QualityGraphItem, Rational>>,
    metadata: QualityGraphRecipeMetadata,
  ): QualityGraphRecipe {
    const recipe = new QualityGraphRecipe(key, name, ingredients, products, metadata)
    this.recipes.push(recipe)
    if (metadata.kind === "source") this.sourceRecipes.push(recipe)
    return recipe
  }

  source(item: QualityGraphItem, baseItem: Item, weight: Rational = one, level = 0): QualityGraphRecipe {
    const existing = this.sourceRecipes.find(
      (recipe) => recipe.metadata.sourceItem === baseItem && recipe.products[0]?.item === item,
    )
    if (existing !== undefined) return existing
    const recipe = this.recipe(`quality-source:${item.key}`, `Fresh ${item.name}`, [], [new Ingredient(item, one)], {
      baseRecipe: null,
      qualityLevel: item.qualityLevel,
      kind: "source",
      sourceItem: baseItem,
    })
    this.setPriority(recipe, weight, level)
    return recipe
  }

  setPriority(recipe: QualityGraphRecipe, weight: Rational, level = 0): void {
    while (this.priorityLevels.length <= level) this.priorityLevels.push(new Map())
    this.priorityLevels[level]!.set(recipe, weight)
  }

  private viableRecipes(): Set<QualityGraphRecipe> {
    const viable = new Set(this.recipes)
    let changed = true
    while (changed) {
      changed = false
      for (const recipe of [...viable]) {
        if (
          recipe.ingredients.some((ingredient) => ingredient.item.recipes.every((producer) => !viable.has(producer)))
        ) {
          viable.delete(recipe)
          changed = true
        }
      }
    }
    return viable
  }

  private recipeSignature(recipe: QualityGraphRecipe): string {
    const amounts = (values: readonly Ingredient<QualityGraphItem, Rational>[]): string[] =>
      values.map(({ item, amount }) => `${item.key}:${amount.toString()}`).sort()
    const priority = this.priorityLevels.map((level) => level.get(recipe)?.toString() ?? null)
    return JSON.stringify([
      amounts(recipe.ingredients),
      amounts(recipe.products),
      priority,
      recipe.metadata.baseRecipe?.key ?? null,
      recipe.metadata.qualityLevel,
      recipe.metadata.kind,
      recipe.metadata.recycleRatesByQuality?.map((rate) => rate.toString()) ?? null,
      recipe.metadata.sourceItem?.key ?? null,
      recipe.metadata.configurationKey ?? null,
    ])
  }

  private deduplicateRecipes(recipes: ReadonlySet<QualityGraphRecipe>): Set<QualityGraphRecipe> {
    const signatures = new Set<string>()
    const unique = new Set<QualityGraphRecipe>()
    for (const recipe of recipes) {
      const signature = this.recipeSignature(recipe)
      if (signatures.has(signature)) continue
      signatures.add(signature)
      unique.add(recipe)
    }
    return unique
  }

  solverRecipes(): ReadonlySet<QualityGraphRecipe> {
    return this.deduplicateRecipes(this.viableRecipes())
  }

  private solverSpec(viableRecipes: ReadonlySet<QualityGraphRecipe>): SolverSpec {
    const priority = this.priorityLevels
      .map((level) => [...level].map(([recipe, weight]) => ({ recipe, weight })))
      .filter((level) => level.length > 0)
    return {
      ignore: new Set(),
      buildTargets: [],
      priority,
      getRecipes(item: SolverItem): SolverRecipe[] {
        if (!(item instanceof QualityGraphItem)) throw new Error("Unknown quality graph item")
        return item.recipes.filter((recipe) => viableRecipes.has(recipe))
      },
      getRecipeGraph(_items: Map<SolverItem, Rational>): Set<SolverRecipe> {
        return new Set(viableRecipes)
      },
      getProdEffect(_recipe: SolverRecipe): Rational {
        return one
      },
      getBuilding(_recipe: SolverRecipe) {
        return null
      },
      getFuelForRecipe(_recipe: SolverRecipe) {
        return null
      },
    }
  }

  private totalsFromSolution(
    viableRecipes: ReadonlySet<QualityGraphRecipe>,
    output: QualityGraphItem,
    rate: Rational,
    solution: QualityGraphSolution,
  ): Totals {
    const spec = this.solverSpec(viableRecipes)
    const outputs = new Map<SolverItem, Rational>([[output, rate]])
    const rates = new Map<SolverRecipe, Rational>(solution.rates)
    rates.set(new QualityOutputRecipe(outputs), one)
    const surplus = new Map<SolverItem, Rational>(solution.surplus)
    if (surplus.size > 0) rates.set(new QualitySurplusRecipe(surplus), one)
    return new Totals(spec, outputs, rates, surplus, new Map())
  }

  solve(output: QualityGraphItem, rate: Rational, optimizer: QualityGraphOptimizer | null = null): Totals {
    const viableRecipes = this.solverRecipes()
    const spec = this.solverSpec(viableRecipes)
    spec.buildTargets.push({
      item: output,
      recipe: null,
      changedBuilding: false,
    })

    try {
      const optimized = optimizer?.solve(this, output, rate) ?? null
      if (optimized !== null) return this.totalsFromSolution(viableRecipes, output, rate, optimized)
      return solve(spec, [{ item: output, rate, recipe: null }])
    } catch (error) {
      if (error instanceof Error && /unbounded|infeasible|cycle/i.test(error.message)) {
        throw new Error("Quality flow contains a neutral or positive production cycle", { cause: error })
      }
      throw error
    }
  }
}

class QualityOutputRecipe implements SolverRecipe {
  readonly name: string = "output"
  readonly products: readonly Ingredient<QualityGraphItem, Rational>[] = []
  readonly ingredients: readonly Ingredient<QualityGraphItem, Rational>[]

  constructor(outputs: ReadonlyMap<SolverItem, Rational>) {
    this.ingredients = [...outputs].map(([item, amount]) => {
      if (!(item instanceof QualityGraphItem)) throw new Error("Unknown quality graph output")
      return new Ingredient(item, amount)
    })
  }

  getIngredients(): readonly Ingredient<QualityGraphItem, Rational>[] {
    return this.ingredients
  }

  gives(_item: SolverItem): Rational {
    return zero
  }

  isReal(): boolean {
    return false
  }
}

class QualitySurplusRecipe extends QualityOutputRecipe {
  override readonly name = "surplus"
}

export function addIngredient(
  amounts: Map<QualityGraphItem, Rational>,
  item: QualityGraphItem,
  amount: Rational,
): void {
  if (amount.isZero()) return
  amounts.set(item, (amounts.get(item) ?? zero).add(amount))
}

export function ingredientsFromMap(
  amounts: ReadonlyMap<QualityGraphItem, Rational>,
): Ingredient<QualityGraphItem, Rational>[] {
  return [...amounts].map(([item, amount]) => new Ingredient(item, amount))
}
// endregion quality/graph.ts

// region quality/operations.ts
interface TargetRecycleClosure {
  readonly operationsByInputQuality: readonly Rational[]
  readonly products: ReadonlyMap<QualityGraphItem, Rational>
  readonly extraIngredients: ReadonlyMap<QualityGraphItem, Rational>
}

export function isQualifiedSolid(item: Item): boolean {
  return item.phase === "solid"
}

export function qualifiedItem(graph: QualityGraph, item: Item, qualityLevel: number): QualityGraphItem {
  return graph.item(item, isQualifiedSolid(item) ? qualityLevel : null)
}

export function addProductivity(recipe: Recipe, product: Ingredient<Item, Rational>, productivity: Rational): Rational {
  if (!one.less(productivity)) return product.amount
  let productiveAmount = product.productivityAmount
  if (productiveAmount === null) {
    productiveAmount = product.amount
    for (const ingredient of recipe.ingredients) {
      if (ingredient.item === product.item) productiveAmount = productiveAmount.sub(ingredient.amount)
    }
    if (productiveAmount.less(zero)) return product.amount
  }
  return product.amount.add(productiveAmount.mul(productivity.sub(one)))
}

export function findRecyclerRecipe(specification: FactorySpecification, item: Item): Recipe | null {
  const exact = specification.recipes.get(`${item.key}-recycling`)
  if (exact !== undefined && exact.ingredients.some((ingredient) => ingredient.item === item)) return exact
  return (
    item.uses.find(
      (candidate) =>
        candidate.categories.has("recycling") && candidate.ingredients.some((ingredient) => ingredient.item === item),
    ) ?? null
  )
}

function cloneModuleSpec(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building,
  configured: ModuleSpec | null,
): ModuleSpec {
  const clone = new ModuleSpec(recipe, specification)
  clone.setBuilding(building, specification)
  if (configured === null || configured.building !== building) return clone

  clone.modules.splice(0, clone.modules.length, ...configured.modules)
  clone.moduleQualities.splice(0, clone.moduleQualities.length, ...configured.moduleQualities)
  clone.beaconModules.splice(0, clone.beaconModules.length, ...configured.beaconModules)
  clone.beaconModuleQualities.splice(0, clone.beaconModuleQualities.length, ...configured.beaconModuleQualities)
  clone.beaconQuality = configured.beaconQuality
  clone.beaconCount = configured.beaconCount
  return clone
}

function productivityForConfiguration(
  specification: FactorySpecification,
  recipe: Recipe,
  moduleSpec: ModuleSpec,
): Rational {
  let productivity = moduleSpec.prodEffect(specification).add(specification.getRecipeProductivityBonus(recipe))
  if (recipe.maximumProductivity !== null) {
    productivity = Rational.min(productivity, one.add(recipe.maximumProductivity))
  }
  return productivity
}

function configurationFromModuleSpec(
  specification: FactorySpecification,
  recipe: Recipe,
  qualityLevel: number,
  moduleSpec: ModuleSpec,
): QualityTierConfiguration {
  const building = moduleSpec.building
  return {
    qualityLevel,
    building,
    machineQuality: specification.getMachineQuality(recipe),
    modules: [...moduleSpec.modules],
    moduleQualities: [...moduleSpec.moduleQualities],
    beaconModules: [...moduleSpec.beaconModules],
    beaconModuleQualities: [...moduleSpec.beaconModuleQualities],
    beaconQuality: moduleSpec.beaconQuality,
    beaconCount: moduleSpec.beaconCount,
    qualityChance: recipe.allow_quality ? moduleSpec.qualityEffect() : zero,
    productivity: productivityForConfiguration(specification, recipe, moduleSpec),
    speedEffect: moduleSpec.speedEffect(),
    powerEffect: moduleSpec.powerEffect(specification),
  }
}

export function moduleTierConfiguration(options: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly qualityLevel: number
  readonly building: Building | null
  readonly module: Module | null
  readonly moduleQuality: Quality
  readonly preserveBeacons?: boolean
}): QualityTierConfiguration {
  const { specification, recipe, qualityLevel, building, module, moduleQuality } = options
  if (building === null) {
    const normal = specification.getNormalQuality()
    return {
      qualityLevel,
      building: null,
      machineQuality: normal,
      modules: [],
      moduleQualities: [],
      beaconModules: [],
      beaconModuleQualities: [],
      beaconQuality: normal,
      beaconCount: zero,
      qualityChance: zero,
      productivity: one.add(specification.getRecipeProductivityBonus(recipe)),
      speedEffect: one,
      powerEffect: one,
    }
  }

  const configured = specification.spec.get(recipe) ?? null
  const moduleSpec = cloneModuleSpec(specification, recipe, building, configured)
  for (let index = 0; index < moduleSpec.modules.length; index++) {
    moduleSpec.modules[index] = module !== null && module.canUse(recipe, building) ? module : null
    moduleSpec.moduleQualities[index] =
      moduleSpec.modules[index] === null ? specification.getNormalQuality() : moduleQuality
  }
  if (options.preserveBeacons === false) {
    moduleSpec.beaconModules.fill(null)
    moduleSpec.beaconModuleQualities.fill(specification.getNormalQuality())
    moduleSpec.beaconCount = zero
  }
  return configurationFromModuleSpec(specification, recipe, qualityLevel, moduleSpec)
}

function moduleSpecFromConfiguration(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
): ModuleSpec | null {
  const building = configuration.building
  if (building === null) return null
  const moduleSpec = new ModuleSpec(recipe, specification)
  moduleSpec.setBuilding(building, specification)
  moduleSpec.modules.splice(0, moduleSpec.modules.length, ...configuration.modules)
  moduleSpec.moduleQualities.splice(0, moduleSpec.moduleQualities.length, ...configuration.moduleQualities)
  moduleSpec.beaconModules.splice(0, moduleSpec.beaconModules.length, ...configuration.beaconModules)
  moduleSpec.beaconModuleQualities.splice(
    0,
    moduleSpec.beaconModuleQualities.length,
    ...configuration.beaconModuleQualities,
  )
  moduleSpec.beaconQuality = configuration.beaconQuality
  moduleSpec.beaconCount = configuration.beaconCount
  return moduleSpec
}

function configurationWithModuleLoadout(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
  qualityModule: Module | null,
  qualityModuleQuality: Quality,
  qualityModuleCount: number,
  productivityModule: Module | null,
  productivityModuleQuality: Quality,
  productivityModuleCount: number,
): QualityTierConfiguration {
  const moduleSpec = moduleSpecFromConfiguration(specification, recipe, configuration)
  if (moduleSpec === null) return configuration
  const normal = specification.getNormalQuality()
  for (let index = 0; index < moduleSpec.modules.length; index++) {
    const useQuality =
      index < qualityModuleCount && qualityModule !== null && qualityModule.canUse(recipe, moduleSpec.building)
    const useProductivity =
      !useQuality &&
      index < qualityModuleCount + productivityModuleCount &&
      productivityModule !== null &&
      productivityModule.canUse(recipe, moduleSpec.building)
    moduleSpec.modules[index] = useQuality ? qualityModule : useProductivity ? productivityModule : null
    moduleSpec.moduleQualities[index] = useQuality
      ? qualityModuleQuality
      : useProductivity
        ? productivityModuleQuality
        : normal
  }
  return configurationFromModuleSpec(specification, recipe, configuration.qualityLevel, moduleSpec)
}

function configurationWithBeaconSetup(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
  beaconModule: Module | null,
  beaconModuleQuality: Quality,
  beaconModuleSlots: number,
  beaconQuality: Quality,
  beaconCount: Rational,
): QualityTierConfiguration {
  const moduleSpec = moduleSpecFromConfiguration(specification, recipe, configuration)
  if (moduleSpec === null) return configuration
  const normal = specification.getNormalQuality()
  for (let index = 0; index < moduleSpec.beaconModules.length; index++) {
    const useModule = index < beaconModuleSlots && beaconModule !== null
    moduleSpec.beaconModules[index] = useModule ? beaconModule : null
    moduleSpec.beaconModuleQualities[index] = useModule ? beaconModuleQuality : normal
  }
  moduleSpec.beaconQuality = beaconQuality
  moduleSpec.beaconCount = beaconCount
  return configurationFromModuleSpec(specification, recipe, configuration.qualityLevel, moduleSpec)
}

function configurationAcrossQualityLevels(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
): readonly QualityTierConfiguration[] {
  const moduleSpec = moduleSpecFromConfiguration(specification, recipe, configuration)
  return Array.from({ length: specification.maxQualityLevel + 1 }, (_, qualityLevel) =>
    moduleSpec === null
      ? { ...configuration, qualityLevel }
      : configurationFromModuleSpec(specification, recipe, qualityLevel, moduleSpec),
  )
}

function qualityModuleCount(configuration: QualityTierConfiguration): number {
  return configuration.modules.filter((module) => module?.category === "quality").length
}

function resourceDrainRate(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
): Rational {
  if (!(configuration.building instanceof Miner)) return one
  const adapter = Object.create(specification) as FactorySpecification
  adapter.getMachineQuality = (candidate: Recipe) =>
    candidate === recipe ? configuration.machineQuality : specification.getMachineQuality(candidate)
  return configuration.building.getResourceDrainRate(adapter, recipe)
}

export function operationCapacity(
  specification: FactorySpecification,
  recipe: Recipe,
  rate: Rational,
  configuration: QualityTierConfiguration,
): { readonly machineCount: Rational; readonly power: Rational } {
  const building = configuration.building
  if (building === null || rate.isZero()) return { machineCount: zero, power: zero }

  const moduleSpec = moduleSpecFromConfiguration(specification, recipe, configuration)
  const adapter = Object.create(specification) as FactorySpecification
  adapter.getModuleSpec = (candidate: Recipe) =>
    candidate === recipe ? moduleSpec : specification.getModuleSpec(candidate)
  adapter.getMachineQuality = (candidate: Recipe) =>
    candidate === recipe ? configuration.machineQuality : specification.getMachineQuality(candidate)

  const machineCount = building.getCount(adapter, recipe, rate)
  let power = building.powerForQuality(configuration.machineQuality).mul(machineCount).mul(configuration.powerEffect)
  if (building.fuel === null) {
    power = power.add(building.drainForQuality(configuration.machineQuality).mul(machineCount.ceil()))
  }
  if (
    !configuration.beaconCount.isZero() &&
    configuration.beaconModules.some((module) => module !== null) &&
    !specification.beaconPower.isZero()
  ) {
    power = power.add(
      specification.beaconPower
        .mul(configuration.beaconQuality.beaconPowerUsageMultiplier)
        .mul(machineCount.ceil())
        .mul(configuration.beaconCount),
    )
  }
  return { machineCount, power }
}

// ponytail: this shortcut is exact only for a single-item 25% self-recycle loop with uniform recycler quality;
// keep recyclerClosure() authoritative for every ingredient-return or mixed-configuration route.
function quarterSelfRecyclerForItem(specification: FactorySpecification, item: Item): Recipe | null {
  const recycler = findRecyclerRecipe(specification, item)
  if (recycler === null || recycler.ingredients.length !== 1 || recycler.products.length !== 1) return null
  const ingredient = recycler.ingredients[0]
  const product = recycler.products[0]
  if (ingredient === undefined || product === undefined || ingredient.item !== item || product.item !== item)
    return null
  return product.amount.mul(Rational.from_integer(4)).equal(ingredient.amount) ? recycler : null
}

function quarterSelfRecyclerOperationsByInitialQuality(
  recyclerQualityChance: Rational,
  maxLevel: number,
): readonly (readonly Rational[])[] {
  const transientLevels = maxLevel
  const returnedFraction = one.div(Rational.from_integer(4))
  const transitions = Array.from({ length: transientLevels }, (_, inputQuality) => {
    const distribution = qualityTransitionDistribution(recyclerQualityChance, inputQuality, maxLevel)
    return Array.from({ length: transientLevels }, (_, outputQuality) =>
      outputQuality < inputQuality ? zero : returnedFraction.mul(distribution[outputQuality] ?? zero),
    )
  })
  return Array.from({ length: transientLevels }, (_, initialQuality) => {
    const visits = Array.from({ length: transientLevels }, () => zero)
    for (let inputQuality = initialQuality; inputQuality < transientLevels; inputQuality++) {
      let arrivals = inputQuality === initialQuality ? one : zero
      for (let priorQuality = initialQuality; priorQuality < inputQuality; priorQuality++) {
        arrivals = arrivals.add((visits[priorQuality] ?? zero).mul(transitions[priorQuality]?.[inputQuality] ?? zero))
      }
      visits[inputQuality] = arrivals.div(one.sub(transitions[inputQuality]?.[inputQuality] ?? zero))
    }
    return visits
  })
}

function selfRecyclingLegendaryMetrics(
  specification: FactorySpecification,
  source: QualityOperationRate,
  recyclerRecipe: Recipe,
  recyclerConfiguration: QualityTierConfiguration,
): SelfRecyclingLegendaryMetrics | null {
  if (source.kind !== "source" || source.qualityLevel !== 0 || source.machineCount.isZero()) return null
  if (!(source.configuration.building instanceof Miner)) return null
  if (source.recipe.products.length !== 1) return null
  const product = source.recipe.products[0]
  if (product === undefined || !isQualifiedSolid(product.item)) return null
  const quarterSelfRecycler = quarterSelfRecyclerForItem(specification, product.item)
  if (quarterSelfRecycler === null || quarterSelfRecycler !== recyclerRecipe) return null

  const outputPerCraft = addProductivity(source.recipe, product, source.configuration.productivity)
  const outputPerSecondPerMachine = source.rate.mul(outputPerCraft).div(source.machineCount)
  const probability = quarterSelfRecycleLegendaryProbability(
    source.configuration.qualityChance,
    recyclerConfiguration.qualityChance,
  )
  return {
    item: product.item,
    recyclerRecipe: quarterSelfRecycler,
    outputPerSecondPerMachine,
    sourceQualityChance: source.configuration.qualityChance,
    recyclerQualityChance: recyclerConfiguration.qualityChance,
    score: quarterSelfRecycleLegendaryScore(
      outputPerSecondPerMachine,
      source.configuration.qualityChance,
      recyclerConfiguration.qualityChance,
    ),
    legendaryPerMinutePerMachine: outputPerSecondPerMachine.mul(probability).mul(Rational.from_integer(60)),
  }
}

export function recyclerClosure(
  graph: QualityGraph,
  target: Item,
  recyclerRecipe: Recipe,
  keepLevel: number,
  maxLevel: number,
  configurations: readonly QualityTierConfiguration[],
): readonly TargetRecycleClosure[] {
  const targetIngredient = recyclerRecipe.ingredients.find((ingredient) => ingredient.item === target)
  if (targetIngredient === undefined || targetIngredient.amount.isZero()) {
    throw new Error(`${recyclerRecipe.name} does not consume ${target.name}`)
  }
  const transientSize = keepLevel
  if (transientSize === 0) return []

  // One column per recycled input quality. Values are expected target items
  // returned into another transient recycler state per one target item consumed.
  const transition: Rational[][] = Array.from({ length: transientSize }, () =>
    Array.from({ length: transientSize }, () => zero),
  )
  const immediateProducts: Map<QualityGraphItem, Rational>[] = Array.from({ length: transientSize }, () => new Map())
  const immediateIngredients: Map<QualityGraphItem, Rational>[] = Array.from({ length: transientSize }, () => new Map())

  for (let inputQuality = 0; inputQuality < transientSize; inputQuality++) {
    const configuration = configurations[inputQuality]
    if (configuration === undefined) throw new Error("Missing recycler quality configuration")
    const operationsPerItem = targetIngredient.amount.reciprocate()

    for (const ingredient of recyclerRecipe.ingredients) {
      if (ingredient.item === target) continue
      addIngredient(
        immediateIngredients[inputQuality]!,
        qualifiedItem(graph, ingredient.item, inputQuality),
        ingredient.amount.mul(operationsPerItem),
      )
    }

    for (const product of recyclerRecipe.products) {
      const amount = addProductivity(recyclerRecipe, product, configuration.productivity).mul(operationsPerItem)
      if (!isQualifiedSolid(product.item)) {
        addIngredient(immediateProducts[inputQuality]!, graph.item(product.item, null), amount)
        continue
      }
      const distribution = qualityTransitionDistribution(configuration.qualityChance, inputQuality, maxLevel)
      for (let outputQuality = inputQuality; outputQuality <= maxLevel; outputQuality++) {
        const probability = distribution[outputQuality] ?? zero
        if (probability.isZero()) continue
        const outputAmount = amount.mul(probability)
        if (product.item === target && outputQuality < keepLevel) {
          transition[outputQuality]![inputQuality] = transition[outputQuality]![inputQuality]!.add(outputAmount)
        } else {
          addIngredient(immediateProducts[inputQuality]!, graph.item(product.item, outputQuality), outputAmount)
        }
      }
    }
  }

  const coefficients: Rational[][] = Array.from({ length: transientSize }, (_, row) =>
    Array.from({ length: transientSize }, (_, column) =>
      row === column ? one.sub(transition[row]![column]!) : zero.sub(transition[row]![column]!),
    ),
  )

  return Array.from({ length: transientSize }, (_, initialQuality) => {
    const visits = solveExactLinearSystem(
      coefficients,
      Array.from({ length: transientSize }, (_, quality) => (quality === initialQuality ? one : zero)),
    )
    if (visits.some((value) => value.less(zero))) {
      throw new Error("Quality recycler contains a positive production cycle")
    }
    const products = new Map<QualityGraphItem, Rational>()
    const extraIngredients = new Map<QualityGraphItem, Rational>()
    for (let inputQuality = 0; inputQuality < transientSize; inputQuality++) {
      const visitCount = visits[inputQuality] ?? zero
      for (const [item, amount] of immediateProducts[inputQuality] ?? []) {
        addIngredient(products, item, amount.mul(visitCount))
      }
      for (const [item, amount] of immediateIngredients[inputQuality] ?? []) {
        addIngredient(extraIngredients, item, amount.mul(visitCount))
      }
    }
    const operationsPerItem = targetIngredient.amount.reciprocate()
    return {
      operationsByInputQuality: visits.map((visitCount) => visitCount.mul(operationsPerItem)),
      products,
      extraIngredients,
    }
  })
}

export function addCraftRecipe(
  graph: QualityGraph,
  target: Item,
  recipe: Recipe,
  inputQuality: number,
  keepLevel: number,
  maxLevel: number,
  configuration: QualityTierConfiguration,
  closures: readonly TargetRecycleClosure[],
  keyPrefix = "quality-craft",
): QualityGraphRecipe {
  const ingredients = new Map<QualityGraphItem, Rational>()
  const products = new Map<QualityGraphItem, Rational>()
  const recycleRates = Array.from({ length: maxLevel + 1 }, () => zero)

  for (const ingredient of recipe.ingredients) {
    addIngredient(ingredients, qualifiedItem(graph, ingredient.item, inputQuality), ingredient.amount)
  }

  for (const product of recipe.products) {
    const amount = addProductivity(recipe, product, configuration.productivity)
    if (!isQualifiedSolid(product.item)) {
      addIngredient(products, graph.item(product.item, null), amount)
      continue
    }

    const distribution = qualityTransitionDistribution(configuration.qualityChance, inputQuality, maxLevel)
    for (let outputQuality = inputQuality; outputQuality <= maxLevel; outputQuality++) {
      const probability = distribution[outputQuality] ?? zero
      if (probability.isZero()) continue
      const outputAmount = amount.mul(probability)
      if (product.item !== target || outputQuality >= keepLevel) {
        addIngredient(products, graph.item(product.item, outputQuality), outputAmount)
        continue
      }

      const closure = closures[outputQuality]
      if (closure === undefined) throw new Error("Missing target recycler closure")
      for (const [item, returned] of closure.products) {
        addIngredient(products, item, returned.mul(outputAmount))
      }
      for (const [item, consumed] of closure.extraIngredients) {
        addIngredient(ingredients, item, consumed.mul(outputAmount))
      }
      for (let recyclerQuality = 0; recyclerQuality < closure.operationsByInputQuality.length; recyclerQuality++) {
        recycleRates[recyclerQuality] = recycleRates[recyclerQuality]!.add(
          (closure.operationsByInputQuality[recyclerQuality] ?? zero).mul(outputAmount),
        )
      }
    }
  }

  return graph.recipe(
    `${keyPrefix}:${recipe.key}:q${inputQuality}`,
    `${recipe.name} quality ${inputQuality}`,
    ingredientsFromMap(ingredients),
    ingredientsFromMap(products),
    {
      baseRecipe: recipe,
      qualityLevel: inputQuality,
      kind: "craft",
      recycleRatesByQuality: recycleRates,
      keepLevel,
      configurationKey: JSON.stringify([
        configuration.qualityLevel,
        configuration.building?.key ?? null,
        configuration.machineQuality.key,
        configuration.modules.map((module) => module?.key ?? null),
        configuration.moduleQualities.map((quality) => quality.key),
        configuration.beaconModules.map((module) => module?.key ?? null),
        configuration.beaconModuleQualities.map((quality) => quality.key),
        configuration.beaconQuality.key,
        configuration.beaconCount.toString(),
        configuration.qualityChance.toString(),
        configuration.productivity.toString(),
        configuration.speedEffect.toString(),
        configuration.powerEffect.toString(),
      ]),
    },
  )
}

export function sortedQualifiedAmounts(values: Iterable<[QualityGraphItem, Rational]>): QualifiedItemAmount[] {
  return [...values]
    .filter(([, amount]) => !amount.isZero())
    .map(([item, amount]) => ({
      item: item.item,
      qualityLevel: item.qualityLevel ?? 0,
      amount,
    }))
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}
// endregion quality/operations.ts

// region quality/disposal.ts
interface DisposalState {
  readonly item: Item
  readonly qualityLevel: number
  readonly recipe: Recipe
  readonly configuration: QualityTierConfiguration
  readonly operationsPerItem: Rational
}

interface QualityDisposalResult {
  readonly operations: readonly QualityOperationRate[]
  readonly terminalOutputs: readonly QualifiedItemAmount[]
  readonly extraFreshInputs: readonly QualifiedItemAmount[]
  readonly totalMachineCount: Rational
  readonly totalPower: Rational
  readonly totalRecycles: Rational
}

function stateKey(item: Item, qualityLevel: number): string {
  return `${item.key}@q${qualityLevel}`
}

function sortedDisposalAmountMap(values: ReadonlyMap<string, QualifiedItemAmount>): QualifiedItemAmount[] {
  return [...values.values()]
    .filter(({ amount }) => !amount.isZero())
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}

function recyclerDescriptor(
  specification: FactorySpecification,
  recipe: Recipe,
  inputItem: Item,
  inputQuality: number,
  configuration: QualityTierConfiguration,
): {
  readonly products: readonly QualifiedItemAmount[]
  readonly extraIngredients: readonly QualifiedItemAmount[]
} {
  const consumed = recipe.ingredients.find((ingredient) => ingredient.item === inputItem)
  if (consumed === undefined || consumed.amount.isZero()) {
    throw new Error(`${recipe.name} does not consume ${inputItem.name}`)
  }
  const operationsPerItem = consumed.amount.reciprocate()
  const products: QualifiedItemAmount[] = []
  const extraIngredients: QualifiedItemAmount[] = []

  for (const ingredient of recipe.ingredients) {
    if (ingredient.item === inputItem) continue
    extraIngredients.push({
      item: ingredient.item,
      qualityLevel: isQualifiedSolid(ingredient.item) ? inputQuality : 0,
      amount: ingredient.amount.mul(operationsPerItem),
    })
  }

  for (const product of recipe.products) {
    const amount = addProductivity(recipe, product, configuration.productivity).mul(operationsPerItem)
    if (!isQualifiedSolid(product.item)) {
      products.push({ item: product.item, qualityLevel: 0, amount })
      continue
    }
    const chance = recipe.allow_quality ? configuration.qualityChance : zero
    const distribution = qualityTransitionDistribution(chance, inputQuality, specification.maxQualityLevel)
    for (let outputQuality = inputQuality; outputQuality <= specification.maxQualityLevel; outputQuality++) {
      const probability = distribution[outputQuality] ?? zero
      if (probability.isZero()) continue
      products.push({
        item: product.item,
        qualityLevel: outputQuality,
        amount: amount.mul(probability),
      })
    }
  }
  return { products, extraIngredients }
}

export function planQualitySurplusDisposal(options: {
  readonly specification: FactorySpecification
  readonly target: Item
  readonly keepLevel: number
  readonly surplus: readonly QualifiedItemAmount[]
  readonly canRecycle: (recipe: Recipe) => boolean
  readonly getConfiguration: (recipe: Recipe, qualityLevel: number) => QualityTierConfiguration
  readonly cycleLabel: string
}): QualityDisposalResult {
  const { specification, target, keepLevel, surplus, canRecycle, getConfiguration, cycleLabel } = options
  const states: DisposalState[] = []
  const stateIndexes = new Map<string, number>()
  const terminalInitial = new Map<string, QualifiedItemAmount>()

  const addMapAmount = (map: Map<string, QualifiedItemAmount>, value: QualifiedItemAmount): void => {
    const key = stateKey(value.item, value.qualityLevel)
    const current = map.get(key)
    map.set(key, {
      item: value.item,
      qualityLevel: value.qualityLevel,
      amount: (current?.amount ?? zero).add(value.amount),
    })
  }

  const addTerminal = (value: QualifiedItemAmount): void => addMapAmount(terminalInitial, value)

  const ensureState = (item: Item, qualityLevel: number): number | null => {
    if (!isQualifiedSolid(item) || (item === target && qualityLevel >= keepLevel)) return null
    const key = stateKey(item, qualityLevel)
    const existing = stateIndexes.get(key)
    if (existing !== undefined) return existing
    const recipe = findRecyclerRecipe(specification, item)
    if (recipe === null || !canRecycle(recipe)) return null
    const consumed = recipe.ingredients.find((ingredient) => ingredient.item === item)
    if (consumed === undefined || consumed.amount.isZero()) return null

    const index = states.length
    stateIndexes.set(key, index)
    states.push({
      item,
      qualityLevel,
      recipe,
      configuration: getConfiguration(recipe, qualityLevel),
      operationsPerItem: consumed.amount.reciprocate(),
    })
    return index
  }

  for (const value of surplus) {
    if (ensureState(value.item, value.qualityLevel) === null) addTerminal(value)
  }

  for (let index = 0; index < states.length; index++) {
    const state = states[index]
    if (state === undefined) continue
    const descriptor = recyclerDescriptor(
      specification,
      state.recipe,
      state.item,
      state.qualityLevel,
      state.configuration,
    )
    for (const product of descriptor.products) ensureState(product.item, product.qualityLevel)
  }

  if (states.length === 0) {
    return {
      operations: [],
      terminalOutputs: sortedDisposalAmountMap(terminalInitial),
      extraFreshInputs: [],
      totalMachineCount: zero,
      totalPower: zero,
      totalRecycles: zero,
    }
  }

  const transition: Rational[][] = Array.from({ length: states.length }, () =>
    Array.from({ length: states.length }, () => zero),
  )
  const terminalByState: Map<string, QualifiedItemAmount>[] = Array.from({ length: states.length }, () => new Map())
  const extraByState: Map<string, QualifiedItemAmount>[] = Array.from({ length: states.length }, () => new Map())

  for (let column = 0; column < states.length; column++) {
    const state = states[column]
    if (state === undefined) continue
    const descriptor = recyclerDescriptor(
      specification,
      state.recipe,
      state.item,
      state.qualityLevel,
      state.configuration,
    )
    for (const product of descriptor.products) {
      const row = stateIndexes.get(stateKey(product.item, product.qualityLevel))
      if (row === undefined) addMapAmount(terminalByState[column]!, product)
      else transition[row]![column] = transition[row]![column]!.add(product.amount)
    }
    for (const ingredient of descriptor.extraIngredients) addMapAmount(extraByState[column]!, ingredient)
  }

  const coefficients = transition.map((row, rowIndex) =>
    row.map((value, columnIndex) => (rowIndex === columnIndex ? one.sub(value) : zero.sub(value))),
  )
  const initial = Array.from({ length: states.length }, () => zero)
  for (const value of surplus) {
    const index = stateIndexes.get(stateKey(value.item, value.qualityLevel))
    if (index !== undefined) initial[index] = initial[index]!.add(value.amount)
  }
  const visits = solveExactLinearSystem(coefficients, initial)
  if (visits.some((value) => value.less(zero))) {
    throw new Error(`${cycleLabel} disposal contains a positive production cycle`)
  }

  const operations: QualityOperationRate[] = []
  const terminal = new Map(terminalInitial)
  const extraFresh = new Map<string, QualifiedItemAmount>()
  let totalMachineCount = zero
  let totalPower = zero
  let totalRecycles = zero

  for (let index = 0; index < states.length; index++) {
    const state = states[index]
    if (state === undefined) continue
    const visitCount = visits[index] ?? zero
    if (visitCount.isZero()) continue
    const rate = visitCount.mul(state.operationsPerItem)
    const capacity = operationCapacity(specification, state.recipe, rate, state.configuration)
    operations.push({
      recipe: state.recipe,
      qualityLevel: state.qualityLevel,
      rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind: "dispose",
      configuration: state.configuration,
    })
    totalRecycles = totalRecycles.add(rate)
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)
    for (const [, value] of terminalByState[index] ?? []) {
      addMapAmount(terminal, {
        ...value,
        amount: value.amount.mul(visitCount),
      })
    }
    for (const [, value] of extraByState[index] ?? []) {
      addMapAmount(extraFresh, {
        ...value,
        amount: value.amount.mul(visitCount),
      })
    }
  }

  return {
    operations,
    terminalOutputs: sortedDisposalAmountMap(terminal),
    extraFreshInputs: sortedDisposalAmountMap(extraFresh),
    totalMachineCount,
    totalPower,
    totalRecycles,
  }
}
// endregion quality/disposal.ts

// region quality/practical.ts
const IMPORT_WEIGHT = Rational.from_integer(1_000_000)
const TIEBREAK_LEVEL = 0
const OBJECTIVE_LEVEL = 1
const IMPORT_LEVEL = 2
const FULGORA_CURATED_PRODUCERS = new Map<string, string>([
  ["water", "ice-melting"],
  ["light-oil", "heavy-oil-cracking"],
  ["petroleum-gas", "light-oil-cracking"],
])

interface EmbeddedRecycler {
  readonly recipe: Recipe
  readonly configurations: readonly QualityTierConfiguration[]
}

function amountKey(item: Item, qualityLevel: number): string {
  return `${item.key}@q${qualityLevel}`
}

function mergeQualifiedAmounts(target: Map<string, QualifiedItemAmount>, values: Iterable<QualifiedItemAmount>): void {
  for (const value of values) {
    const key = amountKey(value.item, value.qualityLevel)
    const current = target.get(key)
    target.set(key, {
      item: value.item,
      qualityLevel: value.qualityLevel,
      amount: (current?.amount ?? zero).add(value.amount),
    })
  }
}

function sortedAmountMap(values: ReadonlyMap<string, QualifiedItemAmount>): QualifiedItemAmount[] {
  return [...values.values()]
    .filter(({ amount }) => !amount.isZero())
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}

function isLocalRecipe(planet: Planet, recipe: Recipe): boolean {
  return planet.allowsRecipe(recipe)
}

function isUsableProducer(specification: FactorySpecification, planet: Planet, recipe: Recipe, item: Item): boolean {
  return (
    recipe.isReal() &&
    !recipe.isDisable() &&
    !recipe.categories.has("recycling") &&
    !specification.getNetDisable().disable.has(recipe) &&
    isLocalRecipe(planet, recipe) &&
    recipe.products.some((product) => product.item === item) &&
    (recipe.isResource() || choosePracticalBuilding(specification, planet, recipe) !== null)
  )
}

function choosePracticalBuilding(specification: FactorySpecification, planet: Planet, recipe: Recipe): Building | null {
  if (!planet.allowsRecipe(recipe)) return null
  const override = specification.getBuildingOverride(recipe)
  if (override !== null && override.canCraft(recipe) && planet.allowsBuilding(override)) return override

  const configured = specification.getBuilding(recipe)
  const candidates = specification
    .getCompatibleBuildings(recipe, false)
    .filter((building) => planet.allowsBuilding(building))
  const preferredKey = recipe.categories.has("metallurgy")
    ? "foundry"
    : recipe.categories.has("recycling")
      ? "recycler"
      : recipe.categories.has("electronics") || recipe.categories.has("electromagnetics")
        ? "electromagnetic-plant"
        : null
  return (
    candidates.find((building) => building.key === preferredKey) ??
    (configured !== null && candidates.includes(configured) ? configured : null) ??
    candidates.at(-1) ??
    null
  )
}

function getPreferredPracticalQualityRecipe(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly item: Item
  readonly preferredRecipe?: Recipe | null
  readonly curatedProducers?: ReadonlyMap<string, string>
}): Recipe | null {
  const { specification, planet, item, preferredRecipe = null, curatedProducers } = options

  const curatedKey = curatedProducers?.get(item.key)
  if (curatedKey !== undefined) {
    const curated = specification.recipes.get(curatedKey)
    if (curated !== undefined && isUsableProducer(specification, planet, curated, item)) {
      return curated
    }
  }
  if (preferredRecipe !== null && isUsableProducer(specification, planet, preferredRecipe, item)) {
    return preferredRecipe
  }

  const candidates = item.recipes.filter((candidate) => isUsableProducer(specification, planet, candidate, item))
  const resource = candidates.find((candidate) => candidate.isResource() && planet.resources.has(candidate))
  if (resource !== undefined) return resource
  const canonical = candidates.find((candidate) => candidate.key === item.key)
  return canonical ?? candidates.sort((left, right) => (left.order ?? "").localeCompare(right.order ?? ""))[0] ?? null
}

function availableModuleQuality(specification: FactorySpecification, configured: Quality): Quality {
  const available = specification.getAvailableQualities()
  return available.includes(configured) ? configured : (available.at(-1) ?? specification.getNormalQuality())
}

function bestModule(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building,
  quality: Quality,
  effect: "quality" | "productivity",
): Module | null {
  const explicit =
    effect === "quality" ? specification.qualityPlannerModule : specification.qualityPlannerProductivityModule
  if (
    explicit !== null &&
    zero.less(effect === "quality" ? explicit.qualityFor(quality) : explicit.productivityFor(quality)) &&
    explicit.canUse(recipe, building)
  ) {
    return explicit
  }

  let best: Module | null = null
  let bestEffect = zero
  for (const module of specification.modules.values()) {
    if (!module.canUse(recipe, building)) continue
    const value = effect === "quality" ? module.qualityFor(quality) : module.productivityFor(quality)
    if (best === null || bestEffect.less(value)) {
      best = module
      bestEffect = value
    }
  }
  return zero.less(bestEffect) ? best : null
}

function objectiveForPlan(specification: FactorySpecification): QualityOptimizationObjective {
  return (specification.qualityPlannerObjective as string) === "practical"
    ? "quality-modules"
    : specification.qualityPlannerObjective
}

class PracticalQualityGraphBuilder {
  readonly graph = new QualityGraph()
  readonly operations = new Map<QualityGraphRecipe, QualityTierConfiguration>()
  readonly embeddedRecyclers = new Map<QualityGraphRecipe, EmbeddedRecycler>()
  private readonly directSelfRecyclingRecipes = new Set<Recipe>()
  private readonly expandedItems = new Set<string>()
  private readonly expandedProducers = new Set<string>()
  private readonly expandedVulcanusShuffles = new Set<string>()
  private readonly importedItems = new Set<QualityGraphItem>()
  private readonly configurations = new Map<string, readonly QualityTierConfiguration[]>()
  private readonly userDisabledRecipes: ReadonlySet<Recipe>
  private readonly plannerQuality: Quality
  private readonly productivityQuality: Quality
  private readonly miningModuleQuality: Quality
  private readonly miningBeaconQuality: Quality

  constructor(
    readonly specification: FactorySpecification,
    readonly planet: Planet,
    readonly target: Item,
    readonly targetRecipe: Recipe,
    readonly targetQualityLevel: number,
    readonly objective: QualityOptimizationObjective,
    readonly curatedProducers: ReadonlyMap<string, string>,
    readonly profile: QualityPlanProfile,
  ) {
    this.userDisabledRecipes = specification.getNetDisable().disable
    this.plannerQuality = availableModuleQuality(specification, specification.qualityPlannerModuleQuality)
    this.productivityQuality = availableModuleQuality(
      specification,
      specification.qualityPlannerProductivityModuleQuality,
    )
    this.miningModuleQuality = availableModuleQuality(specification, specification.qualityPlannerMiningModuleQuality)
    this.miningBeaconQuality = availableModuleQuality(specification, specification.qualityPlannerMiningBeaconQuality)
  }

  build(): QualityGraphItem {
    if (this.planet.key === "fulgora") this.addFulgoraScrapNetwork()
    const output = this.graph.item(this.target, this.targetQualityLevel)
    this.ensureItem(output)
    return output
  }

  private addFulgoraScrapNetwork(): void {
    const scrap = this.specification.items.get("scrap")
    const miningRecipe = this.specification.recipes.get("scrap")
    if (scrap === undefined || miningRecipe === undefined || !this.isUsableProducer(miningRecipe, scrap)) return

    const miningConfiguration = this.getCraftConfigurations(miningRecipe, 0)[0]
    if (miningConfiguration === undefined) throw new Error("Missing Fulgora scrap mining configuration")
    const miningOperation = addCraftRecipe(
      this.graph,
      scrap,
      miningRecipe,
      0,
      0,
      this.specification.maxQualityLevel,
      miningConfiguration,
      [],
      `${this.planet.key}:scrap-source`,
    )
    this.operations.set(miningOperation, miningConfiguration)
    this.setOperationPriorities(miningOperation, miningConfiguration)

    const queuedItems = new Set<string>([scrap.key])
    const recycledRecipes = new Set<Recipe>()
    const queue: Item[] = [scrap]
    while (queue.length > 0) {
      const recycledItem = queue.shift()
      if (recycledItem === undefined) break
      const recyclingRecipe = findRecyclerRecipe(this.specification, recycledItem)
      if (recyclingRecipe === null || recycledRecipes.has(recyclingRecipe) || !this.canRecycle(recyclingRecipe)) {
        continue
      }
      recycledRecipes.add(recyclingRecipe)

      const recyclingConfigurations = this.getRecyclerConfigurations(recyclingRecipe)
      for (let inputQuality = 0; inputQuality <= this.specification.maxQualityLevel; inputQuality++) {
        const configuration = recyclingConfigurations[inputQuality]
        if (configuration === undefined) {
          throw new Error(`Missing Fulgora recycling configuration for ${recycledItem.name}`)
        }
        const operation = addCraftRecipe(
          this.graph,
          recycledItem,
          recyclingRecipe,
          inputQuality,
          0,
          this.specification.maxQualityLevel,
          configuration,
          [],
          `${this.planet.key}:source-recycling`,
        )
        this.operations.set(operation, configuration)
        this.setOperationPriorities(operation, configuration)
      }

      for (const product of recyclingRecipe.products) {
        if (!isQualifiedSolid(product.item) || queuedItems.has(product.item.key)) continue
        queuedItems.add(product.item.key)
        queue.push(product.item)
      }
    }
  }

  getTargetConfigurations(): readonly QualityTierConfiguration[] {
    return this.getCraftConfigurations(this.targetRecipe, this.targetQualityLevel)
  }

  private chooseProducer(item: Item): Recipe | null {
    if (item === this.target) return this.isUsableProducer(this.targetRecipe, item) ? this.targetRecipe : null
    const curatedKey = this.curatedProducers.get(item.key)
    if (curatedKey !== undefined) {
      const curated = this.specification.recipes.get(curatedKey)
      if (curated !== undefined && this.isUsableProducer(curated, item)) return curated
    }

    const candidates = item.recipes.filter((recipe) => this.isUsableProducer(recipe, item))
    const resource = candidates.find((recipe) => recipe.isResource() && this.planet.resources.has(recipe))
    if (resource !== undefined) return resource
    const canonical = candidates.find((recipe) => recipe.key === item.key)
    return canonical ?? candidates.sort((left, right) => (left.order ?? "").localeCompare(right.order ?? ""))[0] ?? null
  }

  private isUsableProducer(recipe: Recipe, item: Item): boolean {
    return isUsableProducer(this.specification, this.planet, recipe, item)
  }

  private ensureItem(graphItem: QualityGraphItem): void {
    const item = graphItem.item
    if (this.expandedItems.has(graphItem.key)) return
    this.expandedItems.add(graphItem.key)

    const keepLevel = graphItem.qualityLevel ?? 0
    this.addVulcanusShuffleProducer(item, keepLevel)
    const producer = this.chooseProducer(item)
    if (producer !== null) this.ensureProducer(item, keepLevel, producer)

    if (keepLevel === 0 || producer === null) this.addImport(graphItem, item)
  }

  private addVulcanusShuffleProducer(item: Item, qualityLevel: number): void {
    if (this.planet.key !== "vulcanus" || qualityLevel === 0 || qualityLevel !== this.targetQualityLevel) return
    if (item.key === "copper-plate" || item.key === "steel-plate") {
      this.addVulcanusLdsShuffle(qualityLevel)
    }
    if (item.key === "iron-ore" || item.key === "iron-plate") {
      this.addVulcanusConcreteShuffle(qualityLevel)
    }
  }

  private addVulcanusLdsShuffle(qualityLevel: number): void {
    const routeKey = `lds@q${qualityLevel}`
    if (this.expandedVulcanusShuffles.has(routeKey)) return
    this.expandedVulcanusShuffles.add(routeKey)

    const lowDensityStructure = this.specification.items.get("low-density-structure")
    const casting = this.specification.recipes.get("casting-low-density-structure")
    const recycling = this.specification.recipes.get("low-density-structure-recycling")
    if (
      lowDensityStructure === undefined ||
      casting === undefined ||
      recycling === undefined ||
      !this.isUsableProducer(casting, lowDensityStructure) ||
      !this.canRecycle(recycling)
    ) {
      return
    }

    const configuration = this.getCraftConfigurations(recycling, qualityLevel)[qualityLevel]
    if (configuration === undefined) throw new Error("Missing Vulcanus low density structure shuffle configuration")
    const operation = addCraftRecipe(
      this.graph,
      lowDensityStructure,
      recycling,
      qualityLevel,
      0,
      this.specification.maxQualityLevel,
      configuration,
      [],
      `${this.planet.key}:lds-shuffle`,
    )
    this.operations.set(operation, configuration)
    this.setOperationPriorities(operation, configuration)
    for (const ingredient of operation.ingredients) this.ensureItem(ingredient.item)
  }

  private addVulcanusConcreteShuffle(qualityLevel: number): void {
    const routeKey = `concrete@q${qualityLevel}`
    if (this.expandedVulcanusShuffles.has(routeKey)) return
    this.expandedVulcanusShuffles.add(routeKey)

    const ironPlate = this.specification.items.get("iron-plate")
    const ironOre = this.specification.items.get("iron-ore")
    const concrete = this.specification.items.get("concrete")
    const stoneBrick = this.specification.items.get("stone-brick")
    const stone = this.specification.items.get("stone")
    const smelting = this.specification.recipes.get("iron-plate")
    const concreteRecycling = this.specification.recipes.get("concrete-recycling")
    const concreteCasting = this.specification.recipes.get("concrete-from-molten-iron")
    const brickSmelting = this.specification.recipes.get("stone-brick")
    const lavaMelting = this.specification.recipes.get("molten-iron-from-lava")
    if (
      ironPlate === undefined ||
      ironOre === undefined ||
      concrete === undefined ||
      stoneBrick === undefined ||
      stone === undefined ||
      smelting === undefined ||
      concreteRecycling === undefined ||
      concreteCasting === undefined ||
      brickSmelting === undefined ||
      lavaMelting === undefined ||
      !this.isUsableProducer(smelting, ironPlate) ||
      !this.canRecycle(concreteRecycling) ||
      !this.isUsableProducer(concreteCasting, concrete) ||
      !this.isUsableProducer(brickSmelting, stoneBrick) ||
      !this.isUsableProducer(lavaMelting, stone)
    ) {
      return
    }

    const routeOperations: [Item, Recipe][] = [
      [ironPlate, smelting],
      [concrete, concreteRecycling],
      [concrete, concreteCasting],
      [stoneBrick, brickSmelting],
      [stone, lavaMelting],
    ]
    const addedOperations: QualityGraphRecipe[] = []
    for (const [product, recipe] of routeOperations) {
      const configuration = this.getCraftConfigurations(recipe, qualityLevel)[qualityLevel]
      if (configuration === undefined) throw new Error(`Missing Vulcanus shuffle configuration for ${recipe.name}`)
      const operation = addCraftRecipe(
        this.graph,
        product,
        recipe,
        qualityLevel,
        0,
        this.specification.maxQualityLevel,
        configuration,
        [],
        `${this.planet.key}:concrete-shuffle`,
      )
      this.operations.set(operation, configuration)
      this.setOperationPriorities(operation, configuration)
      addedOperations.push(operation)
    }
    for (const operation of addedOperations) {
      for (const ingredient of operation.ingredients) this.ensureItem(ingredient.item)
    }
  }

  private addImport(graphItem: QualityGraphItem, item: Item): void {
    if (this.importedItems.has(graphItem)) return
    this.importedItems.add(graphItem)
    const qualityPenalty = graphItem.qualityLevel === null ? one : Rational.from_integer(10 ** graphItem.qualityLevel)
    this.graph.source(graphItem, item, IMPORT_WEIGHT.mul(qualityPenalty), IMPORT_LEVEL)
  }

  private ensureProducer(item: Item, keepLevel: number, recipe: Recipe): void {
    const producerKey = `${recipe.key}->${item.key}@q${keepLevel}`
    if (this.expandedProducers.has(producerKey)) return
    this.expandedProducers.add(producerKey)

    const craftConfigurations = this.getCraftConfigurations(recipe, keepLevel)
    const recycler = keepLevel > 0 && isQualifiedSolid(item) ? findRecyclerRecipe(this.specification, item) : null
    const usableRecycler =
      recycler !== null &&
      !this.directSelfRecyclingRecipes.has(recipe) &&
      !this.userDisabledRecipes.has(recycler) &&
      isLocalRecipe(this.planet, recycler) &&
      choosePracticalBuilding(this.specification, this.planet, recycler) !== null
        ? recycler
        : null
    const recyclerConfigurations = usableRecycler === null ? [] : this.getRecyclerConfigurations(usableRecycler)
    const closures =
      usableRecycler === null
        ? []
        : recyclerClosure(
            this.graph,
            item,
            usableRecycler,
            keepLevel,
            this.specification.maxQualityLevel,
            recyclerConfigurations,
          )

    const hasSolidIngredients = recipe.ingredients.some(({ item: ingredient }) => isQualifiedSolid(ingredient))
    const highestInputQuality = isQualifiedSolid(item) && hasSolidIngredients ? this.specification.maxQualityLevel : 0
    for (let inputQuality = 0; inputQuality <= highestInputQuality; inputQuality++) {
      const configuration = craftConfigurations[inputQuality]
      if (configuration === undefined) throw new Error(`Missing practical configuration for ${recipe.name}`)
      if (usableRecycler !== null && item === this.target && keepLevel === this.targetQualityLevel) {
        const directOperation = addCraftRecipe(
          this.graph,
          item,
          recipe,
          inputQuality,
          0,
          this.specification.maxQualityLevel,
          configuration,
          [],
          `${this.planet.key}:${item.key}:direct`,
        )
        this.operations.set(directOperation, configuration)
        this.setOperationPriorities(directOperation, configuration)
        for (const ingredient of directOperation.ingredients) this.ensureItem(ingredient.item)
      }
      const operation = addCraftRecipe(
        this.graph,
        item,
        recipe,
        inputQuality,
        usableRecycler === null ? 0 : keepLevel,
        this.specification.maxQualityLevel,
        configuration,
        closures,
        `${this.planet.key}:${item.key}:keep${keepLevel}`,
      )
      this.operations.set(operation, configuration)
      if (usableRecycler !== null) {
        this.embeddedRecyclers.set(operation, {
          recipe: usableRecycler,
          configurations: recyclerConfigurations,
        })
      }
      this.setOperationPriorities(operation, configuration)
      for (const ingredient of operation.ingredients) this.ensureItem(ingredient.item)
    }
  }

  private getCraftConfigurations(recipe: Recipe, keepLevel: number): readonly QualityTierConfiguration[] {
    const cacheKey = `craft:${recipe.key}:keep${keepLevel}`
    let configurations = this.configurations.get(cacheKey)
    if (configurations !== undefined) return configurations
    const building = choosePracticalBuilding(this.specification, this.planet, recipe)
    const qualityModule =
      building === null ? null : bestModule(this.specification, recipe, building, this.plannerQuality, "quality")
    const productivityModule =
      building === null
        ? null
        : bestModule(this.specification, recipe, building, this.productivityQuality, "productivity")
    configurations = Array.from({ length: this.specification.maxQualityLevel + 1 }, (_, qualityLevel) => {
      const qualityGoal = this.profile === "planet" ? this.targetQualityLevel : keepLevel
      const wantsQuality = qualityGoal > qualityLevel && recipe.allow_quality
      const configured = moduleTierConfiguration({
        specification: this.specification,
        recipe,
        qualityLevel,
        building,
        module: wantsQuality ? qualityModule : productivityModule,
        moduleQuality: wantsQuality ? this.plannerQuality : this.productivityQuality,
        preserveBeacons: false,
      })
      return qualityLevel === 0 && wantsQuality ? this.optimizeSelfRecyclingFactory(recipe, configured) : configured
    })
    this.configurations.set(cacheKey, configurations)
    return configurations
  }

  // ponytail: this focused search keeps one loadout across recycler quality tiers and puts speed in beacons;
  // add tier-specific or direct speed-module loadouts if those extra degrees of freedom become worth the search cost.
  private selfRecyclingConfigurations(
    recipe: Recipe,
    building: Building,
    qualityModule: Module | null,
    productivityModule: Module | null,
  ): readonly (readonly QualityTierConfiguration[])[] {
    const normal = this.specification.getNormalQuality()
    const base = moduleTierConfiguration({
      specification: this.specification,
      recipe,
      qualityLevel: 0,
      building,
      module: null,
      moduleQuality: normal,
      preserveBeacons: false,
    })
    const qualityModuleCounts =
      qualityModule === null ? [0] : Array.from({ length: building.moduleSlots + 1 }, (_, i) => i)
    const speedModule = this.specification.qualityPlannerMiningModule
    const canSpeedBeacon =
      speedModule !== null &&
      speedModule.canBeacon() &&
      speedModule.canUse(recipe, building) &&
      zero.less(speedModule.speedFor(normal))
    const beaconQualities = this.specification
      .getAvailableQualities()
      .slice(0, this.specification.getQualityIndex(this.miningBeaconQuality) + 1)
    const maximumBeacons = Math.max(0, this.specification.qualityPlannerMiningBeaconCount.floor().toFloat())
    const result: QualityTierConfiguration[][] = []

    for (const qualityModuleCount of qualityModuleCounts) {
      const maximumProductivityModules =
        productivityModule !== null && productivityModule.canUse(recipe, building)
          ? building.moduleSlots - qualityModuleCount
          : 0
      for (
        let productivityModuleCount = 0;
        productivityModuleCount <= maximumProductivityModules;
        productivityModuleCount++
      ) {
        const direct = [
          configurationWithModuleLoadout(
            this.specification,
            recipe,
            base,
            qualityModule,
            this.plannerQuality,
            qualityModuleCount,
            productivityModule,
            this.productivityQuality,
            productivityModuleCount,
          ),
        ]
        result.push(direct)
        if (
          this.objective === "materials" ||
          (this.objective === "quality-modules" && qualityModuleCount === 0) ||
          !canSpeedBeacon ||
          maximumBeacons === 0 ||
          speedModule === null
        )
          continue

        for (let beaconCount = 1; beaconCount <= maximumBeacons; beaconCount++) {
          for (const beaconQuality of beaconQualities) {
            for (let beaconModuleSlots = 1; beaconModuleSlots <= direct[0]!.beaconModules.length; beaconModuleSlots++) {
              result.push([
                configurationWithBeaconSetup(
                  this.specification,
                  recipe,
                  direct[0]!,
                  speedModule,
                  this.miningModuleQuality,
                  beaconModuleSlots,
                  beaconQuality,
                  Rational.from_integer(beaconCount),
                ),
              ])
            }
          }
        }
      }
    }
    return result
  }

  private optimizeSelfRecyclingFactory(recipe: Recipe, configured: QualityTierConfiguration): QualityTierConfiguration {
    if (this.objective === "configured") return configured
    if (this.targetQualityLevel !== 4 || this.specification.maxQualityLevel !== 4) return configured
    if (!(configured.building instanceof Miner) || recipe.products.length !== 1) return configured

    const product = recipe.products[0]
    if (product === undefined || !isQualifiedSolid(product.item)) return configured
    const recyclerRecipe = quarterSelfRecyclerForItem(this.specification, product.item)
    if (recyclerRecipe === null || !this.canRecycle(recyclerRecipe)) return configured
    const recyclerBuilding = choosePracticalBuilding(this.specification, this.planet, recyclerRecipe)
    if (recyclerBuilding === null) return configured

    const sourceQualityModule = bestModule(
      this.specification,
      recipe,
      configured.building,
      this.plannerQuality,
      "quality",
    )
    const sourceProductivityModule = bestModule(
      this.specification,
      recipe,
      configured.building,
      this.productivityQuality,
      "productivity",
    )
    const recyclerQualityModule = bestModule(
      this.specification,
      recyclerRecipe,
      recyclerBuilding,
      this.plannerQuality,
      "quality",
    )
    const recyclerProductivityModule = bestModule(
      this.specification,
      recyclerRecipe,
      recyclerBuilding,
      this.productivityQuality,
      "productivity",
    )
    const sourceCandidates = this.selfRecyclingConfigurations(
      recipe,
      configured.building,
      sourceQualityModule,
      sourceProductivityModule,
    )
    const recyclerCandidates = this.selfRecyclingConfigurations(
      recyclerRecipe,
      recyclerBuilding,
      recyclerQualityModule,
      recyclerProductivityModule,
    )
    const sourceSearchCandidates = (() => {
      if (this.objective === "power") return sourceCandidates
      const byKey = new Map<string, (typeof sourceCandidates)[number]>()
      for (const configurations of sourceCandidates) {
        const configuration = configurations[0]
        if (configuration === undefined) continue
        const moduleCount = qualityModuleCount(configuration)
        const key = JSON.stringify([
          configuration.qualityChance.toString(),
          configuration.productivity.toString(),
          this.objective === "quality-modules" ? moduleCount : null,
        ])
        const existing = byKey.get(key)
        const existingConfiguration = existing?.[0]
        const needsSpeed = this.objective === "machines" || (this.objective === "quality-modules" && moduleCount > 0)
        if (
          existingConfiguration === undefined ||
          (needsSpeed && existingConfiguration.speedEffect.less(configuration.speedEffect))
        ) {
          byKey.set(key, configurations)
        }
      }
      return [...byKey.values()]
    })()
    const recyclerSearchCandidates = (() => {
      if (this.objective === "power") return recyclerCandidates
      const byKey = new Map<string, (typeof recyclerCandidates)[number]>()
      for (const configurations of recyclerCandidates) {
        const configuration = configurations[0]
        if (configuration === undefined) continue
        const moduleCount = qualityModuleCount(configuration)
        const key = JSON.stringify([
          configuration.qualityChance.toString(),
          configuration.productivity.toString(),
          this.objective === "quality-modules" ? moduleCount : null,
        ])
        const existing = byKey.get(key)
        const existingConfiguration = existing?.[0]
        const needsSpeed = this.objective === "machines" || (this.objective === "quality-modules" && moduleCount > 0)
        if (
          existingConfiguration === undefined ||
          (needsSpeed && existingConfiguration.speedEffect.less(configuration.speedEffect))
        ) {
          byKey.set(key, configurations)
        }
      }
      return [...byKey.values()]
    })()
    const rawSourceMetrics = sourceSearchCandidates.flatMap((configurations) => {
      const configuration = configurations[0]
      if (configuration === undefined) return []
      const capacity = operationCapacity(this.specification, recipe, one, configuration)
      if (capacity.machineCount.isZero()) return []
      return [
        {
          configuration,
          capacity,
          outputPerCraft: addProductivity(recipe, product, configuration.productivity),
          distribution: qualityTransitionDistribution(
            configuration.qualityChance,
            0,
            this.specification.maxQualityLevel,
          ),
          qualityModules: capacity.machineCount.mul(Rational.from_integer(qualityModuleCount(configuration))),
          materialCost: resourceDrainRate(this.specification, recipe, configuration),
        },
      ]
    })
    const sourceMetricsByKey = new Map<string, (typeof rawSourceMetrics)[number]>()
    for (const candidate of rawSourceMetrics) {
      const moduleCount = qualityModuleCount(candidate.configuration)
      const key = JSON.stringify([
        candidate.configuration.qualityChance.toString(),
        candidate.configuration.productivity.toString(),
        moduleCount,
        candidate.materialCost.toString(),
      ])
      const existing = sourceMetricsByKey.get(key)
      const better =
        existing !== undefined &&
        (this.objective === "machines"
          ? candidate.capacity.machineCount.less(existing.capacity.machineCount)
          : this.objective === "power"
            ? candidate.capacity.power.less(existing.capacity.power)
            : this.objective === "quality-modules" && moduleCount > 0
              ? candidate.capacity.machineCount.less(existing.capacity.machineCount)
              : false)
      if (existing === undefined || better) sourceMetricsByKey.set(key, candidate)
    }
    const sourceMetricCost = (candidate: (typeof rawSourceMetrics)[number]): Rational =>
      this.objective === "quality-modules"
        ? candidate.qualityModules
        : this.objective === "materials"
          ? candidate.materialCost
          : this.objective === "power"
            ? candidate.capacity.power
            : candidate.capacity.machineCount
    const sourceDominates = (
      left: (typeof rawSourceMetrics)[number],
      right: (typeof rawSourceMetrics)[number],
    ): boolean =>
      !left.configuration.qualityChance.less(right.configuration.qualityChance) &&
      !left.outputPerCraft.less(right.outputPerCraft) &&
      !sourceMetricCost(right).less(sourceMetricCost(left)) &&
      !right.materialCost.less(left.materialCost)
    const sourceMetrics: (typeof rawSourceMetrics)[number][] = []
    for (const candidate of sourceMetricsByKey.values()) {
      if (sourceMetrics.some((existing) => sourceDominates(existing, candidate))) continue
      for (let index = sourceMetrics.length - 1; index >= 0; index--) {
        const existing = sourceMetrics[index]
        if (existing !== undefined && sourceDominates(candidate, existing)) sourceMetrics.splice(index, 1)
      }
      sourceMetrics.push(candidate)
    }
    const recyclerQualityMetrics = new Map<
      string,
      {
        readonly probabilityFactor: Rational
        readonly operationsByInitialQuality: readonly (readonly Rational[])[]
        readonly operationsPerInitialQuality: readonly Rational[]
      }
    >()
    const rawRecyclerMetrics = recyclerSearchCandidates.flatMap((configurations) => {
      const configuration = configurations[0]
      if (configuration === undefined) return []
      const capacityPerOperation = operationCapacity(this.specification, recyclerRecipe, one, configuration)
      if (capacityPerOperation.machineCount.isZero()) return []
      const recyclerChance = configuration.qualityChance
      const qualityKey = JSON.stringify([configuration.qualityChance.toString(), configuration.productivity.toString()])
      let qualityMetrics = recyclerQualityMetrics.get(qualityKey)
      if (qualityMetrics === undefined) {
        const operationsByInitialQuality = quarterSelfRecyclerOperationsByInitialQuality(
          recyclerChance,
          this.specification.maxQualityLevel,
        )
        const three = Rational.from_integer(3)
        qualityMetrics = {
          probabilityFactor: recyclerChance
            .mul(Rational.from_integer(10))
            .add(three)
            .pow(3)
            .div(Rational.from_integer(1000).mul(recyclerChance.add(three).pow(4))),
          operationsByInitialQuality,
          operationsPerInitialQuality: operationsByInitialQuality.map((operations) =>
            operations.reduce((total, rate) => total.add(rate), zero),
          ),
        }
        recyclerQualityMetrics.set(qualityKey, qualityMetrics)
      }
      const building = configuration.building
      let activePowerPerMachine = zero
      let placedPowerPerMachine = zero
      if (building !== null) {
        activePowerPerMachine = building.powerForQuality(configuration.machineQuality).mul(configuration.powerEffect)
        if (building.fuel === null) {
          placedPowerPerMachine = building.drainForQuality(configuration.machineQuality)
        }
        if (
          !configuration.beaconCount.isZero() &&
          configuration.beaconModules.some((module) => module !== null) &&
          !this.specification.beaconPower.isZero()
        ) {
          placedPowerPerMachine = placedPowerPerMachine.add(
            this.specification.beaconPower
              .mul(configuration.beaconQuality.beaconPowerUsageMultiplier)
              .mul(configuration.beaconCount),
          )
        }
      }
      return [
        {
          configuration,
          capacityPerOperation,
          recyclerChance,
          probabilityFactor: qualityMetrics.probabilityFactor,
          operationsByInitialQuality: qualityMetrics.operationsByInitialQuality,
          operationsPerInitialQuality: qualityMetrics.operationsPerInitialQuality,
          qualityModulesPerMachine: Rational.from_integer(qualityModuleCount(configuration)),
          activePowerPerMachine,
          activePowerPerOperation: activePowerPerMachine.mul(capacityPerOperation.machineCount),
          placedPowerPerMachine,
        },
      ]
    })
    const deduplicatedRecyclerMetrics = (() => {
      if (this.objective === "power") {
        const frontiers = new Map<string, (typeof rawRecyclerMetrics)[number][]>()
        const noMore = (left: Rational, right: Rational): boolean => !right.less(left)
        const dominates = (
          left: (typeof rawRecyclerMetrics)[number],
          right: (typeof rawRecyclerMetrics)[number],
        ): boolean =>
          noMore(left.capacityPerOperation.machineCount, right.capacityPerOperation.machineCount) &&
          noMore(left.activePowerPerOperation, right.activePowerPerOperation) &&
          noMore(left.placedPowerPerMachine, right.placedPowerPerMachine)
        for (const candidate of rawRecyclerMetrics) {
          const key = JSON.stringify([
            candidate.configuration.qualityChance.toString(),
            candidate.configuration.productivity.toString(),
          ])
          const frontier = frontiers.get(key) ?? []
          if (frontier.some((existing) => dominates(existing, candidate))) continue
          frontiers.set(key, frontier.filter((existing) => !dominates(candidate, existing)).concat(candidate))
        }
        return [...frontiers.values()].flat()
      }
      const byKey = new Map<string, (typeof rawRecyclerMetrics)[number]>()
      for (const candidate of rawRecyclerMetrics) {
        const moduleCount = qualityModuleCount(candidate.configuration)
        const key = JSON.stringify([
          candidate.configuration.qualityChance.toString(),
          candidate.configuration.productivity.toString(),
          moduleCount,
        ])
        const existing = byKey.get(key)
        const better =
          existing !== undefined &&
          (this.objective === "machines" || (this.objective === "quality-modules" && moduleCount > 0)) &&
          candidate.capacityPerOperation.machineCount.less(existing.capacityPerOperation.machineCount)
        if (existing === undefined || better) byKey.set(key, candidate)
      }
      return [...byKey.values()]
    })()
    const recyclerMetricCost = (candidate: (typeof rawRecyclerMetrics)[number]): Rational =>
      this.objective === "quality-modules"
        ? candidate.capacityPerOperation.machineCount.mul(candidate.qualityModulesPerMachine)
        : this.objective === "machines"
          ? candidate.capacityPerOperation.machineCount
          : zero
    const recyclerDominates = (
      left: (typeof rawRecyclerMetrics)[number],
      right: (typeof rawRecyclerMetrics)[number],
    ): boolean => {
      if (left.recyclerChance.less(right.recyclerChance)) return false
      if (this.objective === "power") {
        return (
          !right.capacityPerOperation.machineCount.less(left.capacityPerOperation.machineCount) &&
          !right.activePowerPerOperation.less(left.activePowerPerOperation) &&
          !right.placedPowerPerMachine.less(left.placedPowerPerMachine)
        )
      }
      return !recyclerMetricCost(right).less(recyclerMetricCost(left))
    }
    const recyclerMetrics: (typeof rawRecyclerMetrics)[number][] = []
    for (const candidate of deduplicatedRecyclerMetrics) {
      if (recyclerMetrics.some((existing) => recyclerDominates(existing, candidate))) continue
      for (let index = recyclerMetrics.length - 1; index >= 0; index--) {
        const existing = recyclerMetrics[index]
        if (existing !== undefined && recyclerDominates(candidate, existing)) recyclerMetrics.splice(index, 1)
      }
      recyclerMetrics.push(candidate)
    }
    const recyclerPowerForSource = (
      source: (typeof sourceMetrics)[number],
      recycler: (typeof recyclerMetrics)[number],
    ): Rational => {
      const recycleRates = Array.from({ length: 4 }, () => zero)
      for (let initialQuality = 0; initialQuality < 4; initialQuality++) {
        const operations = recycler.operationsByInitialQuality[initialQuality]
        if (operations === undefined) continue
        const sourceAmount = source.outputPerCraft.mul(source.distribution[initialQuality] ?? zero)
        for (let recyclerQuality = 0; recyclerQuality < 4; recyclerQuality++) {
          recycleRates[recyclerQuality] = recycleRates[recyclerQuality]!.add(
            sourceAmount.mul(operations[recyclerQuality] ?? zero),
          )
        }
      }
      return recycleRates.reduce((power, recycleRate) => {
        if (recycleRate.isZero()) return power
        const machineCount = recycler.capacityPerOperation.machineCount.mul(recycleRate)
        return power.add(
          recycler.activePowerPerMachine.mul(machineCount).add(recycler.placedPowerPerMachine.mul(machineCount.ceil())),
        )
      }, zero)
    }
    const selectedRecyclerPower = new Map<
      (typeof sourceMetrics)[number],
      Map<(typeof recyclerMetrics)[number], Rational>
    >()
    if (this.objective === "power") {
      for (const source of sourceMetrics) {
        const bestByQuality = new Map<
          string,
          { readonly recycler: (typeof recyclerMetrics)[number]; readonly power: Rational }
        >()
        for (const recycler of recyclerMetrics) {
          const key = JSON.stringify([
            recycler.configuration.qualityChance.toString(),
            recycler.configuration.productivity.toString(),
          ])
          const power = recyclerPowerForSource(source, recycler)
          const existing = bestByQuality.get(key)
          if (existing === undefined || power.less(existing.power)) {
            bestByQuality.set(key, { recycler, power })
          }
        }
        selectedRecyclerPower.set(
          source,
          new Map([...bestByQuality.values()].map(({ recycler, power }) => [recycler, power])),
        )
      }
    }
    // ponytail: plans use continuous machine/module equivalents; exact installed module counts require integer optimization.
    let bestSource = configured
    let bestRecycler: readonly QualityTierConfiguration[] | null = null
    let bestCost: Rational | null = null
    let bestMaterialCost: Rational | null = null

    for (const source of sourceMetrics) {
      const legendaryYield = source.outputPerCraft.mul(source.distribution[4] ?? zero)
      if (legendaryYield.isZero()) continue
      const numerator =
        this.objective === "quality-modules"
          ? source.qualityModules
          : this.objective === "materials"
            ? source.materialCost
            : this.objective === "power"
              ? source.capacity.power
              : source.capacity.machineCount
      const cost = numerator.div(legendaryYield)
      const normalizedMaterialCost = source.materialCost.div(legendaryYield)
      if (
        bestCost === null ||
        cost.less(bestCost) ||
        (cost.equal(bestCost) && (bestMaterialCost === null || normalizedMaterialCost.less(bestMaterialCost)))
      ) {
        bestCost = cost
        bestMaterialCost = normalizedMaterialCost
        bestSource = source.configuration
        bestRecycler = null
      }
    }

    for (const recycler of recyclerMetrics) {
      for (const source of sourceMetrics) {
        const precomputedRecyclerPower = selectedRecyclerPower.get(source)?.get(recycler)
        if (this.objective === "power" && precomputedRecyclerPower === undefined) continue
        const probability = source.configuration.qualityChance
          .mul(Rational.from_integer(3))
          .add(recycler.recyclerChance)
          .mul(recycler.probabilityFactor)
        const legendaryYield = source.outputPerCraft.mul(probability)
        if (legendaryYield.isZero()) continue

        let recyclerOperationsPerOutput = zero
        for (let initialQuality = 0; initialQuality < 4; initialQuality++) {
          recyclerOperationsPerOutput = recyclerOperationsPerOutput.add(
            (source.distribution[initialQuality] ?? zero).mul(
              recycler.operationsPerInitialQuality[initialQuality] ?? zero,
            ),
          )
        }
        const recyclerOperations = source.outputPerCraft.mul(recyclerOperationsPerOutput)
        const recyclerMachines = recycler.capacityPerOperation.machineCount.mul(recyclerOperations)
        const recyclerQualityModules = recyclerMachines.mul(recycler.qualityModulesPerMachine)
        const recyclerPower = precomputedRecyclerPower ?? recycler.capacityPerOperation.power.mul(recyclerOperations)

        const machineCost = source.capacity.machineCount.add(recyclerMachines)
        const qualityModuleCost = source.qualityModules.add(recyclerQualityModules)
        const powerCost = source.capacity.power.add(recyclerPower)
        const numerator =
          this.objective === "quality-modules"
            ? qualityModuleCost
            : this.objective === "materials"
              ? source.materialCost
              : this.objective === "power"
                ? powerCost
                : machineCost
        const cost = numerator.div(legendaryYield)
        const normalizedMaterialCost = source.materialCost.div(legendaryYield)
        const better =
          bestCost === null ||
          cost.less(bestCost) ||
          (cost.equal(bestCost) && (bestMaterialCost === null || normalizedMaterialCost.less(bestMaterialCost)))
        if (!better) continue
        bestCost = cost
        bestMaterialCost = normalizedMaterialCost
        bestSource = source.configuration
        bestRecycler = configurationAcrossQualityLevels(this.specification, recyclerRecipe, recycler.configuration)
      }
    }

    if (bestRecycler !== null) {
      this.configurations.set(`recycler:${recyclerRecipe.key}`, bestRecycler)
    } else if (bestCost !== null) {
      this.directSelfRecyclingRecipes.add(recipe)
    }
    return bestSource
  }

  private getRecyclerConfigurations(recipe: Recipe): readonly QualityTierConfiguration[] {
    const cacheKey = `recycler:${recipe.key}`
    let configurations = this.configurations.get(cacheKey)
    if (configurations !== undefined) return configurations
    const building = choosePracticalBuilding(this.specification, this.planet, recipe)
    const qualityModule =
      building === null ? null : bestModule(this.specification, recipe, building, this.plannerQuality, "quality")
    configurations = Array.from({ length: this.specification.maxQualityLevel + 1 }, (_, qualityLevel) =>
      moduleTierConfiguration({
        specification: this.specification,
        recipe,
        qualityLevel,
        building,
        module: qualityModule,
        moduleQuality: this.plannerQuality,
        preserveBeacons: false,
      }),
    )
    this.configurations.set(cacheKey, configurations)
    return configurations
  }

  private operationCosts(
    operation: QualityGraphRecipe,
    configuration: QualityTierConfiguration,
  ): {
    readonly machines: Rational
    readonly qualityModules: Rational
    readonly power: Rational
    readonly resources: Rational
  } {
    const recipe = operation.metadata.baseRecipe
    if (recipe === null) return { machines: zero, qualityModules: zero, power: zero, resources: zero }
    const capacity = operationCapacity(this.specification, recipe, one, configuration)
    let machines = capacity.machineCount
    let qualityModules = capacity.machineCount.mul(Rational.from_integer(qualityModuleCount(configuration)))
    let power = capacity.power
    const embedded = this.embeddedRecyclers.get(operation)
    if (embedded !== undefined) {
      for (let qualityLevel = 0; qualityLevel <= this.specification.maxQualityLevel; qualityLevel++) {
        const recycleRate = operation.metadata.recycleRatesByQuality?.[qualityLevel] ?? zero
        const recyclerConfiguration = embedded.configurations[qualityLevel]
        if (recycleRate.isZero() || recyclerConfiguration === undefined) continue
        const recyclerCapacity = operationCapacity(
          this.specification,
          embedded.recipe,
          recycleRate,
          recyclerConfiguration,
        )
        machines = machines.add(recyclerCapacity.machineCount)
        qualityModules = qualityModules.add(
          recyclerCapacity.machineCount.mul(Rational.from_integer(qualityModuleCount(recyclerConfiguration))),
        )
        power = power.add(recyclerCapacity.power)
      }
    }
    return {
      machines,
      qualityModules,
      power,
      resources:
        recipe.isResource() && configuration.building instanceof Miner
          ? resourceDrainRate(this.specification, recipe, configuration)
          : zero,
    }
  }

  private setOperationPriorities(operation: QualityGraphRecipe, configuration: QualityTierConfiguration): void {
    const costs = this.operationCosts(operation, configuration)
    const objectiveCost =
      this.objective === "power"
        ? costs.power
        : this.objective === "quality-modules"
          ? costs.qualityModules
          : this.objective === "materials"
            ? costs.resources
            : costs.machines
    if (!objectiveCost.isZero()) this.graph.setPriority(operation, objectiveCost, OBJECTIVE_LEVEL)
    if (!costs.resources.isZero()) {
      this.graph.setPriority(operation, costs.resources, TIEBREAK_LEVEL)
    }
  }

  canRecycle(recipe: Recipe): boolean {
    return (
      !this.userDisabledRecipes.has(recipe) &&
      isLocalRecipe(this.planet, recipe) &&
      choosePracticalBuilding(this.specification, this.planet, recipe) !== null
    )
  }

  disposalConfiguration(recipe: Recipe, qualityLevel: number): QualityTierConfiguration {
    const configuration = this.getRecyclerConfigurations(recipe)[qualityLevel]
    if (configuration === undefined) throw new Error(`Missing recycler configuration for ${recipe.name}`)
    return configuration
  }
}

export function planPracticalQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly profile: QualityPlanProfile
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
  readonly curatedProducers?: ReadonlyMap<string, string>
  readonly profileWarnings?: readonly string[]
}): QualityTargetPlan {
  const {
    specification,
    planet,
    profile,
    item,
    recipe: preferredRecipe,
    requested,
    qualityLevel,
    curatedProducers = new Map(),
    profileWarnings = [],
  } = options
  if (qualityLevel <= 0) throw new Error(`${planet.name} quality planning requires a non-Normal target.`)
  const recipe = getPreferredPracticalQualityRecipe({
    specification,
    planet,
    item,
    preferredRecipe,
    curatedProducers,
  })
  if (recipe === null) throw new Error(`${item.name} has no usable ${planet.name} production recipe.`)

  const objective = objectiveForPlan(specification)
  const builder = new PracticalQualityGraphBuilder(
    specification,
    planet,
    item,
    recipe,
    qualityLevel,
    objective,
    curatedProducers,
    profile,
  )
  const output = builder.build()
  const totals = builder.graph.solve(output, requested, specification.getQualityGraphOptimizer())
  const sourceAmounts = new Map<string, QualifiedItemAmount>()
  const importedAmounts = new Map<string, QualifiedItemAmount>()
  const operations: QualityOperationRate[] = []
  const hiddenRecyclerRates = new Map<
    string,
    {
      recipe: Recipe
      qualityLevel: number
      rate: Rational
      configuration: QualityTierConfiguration
    }
  >()
  let totalCrafts = zero
  let totalRecycles = zero
  let totalMachineCount = zero
  let totalPower = zero

  const addSource = (graphItem: QualityGraphItem, amount: Rational): void => {
    if (amount.isZero()) return
    mergeQualifiedAmounts(sourceAmounts, [
      {
        item: graphItem.item,
        qualityLevel: graphItem.qualityLevel ?? 0,
        amount,
      },
    ])
  }

  for (const [solverRecipe, rate] of totals.rates) {
    if (!(solverRecipe instanceof QualityGraphRecipe) || rate.isZero()) continue
    const baseRecipe = solverRecipe.metadata.baseRecipe
    if (baseRecipe === null) {
      if (solverRecipe.metadata.kind === "source") {
        const product = solverRecipe.products[0]
        if (product !== undefined) {
          const amount = rate.mul(product.amount)
          addSource(product.item, amount)
          mergeQualifiedAmounts(importedAmounts, [
            {
              item: product.item.item,
              qualityLevel: product.item.qualityLevel ?? 0,
              amount,
            },
          ])
        }
      }
      continue
    }
    const quality = solverRecipe.metadata.qualityLevel
    const configuration = builder.operations.get(solverRecipe)
    if (quality === null || configuration === undefined) continue
    const capacity = operationCapacity(specification, baseRecipe, rate, configuration)
    let kind: QualityOperationRate["kind"] = "craft"
    if (baseRecipe.isResource()) kind = "source"
    else if (baseRecipe.categories.has("recycling")) kind = "recycle"
    const embedded = builder.embeddedRecyclers.get(solverRecipe)
    const operation: QualityOperationRate = {
      recipe: baseRecipe,
      qualityLevel: quality,
      rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind,
      ...(kind === "source"
        ? { sourcePurpose: (solverRecipe.metadata.keepLevel ?? 0) > 0 ? ("quality" as const) : ("utility" as const) }
        : {}),
      configuration,
    }
    const recyclerConfiguration = embedded?.configurations[0]
    const hasUniformRecyclerQuality =
      recyclerConfiguration !== undefined &&
      embedded?.configurations.every((candidate) =>
        candidate.qualityChance.equal(recyclerConfiguration.qualityChance),
      ) === true
    const selfRecyclingLegendary =
      kind === "source" &&
      specification.maxQualityLevel === 4 &&
      embedded !== undefined &&
      hasUniformRecyclerQuality &&
      recyclerConfiguration !== undefined &&
      solverRecipe.metadata.recycleRatesByQuality?.some((recycleRate) => !recycleRate.isZero()) === true
        ? selfRecyclingLegendaryMetrics(specification, operation, embedded.recipe, recyclerConfiguration)
        : null
    operations.push(selfRecyclingLegendary === null ? operation : { ...operation, selfRecyclingLegendary })
    if (kind === "source") {
      for (const product of solverRecipe.products) addSource(product.item, rate.mul(product.amount))
    } else if (kind === "recycle") {
      totalRecycles = totalRecycles.add(rate)
    } else {
      totalCrafts = totalCrafts.add(rate)
    }
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)

    if (embedded === undefined) continue
    for (let recyclerQuality = 0; recyclerQuality <= specification.maxQualityLevel; recyclerQuality++) {
      const recycleRate = rate.mul(solverRecipe.metadata.recycleRatesByQuality?.[recyclerQuality] ?? zero)
      if (recycleRate.isZero()) continue
      const key = `${embedded.recipe.key}@q${recyclerQuality}`
      const current = hiddenRecyclerRates.get(key)
      const configuration = embedded.configurations[recyclerQuality]
      if (configuration === undefined) continue
      hiddenRecyclerRates.set(key, {
        recipe: embedded.recipe,
        qualityLevel: recyclerQuality,
        rate: (current?.rate ?? zero).add(recycleRate),
        configuration,
      })
    }
  }

  for (const row of hiddenRecyclerRates.values()) {
    const capacity = operationCapacity(specification, row.recipe, row.rate, row.configuration)
    operations.push({
      recipe: row.recipe,
      qualityLevel: row.qualityLevel,
      rate: row.rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind: "recycle",
      configuration: row.configuration,
    })
    totalRecycles = totalRecycles.add(row.rate)
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)
  }

  let surplusOutputs: readonly QualifiedItemAmount[] = sortedQualifiedAmounts(
    [...totals.surplus].filter(([surplus]) => surplus instanceof QualityGraphItem) as [QualityGraphItem, Rational][],
  )
  const disposal = planQualitySurplusDisposal({
    specification,
    target: item,
    keepLevel: qualityLevel,
    surplus: surplusOutputs,
    canRecycle: (candidate) => builder.canRecycle(candidate),
    getConfiguration: (candidate, level) => builder.disposalConfiguration(candidate, level),
    cycleLabel: planet.name,
  })
  operations.push(...disposal.operations)
  surplusOutputs = disposal.terminalOutputs
  mergeQualifiedAmounts(sourceAmounts, disposal.extraFreshInputs)
  mergeQualifiedAmounts(importedAmounts, disposal.extraFreshInputs)
  totalRecycles = totalRecycles.add(disposal.totalRecycles)
  totalMachineCount = totalMachineCount.add(disposal.totalMachineCount)
  totalPower = totalPower.add(disposal.totalPower)

  const totalQualityModules = operations.reduce(
    (total, operation) =>
      total.add(operation.machineCount.mul(Rational.from_integer(qualityModuleCount(operation.configuration)))),
    zero,
  )

  operations.sort((left, right) => {
    const kindOrder = { source: 0, craft: 1, recycle: 2, dispose: 3 } as const
    const kind = kindOrder[left.kind] - kindOrder[right.kind]
    if (kind !== 0) return kind
    const order = (left.recipe.order ?? "").localeCompare(right.recipe.order ?? "")
    return order === 0 ? left.qualityLevel - right.qualityLevel : order
  })

  const fresh = sortedAmountMap(sourceAmounts)
  const freshInputs = fresh.filter(({ item: input }) => input.phase === "solid")
  const importedInputs = sortedAmountMap(importedAmounts)
  const fluidInputs = fresh.filter(({ item: input }) => input.phase !== "solid")
  const craftConfigurations = builder.getTargetConfigurations()
  const firstPassChance = qualityTransitionProbability(
    craftConfigurations[0]?.qualityChance ?? zero,
    0,
    qualityLevel,
    specification.maxQualityLevel,
  )
  const recyclerRecipe = findRecyclerRecipe(specification, item)
  const warnings = [
    ...profileWarnings,
    "Steady-state estimate: quality modules and recycling raise lower tiers, requested-quality steps use configured productivity where compatible, and small runs may be lumpy; retained byproducts remain listed.",
  ]
  if (!specification.selectedPlanets.has(planet)) {
    warnings.unshift(`The plan uses ${planet.name} availability because the target is in automatic quality mode.`)
  }

  return {
    profile,
    planetKey: planet.key,
    objective,
    item,
    recipe,
    recyclerRecipe,
    qualityLevel,
    requested,
    firstPassChance,
    freshInputs,
    importedInputs,
    fluidInputs,
    surplusOutputs,
    operations,
    totalCrafts,
    totalRecycles,
    totalMachineCount,
    totalQualityModules,
    totalPower,
    warnings,
  }
}

export function planPlanetQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
}): QualityTargetPlan {
  return planPracticalQualityTarget({
    ...options,
    profile: "planet",
    ...(options.planet.key === "fulgora" ? { curatedProducers: FULGORA_CURATED_PRODUCERS } : {}),
    profileWarnings: [
      options.planet.key === "fulgora"
        ? "Fulgora practical mode starts at quality-moduled scrap mining, recycles every scrap quality locally, " +
          "and reuses generated recycler outputs before importing materials."
        : `${options.planet.name} practical mode recursively produces higher-quality intermediates from local resources and fluids.`,
    ],
  })
}
// endregion quality/practical.ts

// region quality/vulcanus.ts
const CURATED_PRODUCERS = new Map<string, string>([
  ["steam", "acid-neutralisation"],
  ["water", "steam-condensation"],
  ["heavy-oil", "simple-coal-liquefaction"],
  ["light-oil", "heavy-oil-cracking"],
  ["petroleum-gas", "light-oil-cracking"],
  ["molten-iron", "molten-iron-from-lava"],
  ["molten-copper", "molten-copper-from-lava"],
  ["iron-plate", "casting-iron"],
  ["copper-plate", "casting-copper"],
  ["steel-plate", "casting-steel"],
  ["iron-gear-wheel", "casting-iron-gear-wheel"],
  ["iron-stick", "casting-iron-stick"],
  ["copper-cable", "casting-copper-cable"],
  ["pipe", "casting-pipe"],
  ["pipe-to-ground", "casting-pipe-to-ground"],
  ["low-density-structure", "casting-low-density-structure"],
])

export function planVulcanusQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
}): QualityTargetPlan {
  const vulcanus = options.specification.planets?.get("vulcanus")
  if (vulcanus === undefined) throw new Error("Vulcanus quality planning requires a Space Age dataset with Vulcanus.")
  return planPracticalQualityTarget({
    ...options,
    planet: vulcanus,
    profile: "vulcanus",
    curatedProducers: CURATED_PRODUCERS,
    profileWarnings: [
      "Uses Vulcanus-local lava, casting, and available quality shuffles; unavailable materials remain listed as imports.",
    ],
  })
}
// endregion quality/vulcanus.ts

// region factory.ts
// Calculator defaults

export const DEFAULT_ITEM_KEY = "advanced-circuit"
export const DEFAULT_PLANET = "nauvis"
export const DEFAULT_BELT = "transport-belt"
export const DEFAULT_FUEL = "coal"
export const DEFAULT_QUALITY_PLANNER_MODULE_KEY = "quality-module-2"
export const DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY = "legendary"
export const DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY = "productivity-module-3"
export const DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY = "legendary"
export const DEFAULT_QUALITY_PLANNER_MINING_MODULE_KEY = "speed-module-2"
export const DEFAULT_QUALITY_PLANNER_MINING_MODULE_QUALITY_KEY = "legendary"
export const DEFAULT_QUALITY_PLANNER_MINING_BEACON_QUALITY_KEY = "legendary"
export const DEFAULT_QUALITY_PLANNER_MINING_BEACON_COUNT = 8
export const DEFAULT_BUILDING_KEYS = new Set([
  "assembling-machine-1",
  "chemical-plant",
  "stone-furnace",
  "electric-mining-drill",
])

// Factory application contracts

export type FactoryRecipe = Recipe | DisabledRecipe
export type TargetBasis = "machines" | "rate" | "belts"
export type BeltStackPolicy = "auto" | "stacked" | "unstacked"

export function isBeltStackPolicy(value: string): value is BeltStackPolicy {
  return value === "auto" || value === "stacked" || value === "unstacked"
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

// React subscribes to FactorySpecification directly; there is no rendering port.

// Building groups

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

// Location policy

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

// Recipe selection commands

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

// Factory specification

function replaceMap<TKey, TValue>(target: Map<TKey, TValue>, source: ReadonlyMap<TKey, TValue>): void {
  target.clear()
  for (const [key, value] of source) target.set(key, value)
}

export class FactorySpecification {
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
  readonly buildTargets: BuildTarget[] = []
  readonly spec = new Map<Recipe, ModuleSpec>()
  defaultModule: Module | null = null
  secondaryDefaultModule: Module | null = null
  defaultMachineQuality: Quality = normalQuality
  defaultModuleQuality: Quality = normalQuality
  defaultBeaconQuality: Quality = normalQuality
  qualityPlannerModule: Module | null = null
  qualityPlannerModuleQuality: Quality = normalQuality
  qualityPlannerProductivityModule: Module | null = null
  qualityPlannerProductivityModuleQuality: Quality = normalQuality
  qualityPlannerMiningModule: Module | null = null
  qualityPlannerMiningModuleQuality: Quality = normalQuality
  qualityPlannerMiningBeaconQuality: Quality = normalQuality
  qualityPlannerMiningBeaconCount = Rational.from_integer(DEFAULT_QUALITY_PLANNER_MINING_BEACON_COUNT)
  qualityPlannerObjective: QualityPlannerObjective = "quality-modules"
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
  readonly qualityPlans: QualityTargetPlan[] = []
  private qualityGraphOptimizer: QualityGraphOptimizer | null = null
  private qualityGraphOptimizerLoader: (() => Promise<QualityGraphOptimizer>) | null = null
  private qualityGraphOptimizerPromise: Promise<void> | null = null
  private qualityGraphOptimizerLoadGeneration = 0
  private readonly stateListeners = new Set<() => void>()
  private stateRevision = 0

  constructor() {}
  setQualityGraphOptimizer(optimizer: QualityGraphOptimizer | null): void {
    this.qualityGraphOptimizer = optimizer
  }
  setQualityGraphOptimizerLoader(loader: (() => Promise<QualityGraphOptimizer>) | null): void {
    this.qualityGraphOptimizerLoader = loader
    this.qualityGraphOptimizerLoadGeneration++
  }
  getQualityGraphOptimizer(): QualityGraphOptimizer | null {
    return this.qualityGraphOptimizer
  }
  private deferForQualityGraphOptimizer(): boolean {
    const needsOptimizer = this.buildTargets.some((target) => target.qualityLevel > 0)
    if (!needsOptimizer || this.qualityGraphOptimizer !== null || this.qualityGraphOptimizerLoader === null) {
      return false
    }
    if (this.qualityGraphOptimizerPromise === null) {
      const generation = this.qualityGraphOptimizerLoadGeneration
      this.qualityGraphOptimizerPromise = this.qualityGraphOptimizerLoader()
        .then((optimizer) => {
          if (generation === this.qualityGraphOptimizerLoadGeneration) this.qualityGraphOptimizer = optimizer
        })
        .catch(() => {
          // This loader is an optimization only. If the optional WASM asset
          // is unavailable, preserve the exact simplex calculation path.
          if (generation === this.qualityGraphOptimizerLoadGeneration) this.qualityGraphOptimizerLoader = null
        })
        .finally(() => {
          if (generation !== this.qualityGraphOptimizerLoadGeneration) return
          this.qualityGraphOptimizerPromise = null
          this.updateSolution()
        })
    }
    return true
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
    const qualityPlannerModule = this.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY)
    this.qualityPlannerModule = qualityPlannerModule?.hasQualityEffect() ? qualityPlannerModule : null
    this.qualityPlannerModuleQuality = this.qualities.get(DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) ?? normal
    const qualityPlannerProductivityModule = this.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY)
    this.qualityPlannerProductivityModule = qualityPlannerProductivityModule?.hasProdEffect()
      ? qualityPlannerProductivityModule
      : null
    this.qualityPlannerProductivityModuleQuality =
      this.qualities.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY) ?? normal
    const qualityPlannerMiningModule = this.modules.get(DEFAULT_QUALITY_PLANNER_MINING_MODULE_KEY)
    this.qualityPlannerMiningModule =
      qualityPlannerMiningModule !== undefined &&
      qualityPlannerMiningModule.canBeacon() &&
      zero.less(qualityPlannerMiningModule.speedFor(normal))
        ? qualityPlannerMiningModule
        : null
    this.qualityPlannerMiningModuleQuality =
      this.qualities.get(DEFAULT_QUALITY_PLANNER_MINING_MODULE_QUALITY_KEY) ?? normal
    this.qualityPlannerMiningBeaconQuality =
      this.qualities.get(DEFAULT_QUALITY_PLANNER_MINING_BEACON_QUALITY_KEY) ?? normal
    this.qualityPlannerMiningBeaconCount = Rational.from_integer(DEFAULT_QUALITY_PLANNER_MINING_BEACON_COUNT)
    this.qualityPlannerObjective = "quality-modules"
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
    return isValidPriorityKey(this, key)
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
    return isItemDisabled(this, item)
  }
  getRecipes(item: Item): FactoryRecipe[] {
    return getEnabledRecipes(this, item)
  }
  getRecipeGraph(items: ReadonlyMap<Item, Rational>): Set<FactoryRecipe> {
    return getRecipeGraph(this, items)
  }
  isFactoryTarget(recipe: Recipe): boolean {
    return isFactoryTarget(this, recipe)
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
    if (!available.has(this.qualityPlannerModuleQuality)) this.qualityPlannerModuleQuality = normal
    if (!available.has(this.qualityPlannerProductivityModuleQuality)) {
      this.qualityPlannerProductivityModuleQuality = normal
    }
    if (!available.has(this.qualityPlannerMiningModuleQuality)) this.qualityPlannerMiningModuleQuality = normal
    if (!available.has(this.qualityPlannerMiningBeaconQuality)) this.qualityPlannerMiningBeaconQuality = normal
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
  applyFullLegendaryQuality(): boolean {
    const legendary = this.qualities.get("legendary")
    if (legendary === undefined) return false

    const qualityLevel = this.getQualityIndex(legendary)
    this.setMaxQualityLevel(qualityLevel)
    this.defaultMachineQuality = legendary
    this.defaultModuleQuality = legendary
    this.defaultBeaconQuality = legendary
    this.qualityPlannerModuleQuality = legendary
    this.qualityPlannerProductivityModuleQuality = legendary
    this.qualityPlannerMiningModuleQuality = legendary
    this.qualityPlannerMiningBeaconQuality = legendary
    this.machineQualityOverrides.clear()

    for (const target of this.buildTargets) {
      const currentRate = target.getRate()
      target.setQuality(qualityLevel, currentRate)
    }

    for (const moduleSpec of this.spec.values()) {
      moduleSpec.moduleQualities.fill(legendary)
      moduleSpec.moduleQualityOverrides.clear()
      moduleSpec.beaconModuleQualities.fill(legendary)
      moduleSpec.beaconModuleQualityOverrides.clear()
      moduleSpec.beaconQuality = legendary
      moduleSpec.beaconQualityOverride = false
    }
    return true
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
    for (const [recipe, moduleSpec] of this.spec) {
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
    for (const [recipe, moduleSpec] of this.spec) {
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
      for (const [recipe, moduleSpec] of this.spec) {
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
    for (const moduleSpec of this.spec.values()) {
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
  addTarget(itemKey = DEFAULT_ITEM_KEY): BuildTarget {
    const item = this.items.get(itemKey)
    if (item === undefined) throw new Error(`Unknown target item: ${itemKey}`)
    const target = new BuildTarget(this, this.buildTargets.length, item)
    this.buildTargets.push(target)
    return target
  }
  removeTarget(target: BuildTarget): void {
    this.buildTargets.splice(target.index, 1)
    for (let i = target.index; i < this.buildTargets.length; i++) {
      const current = this.buildTargets[i]
      if (current !== undefined) current.index--
    }
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
    this.qualityPlans.splice(0, this.qualityPlans.length)
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
        const vulcanus = this.planets?.get("vulcanus") ?? null
        const onlySelectedPlanet = this.selectedPlanets.size === 1 ? ([...this.selectedPlanets][0] ?? null) : null
        const automaticPlanet =
          onlySelectedPlanet ??
          this.recipeLocations.get(qualityRecipe) ??
          (vulcanus !== null && this.selectedPlanets.has(vulcanus) ? vulcanus : null)
        if (automaticPlanet === null) {
          throw new Error(
            `Automatic quality planning for ${item.name} requires one selected planet or an assigned recipe location.`,
          )
        }
        const plan =
          automaticPlanet.key === "vulcanus"
            ? planVulcanusQualityTarget({
                specification: this,
                item,
                recipe: qualityRecipe,
                requested: rate,
                qualityLevel: target.qualityLevel,
              })
            : planPlanetQualityTarget({
                specification: this,
                planet: automaticPlanet,
                item,
                recipe: qualityRecipe,
                requested: rate,
                qualityLevel: target.qualityLevel,
              })
        this.qualityPlans.push(plan)
        continue
      }
      outputs.push({ item, rate, recipe })
    }

    const dedupedOutputs: SolverOutput[] = []
    outer: for (const output of outputs) {
      for (let index = 0; index < dedupedOutputs.length; index++) {
        const existing = dedupedOutputs[index]
        if (existing !== undefined && existing.recipe === output.recipe && existing.item === output.item) {
          dedupedOutputs[index] = {
            ...existing,
            rate: existing.rate.add(output.rate),
          }
          continue outer
        }
      }
      dedupedOutputs.push(output)
    }
    const solverSpec = this.createSolverSpec()
    return dedupedOutputs.length === 0
      ? new Totals(solverSpec, new Map(), new Map(), new Map(), new Map())
      : solve(solverSpec, dedupedOutputs)
  }
  persistUrlState(): void {
    persistFactoryUrlState()
  }
  // Backward-compatible name used by existing event handlers.
  setHash(): void {
    this.persistUrlState()
  }
  // The top-level calculation function. Called whenever the solution
  // requires recalculation.
  updateSolution(): void {
    if (this.deferForQualityGraphOptimizer()) return
    try {
      this.lastTotals = this.solve()
      this.lastError = null
      this.populateModuleSpec(this.lastTotals)
      this.display()
    } catch (error) {
      this.lastTotals = null
      this.lastError = error
      this.persistUrlState()
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
    this.persistUrlState()
    this.notifyStateChanged()
  }
}

// Factory store

let persistFactoryUrlState: () => void = () => undefined

export let spec = new FactorySpecification()

export function configureFactoryPersistence(handler: () => void): void {
  persistFactoryUrlState = handler
}

export function resetSpec(): FactorySpecification {
  spec = new FactorySpecification()
  return spec
}
// endregion factory.ts

// region application/contracts.ts
export type CalculatorTab = "totals" | "graph" | "settings" | "resources" | "help"
export type FactoryDensity = "comfortable" | "compact"
export type ProgressionPreset = "early" | "pre-rocket" | "first-planets" | "late-space-age"
export type QualityPreset = "full-legendary"
export type CalculationStatus = "loading" | "ready" | "error"
export type VisualizerType = "sankey" | "boxline"
export type VisualizerRender = "zoom" | "fix"
export type VisualizerDirection = "right" | "down"

const PROGRESSION_PRESET_VALUES = new Set<string>(["early", "pre-rocket", "first-planets", "late-space-age"])

export function isProgressionPreset(value: string): value is ProgressionPreset {
  return PROGRESSION_PRESET_VALUES.has(value)
}

export function isQualityPreset(value: string): value is QualityPreset {
  return value === "full-legendary"
}

interface PlanningSettingValue {
  readonly id: string
  readonly value: string
  readonly resourceKey?: string
  readonly itemKey?: string
}

export interface CalculatorSnapshot {
  readonly revision: number
  readonly specification: FactorySpecification
  readonly totals: Totals | null
  readonly datasetKey: string
  readonly activeTab: CalculatorTab
  readonly factoryDensity: FactoryDensity
  readonly colorSchemeKey: string
  readonly visualizerType: VisualizerType
  readonly visualizerRender: VisualizerRender
  readonly visualizerDirection: VisualizerDirection
  readonly title: string
  readonly shareStatus: string
  readonly status: CalculationStatus
  readonly errorMessage: string | null
}

export interface CalculatorCommands {
  addTarget(itemKey?: string): void
  removeTarget(index: number): void
  setDataset(value: string): void
  selectTab(tab: CalculatorTab): void
  copyShareLink(): Promise<void>
  applyProgressionPreset(value: ProgressionPreset): void
  applyQualityPreset(value: QualityPreset): void
  setFactoryDensity(value: FactoryDensity): void
  setTitle(value: string): void
  recalculate(): void
}

export interface CalculatorStore {
  getSnapshot(): CalculatorSnapshot
  subscribe(listener: () => void): () => void
  start(): void
  dispose(): void
  readonly commands: CalculatorCommands
}
// endregion application/contracts.ts

// region state.ts
export const DEFAULT_TITLE = "Factorio Calculator"

let calculatorTitle = DEFAULT_TITLE

export function setTitle(title: string): void {
  calculatorTitle = title === "" ? DEFAULT_TITLE : title
  if (typeof document !== "undefined") document.title = calculatorTitle
}

export function getTitle(): string {
  return calculatorTitle
}

const FACTORY_DENSITY_STORAGE_KEY = "factorio-calculator-factory-density"
const DEFAULT_FACTORY_DENSITY: FactoryDensity = "compact"
export let factoryDensity: FactoryDensity = DEFAULT_FACTORY_DENSITY

function isFactoryDensity(value: string | null): value is FactoryDensity {
  return value === "comfortable" || value === "compact"
}

export function setFactoryDensity(value: FactoryDensity): void {
  factoryDensity = value
  try {
    window.localStorage.setItem(FACTORY_DENSITY_STORAGE_KEY, value)
  } catch {
    // Storage is optional.
  }
}

export function initializeFactoryDensity(): void {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(FACTORY_DENSITY_STORAGE_KEY)
  } catch {
    // Storage is optional.
  }
  factoryDensity = isFactoryDensity(stored) ? stored : DEFAULT_FACTORY_DENSITY
}

type PresetDefinition = {
  readonly miningProductivity: number
  readonly recipeProductivityLevel: number
  readonly belt: string
  readonly beltStackSize: number
  readonly maxQualityLevel: number
  readonly defaultMachines: readonly string[]
}

const RECIPE_PRODUCTIVITY_RESEARCH_KEYS = [
  "asteroid-productivity",
  "low-density-structure-productivity",
  "plastic-bar-productivity",
  "processing-unit-productivity",
  "rocket-fuel-productivity",
  "rocket-part-productivity",
  "scrap-recycling-productivity",
  "steel-plate-productivity",
] as const

export const FACTORIO_PRODUCTIVITY_EXPORT_COMMAND = `/c local p=game.player; local id="factorio_calculator_productivity_export"; local old=p.gui.screen[id]; if old then old.destroy(); p.print("[color=green]Productivity export closed.[/color]"); else local f=p.force; local names={${RECIPE_PRODUCTIVITY_RESEARCH_KEYS.map((key) => `"${key}"`).join(",")}}; local levels={}; for _,name in ipairs(names) do local t=f.technologies[name]; if t then local completed=t.researched and t.level or math.max(0,t.level-1); levels[name]=completed; end; end; local payload=helpers.table_to_json({kind="factorio-calculator-productivity",schemaVersion=1,miningProductivityPercent=tonumber(string.format("%.12g",f.mining_drill_productivity_bonus*100)),technologyLevels=levels}); local frame=p.gui.screen.add{type="frame",name=id,caption="Factorio Calculator productivity",direction="vertical"}; frame.auto_center=true; frame.add{type="label",caption="Press Ctrl+C, then paste this into the calculator. Run this command again to close."}; local box=frame.add{type="text-box",text=payload}; box.read_only=true; box.style.width=700; box.style.height=120; p.opened=frame; box.focus(); box.select_all(); end`

const PROGRESSION_PRESETS: Record<ProgressionPreset, PresetDefinition> = {
  early: {
    miningProductivity: 0,
    recipeProductivityLevel: 0,
    belt: "transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 0,
    defaultMachines: ["assembling-machine-1", "chemical-plant", "stone-furnace", "electric-mining-drill"],
  },
  "pre-rocket": {
    miningProductivity: 20,
    recipeProductivityLevel: 0,
    belt: "fast-transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 2,
    defaultMachines: ["assembling-machine-2", "chemical-plant", "steel-furnace", "electric-mining-drill"],
  },
  "first-planets": {
    miningProductivity: 30,
    recipeProductivityLevel: 0,
    belt: "express-transport-belt",
    beltStackSize: 1,
    maxQualityLevel: 2,
    defaultMachines: ["assembling-machine-3", "chemical-plant", "electric-furnace", "electric-mining-drill"],
  },
  "late-space-age": {
    miningProductivity: 100,
    recipeProductivityLevel: 10,
    belt: "express-transport-belt",
    beltStackSize: 4,
    maxQualityLevel: 4,
    defaultMachines: [
      "assembling-machine-3",
      "chemical-plant",
      "foundry",
      "electromagnetic-plant",
      "biochamber",
      "cryogenic-plant",
      "electric-furnace",
      "big-mining-drill",
    ],
  },
}

function applyProgressionPresetValues(specification: FactorySpecification, value: ProgressionPreset): void {
  const preset = PROGRESSION_PRESETS[value]
  specification.miningProd = Rational.from_float(preset.miningProductivity / 100)
  specification.recipeProductivityLevels.clear()
  for (const key of RECIPE_PRODUCTIVITY_RESEARCH_KEYS) {
    if (specification.recipeProductivityResearch.has(key)) {
      specification.setRecipeProductivityLevel(key, preset.recipeProductivityLevel)
    }
  }
  specification.belt = specification.belts.get(preset.belt) ?? specification.belt
  specification.beltStackSize = Rational.from_float(preset.beltStackSize)
  specification.beltStackDefaultPolicy = "auto"
  specification.beltStackOverrides.clear()
  specification.setMaxQualityLevel(preset.maxQualityLevel)
  for (const target of specification.buildTargets) target.setQuality(target.qualityLevel)
  specification.clearBuildingOverrides()
  specification.setAutomaticBuildingPreferences(
    preset.defaultMachines.flatMap((key) => {
      const building = specification.buildingKeys.get(key)
      return building === undefined ? [] : [building]
    }),
  )
}

export function applyProgressionPreset(specification: FactorySpecification, value: ProgressionPreset): void {
  applyProgressionPresetValues(specification, value)
  specification.updateSolution()
}

export function applyQualityPreset(specification: FactorySpecification, value: QualityPreset): void {
  if (value !== "full-legendary" || !specification.qualities.has("legendary")) return
  applyProgressionPresetValues(specification, "late-space-age")
  if (specification.applyFullLegendaryQuality()) specification.updateSolution()
}

function applyPlanningSetting(specification: FactorySpecification, input: PlanningSettingValue): void {
  switch (input.id) {
    case "belt_stack_size":
      specification.beltStackSize = Rational.from_string(input.value)
      break
    case "belt_stack_default_policy":
      if (!isBeltStackPolicy(input.value)) return
      specification.beltStackDefaultPolicy = input.value
      break
    case "buffer_minutes":
      specification.bufferMinutes = Rational.max(zero, Rational.from_string(input.value || "0"))
      break
    case "freshness_delay":
      specification.freshnessDelayMinutes = Rational.max(zero, Rational.from_string(input.value || "0"))
      break
    case "max_quality":
      specification.setMaxQualityLevel(Number(input.value))
      for (const target of specification.buildTargets) target.setQuality(target.qualityLevel)
      break
    case "quality_planner_objective":
      if (!isQualityPlannerObjective(input.value)) return
      specification.qualityPlannerObjective = input.value
      break
    default:
      if (input.resourceKey !== undefined) {
        const recipe = specification.recipes.get(input.resourceKey)
        if (recipe !== undefined) {
          specification.setResourceYield(
            recipe,
            Rational.from_string(input.value || "100").div(Rational.from_float(100)),
          )
        }
      } else if (input.itemKey !== undefined) {
        if (input.value === "") specification.asteroidLimits.delete(input.itemKey)
        else {
          specification.asteroidLimits.set(
            input.itemKey,
            Rational.from_string(input.value).div(specification.format.rateFactor),
          )
        }
      } else {
        return
      }
  }
  specification.updateSolution()
}

export const DEFAULT_TAB: CalculatorTab = "totals"
export let currentTab: CalculatorTab = DEFAULT_TAB

function isCalculatorTab(value: string): value is CalculatorTab {
  return value === "totals" || value === "graph" || value === "settings" || value === "resources" || value === "help"
}

function selectCalculatorTab(requestedTab: string): void {
  const alias =
    requestedTab === "about" || requestedTab === "faq" || requestedTab === "changelog" ? "help" : requestedTab
  currentTab = isCalculatorTab(alias) ? alias : DEFAULT_TAB
}

let shareStatus = ""
let shareTimer: ReturnType<typeof setTimeout> | null = null

export function getShareStatus(): string {
  return shareStatus
}

function setShareStatus(specification: FactorySpecification, value: string): void {
  shareStatus = value
  specification.notifyStateChanged()
  if (shareTimer !== null) clearTimeout(shareTimer)
  if (value !== "") {
    shareTimer = setTimeout(() => {
      shareStatus = ""
      shareTimer = null
      specification.notifyStateChanged()
    }, 2500)
  }
}

async function copyShareLink(specification: FactorySpecification): Promise<void> {
  specification.persistUrlState()
  try {
    await navigator.clipboard.writeText(window.location.href)
    setShareStatus(specification, "Plan link copied.")
  } catch {
    setShareStatus(specification, "Copy failed. Use the browser address bar.")
  }
}

export class Modification {
  constructor(
    readonly name: string,
    readonly filename: string,
    readonly legacy: boolean,
  ) {}
}

export const MODIFICATIONS = new Map([
  ["space-age-2-1-13", new Modification("Space Age 2.1.14", "space-age-2.1.13.json", false)],
  ["2-0-55", new Modification("Vanilla 2.0.55", "vanilla-2.0.55.json", false)],
  ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
  ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
  ["space-age-2-0-55", new Modification("Space Age 2.0.55", "space-age-2.0.55.json", false)],
])

export const DEFAULT_MODIFICATION = "space-age-2-1-13"
const modificationUpdates = new Map([
  ["space-age-2-1-12", "space-age-2-1-13"],
  ["2-0-6", "2-0-55"],
  ["2-0-7", "2-0-55"],
  ["2-0-10", "2-0-55"],
  ["1-1-19", "1-1-110"],
  ["1-1-19x", "1-1-110x"],
  ["space-age-2-0-10", "space-age-2-0-55"],
  ["space-age-2-0-11", "space-age-2-0-55"],
])

export function normalizeDataSetName(name: string | undefined): string {
  const updated = name === undefined ? undefined : (modificationUpdates.get(name) ?? name)
  return updated !== undefined && MODIFICATIONS.has(updated) ? updated : DEFAULT_MODIFICATION
}

let selectedDatasetKey = DEFAULT_MODIFICATION
let onModificationChanged: () => void = () => undefined

export function configureDatasetChangeHandler(handler: () => void): void {
  onModificationChanged = handler
}

function selectDatasetFromSettings(settings: Map<string, string>): void {
  selectedDatasetKey = normalizeDataSetName(settings.get("data"))
}

export function currentMod(): string {
  return selectedDatasetKey
}

export function selectDataset(value: string): void {
  const normalized = normalizeDataSetName(value)
  if (normalized === selectedDatasetKey) return
  selectedDatasetKey = normalized
  onModificationChanged()
}

export const DEFAULT_VISUALIZER: VisualizerType = "sankey"
export const DEFAULT_RENDER: VisualizerRender = "zoom"
export let visualizerType: VisualizerType = DEFAULT_VISUALIZER
export let visualizerRender: VisualizerRender = DEFAULT_RENDER
export let visualizerDirection: VisualizerDirection = "right"

export function setVisualizerType(value: string): void {
  visualizerType = value === "boxline" ? "boxline" : "sankey"
}
export function setVisualizerRender(value: string): void {
  visualizerRender = value === "fix" ? "fix" : "zoom"
}
export function setVisualizerDirection(value: string): void {
  visualizerDirection = value === "down" ? "down" : "right"
}
export function getDefaultVisualizerDirection(): VisualizerDirection {
  return visualizerType === "sankey" ? "right" : "down"
}
export function isDefaultVisualizerDirection(): boolean {
  return visualizerDirection === getDefaultVisualizerDirection()
}

let legacyCalculation = false
export function setLegacyCalculation(value: boolean): void {
  legacyCalculation = value
}
export function usesLegacyCalculation(): boolean {
  return legacyCalculation
}

// endregion state.ts

// region application/store.ts
const INITIAL_SNAPSHOT: CalculatorSnapshot = {
  revision: 0,
  specification: spec,
  totals: null,
  datasetKey: DEFAULT_MODIFICATION,
  activeTab: DEFAULT_TAB,
  factoryDensity: "compact",
  colorSchemeKey: "default",
  visualizerType: DEFAULT_VISUALIZER,
  visualizerRender: DEFAULT_RENDER,
  visualizerDirection: "right",
  title: DEFAULT_TITLE,
  shareStatus: "",
  status: "loading",
  errorMessage: null,
}

function getCalculationStatus(specification: FactorySpecification): CalculationStatus {
  if (specification.lastError !== null) return "error"
  return specification.items.size === 0 || specification.lastTotals === null ? "loading" : "ready"
}

function errorMessage(error: unknown): string | null {
  if (error === null) return null
  return error instanceof Error ? error.message : String(error)
}

function createSnapshot(specification: FactorySpecification, revision: number): CalculatorSnapshot {
  return {
    revision,
    specification,
    totals: specification.lastTotals,
    datasetKey: currentMod(),
    activeTab: currentTab,
    factoryDensity,
    colorSchemeKey: colorScheme.key,
    visualizerType,
    visualizerRender,
    visualizerDirection,
    title: getTitle(),
    shareStatus: getShareStatus(),
    status: getCalculationStatus(specification),
    errorMessage: errorMessage(specification.lastError),
  }
}

export class BrowserCalculatorStore implements CalculatorStore {
  private readonly listeners = new Set<() => void>()
  private specification = spec
  private unsubscribeSpecification: (() => void) | null = null
  private snapshot = INITIAL_SNAPSHOT
  private revision = 0
  private started = false

  readonly getSnapshot = (): CalculatorSnapshot => this.snapshot
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly commands: CalculatorCommands = {
    addTarget: (itemKey) => {
      if (this.specification.items.size === 0) return
      this.specification.addTarget(itemKey)
      this.specification.updateSolution()
    },
    removeTarget: (index) => {
      const target = this.specification.buildTargets[index]
      if (target === undefined) return
      this.specification.removeTarget(target)
      this.specification.updateSolution()
    },
    setDataset: selectDataset,
    selectTab: (tab) => {
      selectCalculatorTab(tab)
      this.specification.display()
    },
    copyShareLink: () => copyShareLink(this.specification),
    applyProgressionPreset: (value) => applyProgressionPreset(this.specification, value),
    applyQualityPreset: (value) => applyQualityPreset(this.specification, value),
    setFactoryDensity: (value) => {
      setFactoryDensity(value)
      this.specification.notifyStateChanged()
    },
    setTitle: (value) => {
      setTitle(value)
      this.specification.display()
    },
    recalculate: () => this.specification.updateSolution(),
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.bindSpecification(spec)
  }

  dispose(): void {
    this.started = false
    this.unsubscribeSpecification?.()
    this.unsubscribeSpecification = null
  }

  bindSpecification(specification: FactorySpecification): void {
    this.unsubscribeSpecification?.()
    this.specification = specification
    this.unsubscribeSpecification = specification.subscribe(this.refresh)
    this.refresh()
  }

  private readonly refresh = (): void => {
    this.revision++
    this.snapshot = createSnapshot(this.specification, this.revision)
    for (const listener of this.listeners) listener()
  }
}

export const calculatorStore = new BrowserCalculatorStore()
export function bindCalculatorSpecification(specification: FactorySpecification): void {
  calculatorStore.bindSpecification(specification)
}
// endregion application/store.ts

// region color-schemes.ts
interface ColorScheme {
  readonly name: string
  readonly key: string
  readonly variables: Readonly<Record<`--${string}`, string>>
}

export const colorSchemes = [
  {
    name: "Default",
    key: "default",
    variables: {
      "--dark": "#171717",
      "--dark-overlay": "rgba(23, 23, 23, 0.8)",
      "--medium": "#212427",
      "--main": "#272b30",
      "--light": "#3a3f44",
      "--rule": "#454b51",
      "--foreground": "#c8c8c8",
      "--muted": "#a7adb3",
      "--accent": "#ff7200",
      "--bright": "#f1fff2",
      "--danger": "#f1a36c",
    },
  },
  {
    name: "Printer-friendly",
    key: "printer",
    variables: {
      "--dark": "#f0f0f0",
      "--dark-overlay": "#ffffff",
      "--medium": "#ffffff",
      "--main": "#ffffff",
      "--light": "#dddddd",
      "--rule": "#bbbbbb",
      "--foreground": "#000000",
      "--muted": "#555555",
      "--accent": "#222222",
      "--bright": "#111111",
      "--danger": "#8a2f00",
    },
  },
] as const satisfies readonly ColorScheme[]
// endregion color-schemes.ts

// region settings/productivity-research.ts
export const MAX_RECIPE_PRODUCTIVITY_PERCENT = 300

export function recipeProductivityPercentPerLevel(research: RecipeProductivityResearch): number {
  const change = research.effects.values().next().value
  return change === undefined ? 0 : Number(change.mul(Rational.from_integer(100)).toDecimal())
}

export function recipeProductivityPercent(research: RecipeProductivityResearch, level: number): string | null {
  const bonuses = new Set<string>()
  for (const change of research.effects.values()) {
    bonuses.add(change.mul(Rational.from_float_approximate(level)).mul(Rational.from_integer(100)).toDecimal())
  }
  if (bonuses.size !== 1) return null

  const onlyBonus = bonuses.values().next().value
  if (onlyBonus === undefined) return null
  const percent = Rational.from_string(onlyBonus)
  return Rational.min(percent, Rational.from_integer(MAX_RECIPE_PRODUCTIVITY_PERCENT)).toDecimal()
}

export function recipeProductivityLevelFromPercent(research: RecipeProductivityResearch, value: string): number {
  const percent = Number(value)
  const percentPerLevel = recipeProductivityPercentPerLevel(research)
  if (!Number.isFinite(percent) || percentPerLevel <= 0) return 0
  return Math.min(MAX_RECIPE_PRODUCTIVITY_PERCENT, Math.max(0, percent)) / percentPerLevel
}

export interface FactorioProductivityExport {
  readonly miningProductivityPercent: number
  readonly technologyLevels: ReadonlyMap<string, number>
}

export function parseFactorioProductivityExport(text: string): FactorioProductivityExport {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("The clipboard does not contain a valid Factorio productivity export.")
  }

  const record = requireRecord(value, "productivity export")
  if (record.kind !== "factorio-calculator-productivity") {
    throw new Error("The clipboard does not contain a Factorio Calculator productivity export.")
  }
  if (record.schemaVersion !== 1) {
    throw new Error("This productivity export version is not supported.")
  }

  const miningProductivityPercent = requireNonnegativeNumber(
    record.miningProductivityPercent,
    "productivity export.miningProductivityPercent",
  )
  const levelsRecord = requireRecord(record.technologyLevels, "productivity export.technologyLevels")
  const technologyLevels = new Map<string, number>()
  for (const [key, rawLevel] of Object.entries(levelsRecord)) {
    const level = requireNonnegativeNumber(rawLevel, `productivity export.technologyLevels.${key}`)
    if (!Number.isInteger(level)) {
      throw new Error(`productivity export.technologyLevels.${key}: expected an integer`)
    }
    technologyLevels.set(key, level)
  }

  return { miningProductivityPercent, technologyLevels }
}

export function applyFactorioProductivityExport(
  specification: FactorySpecification,
  imported: FactorioProductivityExport,
): number {
  specification.miningProd = Rational.from_string(String(imported.miningProductivityPercent)).div(
    Rational.from_integer(100),
  )
  specification.recipeProductivityLevels.clear()
  let appliedResearches = 0
  for (const [key, level] of imported.technologyLevels) {
    if (specification.setRecipeProductivityLevel(key, level)) appliedResearches++
  }
  return appliedResearches
}
// endregion settings/productivity-research.ts

// region url/codec.ts
const MAX_COMPRESSED_FRAGMENT_DEPTH = 3

export interface Base64Codec {
  encode(binary: string): string
  decode(encoded: string): string
}

export type TargetSettingMode = "f" | "r" | "b"
export type BeltStackSettingPolicy = "auto" | "stacked" | "unstacked"

export interface BeltStackItemSetting {
  readonly itemKey: string
  readonly policy: BeltStackSettingPolicy
}

export interface TargetSetting {
  readonly itemKey: string
  readonly mode: TargetSettingMode
  readonly value: string
  readonly recipeKey: string | null
  readonly qualityLevel: number
}

export function formatTargetSetting(target: TargetSetting): string {
  let setting = `${target.itemKey}:${target.mode}:${target.value}`
  if (target.mode === "f" && target.recipeKey !== null) setting += `:${target.recipeKey}`
  if (target.qualityLevel > 0) setting += `:q${target.qualityLevel}`
  return setting
}

export function parseTargetSetting(setting: string): TargetSetting | null {
  const parts = setting.split(":")
  const itemKey = parts[0]
  const mode = parts[1]
  const value = parts[2]
  if (itemKey === undefined || itemKey === "" || value === undefined || value === "") return null
  if (mode !== "f" && mode !== "r" && mode !== "b") return null

  let recipeKey: string | null = null
  let qualityLevel = 0
  let seenQuality = false
  let seenStrategy = false

  for (const part of parts.slice(3)) {
    if (/^q\d+$/.test(part)) {
      if (seenQuality) return null
      qualityLevel = Number(part.slice(1))
      seenQuality = true
      continue
    }
    if (part.startsWith("qs-")) {
      const strategy = part.slice(3)
      if (seenStrategy || (strategy !== "direct" && strategy !== "auto")) return null
      seenStrategy = true
      continue
    }
    if (mode !== "f" || recipeKey !== null || part === "") return null
    recipeKey = part
  }

  return {
    itemKey,
    mode,
    value,
    recipeKey,
    qualityLevel,
  }
}

export function parseBeltStackSettingPolicy(value: string): BeltStackSettingPolicy | null {
  return value === "auto" || value === "stacked" || value === "unstacked" ? value : null
}

export function formatBeltStackItemSettings(settings: readonly BeltStackItemSetting[]): string {
  return settings.map((setting) => `${setting.itemKey}:${setting.policy}`).join(",")
}

export function parseBeltStackItemSettings(value: string): BeltStackItemSetting[] | null {
  if (value === "") return []
  const settings: BeltStackItemSetting[] = []
  const seen = new Set<string>()
  for (const part of value.split(",")) {
    const separator = part.lastIndexOf(":")
    if (separator <= 0) return null
    const itemKey = part.slice(0, separator)
    const policy = parseBeltStackSettingPolicy(part.slice(separator + 1))
    if (policy === null || seen.has(itemKey)) return null
    seen.add(itemKey)
    settings.push({ itemKey, policy })
  }
  return settings
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let result = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return result
}

export function binaryStringToBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function parseSettingsParameters(value: string): Map<string, string> {
  const settings = new Map<string, string>()
  for (const pair of value.split("&")) {
    const separator = pair.indexOf("=")
    if (separator === -1) continue
    settings.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
  return settings
}

export function parseCalculatorFragment(fragment: string, base64: Base64Codec): Map<string, string> {
  return parseCalculatorFragmentAtDepth(fragment, base64, 0)
}

function parseCalculatorFragmentAtDepth(
  fragment: string,
  base64: Base64Codec,
  compressedDepth: number,
): Map<string, string> {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment
  const settings = parseSettingsParameters(value)
  const compressed = settings.get("zip")
  if (compressed === undefined) return settings
  if (compressedDepth >= MAX_COMPRESSED_FRAGMENT_DEPTH) return new Map()

  try {
    const binary = base64.decode(compressed)
    const unzipped = new TextDecoder().decode(inflateRaw(binaryStringToBytes(binary)))
    return parseCalculatorFragmentAtDepth(unzipped, base64, compressedDepth + 1)
  } catch {
    return new Map()
  }
}

export function compressCalculatorSettings(settings: string, base64: Base64Codec): string {
  const compressed = `zip=${base64.encode(bytesToBinaryString(deflateRaw(settings)))}`
  return compressed.length < settings.length ? compressed : settings
}
// endregion url/codec.ts

// region settings.ts
export type SettingsMap = ReadonlyMap<string, string>

function requireSettingsPlanets(): Map<string, Planet> {
  if (spec.planets === null) throw new Error("Planet data has not been loaded")
  return spec.planets
}

function requireFuels(): FuelCollection {
  if (spec.fuels === null) throw new Error("Fuel data has not been loaded")
  return spec.fuels
}

export function getModuleByKey(moduleKey: string): Module | null {
  const module = spec.modules.get(moduleKey) ?? shortModules.get(moduleKey)
  if (module !== undefined) return module
  if (moduleKey === "null" || moduleKey === "") return null
  console.warn("unknown module:", moduleKey)
  return null
}

export function getAvailableQuality(qualityKey: string | undefined): Quality | null {
  if (qualityKey === undefined) return null
  const quality = spec.qualities.get(qualityKey)
  return quality !== undefined && spec.getQualityIndex(quality) <= spec.maxQualityLevel ? quality : null
}

export function getQuality(qualityKey: string | undefined): Quality {
  return getAvailableQuality(qualityKey) ?? spec.getNormalQuality()
}

function applyTitle(settings: SettingsMap): void {
  setTitle(settings.has("title") ? decodeURIComponent(settings.get("title") ?? "") : "")
}

function applyIgnore(settings: SettingsMap): void {
  spec.ignore.clear()
  for (const itemKey of (settings.get("ignore") ?? "").split(",")) {
    if (!itemKey) continue
    const item = spec.items.get(itemKey)
    if (item !== undefined) spec.ignore.add(item)
  }
}

function applyFormatting(settings: SettingsMap): void {
  const rate = settings.get("rate")
  spec.format.setDisplayRate(
    rate !== undefined && longRateNames.has(rate as DisplayRate) ? (rate as DisplayRate) : DEFAULT_RATE,
  )
  spec.format.ratePrecision = Number(settings.get("rp") ?? DEFAULT_RATE_PRECISION)
  spec.format.countPrecision = Number(settings.get("cp") ?? DEFAULT_COUNT_PRECISION)
  spec.format.displayFormat = settings.get("vf") === "r" ? "rational" : DEFAULT_FORMAT
}

function applyProductivity(settings: SettingsMap): void {
  spec.miningProd = Rational.from_string(settings.get("mprod") ?? "0").div(Rational.from_float(100))
  spec.recipeProductivityLevels.clear()
  for (const entry of (settings.get("rprod") ?? "").split(",")) {
    const separator = entry.lastIndexOf(":")
    if (separator < 0) continue
    const level = Number(entry.slice(separator + 1))
    if (Number.isFinite(level) && level >= 0) spec.setRecipeProductivityLevel(entry.slice(0, separator), level)
  }
}

export const DEFAULT_COLOR_SCHEME = "default"
export let colorScheme: ColorScheme = colorSchemes[0]!

export function setColorScheme(schemeKey: string): void {
  colorScheme = colorSchemes.find((scheme) => scheme.key === schemeKey) ?? colorSchemes[0]!
}

function applyBuildingPreferences(settings: SettingsMap): void {
  spec.resetAutomaticBuildingPreferences()
  const selections = new Map<BuildingGroup, Building[]>()
  for (const key of (settings.get("buildings") ?? "").split(",")) {
    if (!key) continue
    const building = spec.buildingKeys.get(key)
    if (building === undefined) continue
    const group = spec.getBuildingGroup(building)
    const selected = selections.get(group) ?? []
    selected.push(building)
    selections.set(group, selected)
  }
  for (const buildings of selections.values()) {
    const minimum = buildings[0]
    if (minimum === undefined) continue
    spec.setMinimumBuilding(minimum)
    for (const building of buildings.slice(1)) spec.setAutomaticBuildingEnabled(building, true)
  }
}

function applyBuildingOverrides(settings: SettingsMap): void {
  spec.clearBuildingOverrides()
  for (const entry of (settings.get("machines") ?? "").split(",")) {
    const [recipeKey, buildingKey] = entry.split(":")
    if (!recipeKey || !buildingKey) continue
    const recipe = spec.recipes.get(recipeKey)
    const building = spec.buildingKeys.get(buildingKey)
    if (recipe !== undefined && building !== undefined) spec.setBuildingOverride(recipe, building, "default")
  }
}

function applyBeltsAndFuel(settings: SettingsMap): void {
  const beltKey = settings.get("belt") ?? DEFAULT_BELT
  spec.belt = spec.belts.get(beltKey) ?? spec.belts.get(DEFAULT_BELT) ?? null
  const fuelKey = settings.get("fuel") ?? DEFAULT_FUEL
  spec.fuel = requireFuels().get(fuelKey) ?? requireFuels().get(DEFAULT_FUEL) ?? null
}

function applyPlanning(settings: SettingsMap): void {
  spec.beltStackSize = Rational.from_string(settings.get("bstack") ?? "1")
  const serializedStackPolicy = settings.get("bstackmode")
  spec.beltStackDefaultPolicy =
    serializedStackPolicy === undefined
      ? settings.has("bstack")
        ? "stacked"
        : "auto"
      : (parseBeltStackSettingPolicy(serializedStackPolicy) ?? "auto")
  spec.beltStackOverrides.clear()
  const itemSettings = parseBeltStackItemSettings(settings.get("bstackitems") ?? "")
  if (itemSettings !== null) {
    for (const entry of itemSettings) {
      const item = spec.items.get(entry.itemKey)
      if (item?.phase === "solid") spec.setBeltStackOverride(item, entry.policy)
    }
  }

  spec.bufferMinutes = Rational.from_string(settings.get("buffer") ?? "1")
  spec.freshnessDelayMinutes = Rational.from_string(settings.get("fresh") ?? "0")
  spec.setMaxQualityLevel(Number(settings.get("maxq") ?? "4"))

  spec.resourceYields.clear()
  for (const entry of (settings.get("ryield") ?? "").split(",")) {
    const separator = entry.lastIndexOf(":")
    const recipe = separator < 0 ? undefined : spec.recipes.get(entry.slice(0, separator))
    if (recipe !== undefined) {
      spec.setResourceYield(recipe, Rational.from_string(entry.slice(separator + 1)).div(Rational.from_float(100)))
    }
  }

  spec.asteroidLimits.clear()
  for (const entry of (settings.get("astcap") ?? "").split(",")) {
    const separator = entry.lastIndexOf(":")
    if (separator > 0) {
      spec.asteroidLimits.set(
        entry.slice(0, separator),
        Rational.from_string(entry.slice(separator + 1)).div(spec.format.rateFactor),
      )
    }
  }

  spec.recipeLocations.clear()
  for (const entry of (settings.get("rloc") ?? "").split(",")) {
    const [recipeKey, locationKey] = entry.split(":")
    if (!recipeKey || !locationKey) continue
    const recipe = spec.recipes.get(recipeKey)
    const location = requireSettingsPlanets().get(locationKey)
    if (recipe !== undefined && location !== undefined) spec.setRecipeLocation(recipe, location)
  }
}

function applyVisualizer(settings: SettingsMap): void {
  setVisualizerType(settings.get("vt") ?? DEFAULT_VISUALIZER)
  setVisualizerRender(settings.get("vr") ?? DEFAULT_RENDER)
  setVisualizerDirection(settings.get("vd") ?? getDefaultVisualizerDirection())
}

function applyEquipmentDefaults(settings: SettingsMap): void {
  spec.setDefaultMachineQuality(getQuality(settings.get("dmachq")))
  spec.setDefaultModuleQuality(getQuality(settings.get("dmq")))
  spec.setDefaultBeaconQuality(getQuality(settings.get("dbq")))
}

function applyQualityPlanner(settings: SettingsMap): void {
  const qualityModule = settings.has("qpm")
    ? getModuleByKey(settings.get("qpm") ?? "null")
    : (spec.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY) ?? null)
  spec.qualityPlannerModule = qualityModule?.hasQualityEffect() ? qualityModule : null
  spec.qualityPlannerModuleQuality = settings.has("qpmq")
    ? getQuality(settings.get("qpmq"))
    : (getAvailableQuality(DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) ?? spec.getNormalQuality())

  const productivityModule = settings.has("qppm")
    ? getModuleByKey(settings.get("qppm") ?? "null")
    : (spec.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY) ?? null)
  spec.qualityPlannerProductivityModule = productivityModule?.hasProdEffect() ? productivityModule : null
  spec.qualityPlannerProductivityModuleQuality = settings.has("qppmq")
    ? getQuality(settings.get("qppmq"))
    : (getAvailableQuality(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY) ?? spec.getNormalQuality())

  const miningModule = settings.has("qpmm")
    ? getModuleByKey(settings.get("qpmm") ?? "null")
    : (spec.modules.get(DEFAULT_QUALITY_PLANNER_MINING_MODULE_KEY) ?? null)
  spec.qualityPlannerMiningModule =
    miningModule !== null && miningModule.canBeacon() && zero.less(miningModule.speedFor(spec.getNormalQuality()))
      ? miningModule
      : null
  spec.qualityPlannerMiningModuleQuality = settings.has("qpmmq")
    ? getQuality(settings.get("qpmmq"))
    : (getAvailableQuality(DEFAULT_QUALITY_PLANNER_MINING_MODULE_QUALITY_KEY) ?? spec.getNormalQuality())
  spec.qualityPlannerMiningBeaconQuality = settings.has("qpmbq")
    ? getQuality(settings.get("qpmbq"))
    : (getAvailableQuality(DEFAULT_QUALITY_PLANNER_MINING_BEACON_QUALITY_KEY) ?? spec.getNormalQuality())
  spec.qualityPlannerMiningBeaconCount = Rational.max(
    zero,
    Rational.from_string(settings.get("qpmbc") ?? String(DEFAULT_QUALITY_PLANNER_MINING_BEACON_COUNT)),
  )
  const objective = settings.get("qpo")
  spec.qualityPlannerObjective =
    objective === "practical"
      ? "quality-modules"
      : objective !== undefined && isQualityPlannerObjective(objective)
        ? objective
        : "quality-modules"
}

function applyDefaultModules(settings: SettingsMap): void {
  spec.setDefaultModule(settings.has("dm") ? getModuleByKey(settings.get("dm") ?? "null") : null)
  spec.setSecondaryDefaultModule(settings.has("dm2") ? getModuleByKey(settings.get("dm2") ?? "null") : null)
}

function applyDefaultBeacon(settings: SettingsMap): void {
  let modules: [Module | null, Module | null] = [null, null]
  let count = zero
  let legacy = false
  if (settings.has("db")) {
    const keys = (settings.get("db") ?? "").split(":")
    legacy = keys.length === 1
    modules = [getModuleByKey(keys[0] ?? "null"), getModuleByKey(keys[1] ?? "null")]
  }
  if (settings.has("dbc")) count = Rational.from_string(settings.get("dbc") ?? "0")
  if (legacy) {
    const halves = count.divmod(Rational.from_float(2))
    if (halves.remainder.isZero()) {
      modules = [modules[0], modules[0]]
      count = halves.quotient
    }
  }
  modules.forEach((module, index) => spec.setDefaultBeacon(module, index))
  spec.setDefaultBeaconCount(count)
}

function applyPrioritiesFromSettings(settings: SettingsMap): void {
  spec.setDefaultPriority()
  const serialized = settings.get("priority")
  if (serialized === undefined) return
  const tiers: [string, Rational][][] = []
  for (const tierString of serialized.split(";")) {
    const tier: [string, Rational][] = []
    for (const pair of tierString.split(",")) {
      const [key, weight] = pair.split("=")
      if (!key || weight === undefined || !spec.isValidPriorityKey(key)) continue
      tier.push([key, Rational.from_string(weight)])
    }
    tiers.push(tier)
  }
  spec.setPriorities(tiers)
}

function applyLocationsAndRecipes(settings: SettingsMap): void {
  const planets = requireSettingsPlanets()
  spec.selectedPlanets.clear()
  const multiple = planets.size > 1
  if (multiple) {
    const keys = settings.has("planet") ? (settings.get("planet") ?? "").split(",").filter(Boolean) : [DEFAULT_PLANET]
    for (const key of keys) {
      const planet = planets.get(key)
      if (planet !== undefined) spec.selectedPlanets.add(planet)
    }
    if (spec.selectedPlanets.size === 0) {
      const fallback = planets.get(DEFAULT_PLANET) ?? planets.values().next().value
      if (fallback !== undefined) spec.selectedPlanets.add(fallback)
    }
    syncLocationDisabledRecipes(spec)
  }

  if (!settings.has("disable") && !settings.has("enable")) {
    if (!multiple) spec.setDefaultDisable()
    return
  }
  for (const key of (settings.get("disable") ?? "").split(",")) {
    const recipe = spec.recipes.get(key)
    if (recipe !== undefined) spec.setDisable(recipe)
  }
  for (const key of (settings.get("enable") ?? "").split(",")) {
    const recipe = spec.recipes.get(key)
    if (recipe !== undefined) spec.setEnable(recipe)
  }
}

function applyTargets(settings: SettingsMap): void {
  spec.buildTargets.splice(0)
  const serialized = settings.get("items")
  if (!serialized) {
    spec.addTarget()
    return
  }
  for (const targetString of serialized.split(",")) {
    const parsed = parseTargetSetting(targetString)
    if (parsed === null || !spec.items.has(parsed.itemKey)) continue
    const recipe = parsed.recipeKey === null ? null : (spec.recipes.get(parsed.recipeKey) ?? null)
    const target = spec.addTarget(parsed.itemKey)
    if (parsed.mode === "f") target.setBuildings(parsed.value, recipe)
    else if (parsed.mode === "r") target.setRate(parsed.value)
    else target.setBelts(parsed.value)
    target.setQuality(parsed.qualityLevel)
    target.refreshRecipes()
  }
  if (spec.buildTargets.length === 0) spec.addTarget()
}

function applyRecipeModules(settings: SettingsMap): void {
  const two = Rational.from_float(2)
  for (const recipeSetting of (settings.get("modules") ?? "").split(",")) {
    if (!recipeSetting) continue
    const [machineSettings, beaconSettings] = recipeSetting.split(";")
    if (machineSettings === undefined) continue
    const [recipeKey, ...moduleKeys] = machineSettings.split(":")
    const recipe = recipeKey === undefined ? undefined : spec.recipes.get(recipeKey)
    if (recipe === undefined) continue
    const moduleSpec = spec.getModuleSpec(recipe)
    if (moduleSpec === null) continue
    moduleKeys.forEach((moduleKey, index) => {
      if (moduleKey) moduleSpec.setModule(index, getModuleByKey(moduleKey))
    })
    if (beaconSettings === undefined) continue
    const beacon = beaconSettings.split(":")
    let first: Module | null
    let second: Module | null
    let count: Rational
    if (beacon.length === 2) {
      first = getModuleByKey(beacon[0] ?? "null")
      count = Rational.from_string(beacon[1] ?? "0")
      const halves = count.divmod(two)
      if (halves.remainder.isZero()) {
        second = first
        count = halves.quotient
      } else {
        second = null
      }
    } else {
      first = getModuleByKey(beacon[0] ?? "null")
      second = getModuleByKey(beacon[1] ?? "null")
      count = Rational.from_string(beacon[2] ?? "0")
    }
    moduleSpec.setBeaconModule(first, 0)
    moduleSpec.setBeaconModule(second, 1)
    moduleSpec.setBeaconCount(count)
  }
}

function applyEquipmentOverrides(settings: SettingsMap): void {
  for (const entry of (settings.get("machineq") ?? "").split(",")) {
    const separator = entry.lastIndexOf(":")
    const recipe = separator < 0 ? undefined : spec.recipes.get(entry.slice(0, separator))
    if (recipe !== undefined) spec.setMachineQuality(recipe, getQuality(entry.slice(separator + 1)), "default")
  }
  for (const entry of (settings.get("moduleq") ?? "").split(",")) {
    if (!entry) continue
    const [machinePart, beaconPart = "", beaconQualityKey = ""] = entry.split(";")
    if (!machinePart) continue
    const [recipeKey, ...machineQualityKeys] = machinePart.split(":")
    const recipe = recipeKey === undefined ? undefined : spec.recipes.get(recipeKey)
    const moduleSpec = recipe === undefined ? null : spec.getModuleSpec(recipe)
    if (moduleSpec === null) continue
    machineQualityKeys.forEach((key, index) => {
      const quality = getAvailableQuality(key)
      if (quality !== null) moduleSpec.restoreModuleQualityOverride(index, quality)
    })
    beaconPart.split(":").forEach((key, index) => {
      const quality = getAvailableQuality(key)
      if (quality !== null) moduleSpec.restoreBeaconModuleQualityOverride(quality, index)
    })
    const beaconQuality = getAvailableQuality(beaconQualityKey)
    if (beaconQuality !== null) moduleSpec.restoreBeaconQualityOverride(beaconQuality)
  }
}

export function applySettings(settings: SettingsMap): void {
  applyTitle(settings)
  applyIgnore(settings)
  applyFormatting(settings)
  applyProductivity(settings)
  setColorScheme(settings.get("c") ?? DEFAULT_COLOR_SCHEME)
  applyBuildingPreferences(settings)
  applyBeltsAndFuel(settings)
  applyPlanning(settings)
  applyVisualizer(settings)
  applyEquipmentDefaults(settings)
  applyDefaultModules(settings)
  applyQualityPlanner(settings)
  applyDefaultBeacon(settings)
  applyPrioritiesFromSettings(settings)
  applyLocationsAndRecipes(settings)
  applyBuildingOverrides(settings)
  applyTargets(settings)
  applyRecipeModules(settings)
  applyEquipmentOverrides(settings)
  selectCalculatorTab(settings.get("tab") ?? DEFAULT_TAB)
}

// endregion settings.ts

// region url/history.ts
export interface UrlHistoryPort {
  readonly hash: string
  readonly pathname: string
  readonly search: string
  replace(url: string): void
}

export class CalculatorUrlHistory {
  private suppressWrites = false

  constructor(private readonly port: UrlHistoryPort) {}

  initialize(): void {
    this.suppressWrites = true
  }

  finishInitialization(): void {
    this.suppressWrites = false
  }

  clearHash(): void {
    this.port.replace(`${this.port.pathname}${this.port.search}`)
  }

  sync(settings: string): void {
    if (this.suppressWrites) return
    const nextHash = `#${settings}`
    if (this.port.hash !== nextHash) this.port.replace(nextHash)
  }
}
// endregion url/history.ts

// region url-state.ts
// Browser URL history

const browserHistory = new CalculatorUrlHistory({
  get hash() {
    return window.location.hash
  },
  get pathname() {
    return window.location.pathname
  },
  get search() {
    return window.location.search
  },
  replace(url: string) {
    window.history.replaceState(null, "", url)
  },
})

export function initializeUrlState(): void {
  browserHistory.initialize()
}

export function finishUrlInitialization(): void {
  browserHistory.finishInitialization()
}

export function clearUrlHash(): void {
  browserHistory.clearHash()
}

export function syncUrlHash(settings: string): void {
  browserHistory.sync(settings)
}

// Calculator fragment format

function getModuleKey(module: Module | null): string {
  let moduleKey
  if (module === null) {
    moduleKey = "null"
  } else {
    moduleKey = module.shortName()
  }
  return moduleKey
}

/**
 * Serialize recipe-specific modules without losing their slot positions.
 *
 * Empty placeholders are significant: a customized second slot must remain
 * the second slot after loading even when the first slot still uses the
 * current default module. Trailing default slots are omitted to keep links
 * compact.
 */
export function serializeModuleSettings(factorySpec: FactorySpecification): string[] {
  let settings = []
  for (let [recipe, moduleSpec] of factorySpec.spec) {
    let defaultModule = factorySpec.getDefaultModule(recipe, moduleSpec.building)
    let modules = moduleSpec.modules.map((module) => (module === defaultModule ? "" : getModuleKey(module)))
    while (modules.at(-1) === "") {
      modules.pop()
    }

    let beacon = ""
    let beaconChanged =
      moduleSpec.beaconModules[0] !== factorySpec.defaultBeacon[0] ||
      moduleSpec.beaconModules[1] !== factorySpec.defaultBeacon[1] ||
      !moduleSpec.beaconCount.equal(factorySpec.defaultBeaconCount)
    if (beaconChanged) {
      let beaconKeys = moduleSpec.beaconModules.map(getModuleKey)
      beacon = beaconKeys.join(":") + ":" + moduleSpec.beaconCount.toString()
    }

    if (modules.length > 0 || beaconChanged) {
      let setting = recipe.key + ":" + modules.join(":")
      if (beacon !== "") {
        setting += ";" + beacon
      }
      settings.push(setting)
    }
  }
  return settings.sort()
}

export function serializeBuildingOverrides(factorySpec: FactorySpecification): string[] {
  return [...factorySpec.buildingOverrides].map(([recipe, building]) => `${recipe.key}:${building.key}`).sort()
}

export function serializeMachineQualities(factorySpec: FactorySpecification): string[] {
  return [...factorySpec.machineQualityOverrides].map(([recipe, quality]) => `${recipe.key}:${quality.key}`).sort()
}

export function serializeModuleQualitySettings(factorySpec: FactorySpecification): string[] {
  const settings: string[] = []
  for (const [recipe, moduleSpec] of factorySpec.spec) {
    const moduleQualities = moduleSpec.moduleQualities.map((quality, index) =>
      moduleSpec.moduleQualityOverrides.has(index) ? quality.key : "",
    )
    while (moduleQualities.at(-1) === "") moduleQualities.pop()
    const beaconModuleQualities = moduleSpec.beaconModuleQualities.map((quality, index) =>
      moduleSpec.beaconModuleQualityOverrides.has(index) ? quality.key : "",
    )
    while (beaconModuleQualities.at(-1) === "") beaconModuleQualities.pop()
    const beaconQuality = moduleSpec.beaconQualityOverride ? moduleSpec.beaconQuality.key : ""
    if (moduleQualities.length || beaconModuleQualities.length || beaconQuality) {
      settings.push(`${recipe.key}:${moduleQualities.join(":")};${beaconModuleQualities.join(":")};${beaconQuality}`)
    }
  }
  return settings.sort()
}

export function serializeAutomaticBuildings(factorySpec: FactorySpecification): string[] {
  const buildings: string[] = []
  const groupSet = new Set(factorySpec.buildings.values())
  for (let group of groupSet) {
    const defaultBuildings = group.getDefaults()
    if (
      defaultBuildings.length !== group.selectedBuildings.size ||
      defaultBuildings.some((building) => !group.selectedBuildings.has(building))
    ) {
      for (let building of group.buildings) {
        if (group.selectedBuildings.has(building)) {
          buildings.push(building.key)
        }
      }
    }
  }
  return buildings
}

export function serializeRecipeProductivityLevels(factorySpec: FactorySpecification): string[] {
  return [...factorySpec.recipeProductivityLevels.entries()]
    .filter(([researchKey, level]) => level > 0 && factorySpec.recipeProductivityResearch.has(researchKey))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([researchKey, level]) => `${researchKey}:${level}`)
}

export function serializeBeltStackOverrides(factorySpec: FactorySpecification): string {
  return formatBeltStackItemSettings(
    [...factorySpec.beltStackOverrides]
      .sort(([a], [b]) => a.key.localeCompare(b.key))
      .map(([item, policy]) => ({ itemKey: item.key, policy })),
  )
}

export function formatSettings(
  excludeTitle = false,
  overrideTab: CalculatorTab | null = null,
  targets: Iterable<readonly [Item, Rational]> | null = null,
  factorySpec: FactorySpecification = spec,
): string {
  let settings = ""
  const title = getTitle()
  if (!excludeTitle && title !== DEFAULT_TITLE) {
    settings += "title=" + encodeURIComponent(title) + "&"
  }
  settings += "data=" + currentMod() + "&"
  let tab = currentTab
  if (overrideTab) {
    tab = overrideTab
  }
  if (tab !== DEFAULT_TAB) {
    settings += "tab=" + tab + "&"
  }
  if (colorScheme.key !== DEFAULT_COLOR_SCHEME) {
    settings += "c=" + colorScheme.key + "&"
  }
  if (factorySpec.format.rateName !== DEFAULT_RATE) {
    settings += "rate=" + factorySpec.format.rateName + "&"
  }
  if (factorySpec.format.ratePrecision !== DEFAULT_RATE_PRECISION) {
    settings += "rp=" + factorySpec.format.ratePrecision + "&"
  }
  if (factorySpec.format.countPrecision !== DEFAULT_COUNT_PRECISION) {
    settings += "cp=" + factorySpec.format.countPrecision + "&"
  }
  if (factorySpec.format.displayFormat !== DEFAULT_FORMAT) {
    settings += "vf=" + factorySpec.format.displayFormat[0] + "&"
  }
  if (!factorySpec.miningProd.isZero()) {
    let hundred = Rational.from_float(100)
    let mprod = factorySpec.miningProd.mul(hundred).toString()
    settings += "mprod=" + mprod + "&"
  }
  let recipeProductivityLevels = serializeRecipeProductivityLevels(factorySpec)
  if (recipeProductivityLevels.length > 0) {
    settings += "rprod=" + recipeProductivityLevels.join(",") + "&"
  }
  let buildings = serializeAutomaticBuildings(factorySpec)
  if (buildings.length > 0) {
    settings += "buildings=" + buildings.join(",") + "&"
  }
  let machineSettings = serializeBuildingOverrides(factorySpec)
  if (machineSettings.length > 0) {
    settings += "machines=" + machineSettings.join(",") + "&"
  }
  const machineQualities = serializeMachineQualities(factorySpec)
  if (machineQualities.length > 0) settings += "machineq=" + machineQualities.join(",") + "&"
  if (factorySpec.belt !== null && factorySpec.belt.key !== DEFAULT_BELT) {
    settings += "belt=" + factorySpec.belt.key + "&"
  }
  if (!factorySpec.beltStackSize.equal(Rational.from_float(1)))
    settings += "bstack=" + factorySpec.beltStackSize.toString() + "&"
  const beltStackOverrides = serializeBeltStackOverrides(factorySpec)
  if (
    !factorySpec.beltStackSize.equal(Rational.from_float(1)) ||
    factorySpec.beltStackDefaultPolicy !== "auto" ||
    beltStackOverrides !== ""
  ) {
    settings += "bstackmode=" + factorySpec.beltStackDefaultPolicy + "&"
  }
  if (beltStackOverrides !== "") settings += "bstackitems=" + beltStackOverrides + "&"
  if (!factorySpec.bufferMinutes.equal(Rational.from_float(1)))
    settings += "buffer=" + factorySpec.bufferMinutes.toString() + "&"
  if (!factorySpec.freshnessDelayMinutes.isZero())
    settings += "fresh=" + factorySpec.freshnessDelayMinutes.toString() + "&"
  let resourceYields = [...factorySpec.resourceYields]
    .filter(([recipe, value]) => recipe.categories?.has("basic-fluid") && !value.equal(Rational.from_float(1)))
    .sort(([a], [b]) => a.key.localeCompare(b.key))
    .map(([recipe, value]) => `${recipe.key}:${value.mul(Rational.from_float(100)).toString()}`)
  if (resourceYields.length > 0) settings += "ryield=" + resourceYields.join(",") + "&"
  if (factorySpec.maxQualityLevel !== 4) settings += "maxq=" + factorySpec.maxQualityLevel + "&"
  if (factorySpec.asteroidLimits.size > 0) {
    settings +=
      "astcap=" +
      [...factorySpec.asteroidLimits]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value.mul(factorySpec.format.rateFactor).toString()}`)
        .join(",") +
      "&"
  }
  if (factorySpec.recipeLocations.size > 0) {
    settings +=
      "rloc=" +
      [...factorySpec.recipeLocations]
        .sort(([a], [b]) => a.key.localeCompare(b.key))
        .map(([recipe, location]) => `${recipe.key}:${location.key}`)
        .join(",") +
      "&"
  }
  if (factorySpec.fuel !== null && factorySpec.fuel.key !== DEFAULT_FUEL) {
    settings += "fuel=" + factorySpec.fuel.key + "&"
  }
  if (factorySpec.defaultModule !== null) {
    settings += "dm=" + factorySpec.defaultModule.shortName() + "&"
  }
  if (factorySpec.defaultMachineQuality.key !== "normal")
    settings += "dmachq=" + factorySpec.defaultMachineQuality.key + "&"
  if (factorySpec.defaultModuleQuality.key !== "normal") settings += "dmq=" + factorySpec.defaultModuleQuality.key + "&"
  if (factorySpec.defaultBeaconQuality.key !== "normal") settings += "dbq=" + factorySpec.defaultBeaconQuality.key + "&"
  const defaultQualityPlannerModule = factorySpec.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY) ?? null
  if (factorySpec.qualityPlannerModule !== defaultQualityPlannerModule) {
    settings += "qpm=" + getModuleKey(factorySpec.qualityPlannerModule) + "&"
  }
  if (factorySpec.qualityPlannerModuleQuality.key !== DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) {
    settings += "qpmq=" + factorySpec.qualityPlannerModuleQuality.key + "&"
  }
  const defaultQualityPlannerProductivityModule =
    factorySpec.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY) ?? null
  if (factorySpec.qualityPlannerProductivityModule !== defaultQualityPlannerProductivityModule) {
    settings += "qppm=" + getModuleKey(factorySpec.qualityPlannerProductivityModule) + "&"
  }
  if (
    factorySpec.qualityPlannerProductivityModuleQuality.key !== DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY
  ) {
    settings += "qppmq=" + factorySpec.qualityPlannerProductivityModuleQuality.key + "&"
  }
  const defaultQualityPlannerMiningModule = factorySpec.modules.get(DEFAULT_QUALITY_PLANNER_MINING_MODULE_KEY) ?? null
  if (factorySpec.qualityPlannerMiningModule !== defaultQualityPlannerMiningModule) {
    settings += "qpmm=" + getModuleKey(factorySpec.qualityPlannerMiningModule) + "&"
  }
  if (factorySpec.qualityPlannerMiningModuleQuality.key !== DEFAULT_QUALITY_PLANNER_MINING_MODULE_QUALITY_KEY) {
    settings += "qpmmq=" + factorySpec.qualityPlannerMiningModuleQuality.key + "&"
  }
  if (factorySpec.qualityPlannerMiningBeaconQuality.key !== DEFAULT_QUALITY_PLANNER_MINING_BEACON_QUALITY_KEY) {
    settings += "qpmbq=" + factorySpec.qualityPlannerMiningBeaconQuality.key + "&"
  }
  if (
    !factorySpec.qualityPlannerMiningBeaconCount.equal(
      Rational.from_integer(DEFAULT_QUALITY_PLANNER_MINING_BEACON_COUNT),
    )
  ) {
    settings += "qpmbc=" + factorySpec.qualityPlannerMiningBeaconCount.toString() + "&"
  }
  if (factorySpec.qualityPlannerObjective !== "quality-modules")
    settings += "qpo=" + factorySpec.qualityPlannerObjective + "&"
  if (factorySpec.secondaryDefaultModule !== null) {
    settings += "dm2=" + factorySpec.secondaryDefaultModule.shortName() + "&"
  }
  if (!factorySpec.isDefaultDefaultBeacon()) {
    let parts = []
    for (let module of factorySpec.defaultBeacon) {
      if (module === null) {
        parts.push("null")
      } else {
        parts.push(module.shortName())
      }
    }
    settings += "db=" + parts.join(":") + "&"
  }
  if (!factorySpec.defaultBeaconCount.isZero()) {
    settings += "dbc=" + factorySpec.defaultBeaconCount.toDecimal(0) + "&"
  }
  if (visualizerType !== DEFAULT_VISUALIZER) {
    settings += "vt=" + visualizerType + "&"
  }
  if (visualizerRender !== DEFAULT_RENDER) {
    settings += "vr=" + visualizerRender + "&"
  }
  if (!isDefaultVisualizerDirection()) {
    settings += "vd=" + visualizerDirection + "&"
  }

  settings += "items="
  const targetStrings: string[] = []
  if (targets) {
    for (let [item, rate] of targets) {
      targetStrings.push(`${item.key}:r:${rate.mul(factorySpec.format.rateFactor).toString()}`)
    }
  } else {
    for (let target of factorySpec.buildTargets) {
      let mode: "f" | "r" | "b"
      let value: string
      if (target.changedBuilding) {
        mode = "f"
        value = target.getBuildingCountInput()
      } else if (target.basis === "belts") {
        mode = "b"
        value = target.getBeltCountInput()
      } else {
        mode = "r"
        value = target.rate.mul(factorySpec.format.rateFactor).toString()
      }
      targetStrings.push(
        formatTargetSetting({
          itemKey: target.item.key,
          mode,
          value,
          recipeKey:
            mode === "f" && target.recipe !== null && target.recipe !== target.defaultRecipe ? target.recipe.key : null,
          qualityLevel: target.qualityLevel,
        }),
      )
    }
  }
  settings += targetStrings.join(",")

  let ignore = []
  for (let item of factorySpec.ignore) {
    ignore.push(item.key)
  }
  if (ignore.length > 0) {
    settings += "&ignore=" + ignore.sort().join(",")
  }

  if (!factorySpec.isDefaultPlanet()) {
    let planets = []
    for (let p of sorted(factorySpec.selectedPlanets, (p) => p.order)) {
      planets.push(p.key)
    }
    settings += "&planet=" + planets.join(",")
  }
  let { disable, enable } = factorySpec.getNetDisable()
  if (disable.size !== 0) {
    let parts = []
    for (let d of disable) {
      parts.push(d.key)
    }
    settings += "&disable=" + parts.sort().join(",")
  }
  if (enable.size !== 0) {
    let parts = []
    for (const d of enable) {
      parts.push(d.key)
    }
    settings += "&enable=" + parts.sort().join(",")
  }

  let moduleSettings = serializeModuleSettings(factorySpec)
  if (moduleSettings.length > 0) {
    settings += "&modules=" + moduleSettings.join(",")
  }
  const moduleQualitySettings = serializeModuleQualitySettings(factorySpec)
  if (moduleQualitySettings.length > 0) settings += "&moduleq=" + moduleQualitySettings.join(",")

  if (!factorySpec.isDefaultPriority()) {
    let priority = []
    for (let level of factorySpec.priority) {
      let keys = []
      for (let { recipe, weight } of level) {
        keys.push(`${recipe.key}=${weight.toString()}`)
      }
      priority.push(keys.join(","))
    }
    settings += "&priority=" + priority.join(";")
  }

  return compressCalculatorSettings(settings, {
    encode: (binary) => (typeof window !== "undefined" ? window.btoa(binary) : globalThis.btoa(binary)),
    decode: (encoded) => (typeof window !== "undefined" ? window.atob(encoded) : globalThis.atob(encoded)),
  })
}

export function loadSettings(fragment: string): Map<string, string> {
  return parseCalculatorFragment(fragment, {
    encode: (binary) => (typeof window !== "undefined" ? window.btoa(binary) : globalThis.btoa(binary)),
    decode: (encoded) => (typeof window !== "undefined" ? window.atob(encoded) : globalThis.atob(encoded)),
  })
}
// endregion url-state.ts

// region results/grouping.ts
export type RecipeGroup = Set<FactoryRecipe>
type RecipeGroupMap = Map<FactoryRecipe, RecipeGroup>

export function isFactoryRecipe(recipe: SolverRecipe): recipe is FactoryRecipe {
  return recipe instanceof Recipe || recipe instanceof DisabledRecipe
}

export function isItem(item: SolverItem): item is Item {
  return item instanceof Item
}

function neighbors(groupMap: RecipeGroupMap, group: RecipeGroup): Set<RecipeGroup> {
  const result = new Set<RecipeGroup>()
  for (const recipe of group) {
    const ingredients = [...recipe.getIngredients()].reverse()
    for (const ingredient of ingredients) {
      if (!isItem(ingredient.item)) continue
      for (const subRecipe of ingredient.item.allRecipes()) {
        const neighbor = groupMap.get(subRecipe)
        if (neighbor !== undefined) result.add(neighbor)
      }
    }
  }
  result.delete(group)
  return result
}

function visitRecipeGroups(
  groupMap: RecipeGroupMap,
  group: RecipeGroup,
  result: Set<RecipeGroup>,
  seen: Set<RecipeGroup>,
): void {
  if (result.has(group) || seen.has(group)) return
  seen.add(group)
  for (const neighbor of neighbors(groupMap, group)) visitRecipeGroups(groupMap, neighbor, result, seen)
  seen.delete(group)
  result.add(group)
}

export function topoSort(groups: ReadonlySet<RecipeGroup>): RecipeGroup[] {
  const groupMap: RecipeGroupMap = new Map()
  for (const group of groups) {
    for (const recipe of group) groupMap.set(recipe, group)
  }
  const result = new Set<RecipeGroup>()
  const seen = new Set<RecipeGroup>()
  for (const group of groups) {
    if (!result.has(group) && !seen.has(group)) visitRecipeGroups(groupMap, group, result, seen)
  }
  return [...result].reverse()
}

export function getRecipeGroups(recipes: ReadonlySet<FactoryRecipe>): Set<RecipeGroup> {
  const groups = new Map<FactoryRecipe, RecipeGroup>()
  const items = new Set<Item>()
  for (const recipe of recipes) {
    if (recipe.products.length === 0) continue
    groups.set(recipe, new Set([recipe]))
    for (const product of recipe.products) {
      if (isItem(product.item)) items.add(product.item)
    }
  }
  for (const item of items) {
    const itemRecipes = item.allRecipes().filter((recipe) => recipes.has(recipe))
    if (itemRecipes.length <= 1) continue
    const combined = new Set<FactoryRecipe>()
    for (const recipe of itemRecipes) {
      for (const groupedRecipe of groups.get(recipe) ?? []) combined.add(groupedRecipe)
    }
    for (const recipe of combined) groups.set(recipe, combined)
  }
  return new Set(groups.values())
}
// endregion results/grouping.ts

// region results/summary.ts
function hasQualityModules(moduleSpec: ModuleSpec | null): boolean {
  return moduleSpec?.modules.some((module) => module?.category === "quality") ?? false
}

export interface FactorySummary {
  readonly exactMachines: Rational
  readonly placedMachines: Rational
  readonly electricalPower: Rational
  readonly fuelRates: ReadonlyMap<Fuel, Rational>
  readonly recipeCount: number
  readonly ambiguousRecipeCount: number
  readonly qualityRecipeCount: number
  readonly beaconedRecipeCount: number
  readonly selectedLocations: readonly Planet[]
  readonly importedItems: readonly Item[]
  readonly planning: ReturnType<typeof getPlanningSummary>
}

export function getFactorySummary(specification: FactorySpecification, totals: Totals): FactorySummary {
  let exactMachines = zero
  let placedMachines = zero
  let electricalPower = zero
  const fuelRates = new Map<Fuel, Rational>()
  let recipeCount = 0
  let ambiguousRecipeCount = 0
  let qualityRecipeCount = 0
  let beaconedRecipeCount = 0

  for (const [solverRecipe, rate] of totals.rates) {
    if (!(solverRecipe instanceof Recipe) || !solverRecipe.isReal()) continue
    const recipe = solverRecipe
    recipeCount++
    const building = specification.getBuilding(recipe)
    if (building === null) continue

    const count = specification.getCount(recipe, rate)
    exactMachines = exactMachines.add(count)
    placedMachines = placedMachines.add(count.ceil())

    const { fuel, power } = specification.getPowerUsage(recipe, rate)
    if (fuel === "electric") {
      electricalPower = electricalPower.add(power)
    } else if (fuel !== null) {
      const recipeFuel = specification.getFuelForRecipe(recipe)
      if (recipeFuel !== null) {
        fuelRates.set(recipeFuel, (fuelRates.get(recipeFuel) ?? zero).add(power.div(recipeFuel.value)))
      }
    }

    if (getRecipeLocations(specification, recipe, building).length > 1) ambiguousRecipeCount++
    const moduleSpec = specification.getModuleSpec(recipe)
    if (hasQualityModules(moduleSpec)) qualityRecipeCount++
    if (
      moduleSpec !== null &&
      !moduleSpec.beaconCount.isZero() &&
      moduleSpec.beaconModules.some((module) => module !== null)
    ) {
      beaconedRecipeCount++
    }
  }

  const planning = getPlanningSummary(specification, totals)
  for (const plan of planning.qualityPlans) {
    exactMachines = exactMachines.add(plan.totalMachineCount)
    placedMachines = placedMachines.add(
      plan.operations.reduce((total, operation) => total.add(operation.machineCount.ceil()), zero),
    )
    electricalPower = electricalPower.add(plan.totalPower)
    recipeCount += plan.operations.length
    qualityRecipeCount += plan.operations.filter((operation) =>
      operation.configuration.modules.some((module) => module?.category === "quality"),
    ).length
    beaconedRecipeCount += plan.operations.filter(
      (operation) =>
        !operation.configuration.beaconCount.isZero() &&
        operation.configuration.beaconModules.some((module) => module !== null),
    ).length
  }

  const selectedLocations = [...specification.selectedPlanets].sort((a, b) => a.order.localeCompare(b.order))
  const importedItems = [...specification.ignore]
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
    planning,
  }
}
// endregion results/summary.ts

// region target-model.ts
// Production targets are plain models. React owns every rendered control.

function hasRecipeCategories(recipe: Recipe | null | undefined): boolean {
  return recipe !== null && recipe !== undefined && (recipe.categories.size > 0 || recipe.category !== null)
}

export function handleTargetQualityChange(
  specification: FactorySpecification,
  target: Pick<BuildTarget, "getRate" | "setQuality">,
  requestedQuality: number,
): void {
  const currentRate = target.getRate()
  target.setQuality(requestedQuality, currentRate)
  specification.updateSolution()
}

export class BuildTarget {
  recipe: Recipe | null = null
  defaultRecipe: Recipe | null = null
  basis: TargetBasis = "machines"
  buildings = one
  rate = zero
  belts = zero
  qualityLevel = 0
  compatibleLocations: Planet[] = []
  private buildingInputValue = "1"
  private beltInputValue = ""

  constructor(
    readonly specification: FactorySpecification,
    public index: number,
    public item: Item,
  ) {
    this.refreshRecipes()
  }

  get changedBuilding(): boolean {
    return this.basis === "machines"
  }

  getBuildingCountInput(): string {
    return this.buildingInputValue
  }

  getBeltCountInput(): string {
    return this.beltInputValue
  }

  getAvailableRecipes(): Recipe[] {
    if (this.specification.ignore.has(this.item)) return []
    return this.item.recipes.filter(
      (recipe) => !this.specification.disable.has(recipe) && recipe.isNetProducer(this.item),
    )
  }

  setItem(item: Item, currentRate = this.getRate()): void {
    this.item = item
    if (this.basis === "belts" && item.phase !== "solid") {
      this.basis = "rate"
      this.rate = currentRate
      this.belts = zero
      this.beltInputValue = ""
    }
    this.refreshRecipes()
    if (this.basis === "machines" && !hasRecipeCategories(this.recipe)) {
      this.basis = "rate"
      this.rate = currentRate
      this.buildings = zero
    }
  }

  setRecipe(recipe: Recipe): void {
    if (!this.getAvailableRecipes().includes(recipe)) return
    this.recipe = recipe
  }

  displayRecipes(): void {
    this.refreshRecipes()
  }

  refreshRecipes(): void {
    const recipes = this.getAvailableRecipes()
    this.defaultRecipe = recipes[0] ?? null
    if (this.recipe === null || !recipes.includes(this.recipe)) this.recipe = this.defaultRecipe
    const info = getUnavailableLocationInfo(this.specification, this.item)
    this.compatibleLocations = info?.compatibleLocations ?? []
  }

  enableCompatibleLocations(): void {
    for (const location of this.compatibleLocations) this.specification.selectPlanet(location)
    this.refreshRecipes()
  }

  getRate(): Rational {
    const recipe = this.recipe
    let recipeRate: Rational | null = null
    if (recipe !== null) {
      const baseRate = this.specification.getRecipeRate(recipe)
      if (baseRate !== null) recipeRate = baseRate.mul(recipe.gives(this.item))
    }

    if (this.basis === "machines") return recipeRate === null ? zero : recipeRate.mul(this.buildings)
    if (this.basis === "belts") {
      return this.specification.getRateForBeltCount(this.item, this.belts, this.recipe ?? this.defaultRecipe)
    }
    return this.rate
  }

  getDisplayedBuildings(): string {
    if (this.qualityLevel > 0) return "Plan"
    if (this.basis === "machines") return this.buildingInputValue
    const recipe = this.recipe
    if (recipe === null) return "N/A"
    let outputRate = this.specification.getRecipeRate(recipe)
    if (outputRate === null) return "N/A"
    outputRate = outputRate.mul(recipe.gives(this.item))
    return outputRate.isZero() ? "N/A" : this.specification.format.count(this.getRate().div(outputRate))
  }

  getDisplayedRate(): string {
    return this.specification.format.rate(this.getRate())
  }

  getDisplayedBelts(): string {
    if (this.item.phase !== "solid") return "N/A"
    if (this.basis === "belts") return this.beltInputValue
    return this.specification.format.count(
      this.specification.getBeltCount(this.item, this.getRate(), this.recipe ?? this.defaultRecipe),
    )
  }

  getBeltStackHeight(): string {
    if (this.item.phase !== "solid") return ""
    return `×${formatCanadianNumber(
      this.specification.getEffectiveBeltStackSize(this.item, this.recipe ?? this.defaultRecipe).toDecimal(),
    )}`
  }

  setBuildings(value: string, recipe: Recipe | null): void {
    this.buildingInputValue = value
    this.recipe = recipe ?? this.recipe
    this.basis = "machines"
    this.buildings = Rational.from_string(value)
    this.rate = zero
    this.belts = zero
    this.beltInputValue = ""
  }

  setRate(value: string): void {
    this.basis = "rate"
    this.buildings = zero
    this.rate = Rational.from_string(value).div(this.specification.format.rateFactor)
    this.belts = zero
    this.beltInputValue = ""
  }

  rateChanged(): void {
    const currentRate = this.getRate()
    this.basis = "rate"
    this.buildings = zero
    this.rate = currentRate
    this.belts = zero
    this.beltInputValue = ""
  }

  setBelts(value: string): void {
    const beltCount = Rational.from_string(value)
    if (this.item.phase === "solid") {
      this.basis = "belts"
      this.buildings = zero
      this.rate = zero
      this.belts = beltCount
      this.beltInputValue = value
      return
    }
    this.basis = "rate"
    this.buildings = zero
    this.rate = this.specification.getRateForBeltCount(this.item, beltCount, this.recipe ?? this.defaultRecipe)
    this.belts = zero
    this.beltInputValue = ""
  }

  setQuality(level: number | string, preservedRate: Rational | null = null): void {
    const previousRate = preservedRate ?? (this.qualityLevel === 0 ? this.getRate() : null)
    const maxLevel = Math.max(0, Math.min(QUALITY_TIERS.length - 1, this.specification.maxQualityLevel))
    this.qualityLevel = Math.max(0, Math.min(maxLevel, Number(level) || 0))
    if (this.qualityLevel > 0 && this.basis !== "rate" && previousRate !== null) {
      this.basis = "rate"
      this.buildings = zero
      this.rate = previousRate
      this.belts = zero
      this.beltInputValue = ""
    }
  }
}
// endregion target-model.ts

// region quality/highs-solver.ts
type HighsLoader = (typeof import("highs"))["default"]
type Highs = Awaited<ReturnType<HighsLoader>>

export interface HighsLoaderOptions {
  readonly locateFile?: (file: string) => string
}

export interface QualityOptimizationRun {
  readonly certified: boolean
  readonly cacheHit: boolean
  readonly columns: number
  readonly rows: number
  readonly basicColumns: number
  readonly solveMilliseconds: number
  readonly certificationMilliseconds: number
  readonly reason: string | null
}

interface CachedSolution {
  readonly rates: readonly Rational[]
  readonly surplus: readonly Rational[]
}

interface ExactModel {
  readonly recipes: readonly QualityGraphRecipe[]
  readonly items: readonly QualityGraphItem[]
  readonly coefficients: readonly (readonly Rational[])[]
  readonly demand: readonly Rational[]
  readonly costs: readonly Rational[]
}

function addAmount(amounts: Map<QualityGraphItem, Rational>, item: QualityGraphItem, amount: Rational): void {
  amounts.set(item, (amounts.get(item) ?? zero).add(amount))
}

function modelForGraph(graph: QualityGraph, output: QualityGraphItem, rate: Rational): ExactModel {
  const recipes = [...graph.solverRecipes()]
  const itemSet = new Set<QualityGraphItem>([output])
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) itemSet.add(ingredient.item)
    for (const product of recipe.products) itemSet.add(product.item)
  }
  const items = [...itemSet]
  const itemRows = new Map(items.map((item, index) => [item, index]))
  const coefficients = Array.from({ length: items.length }, () => Array.from({ length: recipes.length }, () => zero))
  let minimum = one
  let maximum = one
  const observe = (value: Rational): void => {
    if (value.isZero()) return
    const absolute = value.abs()
    if (absolute.less(minimum)) minimum = absolute
    if (maximum.less(absolute)) maximum = absolute
  }
  observe(rate)

  for (let column = 0; column < recipes.length; column++) {
    const recipe = recipes[column]
    if (recipe === undefined) throw new Error("Missing quality recipe")
    const net = new Map<QualityGraphItem, Rational>()
    for (const product of recipe.products) addAmount(net, product.item, product.amount)
    for (const ingredient of recipe.ingredients) addAmount(net, ingredient.item, zero.sub(ingredient.amount))
    for (const [item, amount] of net) {
      const row = itemRows.get(item)
      if (row === undefined) throw new Error("Missing quality item row")
      coefficients[row]![column] = amount
      observe(amount)
    }
  }

  const combinedCosts = Array.from({ length: recipes.length }, () => one)
  const costRatio = Rational.max(Rational.from_integer(2), maximum.div(minimum).mul(Rational.from_integer(2)))
  let priorityCost = costRatio
  for (const level of graph.priorityLevels) {
    let minimumWeight: Rational | null = null
    for (const [recipe, weight] of level) {
      if (!recipes.includes(recipe)) continue
      if (minimumWeight === null || weight.less(minimumWeight)) minimumWeight = weight
    }
    if (minimumWeight === null) continue
    let normalizedTotal = zero
    for (const [recipe, weight] of level) {
      const column = recipes.indexOf(recipe)
      if (column === -1) continue
      const normalizedWeight = weight.div(minimumWeight)
      normalizedTotal = normalizedTotal.add(normalizedWeight)
      combinedCosts[column] = combinedCosts[column]!.add(priorityCost.mul(normalizedWeight))
    }
    if (!normalizedTotal.isZero()) priorityCost = priorityCost.mul(costRatio).mul(normalizedTotal)
  }
  return {
    recipes,
    items,
    coefficients,
    demand: items.map((item) => (item === output ? rate : zero)),
    costs: combinedCosts,
  }
}

function finiteFloat(value: Rational, label: string): number {
  const result = value.toFloat()
  if (!Number.isFinite(result)) throw new Error(`${label} is outside the Float64 range`)
  return Object.is(result, -0) ? 0 : result
}

function modelSignature(model: ExactModel, output: QualityGraphItem): string {
  return JSON.stringify([
    output.key,
    model.items.map((item) => item.key),
    model.recipes.map((recipe) => recipe.key),
    model.coefficients.map((row) => row.map((value) => value.toString())),
    model.costs.map((value) => value.toString()),
  ])
}

function cachedSolutionForModel(model: ExactModel, cached: CachedSolution, rate: Rational): QualityGraphSolution {
  const rates = new Map<QualityGraphRecipe, Rational>()
  for (let column = 0; column < model.recipes.length; column++) {
    const recipe = model.recipes[column]
    const unitRate = cached.rates[column]
    if (recipe === undefined || unitRate === undefined) throw new Error("Cached quality solution is incomplete")
    const scaled = unitRate.mul(rate)
    if (!scaled.isZero()) rates.set(recipe, scaled)
  }
  const surplus = new Map<QualityGraphItem, Rational>()
  for (let row = 0; row < model.items.length; row++) {
    const item = model.items[row]
    const unitRate = cached.surplus[row]
    if (item === undefined || unitRate === undefined) throw new Error("Cached quality surplus is incomplete")
    const scaled = unitRate.mul(rate)
    if (!scaled.isZero()) surplus.set(item, scaled)
  }
  return { rates, surplus }
}

function lpTerm(value: Rational, name: string, first: boolean): string {
  const numeric = finiteFloat(value, name)
  const sign = numeric < 0 ? "-" : first ? "" : "+"
  return `${sign} ${Math.abs(numeric).toPrecision(17)} ${name}`
}

function lpForModel(model: ExactModel): string {
  const maximumCost = model.costs.reduce((maximum, cost) => (maximum.less(cost) ? cost : maximum), zero)
  const objective = model.costs
    .map((cost, column) => lpTerm(cost.div(maximumCost), `x${column}`, column === 0))
    .join(" ")
  const constraints = model.items.map((_, row) => {
    const terms: string[] = []
    for (let column = 0; column < model.recipes.length; column++) {
      const coefficient = model.coefficients[row]?.[column]
      if (coefficient === undefined || coefficient.isZero()) continue
      terms.push(lpTerm(coefficient, `x${column}`, terms.length === 0))
    }
    if (terms.length === 0) terms.push("0")
    const demand = model.demand[row]
    if (demand === undefined) throw new Error("Missing quality demand")
    return ` c${row}: ${terms.join(" ")} >= ${finiteFloat(demand, `c${row}`).toPrecision(17)}`
  })
  const bounds = model.recipes.map((_, column) => ` 0 <= x${column}`)
  return ["Minimize", ` obj: ${objective}`, "Subject To", ...constraints, "Bounds", ...bounds, "End"].join("\n")
}

function dot(left: readonly Rational[], right: readonly Rational[]): Rational {
  let result = zero
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index]
    const rightValue = right[index]
    if (leftValue === undefined || rightValue === undefined) throw new Error("Mismatched exact vectors")
    result = result.add(leftValue.mul(rightValue))
  }
  return result
}

const RANK_PRIME = 2_147_483_647n

function modularPower(base: bigint, exponent: bigint): bigint {
  let result = 1n
  while (exponent > 0n) {
    if ((exponent & 1n) === 1n) result = (result * base) % RANK_PRIME
    base = (base * base) % RANK_PRIME
    exponent >>= 1n
  }
  return result
}

function rationalModulo(value: Rational): bigint {
  const numerator = ((value.p % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
  const denominator = ((value.q % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
  if (denominator === 0n) throw new Error("Exact basis denominator is not invertible")
  return (numerator * modularPower(denominator, RANK_PRIME - 2n)) % RANK_PRIME
}

function selectIndependentRows(
  model: ExactModel,
  basicColumns: readonly number[],
  candidates: readonly number[],
): number[] {
  const selected: number[] = []
  const echelon = new Map<number, bigint[]>()
  for (const row of candidates) {
    const values = basicColumns.map((column) => rationalModulo(model.coefficients[row]?.[column] ?? zero))
    for (const [pivot, pivotValues] of echelon) {
      const factor = values[pivot]
      if (factor === undefined || factor === 0n) continue
      for (let column = pivot; column < values.length; column++) {
        const value = values[column]
        const pivotValue = pivotValues[column]
        if (value === undefined || pivotValue === undefined) throw new Error("Missing modular basis coefficient")
        values[column] = (((value - factor * pivotValue) % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
      }
    }
    const pivot = values.findIndex((value) => value !== 0n)
    if (pivot === -1) continue
    const pivotValue = values[pivot]
    if (pivotValue === undefined) throw new Error("Missing modular basis pivot")
    const inverse = modularPower(pivotValue, RANK_PRIME - 2n)
    for (let column = pivot; column < values.length; column++) {
      const value = values[column]
      if (value === undefined) throw new Error("Missing modular basis coefficient")
      values[column] = (value * inverse) % RANK_PRIME
    }
    echelon.set(pivot, values)
    selected.push(row)
    if (selected.length === basicColumns.length) return selected
  }
  throw new Error(`Candidate active rows have rank ${selected.length}, expected ${basicColumns.length}`)
}

function certify(
  model: ExactModel,
  basicColumns: readonly number[],
  activeRows: readonly number[],
): QualityGraphSolution {
  if (basicColumns.length === 0 || activeRows.length !== basicColumns.length) {
    throw new Error(`Candidate basis is not square (${activeRows.length} rows, ${basicColumns.length} columns)`)
  }

  const basis = activeRows.map((row) =>
    basicColumns.map((column) => {
      const value = model.coefficients[row]?.[column]
      if (value === undefined) throw new Error("Missing candidate basis coefficient")
      return value
    }),
  )
  const basicRates = solveExactLinearSystemFractionFree(
    basis,
    activeRows.map((row) => {
      const value = model.demand[row]
      if (value === undefined) throw new Error("Missing candidate demand")
      return value
    }),
  )
  const negativeIndex = basicRates.findIndex((value) => value.less(zero))
  if (negativeIndex !== -1) {
    throw new Error(`Candidate basis is not primal feasible (${basicRates[negativeIndex]?.toString() ?? "unknown"})`)
  }

  const ratesByColumn = Array.from({ length: model.recipes.length }, () => zero)
  for (let index = 0; index < basicColumns.length; index++) {
    const column = basicColumns[index]
    const value = basicRates[index]
    if (column === undefined || value === undefined) throw new Error("Missing candidate basic rate")
    ratesByColumn[column] = value
  }

  const surplus = new Map<QualityGraphItem, Rational>()
  for (let row = 0; row < model.coefficients.length; row++) {
    const coefficients = model.coefficients[row]
    const demand = model.demand[row]
    if (coefficients === undefined || demand === undefined) {
      throw new Error("Missing candidate material balance")
    }
    const remainder = dot(coefficients, ratesByColumn).sub(demand)
    const item = model.items[row]
    if (item === undefined) throw new Error("Missing candidate material item")
    if (remainder.less(zero)) throw new Error(`Candidate basis underproduces ${item.name}`)
    if (!remainder.isZero()) surplus.set(item, remainder)
  }

  const dualBasis = basicColumns.map((column) =>
    activeRows.map((row) => {
      const value = model.coefficients[row]?.[column]
      if (value === undefined) throw new Error("Missing candidate dual coefficient")
      return value
    }),
  )
  const activeDual = solveExactLinearSystemFractionFree(
    dualBasis,
    basicColumns.map((column) => {
      const value = model.costs[column]
      if (value === undefined) throw new Error("Missing candidate basic cost")
      return value
    }),
  )
  for (let index = 0; index < activeDual.length; index++) {
    const row = activeRows[index]
    const value = activeDual[index]
    if (row === undefined || value === undefined) throw new Error("Missing candidate dual value")
    if (value.less(zero)) throw new Error("Candidate basis is not dual feasible")
  }

  const dual = Array.from({ length: model.coefficients.length }, () => zero)
  for (let index = 0; index < activeRows.length; index++) {
    const row = activeRows[index]
    const value = activeDual[index]
    if (row === undefined || value === undefined) throw new Error("Missing candidate dual value")
    dual[row] = value
  }
  for (let column = 0; column < model.recipes.length; column++) {
    const coefficients = model.coefficients.map((row) => row[column] ?? zero)
    const cost = model.costs[column]
    if (cost === undefined) throw new Error("Missing candidate cost")
    if (cost.less(dot(coefficients, dual))) throw new Error("Candidate basis has a negative exact reduced cost")
  }

  const primalObjective = dot(model.costs, ratesByColumn)
  const dualObjective = dot(model.demand, dual)
  if (!primalObjective.equal(dualObjective)) throw new Error("Candidate primal and dual objectives differ")

  const rates = new Map<QualityGraphRecipe, Rational>()
  for (let column = 0; column < model.recipes.length; column++) {
    const recipe = model.recipes[column]
    const rate = ratesByColumn[column]
    if (recipe !== undefined && rate !== undefined && !rate.isZero()) rates.set(recipe, rate)
  }
  return { rates, surplus }
}

export class HighsQualityOptimizer implements QualityGraphOptimizer {
  lastRun: QualityOptimizationRun | null = null
  private readonly solutionCache = new Map<string, CachedSolution>()

  constructor(private readonly highs: Highs) {}

  solve(graph: QualityGraph, output: QualityGraphItem, rate: Rational): QualityGraphSolution | null {
    const baseModel = modelForGraph(graph, output, rate)
    const signature = modelSignature(baseModel, output)
    const cached = this.solutionCache.get(signature)
    if (cached !== undefined) {
      this.solutionCache.delete(signature)
      this.solutionCache.set(signature, cached)
      this.lastRun = {
        certified: true,
        cacheHit: true,
        columns: baseModel.recipes.length,
        rows: baseModel.coefficients.length,
        basicColumns: 0,
        solveMilliseconds: 0,
        certificationMilliseconds: 0,
        reason: null,
      }
      return cachedSolutionForModel(baseModel, cached, rate)
    }
    const model = baseModel
    const solveStarted = performance.now()
    const solution = this.highs.solve(lpForModel(model), {
      solver: "simplex",
      presolve: "on",
      output_flag: false,
      log_to_console: false,
      small_matrix_value: 1e-12,
      primal_feasibility_tolerance: 1e-9,
      dual_feasibility_tolerance: 1e-9,
    })
    const solveMilliseconds = performance.now() - solveStarted
    const certificationStarted = performance.now()
    let reason: string | null = null
    let certified: QualityGraphSolution | null = null
    let basicColumns: number[] = []
    try {
      if (solution.Status !== "Optimal") {
        throw new Error(
          `HiGHS returned ${solution.Status} (${Object.keys(solution.Columns).length} columns, ${solution.Rows.length} rows, objective ${solution.ObjectiveValue})`,
        )
      }
      basicColumns = model.recipes
        .map((_, column) => column)
        .filter((column) => {
          const candidate = solution.Columns[`x${column}`]
          return candidate !== undefined && "Status" in candidate && candidate.Status === "BS"
        })
      const rowIndexes = model.coefficients.map((_, row) => row)
      const nonbasicRows = rowIndexes.filter((row) => {
        const candidate = solution.Rows[row]
        return candidate !== undefined && "Status" in candidate && candidate.Status !== "BS"
      })
      const tightRows = rowIndexes.filter((row) => {
        const candidate = solution.Rows[row]
        const demand = model.demand[row]
        return (
          candidate !== undefined &&
          "Primal" in candidate &&
          demand !== undefined &&
          Math.abs(candidate.Primal - finiteFloat(demand, `c${row}`)) <= 1e-7
        )
      })
      const activeRows = selectIndependentRows(model, basicColumns, [...new Set([...nonbasicRows, ...tightRows])])
      certified = certify(model, basicColumns, activeRows)
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error)
      certified = null
    }
    this.lastRun = {
      certified: certified !== null,
      cacheHit: false,
      columns: model.recipes.length,
      rows: model.coefficients.length,
      basicColumns: basicColumns.length,
      solveMilliseconds,
      certificationMilliseconds: performance.now() - certificationStarted,
      reason,
    }
    if (certified !== null && !rate.isZero()) {
      const unitRates = baseModel.recipes.map((recipe) => (certified.rates.get(recipe) ?? zero).div(rate))
      const unitSurplus = baseModel.items.map((item) => (certified.surplus.get(item) ?? zero).div(rate))
      this.solutionCache.set(signature, {
        rates: unitRates,
        surplus: unitSurplus,
      })
      if (this.solutionCache.size > 8) {
        const oldest = this.solutionCache.keys().next().value
        if (oldest !== undefined) this.solutionCache.delete(oldest)
      }
    }
    return certified
  }
}

export async function loadHighsQualityOptimizer(options: HighsLoaderOptions = {}): Promise<HighsQualityOptimizer> {
  const { default: highsLoader } = await import("highs")
  const highs = await highsLoader(options)
  return new HighsQualityOptimizer(highs)
}
// endregion quality/highs-solver.ts

// region quality/highs-runtime.ts
/** Load the optional quality LP engine without adding it to the normal-plan entry chunk. */
export async function loadBrowserHighsQualityOptimizer(): Promise<HighsQualityOptimizer> {
  const { default: highsRuntimeUrl } = await import("highs/runtime?url")
  return loadHighsQualityOptimizer({ locateFile: () => highsRuntimeUrl })
}
// endregion quality/highs-runtime.ts

// region react-ui.tsx

type StyleMap = Record<string, CSSProperties>

const UI = {
  app: {
    minHeight: "100vh",
    padding: "0.75rem 1rem 2rem",
    color: "var(--foreground)",
    background: "var(--dark)",
  },
  page: { width: "min(1680px, 100%)", margin: "0 auto" },
  muted: { color: "var(--muted)", fontSize: 12 },
  panel: {
    marginBottom: 10,
    padding: "0.65rem 0",
    borderTop: "1px solid var(--rule)",
    borderBottom: "1px solid var(--rule)",
    background: "transparent",
  },
  panelHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 6,
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 },
  stack: { display: "grid", gap: "var(--layout-gap)" },
  targetGrid: {
    display: "grid",
    gridTemplateColumns: "32px 220px 110px 72px 88px 88px",
    gap: 8,
    alignItems: "center",
    width: "max-content",
    maxWidth: "100%",
  },
  field: { display: "grid", gap: 3, minWidth: 0 },
  label: { color: "var(--muted)", fontSize: 12, fontWeight: 600 },
  control: {
    width: "100%",
    minHeight: 30,
    padding: "4px 7px",
    color: "var(--foreground)",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--medium)",
  },
  button: {
    minHeight: 32,
    padding: "4px 10px",
    color: "var(--foreground)",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--medium)",
    cursor: "pointer",
  },
  primaryButton: {
    minHeight: 32,
    padding: "4px 10px",
    color: "var(--foreground)",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--medium)",
    cursor: "pointer",
  },
  dangerButton: {
    width: 28,
    minHeight: 32,
    padding: 0,
    color: "var(--foreground)",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--medium)",
    cursor: "pointer",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 20,
    marginTop: 10.4,
    marginBottom: 10,
    borderBottom: "1px solid var(--rule)",
    position: "sticky",
    top: 0,
    zIndex: 8,
    background: "var(--dark-overlay)",
    backdropFilter: "blur(6px)",
  },
  tab: {
    padding: "8.8px 0 7.2px",
    color: "var(--muted)",
    border: 0,
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    background: "transparent",
    fontWeight: 600,
    cursor: "pointer",
  },
  activeTab: {
    color: "var(--bright)",
    borderBottomColor: "var(--accent)",
    background: "transparent",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: 0,
  },
  summaryCard: {
    padding: "8px 12px 8px 0",
    border: 0,
    borderRadius: 0,
    background: "transparent",
  },
  summaryValue: {
    color: "var(--bright)",
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: 650,
  },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    padding: "var(--cell-padding)",
    color: "var(--muted)",
    borderBottom: "1px solid var(--rule)",
    fontSize: 12,
    fontWeight: 600,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "var(--cell-padding)",
    borderBottom: "1px solid #30353a",
    verticalAlign: "middle",
  },
  iconLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  details: {
    padding: "7px 0",
    border: 0,
    borderBottom: "1px solid var(--rule)",
    borderRadius: 0,
    background: "transparent",
  },
  detailsSummary: {
    color: "var(--bright)",
    fontWeight: 700,
    cursor: "pointer",
  },
  callout: {
    padding: "9px 11px",
    borderLeft: "3px solid var(--accent)",
    borderRadius: 2,
    background: "var(--medium)",
  },
  error: {
    marginBottom: 12,
    padding: 12,
    color: "var(--bright)",
    border: "1px solid var(--rule)",
    borderLeftWidth: 4,
    borderLeftColor: "var(--danger)",
    borderRadius: 2,
    background: "transparent",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 5px",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--medium)",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(180px, 240px))",
    gap: "8px 24px",
    maxWidth: 520,
  },
  recipeCard: {
    display: "grid",
    gap: "var(--layout-gap)",
    padding: "var(--panel-padding)",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "transparent",
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 6,
  },
  visuallyHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
  pipetteGhost: {
    position: "fixed",
    zIndex: 10000,
    width: 36,
    height: 36,
    padding: 2,
    border: "1px solid var(--accent)",
    borderRadius: 6,
    background: "var(--medium)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.65)",
    opacity: 0.88,
    pointerEvents: "none",
  },
  graphWrap: {
    width: "100%",
    minHeight: 500,
    overflow: "auto",
    border: "1px solid var(--rule)",
    borderRadius: 3,
    background: "var(--dark)",
  },
  help: { maxWidth: 900, lineHeight: 1.55 },
  footer: {
    marginTop: 36,
    paddingTop: 12,
    borderTop: "1px solid var(--rule)",
    fontSize: 12,
  },
} satisfies StyleMap

function mergeStyles(...styles: (CSSProperties | false | null | undefined)[]): CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean))
}

function themeVariables(key: string): CSSProperties {
  const scheme = colorSchemes.find((candidate) => candidate.key === key) ?? colorSchemes[0]
  return scheme.variables as CSSProperties
}

function runMutation(specification: FactorySpecification, operation: () => void, recalculate = true): void {
  try {
    operation()
    if (recalculate) specification.updateSolution()
    else specification.display()
  } catch (error) {
    specification.lastError = error
    specification.notifyStateChanged()
  }
}

interface SpriteIconProps {
  readonly icon: Icon
  readonly size?: number
  readonly quality?: Quality | null
  readonly dimmed?: boolean
  readonly title?: string
}

function SpriteIcon({ icon, size = 32, quality = null, dimmed = false, title }: SpriteIconProps) {
  const badgeSize = Math.max(12, Math.round(size / 2))
  return (
    <span
      role="img"
      aria-label={title ?? icon.name}
      title={title ?? icon.name}
      style={{
        position: "relative",
        display: "inline-flex",
        flex: "0 0 auto",
        verticalAlign: "middle",
        opacity: dimmed ? 0.35 : 1,
      }}
    >
      <span aria-hidden="true" style={icon.style(size)} />
      {quality !== null && quality.level > 0 ? (
        <span
          title={`${quality.name} quality`}
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            filter: "drop-shadow(0 1px 1px var(--dark))",
            ...quality.icon.style(badgeSize),
          }}
        />
      ) : null}
    </span>
  )
}

interface IconLabelProps {
  readonly icon: Icon
  readonly name: string
  readonly quality?: Quality | null
  readonly dimmed?: boolean
  readonly size?: number
}

function IconLabel({ icon, name, quality = null, dimmed = false, size = 28 }: IconLabelProps) {
  return (
    <span style={UI.iconLabel}>
      <SpriteIcon icon={icon} size={size} quality={quality} dimmed={dimmed} title={name} />
      <span>{name}</span>
    </span>
  )
}

function UiGlyph({
  name,
  size = 18,
  rotate = 0,
}: {
  readonly name: "popout" | "right" | "rightarrow"
  readonly size?: number
  readonly rotate?: number
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={name === "popout" ? "0 0 24 24" : "0 0 18 16"}
      width={size}
      height={size}
      style={{
        display: "block",
        transform: rotate === 0 ? undefined : `rotate(${rotate}deg)`,
      }}
    >
      <use href={`images/icons.svg#${name}`} />
    </svg>
  )
}

function EmptyModuleIcon({ size = 32 }: { readonly size?: number }) {
  const emptySlot = sprites.get("slot_icon_module")?.icon
  return emptySlot === undefined ? (
    <span aria-hidden="true" style={{ fontSize: Math.round(size * 0.65), lineHeight: 1 }}>
      □
    </span>
  ) : (
    <SpriteIcon icon={emptySlot} size={size} title="Empty module slot" />
  )
}

interface CompactIconSelectOption {
  readonly value: string
  readonly label: string
}

function CompactIconSelect({
  label,
  value,
  icon,
  quality = null,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: string
  readonly icon: Icon | null
  readonly quality?: Quality | null
  readonly options: readonly CompactIconSelectOption[]
  readonly onChange: (value: string) => void
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? label
  return (
    <span
      className="compact-icon-select"
      title={`${label}: ${selectedLabel}`}
      style={{
        position: "relative",
        display: "inline-grid",
        width: 36,
        height: 36,
        verticalAlign: "middle",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          border: "1px solid var(--rule)",
          borderRadius: 2,
          background: "transparent",
        }}
      >
        {icon === null ? (
          <EmptyModuleIcon />
        ) : (
          <SpriteIcon icon={icon} quality={quality} size={32} title={selectedLabel} />
        )}
      </span>
      <select
        aria-label={label}
        value={value}
        title={`${label}: ${selectedLabel}`}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}

function IconChoice({
  group,
  value,
  label,
  icon,
  checked,
  type = "radio",
  onChange,
}: {
  readonly group: string
  readonly value: string
  readonly label: string
  readonly icon: Icon
  readonly checked: boolean
  readonly type?: "radio" | "checkbox"
  readonly onChange: (checked: boolean) => void
}) {
  return (
    <label
      className="icon-choice"
      title={label}
      style={{
        position: "relative",
        display: "inline-grid",
        width: 40,
        height: 40,
        justifyItems: "center",
        alignItems: "start",
        cursor: "pointer",
      }}
    >
      <input
        type={type}
        name={group}
        value={value}
        aria-label={label}
        checked={checked}
        style={UI.visuallyHidden}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          border: "1px solid var(--foreground)",
          borderRadius: 2,
          background: checked ? "var(--accent)" : "var(--light)",
        }}
      >
        <SpriteIcon icon={icon} size={32} title={label} />
      </span>
    </label>
  )
}

interface CommitInputProps {
  readonly value: string
  readonly onCommit: (value: string) => void
  readonly ariaLabel: string
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly inputMode?: "decimal" | "numeric" | "text"
  readonly style?: CSSProperties
}

function CommitInput({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  disabled = false,
  inputMode = "decimal",
  style,
}: CommitInputProps) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      inputMode={inputMode}
      placeholder={placeholder}
      value={draft}
      style={mergeStyles(UI.control, style)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

interface FieldProps {
  readonly label: ReactNode
  readonly children: ReactNode
  readonly style?: CSSProperties
  readonly className?: string
}

function Field({ label, children, style, className }: FieldProps) {
  return (
    <label className={className} style={mergeStyles(UI.field, style)}>
      <span style={UI.label}>{label}</span>
      {children}
    </label>
  )
}

function sortedByName<T extends { readonly name: string }>(values: Iterable<T>): T[] {
  return [...values].sort((a, b) => a.name.localeCompare(b.name))
}

function qualityName(level: number): string {
  return QUALITY_TIERS[level] ?? `Quality ${level}`
}

function formatPower(specification: FactorySpecification, value: Rational): string {
  if (value.isZero()) return "0 W"
  const { power, suffix } = powerRepresentation(value)
  return `${specification.format.count(power)} ${suffix}`
}

function formatPercent(value: Rational, precision = 1): string {
  return `${formatCanadianNumber(value.mul(Rational.from_integer(100)).toDecimal(precision))}%`
}

interface CalculatorViewProps {
  readonly snapshot: CalculatorSnapshot
  readonly commands: CalculatorCommands
}

function LocationSelector({ specification }: { readonly specification: FactorySpecification }) {
  if (specification.planets === null || specification.planets.size <= 1) return null
  const locations = [...specification.planets.values()].sort((a, b) => a.order.localeCompare(b.order))
  return (
    <div
      className="location-selector"
      aria-label="Production locations"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        alignItems: "center",
        gap: "1.6px 5.6px",
      }}
    >
      <span
        style={{
          ...UI.label,
          gridRow: "1 / 3",
          alignSelf: "center",
          fontSize: 11.52,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Locations
      </span>
      <div style={{ ...UI.row, gridColumn: 2, gap: 1, padding: 1 }}>
        {locations.map((location) => {
          const selected = specification.selectedPlanets.has(location)
          return (
            <button
              key={location.key}
              type="button"
              aria-pressed={selected}
              style={mergeStyles(
                UI.button,
                {
                  height: 28,
                  minHeight: 28,
                  padding: "1px 5px",
                  fontSize: "12.6px",
                  borderColor: "transparent",
                  background: "transparent",
                },
                selected && {
                  borderColor: "var(--accent)",
                  color: "var(--bright)",
                  background: "rgba(233, 121, 36, 0.09)",
                },
              )}
              onClick={(event) => {
                runMutation(specification, () => {
                  if (event.shiftKey) {
                    if (selected && specification.selectedPlanets.size > 1) specification.unselectPlanet(location)
                    else specification.selectPlanet(location)
                  } else {
                    specification.selectOnePlanet(location)
                  }
                  for (const target of specification.buildTargets) target.refreshRecipes()
                })
              }}
            >
              <IconLabel icon={location.icon} name={location.name} size={24} />
            </button>
          )
        })}
      </div>
      <span style={{ ...UI.muted, gridColumn: 2, fontSize: 11.52 }}>Shift-click to combine</span>
    </div>
  )
}

function TargetItemPicker({
  specification,
  target,
  quality,
}: {
  readonly specification: FactorySpecification
  readonly target: BuildTarget
  readonly quality: Quality | null
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const trigger = useRef<HTMLButtonElement>(null)
  const pickerKey = `target-output:${target.index}`
  const panelId = `target-output-picker-${target.index}`
  const close = (restoreFocus = false) => {
    setOpen(false)
    setSearch("")
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus())
  }
  const groupedItems = open
    ? specification.itemGroups
        .map((group) =>
          group
            .map((subgroup) => subgroup.filter((item) => item.phase !== "abstract" && itemMatchesSearch(item, search)))
            .filter((subgroup) => subgroup.length > 0),
        )
        .filter((group) => group.length > 0)
    : []
  const matchingItems = groupedItems.flat(2)
  const choose = (item: Item) => {
    close()
    if (item !== target.item) runMutation(specification, () => target.setItem(item))
  }

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const element =
        event.target instanceof Element ? event.target.closest<HTMLElement>("[data-target-item-picker]") : null
      if (element?.dataset.targetItemPicker !== pickerKey) close()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true)
    }
    window.addEventListener("pointerdown", closeOnOutsidePointer, true)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [open, pickerKey])

  return (
    <div
      data-target-item-picker={pickerKey}
      style={{
        position: "relative",
        display: "block",
        width: 217,
        height: 40,
        zIndex: open ? 60 : undefined,
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose output for target ${target.index + 1}: ${target.item.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title={`Output: ${target.item.name}`}
        style={{
          ...UI.control,
          display: "flex",
          alignItems: "center",
          gap: 5,
          height: 40,
          padding: "3px 7px 3px 3px",
          cursor: "pointer",
          textAlign: "left",
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <SpriteIcon icon={target.item.icon} size={32} quality={quality} title={target.item.name} />
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {target.item.name}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="target-item-picker-panel"
          role="dialog"
          aria-label={`Choose output for target ${target.index + 1}`}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 70,
            display: "grid",
            gridTemplateRows: "32px minmax(0, 1fr)",
            gap: 4,
            width: 380,
            height: 400,
            maxWidth: "calc(100vw - 20px)",
            maxHeight: "min(400px, calc(100vh - 24px))",
            padding: 5,
            border: "1px solid var(--light)",
            borderTop: "2px solid var(--accent)",
            borderRadius: 2,
            background: "var(--dark)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.62)",
          }}
        >
          <input
            autoFocus
            aria-label="Search target outputs"
            value={search}
            placeholder="Search"
            style={{ ...UI.control, minHeight: 32, padding: "3px 7px" }}
            onChange={(event) => setSearch(event.currentTarget.value)}
            onKeyDown={(event) => {
              const first = matchingItems[0]
              if (event.key === "Enter" && first !== undefined) {
                event.preventDefault()
                choose(first)
              }
            }}
          />
          <div
            style={{
              minHeight: 0,
              overflowY: "auto",
              scrollbarGutter: "stable",
            }}
          >
            {groupedItems.map((group, groupIndex) => (
              <div key={groupIndex} style={groupIndex === 0 ? undefined : { marginTop: 3 }}>
                {group.map((subgroup, subgroupIndex) => (
                  <div
                    key={subgroupIndex}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 2,
                      minHeight: 34,
                    }}
                  >
                    {subgroup.map((item) => {
                      const selected = item === target.item
                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-label={`Select ${item.name} as output`}
                          aria-pressed={selected}
                          title={item.name}
                          style={{
                            display: "grid",
                            placeItems: "center",
                            width: 32,
                            height: 32,
                            padding: 0,
                            border: `1px solid ${selected ? "var(--accent)" : "transparent"}`,
                            borderRadius: 2,
                            background: selected ? "var(--light)" : "transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => choose(item)}
                        >
                          <SpriteIcon icon={item.icon} size={32} title={item.name} />
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
            {matchingItems.length === 0 ? (
              <div role="status" style={{ ...UI.muted, padding: "8px 3px" }}>
                No items match your search.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TargetRow({ target, snapshot }: { readonly target: BuildTarget; readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const availableRecipes = target.getAvailableRecipes()
  const qualities = specification.getAvailableQualities()
  const rateUnit = specification.format.longRate
  const targetRateUnit = rateUnit === "minute" ? "min" : rateUnit

  return (
    <li
      className="target-grid"
      style={{
        ...UI.targetGrid,
        minHeight: 40,
        listStyle: "none",
        margin: "0.7px 0 0",
      }}
    >
      <button
        type="button"
        aria-label={`Remove ${target.item.name} target`}
        title="Remove target"
        style={UI.dangerButton}
        onClick={() => runMutation(specification, () => specification.removeTarget(target))}
      >
        ×
      </button>

      <div className="target-output" style={{ ...UI.field, width: 217, height: 40 }}>
        <span style={UI.label}>Output</span>
        <TargetItemPicker
          specification={specification}
          target={target}
          quality={qualities[target.qualityLevel] ?? null}
        />
      </div>

      <Field label="Quality" className="target-quality">
        <select
          aria-label={`Quality for ${target.item.name}`}
          value={target.qualityLevel}
          style={{ ...UI.control, height: 30, minHeight: 30 }}
          onChange={(event) => handleTargetQualityChange(specification, target, Number(event.currentTarget.value))}
        >
          {qualities.map((quality, index) => (
            <option key={quality.key} value={index}>
              {quality.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Machines" className="target-machines">
        <CommitInput
          key={`machines-${snapshot.revision}-${target.getDisplayedBuildings()}`}
          ariaLabel={`Machine count for ${target.item.name}`}
          value={target.getDisplayedBuildings()}
          disabled={target.recipe === null || target.qualityLevel > 0}
          style={{ height: 29, minHeight: 29, textAlign: "right" }}
          onCommit={(value) => runMutation(specification, () => target.setBuildings(value, target.recipe))}
        />
      </Field>

      <Field label={`Rate/${targetRateUnit}`} className="target-rate">
        <CommitInput
          key={`rate-${snapshot.revision}-${target.getDisplayedRate()}`}
          ariaLabel={`Rate for ${target.item.name}`}
          value={target.getDisplayedRate()}
          style={{ height: 29, minHeight: 29, textAlign: "right" }}
          onCommit={(value) => runMutation(specification, () => target.setRate(value))}
        />
      </Field>

      {target.item.phase === "solid" ? (
        <Field label="Belts" className="target-belts">
          <span
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 3,
            }}
          >
            <CommitInput
              key={`belts-${snapshot.revision}-${target.getDisplayedBelts()}`}
              ariaLabel={`Belt count for ${target.item.name}`}
              value={target.getDisplayedBelts()}
              style={{ height: 29, minHeight: 29, textAlign: "right" }}
              onCommit={(value) => runMutation(specification, () => target.setBelts(value))}
            />
            <span
              style={{
                ...UI.muted,
                fontFamily: "monospace",
                whiteSpace: "nowrap",
              }}
            >
              {target.getBeltStackHeight()}
            </span>
          </span>
        </Field>
      ) : (
        <span />
      )}

      {availableRecipes.length === 0 && target.compatibleLocations.length > 0 ? (
        <div className="target-warning" style={{ ...UI.callout, gridColumn: "2 / -1" }}>
          <div>No selected location can produce {target.item.name}.</div>
          <button
            type="button"
            style={{ ...UI.button, marginTop: 7 }}
            onClick={() => runMutation(specification, () => target.enableCompatibleLocations())}
          >
            Enable {target.compatibleLocations.map((location) => location.name).join(" + ")}
          </button>
        </div>
      ) : null}
    </li>
  )
}

function TargetsPanel({ snapshot, commands }: CalculatorViewProps) {
  const specification = snapshot.specification
  return (
    <section aria-labelledby="targets-title">
      <strong
        id="targets-title"
        style={{
          color: "var(--bright)",
          fontSize: 12,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Production targets
      </strong>
      <div className="target-header" style={{ ...UI.targetGrid, marginTop: 5 }} aria-hidden="true">
        <span />
        <span style={UI.label}>Output</span>
        <span style={UI.label}>Quality</span>
        <span style={UI.label}>Machines</span>
        <span style={UI.label}>
          Rate/
          {specification.format.longRate === "minute" ? "min" : specification.format.longRate}
        </span>
        <span style={UI.label}>Belts</span>
      </div>
      <ul id="targets" style={{ margin: 0, padding: 0 }}>
        {specification.buildTargets.map((target) => (
          <TargetRow key={`${target.index}-${target.item.key}`} target={target} snapshot={snapshot} />
        ))}
      </ul>
      <button
        type="button"
        style={{ ...UI.button, width: 103, margin: "2.3px 0 6.4px 40px" }}
        disabled={snapshot.status === "loading"}
        onClick={() => commands.addTarget()}
      >
        + Add target
      </button>

      <div
        className="planner-toolbar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 13.3px",
          padding: "4.8px 0",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <LocationSelector specification={specification} />
        <Field
          label="Preset"
          style={{
            width: 220,
            gridTemplateColumns: "auto 158px",
            alignItems: "center",
            gap: 8,
            paddingLeft: 12,
            borderLeft: "1px solid var(--rule)",
          }}
        >
          <select
            aria-label="Apply preset"
            defaultValue=""
            style={{
              ...UI.control,
              width: 158,
              minHeight: 30,
              fontSize: 13.75,
            }}
            onChange={(event) => {
              const value = event.currentTarget.value
              if (isProgressionPreset(value)) commands.applyProgressionPreset(value)
              else if (isQualityPreset(value)) commands.applyQualityPreset(value)
              event.currentTarget.value = ""
            }}
          >
            <option value="">Custom</option>
            <option value="early">Early game</option>
            <option value="pre-rocket">Pre-rocket</option>
            <option value="first-planets">Early Space Age</option>
            <option value="late-space-age">Late Space Age</option>
            <option value="full-legendary" disabled={specification.getAvailableQualities().length < 5}>
              Full Legendary
            </option>
          </select>
        </Field>
        <div className="planner-actions" style={{ ...UI.row, marginLeft: "auto" }}>
          <span role="status" aria-live="polite" style={UI.muted}>
            {snapshot.shareStatus}
          </span>
          <button type="button" style={UI.button} onClick={() => void commands.copyShareLink()}>
            Copy plan link
          </button>
        </div>
      </div>
    </section>
  )
}

function TabBar({ snapshot, commands }: CalculatorViewProps) {
  const tabs: readonly [CalculatorTab, string][] = [
    ["totals", "Factory"],
    ["graph", "Visualize"],
    ["resources", "Resources"],
    ["settings", "Settings"],
    ["help", "Help"],
  ]
  return (
    <nav className="tabs" style={UI.tabs} aria-label="Calculator sections">
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          aria-current={snapshot.activeTab === tab ? "page" : undefined}
          style={mergeStyles(UI.tab, snapshot.activeTab === tab && UI.activeTab)}
          onClick={() => commands.selectTab(tab)}
        >
          {label}
        </button>
      ))}
      {snapshot.activeTab === "totals" ? (
        <fieldset
          className="density-switch"
          aria-label="Factory row density"
          style={{
            ...UI.row,
            gap: 0,
            margin: "0 0 0 auto",
            padding: 0,
            border: 0,
            fontSize: 11,
          }}
        >
          <legend style={UI.visuallyHidden}>Factory row density</legend>
          <span style={{ ...UI.muted, marginRight: 5 }}>Rows</span>
          {(
            [
              ["comfortable", "Relaxed"],
              ["compact", "Compact"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="factory-density"
                value={value}
                checked={snapshot.factoryDensity === value}
                onChange={() => commands.setFactoryDensity(value)}
              />
              <span
                style={{
                  display: "inline-block",
                  padding: "3.2px 6px",
                  borderBottom: "1px solid transparent",
                }}
              >
                {label}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </nav>
  )
}

function SummaryCard({
  label,
  value,
  note,
}: {
  readonly label: string
  readonly value: string
  readonly note?: string
}) {
  return (
    <div style={UI.summaryCard}>
      <div style={UI.summaryValue}>{value}</div>
      <div>{label}</div>
      {note === undefined ? null : <div style={UI.muted}>{note}</div>}
    </div>
  )
}

function FactorySummaryView({
  specification,
  totals,
}: {
  readonly specification: FactorySpecification
  readonly totals: Totals
}) {
  const summary = getFactorySummary(specification, totals)
  return (
    <section
      className="factory-summary"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: 28,
        margin: "4px 0 10px",
      }}
      aria-label="Factory summary"
    >
      <div className="factory-summary-card" style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
        <span style={UI.summaryValue}>{formatCanadianNumber(String(summary.recipeCount))}</span>
        <span style={UI.muted}>Active recipes</span>
      </div>
      <div className="factory-summary-card" style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
        <span style={UI.summaryValue}>{specification.format.count(summary.placedMachines)}</span>
        <span style={UI.muted}>Machines to place</span>
      </div>
      <div className="factory-summary-card" style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
        <span style={UI.summaryValue}>
          {formatPower(specification, summary.electricalPower.add(summary.planning.beaconPower))}
        </span>
        <span style={UI.muted}>Electric + beacon power</span>
      </div>
      <div className="factory-summary-card" style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
        <span style={UI.summaryValue}>{specification.format.count(summary.planning.pollution)}</span>
        <span style={UI.muted}>Pollution / min</span>
      </div>
      {[...summary.fuelRates].map(([fuel, rate]) => (
        <div
          key={fuel.key}
          className="factory-summary-card"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span style={UI.summaryValue}>{specification.format.rate(rate)}</span>
          <span
            style={{
              ...UI.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <SpriteIcon icon={fuel.icon} size={18} /> {fuel.name} / {specification.format.longRate}
          </span>
        </div>
      ))}
      {summary.importedItems.length > 0 ? (
        <div style={{ ...UI.row, flexBasis: "100%" }}>
          <span style={UI.label}>Imported</span>
          {summary.importedItems.map((item) => (
            <span key={item.key} style={UI.chip}>
              <SpriteIcon icon={item.icon} size={20} /> {item.name}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function RecipeIconPicker({
  specification,
  item,
  activeRecipe,
}: {
  readonly specification: FactorySpecification
  readonly item: Item
  readonly activeRecipe: Recipe
}) {
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({
    top: 8,
    left: 8,
    width: 392,
    maxHeight: 308,
  })
  const recipes = getItemProductionRecipes(item)
  const groups = getRecipeSelectorGroups(recipes, activeRecipe)

  const updatePosition = () => {
    const anchor = trigger.current
    if (anchor === null) return
    const viewportPadding = 8
    const gap = 6
    const bounds = anchor.getBoundingClientRect()
    const width = Math.min(392, Math.max(0, window.innerWidth - viewportPadding * 2))
    const maxHeight = Math.min(308, Math.max(0, window.innerHeight - viewportPadding * 2))
    const preferredLeft = bounds.right + gap
    const left =
      preferredLeft + width <= window.innerWidth - viewportPadding
        ? preferredLeft
        : Math.max(viewportPadding, bounds.left - width - gap)
    const top = Math.min(
      Math.max(viewportPadding, bounds.top - 5),
      Math.max(viewportPadding, window.innerHeight - maxHeight - viewportPadding),
    )
    setPosition({ top, left, width, maxHeight })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !root.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      requestAnimationFrame(() => trigger.current?.focus())
    }
    window.addEventListener("pointerdown", closeOnOutsidePointer, true)
    window.addEventListener("keydown", closeOnEscape)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true)
      window.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open])

  if (recipes.length === 0) return <SpriteIcon icon={item.icon} size={32} title={item.name} />

  return (
    <div ref={root} className="icon-picker" data-open={open} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Enable or disable recipes for ${item.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Enable or disable recipes for ${item.name}`}
        style={{
          display: "block",
          width: 32,
          height: 32,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
        }}
        onClick={() => {
          if (!open) updatePosition()
          setOpen((current) => !current)
        }}
      >
        <SpriteIcon icon={item.icon} size={32} title={item.name} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`Recipes for ${item.name}`}
          style={{
            position: "fixed",
            zIndex: 100,
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            overflow: "auto",
            padding: 7,
            color: "var(--foreground)",
            border: "1px solid var(--rule)",
            borderTop: "2px solid var(--accent)",
            borderRadius: 2,
            background: "var(--dark)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.55)",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 5,
              color: "var(--bright)",
            }}
          >
            Recipes for {item.name}
          </strong>
          {groups.map((group, groupIndex) => (
            <section
              key={group.key}
              style={
                groupIndex === 0
                  ? undefined
                  : {
                      marginTop: 7,
                      paddingTop: 7,
                      borderTop: "1px solid var(--light)",
                    }
              }
            >
              <div
                style={{
                  ...UI.label,
                  margin: "1px 0 3px 4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.035em",
                }}
              >
                {group.name}
              </div>
              <div>
                {group.recipes.map((recipe) => {
                  const enabled = !specification.disable.has(recipe)
                  const recipeDetails: string[] = []
                  if (!recipe.time.isZero()) recipeDetails.push(`${formatCanadianNumber(recipe.time.toDecimal())} s`)
                  if (specification.selectedPlanets.size > 0) {
                    const count = getRecipeLocations(specification, recipe, specification.getBuilding(recipe)).length
                    recipeDetails.push(`${count} selected location${count === 1 ? "" : "s"}`)
                  }
                  const label = recipeDetails.length > 0 ? `${recipe.name} — ${recipeDetails.join(", ")}` : recipe.name
                  return (
                    <label
                      key={recipe.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "18px 32px minmax(0, 1fr)",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 4px",
                        borderRadius: 4,
                        color: recipe === activeRecipe ? "var(--bright)" : undefined,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        style={{ accentColor: "var(--accent)" }}
                        onChange={(event) =>
                          runMutation(specification, () =>
                            setRecipeEnabled(specification, recipe, event.currentTarget.checked),
                          )
                        }
                      />
                      <SpriteIcon icon={recipe.icon} size={32} title={recipe.name} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface ItemBreakdownRow {
  readonly item: Item
  readonly recipe: Recipe
  readonly rate: Rational
  readonly building: Building | null
  readonly count: Rational | null
  readonly percent: string | null
  readonly divider: boolean
}

function getItemBreakdown(specification: FactorySpecification, item: Item, totals: Totals): ItemBreakdownRow[] {
  const rows: ItemBreakdownRow[] = []
  let foundIngredient = false
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
          building = specification.getBuilding(producer)
          count = specification.getCount(producer, recipeRate)
        }
      }
      rows.push({
        item: ingredient.item,
        recipe,
        rate,
        building,
        count,
        percent: null,
        divider: false,
      })
      foundIngredient = true
    }
  }

  const producers = totals.producers.get(item)
  const singleProducer = producers?.size === 1 ? producers.keys().next().value : undefined
  const singleRecipe = singleProducer instanceof Recipe ? singleProducer : null
  const amount = singleRecipe?.gives(item) ?? null
  const building = singleRecipe === null ? null : specification.getBuilding(singleRecipe)
  const consumers = totals.consumers.get(item)
  const itemTotal = totals.items.get(item)
  if (consumers === undefined || itemTotal === undefined || itemTotal.isZero()) return rows
  const hundred = Rational.from_integer(100)
  for (const [consumer, rate] of consumers) {
    if (!(consumer instanceof Recipe)) continue
    const count =
      singleRecipe === null || amount === null ? null : specification.getCount(singleRecipe, rate.div(amount))
    const percent = rate.div(itemTotal).mul(hundred)
    const percentText = percent.less(one) ? "<1%" : `${formatCanadianNumber(percent.toDecimal(0))}%`
    rows.push({
      item,
      recipe: consumer,
      rate,
      building,
      count,
      percent: percentText,
      divider: foundIngredient,
    })
    foundIngredient = false
  }
  return rows
}

function ItemBreakdown({
  specification,
  item,
  totals,
}: {
  readonly specification: FactorySpecification
  readonly item: Item
  readonly totals: Totals
}) {
  const rows = getItemBreakdown(specification, item, totals)
  const belt = specification.belt
  const pipe = specification.items.get("pipe")
  return (
    <table
      aria-label={`${item.name} production breakdown`}
      style={{
        width: "auto",
        borderCollapse: "collapse",
        borderLeft: "2px solid var(--rule)",
        borderRight: "2px solid var(--rule)",
        lineHeight: 0,
      }}
    >
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.recipe.key}-${row.item.key}-${index}`}>
            <td
              style={{
                width: 85,
                padding: "2px 1px",
                borderTop: row.divider ? "1px solid var(--rule)" : undefined,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0,
                  verticalAlign: "middle",
                }}
              >
                <SpriteIcon icon={row.recipe.icon} size={32} title={row.recipe.name} />
                <UiGlyph name="rightarrow" size={18} rotate={180} />
                <SpriteIcon icon={row.item.icon} size={32} title={row.item.name} />
              </span>
            </td>
            <td
              style={{
                width: 54,
                minWidth: 54,
                padding: "2px 6px",
                borderTop: row.divider ? "1px solid var(--rule)" : undefined,
                textAlign: "right",
                fontFamily: "monospace",
              }}
            >
              <span style={{ display: "inline-block", lineHeight: 1.42 }}>{specification.format.rate(row.rate)}</span>
            </td>
            <td
              style={{
                width: 78,
                minWidth: 78,
                padding: "2px 3px",
                borderTop: row.divider ? "1px solid var(--rule)" : undefined,
              }}
            >
              {row.item.phase === "solid" && belt !== null ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                    lineHeight: 1.42,
                  }}
                >
                  <SpriteIcon icon={belt.icon} size={32} title={belt.name} /> ×
                  <span style={{ fontFamily: "monospace" }}>
                    {specification.format.count(specification.getBeltCount(row.item, row.rate))}
                  </span>
                </span>
              ) : pipe === undefined ? null : (
                <SpriteIcon icon={pipe.icon} size={32} title={pipe.name} />
              )}
            </td>
            <td
              style={{
                width: 77,
                minWidth: 77,
                padding: "2px 3px",
                borderTop: row.divider ? "1px solid var(--rule)" : undefined,
              }}
            >
              {row.building === null || row.count === null ? null : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                    lineHeight: 1.42,
                  }}
                >
                  <SpriteIcon icon={row.building.icon} size={32} title={row.building.name} /> ×
                  <span style={{ fontFamily: "monospace" }}>{specification.format.count(row.count)}</span>
                </span>
              )}
            </td>
            <td
              style={{
                width: 33,
                minWidth: 33,
                padding: "2px 0",
                borderTop: row.divider ? "1px solid var(--rule)" : undefined,
                textAlign: "right",
                fontFamily: "monospace",
              }}
            >
              <span style={{ display: "inline-block", lineHeight: 1.42 }}>{row.percent}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ItemTable({
  specification,
  totals,
  pipette,
}: {
  readonly specification: FactorySpecification
  readonly totals: Totals
  readonly pipette: ModulePipetteController
}) {
  const [expandedItems, setExpandedItems] = useState<ReadonlySet<string>>(() => new Set())
  const [openEquipmentPicker, setOpenEquipmentPicker] = useState<string | null>(null)
  const showLocations = specification.selectedPlanets.size > 1
  const items = new Map<Item, Rational>()
  for (const [solverItem, rate] of totals.items) if (solverItem instanceof Item) items.set(solverItem, rate)
  for (const [solverItem, rate] of totals.products)
    if (solverItem instanceof Item && !items.has(solverItem)) items.set(solverItem, rate)
  const recipeGroups = topoSort(getRecipeGroups(new Set([...totals.rates.keys()].filter(isFactoryRecipe).reverse())))
  const rows: {
    readonly key: string
    readonly item: Item | null
    readonly factoryRecipe: FactoryRecipe | null
  }[] = []
  recipeGroups.forEach((group, groupIndex) => {
    const groupItems = new Set<Item>()
    for (const recipe of group) {
      for (const product of recipe.products) {
        if (product.item instanceof Item && items.has(product.item)) groupItems.add(product.item)
      }
    }
    if (groupItems.size === 0) return
    const claimedItems = new Set<Item>()
    let index = 0
    for (const factoryRecipe of group) {
      const primaryProduct = factoryRecipe.products[0]?.item
      const item =
        primaryProduct instanceof Item && groupItems.has(primaryProduct) && !claimedItems.has(primaryProduct)
          ? primaryProduct
          : null
      if (item !== null) claimedItems.add(item)
      rows.push({
        key: `${groupIndex}-${index}-${item?.key ?? factoryRecipe?.key ?? "row"}`,
        item,
        factoryRecipe,
      })
      index++
    }
    for (const item of groupItems) {
      if (claimedItems.has(item)) continue
      rows.push({
        key: `${groupIndex}-${index}-${item.key}`,
        item,
        factoryRecipe: null,
      })
      index++
    }
  })

  const toggleExpanded = (key: string) => {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleEquipmentPicker = (key: string) => {
    setOpenEquipmentPicker((current) => (current === key ? null : key))
  }

  const closeEquipmentPicker = (key: string) => {
    setOpenEquipmentPicker(null)
    requestAnimationFrame(() => document.getElementById(equipmentPickerTriggerId(key))?.focus())
  }

  useEffect(() => {
    if (openEquipmentPicker === null) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      const picker = target instanceof Element ? target.closest<HTMLElement>("[data-inline-equipment-picker]") : null
      if (picker?.dataset.inlineEquipmentPicker !== openEquipmentPicker) setOpenEquipmentPicker(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEquipmentPicker(openEquipmentPicker)
    }
    window.addEventListener("pointerdown", closeOnOutsidePointer, true)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [openEquipmentPicker])

  return (
    <div className="factory-table-scroll" style={UI.tableWrap}>
      <table className="factory-table" style={{ ...UI.table, minWidth: showLocations ? 1088 : 936 }}>
        <thead>
          <tr>
            <th style={{ ...UI.th, width: 24 }} />
            <th style={{ ...UI.th, width: 284, paddingLeft: 0 }}>Item</th>
            <th style={{ ...UI.th, width: 83, textAlign: "right" }}>Rate / {specification.format.rateName}</th>
            <th style={{ ...UI.th, width: 214, textAlign: "right" }}>
              <span
                style={{
                  display: "inline-flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 5,
                }}
              >
                {specification.belt === null ? null : (
                  <SpriteIcon icon={specification.belt.icon} size={18} title={specification.belt.name} />
                )}
                Belts
              </span>
            </th>
            <th className="factory-machine" style={{ ...UI.th, width: 181, textAlign: "center" }}>
              Machines
            </th>
            {showLocations ? (
              <th className="factory-location" style={{ ...UI.th, width: 172 }}>
                Location
              </th>
            ) : null}
            <th className="factory-modules" style={{ ...UI.th, width: 170 }}>
              Modules
            </th>
            <th className="factory-beacons" style={{ ...UI.th, width: 231 }}>
              Beacons
            </th>
            <th className="factory-power" style={{ ...UI.th, width: 152, textAlign: "right" }}>
              Power
            </th>
            <th className="factory-action" style={{ ...UI.th, width: 46 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const item = row.item
            const recipe = row.factoryRecipe instanceof Recipe ? row.factoryRecipe : null
            const rate = item === null ? zero : (items.get(item) ?? zero)
            const imported = item !== null && specification.ignore.has(item)
            const belts =
              item !== null && item.phase === "solid" && specification.belt !== null
                ? specification.getBeltCount(item, rate)
                : null
            const recipeRate = recipe === null ? zero : (totals.rates.get(recipe) ?? zero)
            const building = recipe === null ? null : specification.getBuilding(recipe)
            const machineQuality =
              recipe === null ? specification.getNormalQuality() : specification.getMachineQuality(recipe)
            const count = recipe === null || building === null ? zero : specification.getCount(recipe, recipeRate)
            const moduleSpec = recipe === null ? null : specification.getModuleSpec(recipe)
            const power = recipe === null ? null : specification.getPowerUsage(recipe, recipeRate)
            const expanded = item !== null && expandedItems.has(item.key)
            const target = item !== null && specification.buildTargets.some((candidate) => candidate.item === item)
            return (
              <Fragment key={row.key}>
                <tr
                  className={target ? "target-output-row" : undefined}
                  data-item-key={item?.key}
                  data-recipe-key={recipe?.key}
                >
                  <td style={{ ...UI.td, paddingLeft: 0, paddingRight: 0 }}>
                    {item === null ? null : (
                      <button
                        type="button"
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${item.name}`}
                        aria-expanded={expanded}
                        style={{
                          ...UI.button,
                          display: "grid",
                          placeItems: "center",
                          minHeight: 26,
                          width: 24,
                          padding: 0,
                          color: "var(--foreground)",
                          border: 0,
                          background: "transparent",
                        }}
                        onClick={() => toggleExpanded(item.key)}
                      >
                        <UiGlyph name="right" size={16} rotate={expanded ? 90 : 0} />
                      </button>
                    )}
                  </td>
                  <td style={{ ...UI.td, paddingLeft: 3 }}>
                    {item === null ? null : (
                      <button
                        type="button"
                        title={imported ? "Produce this item in the factory" : "Treat this item as imported"}
                        style={mergeStyles(UI.button, {
                          width: "100%",
                          minHeight: 32,
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          justifyContent: "flex-start",
                          textAlign: "left",
                        })}
                        onClick={() => runMutation(specification, () => specification.toggleIgnore(item))}
                      >
                        <span
                          className="item-name"
                          style={{
                            position: "relative",
                            display: "inline-flex",
                            fontWeight: 600,
                          }}
                        >
                          <IconLabel icon={item.icon} name={item.name} dimmed={imported} size={32} />
                          {target ? (
                            <span
                              style={{
                                position: "absolute",
                                top: 20,
                                left: 39,
                                color: "var(--accent)",
                                fontSize: 10,
                                lineHeight: 1.2,
                                textTransform: "uppercase",
                              }}
                            >
                              Target
                            </span>
                          ) : null}
                        </span>
                      </button>
                    )}
                  </td>
                  <td
                    style={{
                      ...UI.td,
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {item === null ? null : specification.format.rate(rate)}
                  </td>
                  <td style={UI.td}>
                    {item === null || belts === null ? (
                      <span style={UI.muted}>{item === null || item.phase === "fluid" ? "" : "—"}</span>
                    ) : (
                      <div
                        className="belt-controls"
                        style={{
                          ...UI.row,
                          gap: 4,
                          justifyContent: "flex-end",
                        }}
                      >
                        <span style={{ fontFamily: "monospace" }}>{specification.format.count(belts)}</span>
                        <select
                          aria-label={`Belt stacking for ${item.name}`}
                          value={
                            specification.getBeltStackPolicySource(item) === "default"
                              ? ""
                              : specification.getBeltStackPolicy(item)
                          }
                          style={{
                            ...UI.control,
                            width: 85,
                            minHeight: 28,
                            padding: "2px 4px",
                            fontSize: 12,
                          }}
                          onChange={(event) => {
                            const value = event.currentTarget.value
                            runMutation(specification, () =>
                              specification.setBeltStackOverride(
                                item,
                                value === "" ? null : (value as BeltStackPolicy),
                              ),
                            )
                          }}
                        >
                          <option value="">Default</option>
                          <option value="auto">Auto</option>
                          <option value="stacked">Stacked</option>
                          <option value="unstacked">Unstacked</option>
                        </select>
                        <span style={{ ...UI.muted, fontFamily: "monospace" }}>
                          ×{specification.getEffectiveBeltStackSize(item, recipe).toDecimal()}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="factory-machine" style={UI.td}>
                    {recipe === null || building === null ? null : (
                      <div
                        style={{
                          ...UI.row,
                          position: "relative",
                          left: 20,
                          gap: 4,
                          justifyContent: "center",
                        }}
                      >
                        {item === null ? (
                          <SpriteIcon icon={recipe.icon} size={32} title={recipe.name} />
                        ) : (
                          <RecipeIconPicker specification={specification} item={item} activeRecipe={recipe} />
                        )}
                        <InlineMachinePicker
                          specification={specification}
                          recipe={recipe}
                          building={building}
                          quality={machineQuality}
                          pickerKey={`machine:${recipe.key}`}
                          open={openEquipmentPicker === `machine:${recipe.key}`}
                          onToggle={() => toggleEquipmentPicker(`machine:${recipe.key}`)}
                          onClose={() => closeEquipmentPicker(`machine:${recipe.key}`)}
                        />
                        <CopyFriendlyText>
                          {` Machine: ${qualifiedEquipmentName(building, machineQuality)}. `}
                        </CopyFriendlyText>
                        <span>× {specification.format.count(count)}</span>
                      </div>
                    )}
                  </td>
                  {showLocations ? (
                    <td className="factory-location" style={UI.td}>
                      {recipe === null || !recipe.isReal() ? null : (
                        <InlineLocationSelect specification={specification} recipe={recipe} building={building} />
                      )}
                    </td>
                  ) : null}
                  <td className="factory-modules" style={UI.td}>
                    {recipe === null || building === null || moduleSpec === null ? null : (
                      <div style={{ ...UI.row, gap: 2 }}>
                        <CopyFriendlyText>
                          {`Modules: ${moduleSelectionText(moduleSpec.modules, moduleSpec.moduleQualities, specification.getNormalQuality())}. `}
                        </CopyFriendlyText>
                        {moduleSpec.modules.map((module, index) => (
                          <InlineModulePicker
                            key={index}
                            specification={specification}
                            recipe={recipe}
                            building={building}
                            moduleSpec={moduleSpec}
                            index={index}
                            module={module}
                            quality={moduleSpec.moduleQualities[index] ?? specification.defaultModuleQuality}
                            pipette={pipette}
                            pickerKey={`module:${recipe.key}:${index}`}
                            open={openEquipmentPicker === `module:${recipe.key}:${index}`}
                            onToggle={() => toggleEquipmentPicker(`module:${recipe.key}:${index}`)}
                            onClose={() => closeEquipmentPicker(`module:${recipe.key}:${index}`)}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="factory-beacons" style={UI.td}>
                    {recipe === null || building === null || moduleSpec === null || !building.canBeacon() ? null : (
                      <div style={{ ...UI.row, gap: 2 }}>
                        <CopyFriendlyText>
                          {`Beacons: ${moduleSpec.beaconCount.toString()} ${qualifiedEquipmentName({ name: "beacon" }, moduleSpec.beaconQuality)}; modules: ${moduleSelectionText(moduleSpec.beaconModules, moduleSpec.beaconModuleQualities, specification.getNormalQuality())}. `}
                        </CopyFriendlyText>
                        {moduleSpec.beaconModules.map((module, index) => (
                          <InlineModulePicker
                            key={index}
                            specification={specification}
                            recipe={recipe}
                            building={building}
                            moduleSpec={moduleSpec}
                            index={index}
                            module={module}
                            quality={moduleSpec.beaconModuleQualities[index] ?? specification.defaultModuleQuality}
                            pipette={pipette}
                            beacon
                            pickerKey={`beacon-module:${recipe.key}:${index}`}
                            open={openEquipmentPicker === `beacon-module:${recipe.key}:${index}`}
                            onToggle={() => toggleEquipmentPicker(`beacon-module:${recipe.key}:${index}`)}
                            onClose={() => closeEquipmentPicker(`beacon-module:${recipe.key}:${index}`)}
                          />
                        ))}
                        {specification.getAvailableQualities().length > 1 &&
                        moduleSpec.beaconModules.some((module) => module !== null) ? (
                          <InlineBeaconQualityPicker
                            specification={specification}
                            recipe={recipe}
                            moduleSpec={moduleSpec}
                            pickerKey={`beacon-quality:${recipe.key}`}
                            open={openEquipmentPicker === `beacon-quality:${recipe.key}`}
                            onToggle={() => toggleEquipmentPicker(`beacon-quality:${recipe.key}`)}
                            onClose={() => closeEquipmentPicker(`beacon-quality:${recipe.key}`)}
                          />
                        ) : null}
                        <span>×</span>
                        <CommitInput
                          key={`${recipe.key}-${moduleSpec.beaconCount.toString()}`}
                          ariaLabel={`Beacon count for ${recipe.name}`}
                          value={moduleSpec.beaconCount.toString()}
                          style={{
                            width: 58,
                            minHeight: 28,
                            padding: "2px 4px",
                          }}
                          onCommit={(value) =>
                            runMutation(specification, () => moduleSpec.setBeaconCount(Rational.from_string(value)))
                          }
                        />
                      </div>
                    )}
                  </td>
                  <td
                    className="factory-power"
                    style={{
                      ...UI.td,
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {power === null || power.fuel === null
                      ? null
                      : power.fuel === "electric"
                        ? formatPower(specification, power.power)
                        : (() => {
                            const fuel = recipe === null ? null : specification.getFuelForRecipe(recipe)
                            return fuel === null ? null : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <SpriteIcon icon={fuel.icon} size={24} /> ×{" "}
                                {specification.format.rate(power.power.div(fuel.value))} /
                                {specification.format.rateName}
                              </span>
                            )
                          })()}
                  </td>
                  <td className="factory-action" style={{ ...UI.td, textAlign: "center" }}>
                    {item === null ? null : (
                      <a
                        href={`#${formatSettings(false, null, [[item, rate]], specification)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Add ${item.name} as a production target`}
                        title={`Add ${item.name} as a production target`}
                        style={{
                          ...UI.button,
                          display: "grid",
                          placeItems: "center",
                          minHeight: 28,
                          padding: "0 5px",
                          color: "var(--accent)",
                          opacity: 0.45,
                          border: 0,
                          background: "transparent",
                          textDecoration: "none",
                        }}
                      >
                        <UiGlyph name="popout" size={24} />
                      </a>
                    )}
                  </td>
                </tr>
                {expanded && item !== null ? (
                  <tr>
                    <td
                      colSpan={showLocations ? 10 : 9}
                      style={{
                        ...UI.td,
                        padding: "0 12px 8px 29px",
                        background: "transparent",
                        whiteSpace: "normal",
                      }}
                    >
                      <div
                        style={{
                          ...UI.stack,
                          width: "max-content",
                          maxWidth: "100%",
                        }}
                      >
                        <ItemBreakdown specification={specification} item={item} totals={totals} />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface ModulePipetteSelection {
  readonly module: Module
  readonly quality: Quality
}

interface ModulePipetteController {
  readonly selection: ModulePipetteSelection | null
  readonly sample: (selection: ModulePipetteSelection | null) => void
  readonly setHovered: (selection: ModulePipetteSelection | null | undefined) => void
  readonly setMessage: (message: string) => void
}

function qualifiedModuleName(selection: ModulePipetteSelection, normalQuality: Quality): string {
  return selection.quality === normalQuality
    ? selection.module.name
    : `${selection.quality.name} ${selection.module.name}`
}

function qualifiedEquipmentName(item: { readonly name: string }, quality: Quality): string {
  return `${quality.name} ${item.name}`
}

function moduleSelectionText(
  modules: readonly (Module | null | undefined)[],
  qualities: readonly Quality[],
  normalQuality: Quality,
): string {
  const names = modules.map((module, index) =>
    module === null || module === undefined
      ? "Empty"
      : qualifiedEquipmentName(module, qualities[index] ?? normalQuality),
  )
  return names.length === 0 ? "None" : names.join(", ")
}

function CopyFriendlyText({ children }: { readonly children: ReactNode }) {
  return (
    <span aria-hidden="true" data-copy-text="true" style={UI.visuallyHidden}>
      {children}
    </span>
  )
}

type InlineEquipmentPopoverAlignment = "left" | "machine" | "right"

function equipmentPickerPanelId(pickerKey: string): string {
  return `${pickerKey.replace(/[^a-z0-9_-]/gi, "-")}-picker`
}

function equipmentPickerTriggerId(pickerKey: string): string {
  return `${pickerKey.replace(/[^a-z0-9_-]/gi, "-")}-trigger`
}

function InlineEquipmentPopover({
  pickerKey,
  open,
  label,
  trigger,
  children,
  width,
  align = "left",
}: {
  readonly pickerKey: string
  readonly open: boolean
  readonly label: string
  readonly trigger: ReactNode
  readonly children: ReactNode
  readonly width: number | string
  readonly align?: InlineEquipmentPopoverAlignment
}) {
  const root = useRef<HTMLSpanElement>(null)
  const [panelPosition, setPanelPosition] = useState<CSSProperties | null>(null)

  useEffect(() => {
    if (!open) {
      setPanelPosition(null)
      return
    }
    const updatePosition = () => {
      const rect = root.current?.getBoundingClientRect()
      if (rect === undefined) return
      const spaceAbove = rect.top - 12
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const openAbove = spaceBelow < 430 && spaceAbove > spaceBelow
      setPanelPosition({
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        maxHeight: Math.max(120, Math.min(430, openAbove ? spaceAbove : spaceBelow)),
        ...(align === "right"
          ? { right: Math.max(12, window.innerWidth - rect.right) }
          : align === "machine"
            ? {
                left: rect.left + rect.width / 2,
                transform: "translateX(-30%)",
              }
            : { left: rect.left }),
      })
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [align, open])

  return (
    <span
      ref={root}
      data-inline-equipment-picker={pickerKey}
      style={{
        position: "relative",
        display: "inline-flex",
        zIndex: open ? 40 : undefined,
      }}
    >
      {trigger}
      {open && panelPosition !== null ? (
        <span
          id={equipmentPickerPanelId(pickerKey)}
          role="dialog"
          aria-label={label}
          style={{
            position: "fixed",
            ...panelPosition,
            zIndex: 100,
            display: "grid",
            width,
            maxWidth: "calc(100vw - 24px)",
            padding: 6,
            overflow: "auto",
            color: "var(--foreground)",
            whiteSpace: "normal",
            textAlign: "left",
            border: "1px solid var(--light)",
            borderTop: "2px solid var(--accent)",
            borderRadius: 2,
            background: "var(--dark)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.72)",
          }}
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

function EquipmentQualityStrip({
  qualities,
  selected,
  label,
  onChoose,
}: {
  readonly qualities: readonly Quality[]
  readonly selected: Quality
  readonly label: string
  readonly onChoose: (quality: Quality) => void
}) {
  if (qualities.length <= 1) return null
  return (
    <span
      role="group"
      aria-label={label}
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 6,
        paddingBottom: 6,
        borderBottom: "1px solid var(--rule)",
      }}
    >
      {qualities.map((quality) => {
        const chosen = quality === selected
        return (
          <button
            key={quality.key}
            type="button"
            aria-label={`${quality.name} quality`}
            aria-pressed={chosen}
            title={`${quality.name} quality`}
            style={{
              display: "grid",
              placeItems: "center",
              width: 32,
              height: 32,
              padding: 2,
              border: `1px solid ${chosen ? "var(--accent)" : "var(--light)"}`,
              borderRadius: 3,
              background: chosen ? "var(--light)" : "var(--medium)",
              cursor: "pointer",
            }}
            onClick={() => onChoose(quality)}
          >
            <SpriteIcon icon={quality.icon} size={20} title={`${quality.name} quality`} />
          </button>
        )
      })}
    </span>
  )
}

interface MachinePickerOption {
  readonly building: Building | null
  readonly displayBuilding: Building
  readonly label: string
}

function machinePickerLabel(building: Building): string {
  const details: string[] = []
  if (!building.speed.isZero()) details.push(`speed ${formatCanadianNumber(building.speed.toDecimal())}`)
  details.push(`${building.moduleSlots} module slot${building.moduleSlots === 1 ? "" : "s"}`)
  return `${building.name} — ${details.join(", ")}`
}

function InlineMachinePicker({
  specification,
  recipe,
  building,
  quality,
  pickerKey,
  open,
  onToggle,
  onClose,
}: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly building: Building
  readonly quality: Quality
  readonly pickerKey: string
  readonly open: boolean
  readonly onToggle: () => void
  readonly onClose: () => void
}) {
  const automaticBuilding = specification.getAutomaticBuilding(recipe) ?? building
  const override = specification.getBuildingOverride(recipe)
  const compatibleBuildings = specification.getCompatibleBuildings(recipe, false)
  const qualities = building.supportsEquipmentQuality() ? specification.getAvailableQualities() : []
  const hasQualityChoices = qualities.length > 1
  const hasMachineChoices = compatibleBuildings.length > 1 || override !== null
  if (!hasQualityChoices && !hasMachineChoices) {
    return <SpriteIcon icon={building.icon} size={32} title={building.name} />
  }
  const options: MachinePickerOption[] = [
    {
      building: null,
      displayBuilding: automaticBuilding,
      label: `Automatic (${machinePickerLabel(automaticBuilding)})`,
    },
    ...(hasMachineChoices
      ? compatibleBuildings.map((candidate) => ({
          building: candidate,
          displayBuilding: candidate,
          label: machinePickerLabel(candidate),
        }))
      : []),
  ]
  const selectedLabel = options.find((option) => option.building === override)?.label ?? building.name
  return (
    <InlineEquipmentPopover
      pickerKey={pickerKey}
      open={open}
      label={`Machine and quality for ${recipe.name}`}
      width="max-content"
      align="machine"
      trigger={
        <button
          id={equipmentPickerTriggerId(pickerKey)}
          type="button"
          aria-label={`Choose a machine for ${recipe.name}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={equipmentPickerPanelId(pickerKey)}
          title={`Choose a machine for ${recipe.name}: ${selectedLabel}`}
          style={{
            display: "grid",
            placeItems: "center",
            width: 36,
            height: 36,
            padding: 2,
            border: `1px solid ${open ? "var(--accent)" : "var(--rule)"}`,
            borderRadius: 2,
            background: "transparent",
            cursor: "pointer",
          }}
          onClick={onToggle}
        >
          <SpriteIcon icon={building.icon} quality={quality} size={32} title={building.name} />
        </button>
      }
    >
      <EquipmentQualityStrip
        qualities={qualities}
        selected={quality}
        label={`Machine quality for ${recipe.name}`}
        onChoose={(nextQuality) => {
          runMutation(specification, () => specification.setMachineQuality(recipe, nextQuality))
          onClose()
        }}
      />
      <span style={{ display: "grid", gap: 1 }}>
        {options.map((option) => {
          const chosen = option.building === override
          return (
            <button
              key={option.building?.key ?? "automatic"}
              type="button"
              aria-label={option.label}
              aria-pressed={chosen}
              title={option.label}
              style={{
                display: "flex",
                width: "100%",
                minHeight: 38,
                alignItems: "center",
                gap: 7,
                padding: "2px 6px",
                color: "var(--foreground)",
                border: "1px solid transparent",
                borderRadius: 3,
                background: chosen ? "var(--light)" : "transparent",
                textAlign: "left",
                cursor: "pointer",
              }}
              onClick={() => {
                runMutation(specification, () => specification.setBuildingOverride(recipe, option.building))
                onClose()
              }}
            >
              <SpriteIcon
                icon={option.displayBuilding.icon}
                quality={hasQualityChoices && chosen ? quality : null}
                size={32}
                title={option.displayBuilding.name}
              />
              <span style={{ fontSize: 13, lineHeight: 1.25, whiteSpace: "nowrap" }}>{option.label}</span>
            </button>
          )
        })}
      </span>
    </InlineEquipmentPopover>
  )
}

function InlineLocationSelect({
  specification,
  recipe,
  building,
}: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly building: Building | null
}) {
  const compatible = getRecipeLocations(specification, recipe, building)
  const configured = specification.recipeLocations.get(recipe) ?? null
  const assigned = configured !== null && compatible.includes(configured) ? configured : null
  const automatic = getAssignedLocation(specification, recipe, building)
  return (
    <select
      aria-label={`Choose production location for ${recipe.name}`}
      value={assigned?.key ?? ""}
      title={`Production location for ${recipe.name}`}
      style={{
        ...UI.control,
        minWidth: 146,
        minHeight: 28,
        padding: "2px 5px",
        fontSize: 12,
      }}
      onChange={(event) =>
        runMutation(specification, () => {
          const location =
            event.currentTarget.value === "" ? null : (specification.planets?.get(event.currentTarget.value) ?? null)
          specification.setRecipeLocation(recipe, location)
        })
      }
    >
      <option value="">Automatic ({automatic?.name ?? "unavailable"})</option>
      {compatible.map((location) => (
        <option key={location.key} value={location.key}>
          {location.name}
        </option>
      ))}
    </select>
  )
}

function InlineModulePicker({
  specification,
  recipe,
  building,
  moduleSpec,
  index,
  module,
  quality,
  pipette,
  pickerKey,
  open,
  onToggle,
  onClose,
  beacon = false,
}: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly building: Building
  readonly moduleSpec: ModuleSpec
  readonly index: number
  readonly module: Module | null | undefined
  readonly quality: Quality
  readonly pipette: ModulePipetteController
  readonly pickerKey: string
  readonly open: boolean
  readonly onToggle: () => void
  readonly onClose: () => void
  readonly beacon?: boolean
}) {
  const normalQuality = specification.getNormalQuality()
  const currentSelection = module === null || module === undefined ? null : { module, quality }
  const pipetteName =
    pipette.selection === null ? null : qualifiedModuleName(pipette.selection, specification.getNormalQuality())
  const label = beacon
    ? `${recipe.name} beacon module ${index + 1}`
    : index === 0
      ? `${recipe.name} module 1 — changes matching slots`
      : `${recipe.name} module ${index + 1}`
  const compatibleRows = moduleRows
    .map((row) =>
      row.filter(
        (candidate) => candidate === null || (candidate.canUse(recipe, building) && (!beacon || candidate.canBeacon())),
      ),
    )
    .filter((row) => row.length > 0)
  const compatibleModules = new Set(compatibleRows.flatMap((row) => row.filter((candidate) => candidate !== null)))
  const handleQ = (event: {
    readonly key: string
    readonly repeat: boolean
    readonly altKey: boolean
    readonly ctrlKey: boolean
    readonly metaKey: boolean
    preventDefault(): void
    stopPropagation(): void
  }) => {
    if (event.key.toLowerCase() !== "q" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
    pipette.sample(currentSelection)
  }
  const chooseModule = (nextModule: Module | null) => {
    const modules = beacon ? moduleSpec.beaconModules : moduleSpec.modules
    const oldModule = modules[index]
    const indices = [index]
    if (index === 0) {
      for (let candidateIndex = 1; candidateIndex < modules.length; candidateIndex++) {
        if (modules[candidateIndex] === oldModule) indices.push(candidateIndex)
      }
    }
    runMutation(specification, () => {
      for (const candidateIndex of indices) {
        if (beacon) moduleSpec.setBeaconModule(nextModule, candidateIndex)
        else void moduleSpec.setModule(candidateIndex, nextModule)
      }
    })
    onClose()
  }
  const chooseQuality = (nextQuality: Quality) => {
    const modules = beacon ? moduleSpec.beaconModules : moduleSpec.modules
    const qualities = beacon ? moduleSpec.beaconModuleQualities : moduleSpec.moduleQualities
    const oldModule = modules[index]
    const oldQuality = qualities[index] ?? specification.defaultModuleQuality
    const indices = [index]
    if (index === 0) {
      for (let candidateIndex = 1; candidateIndex < modules.length; candidateIndex++) {
        const candidateQuality = qualities[candidateIndex] ?? specification.defaultModuleQuality
        if (modules[candidateIndex] === oldModule && candidateQuality === oldQuality) indices.push(candidateIndex)
      }
    }
    runMutation(specification, () => {
      for (const candidateIndex of indices) {
        if (beacon) moduleSpec.setBeaconModuleQuality(nextQuality, candidateIndex)
        else void moduleSpec.setModuleQuality(candidateIndex, nextQuality)
      }
    })
    if (module !== null && module !== undefined) onClose()
  }
  const applyPipette = (selection: ModulePipetteSelection) => {
    if (!compatibleModules.has(selection.module)) {
      pipette.setMessage(
        `${qualifiedModuleName(selection, normalQuality)} cannot be used ${beacon ? "in a beacon" : "in this machine"} for ${recipe.name}.`,
      )
      return
    }
    runMutation(specification, () => {
      if (beacon) {
        moduleSpec.setBeaconModule(selection.module, index)
        moduleSpec.setBeaconModuleQuality(selection.quality, index)
      } else {
        void moduleSpec.setModule(index, selection.module)
        void moduleSpec.setModuleQuality(index, selection.quality)
      }
    })
    pipette.setMessage(`Pipette applied to ${label}; click another compatible slot or press Q or Esc to clear.`)
  }
  return (
    <InlineEquipmentPopover
      pickerKey={pickerKey}
      open={open}
      label={`${beacon ? "Beacon module" : "Module"} ${index + 1} and quality for ${recipe.name}`}
      width="max-content"
      align={beacon ? "right" : "left"}
      trigger={
        <button
          id={equipmentPickerTriggerId(pickerKey)}
          type="button"
          data-module-pipette-target="true"
          aria-label={`${label}. ${currentSelection === null ? "Empty" : qualifiedModuleName(currentSelection, normalQuality)}`}
          aria-keyshortcuts="Q"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={equipmentPickerPanelId(pickerKey)}
          title={
            pipetteName === null
              ? `${label}. Press Q to sample; click to choose module and quality.`
              : `Place ${pipetteName}`
          }
          style={{
            display: "grid",
            placeItems: "center",
            width: 36,
            height: 36,
            padding: 2,
            color: "var(--foreground)",
            border: `1px solid ${open ? "var(--accent)" : "var(--rule)"}`,
            borderRadius: 2,
            background: "transparent",
            cursor: pipette.selection === null ? "pointer" : "copy",
          }}
          onPointerEnter={() => pipette.setHovered(currentSelection)}
          onPointerLeave={() => pipette.setHovered(undefined)}
          onFocus={() => pipette.setHovered(currentSelection)}
          onBlur={() => pipette.setHovered(undefined)}
          onKeyDown={handleQ}
          onClick={() => {
            if (pipette.selection === null) onToggle()
            else applyPipette(pipette.selection)
          }}
        >
          {module === null || module === undefined ? (
            <EmptyModuleIcon />
          ) : (
            <SpriteIcon icon={module.icon} quality={quality} size={32} title={module.name} />
          )}
        </button>
      }
    >
      <EquipmentQualityStrip
        qualities={specification.getAvailableQualities()}
        selected={quality}
        label={`${beacon ? "Beacon module" : "Module"} ${index + 1} quality for ${recipe.name}`}
        onChoose={chooseQuality}
      />
      <span style={{ display: "grid", gap: 3 }}>
        {compatibleRows.map((row, rowIndex) => (
          <span key={rowIndex} style={{ display: "flex", gap: 3 }}>
            {row.map((candidate) => {
              const chosen = candidate === module || (candidate === null && (module === null || module === undefined))
              const selection = candidate === null ? null : { module: candidate, quality }
              const name =
                candidate === null
                  ? "Empty module slot"
                  : qualifiedModuleName({ module: candidate, quality }, normalQuality)
              return (
                <button
                  key={candidate?.key ?? "empty"}
                  type="button"
                  aria-label={`${name} for ${label}`}
                  aria-pressed={chosen}
                  title={name}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    padding: 2,
                    border: `1px solid ${chosen ? "var(--accent)" : "var(--light)"}`,
                    borderRadius: 3,
                    background: chosen ? "var(--light)" : "var(--medium)",
                    cursor: "pointer",
                  }}
                  onPointerEnter={() => pipette.setHovered(selection)}
                  onPointerLeave={() => pipette.setHovered(undefined)}
                  onFocus={() => pipette.setHovered(selection)}
                  onBlur={() => pipette.setHovered(undefined)}
                  onClick={() => chooseModule(candidate)}
                >
                  {candidate === null ? (
                    <EmptyModuleIcon />
                  ) : (
                    <SpriteIcon
                      icon={candidate.icon}
                      quality={chosen ? quality : null}
                      size={32}
                      title={candidate.name}
                    />
                  )}
                </button>
              )
            })}
          </span>
        ))}
      </span>
    </InlineEquipmentPopover>
  )
}

function InlineBeaconQualityPicker({
  specification,
  recipe,
  moduleSpec,
  pickerKey,
  open,
  onToggle,
  onClose,
}: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly moduleSpec: ModuleSpec
  readonly pickerKey: string
  readonly open: boolean
  readonly onToggle: () => void
  readonly onClose: () => void
}) {
  const quality = moduleSpec.beaconQuality
  return (
    <InlineEquipmentPopover
      pickerKey={pickerKey}
      open={open}
      label={`Beacon quality for ${recipe.name}`}
      width="max-content"
      align="right"
      trigger={
        <button
          id={equipmentPickerTriggerId(pickerKey)}
          type="button"
          aria-label={`${quality.name} beacon quality for ${recipe.name}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={equipmentPickerPanelId(pickerKey)}
          title={`${quality.name} beacon quality`}
          style={{
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            padding: 2,
            border: `1px solid ${open ? "var(--accent)" : "var(--light)"}`,
            borderRadius: 3,
            background: "var(--medium)",
            cursor: "pointer",
          }}
          onClick={onToggle}
        >
          <SpriteIcon icon={quality.icon} size={20} title={`${quality.name} quality`} />
        </button>
      }
    >
      <EquipmentQualityStrip
        qualities={specification.getAvailableQualities()}
        selected={quality}
        label={`Beacon quality for ${recipe.name}`}
        onChoose={(nextQuality) => {
          runMutation(specification, () => moduleSpec.setBeaconQuality(nextQuality))
          onClose()
        }}
      />
    </InlineEquipmentPopover>
  )
}

function QualifiedAmountList({
  specification,
  values,
}: {
  readonly specification: FactorySpecification
  readonly values: readonly QualifiedItemAmount[]
}) {
  if (values.length === 0) return <span style={UI.muted}>None</span>
  return (
    <div style={UI.row}>
      {values.map((entry) => (
        <span key={`${entry.item.key}-${entry.qualityLevel}`} style={UI.chip}>
          <SpriteIcon
            icon={entry.item.icon}
            size={22}
            quality={specification.getAvailableQualities()[entry.qualityLevel] ?? null}
          />
          {specification.format.rate(entry.amount)} {qualityName(entry.qualityLevel)} {entry.item.name}
        </span>
      ))}
    </div>
  )
}

function QualityPlanView({
  specification,
  plan,
}: {
  readonly specification: FactorySpecification
  readonly plan: QualityTargetPlan
}) {
  const beaconItem = specification.items.get("beacon")
  interface QualityOperationDisplayRow {
    readonly operation: QualityOperationRate
    readonly qualityLevels: readonly number[]
    readonly rate: Rational
    readonly machineCount: Rational
    readonly power: Rational
  }
  const equipmentKey = (operation: QualityOperationRate): string => {
    const configuration = operation.configuration
    return JSON.stringify([
      operation.recipe.key,
      operation.kind,
      configuration.building?.key ?? null,
      configuration.machineQuality.key,
      configuration.modules.map((module) => module?.key ?? null),
      configuration.moduleQualities.map((quality) => quality.key),
      configuration.beaconModules.map((module) => module?.key ?? null),
      configuration.beaconModuleQualities.map((quality) => quality.key),
      configuration.beaconQuality.key,
      configuration.beaconCount.toString(),
    ])
  }
  const displayRows = (() => {
    const rows: QualityOperationDisplayRow[] = []
    const recyclers = new Map<string, number>()
    for (const operation of plan.operations) {
      const row = {
        operation,
        qualityLevels: [operation.qualityLevel],
        rate: operation.rate,
        machineCount: operation.machineCount,
        power: operation.power,
      }
      if (operation.kind !== "recycle") {
        rows.push(row)
        continue
      }
      const key = equipmentKey(operation)
      const existingIndex = recyclers.get(key)
      if (existingIndex === undefined) {
        recyclers.set(key, rows.length)
        rows.push(row)
        continue
      }
      const existing = rows[existingIndex]!
      rows[existingIndex] = {
        ...existing,
        qualityLevels: [...existing.qualityLevels, operation.qualityLevel],
        rate: existing.rate.add(operation.rate),
        machineCount: existing.machineCount.add(operation.machineCount),
        power: existing.power.add(operation.power),
      }
    }
    return rows
  })()
  const operationName = (operation: QualityOperationRate): string =>
    operation.kind === "source"
      ? `${operation.recipe.name} mining · ${operation.sourcePurpose ?? "utility"}`
      : `${operation.kind}: ${operation.recipe.name}`
  const operationQuality = (operation: QualityOperationRate, qualityLevels: readonly number[]): string => {
    const levels = [...new Set(qualityLevels)].sort((left, right) => left - right)
    if (levels.length > 1) {
      const consecutive = levels.every((level, index) => index === 0 || level === levels[index - 1]! + 1)
      return consecutive
        ? `${qualityName(levels[0]!)}–${qualityName(levels.at(-1)!)}`
        : levels.map(qualityName).join(", ")
    }
    const quality = qualityName(operation.qualityLevel)
    const hasSolidOutput = operation.recipe.products.some(({ item }) => isQualifiedSolid(item))
    const hasFluidOutput = operation.recipe.products.some(({ item }) => !isQualifiedSolid(item))
    return operation.qualityLevel > 0 && hasSolidOutput && hasFluidOutput ? `${quality} solid outputs` : quality
  }
  return (
    <details open style={UI.details}>
      <summary style={UI.detailsSummary}>
        {qualityName(plan.qualityLevel)} {plan.item.name} · {plan.planetKey}
      </summary>
      <div style={{ ...UI.stack, marginTop: 9 }}>
        <div style={UI.summary}>
          <SummaryCard
            label="Requested"
            value={`${specification.format.rate(plan.requested)}/${specification.format.longRate}`}
          />
          <SummaryCard label="First-pass chance" value={formatPercent(plan.firstPassChance, 3)} />
          <SummaryCard label="Machine count" value={specification.format.count(plan.totalMachineCount)} />
          <SummaryCard label="Q-module equivalents" value={specification.format.count(plan.totalQualityModules)} />
          <SummaryCard label="Power" value={formatPower(specification, plan.totalPower)} />
          <SummaryCard label="Crafts" value={specification.format.rate(plan.totalCrafts)} />
          <SummaryCard label="Recycles" value={specification.format.rate(plan.totalRecycles)} />
        </div>
        <div>
          <strong>Fresh inputs</strong>
          <QualifiedAmountList specification={specification} values={plan.freshInputs} />
        </div>
        {plan.importedInputs.length > 0 ? (
          <div>
            <strong>Imported inputs</strong>
            <QualifiedAmountList specification={specification} values={plan.importedInputs} />
          </div>
        ) : null}
        <div style={UI.tableWrap}>
          <table style={UI.table}>
            <thead>
              <tr>
                <th style={UI.th}>Operation</th>
                <th style={UI.th}>Quality</th>
                <th style={{ ...UI.th, textAlign: "right" }}>Rate</th>
                <th style={{ ...UI.th, textAlign: "right" }}>Machines</th>
                <th style={{ ...UI.th, textAlign: "right" }}>Power</th>
                <th style={UI.th}>Equipment</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => {
                const operation = row.operation
                return (
                  <tr key={`${operation.recipe.key}-${operation.qualityLevel}-${operation.kind}-${index}`}>
                    <td style={UI.td}>
                      <IconLabel icon={operation.recipe.icon} name={operationName(operation)} size={24} />
                      {operation.selfRecyclingLegendary === undefined ? null : (
                        <div
                          style={{
                            ...UI.muted,
                            marginTop: 3,
                            fontSize: 11.5,
                            lineHeight: 1.35,
                          }}
                        >
                          <div>
                            {formatCanadianNumber(
                              operation.selfRecyclingLegendary.legendaryPerMinutePerMachine.toDecimal(3),
                            )}
                            {" Legendary/min per miner · score "}
                            {formatCanadianNumber(
                              operation.selfRecyclingLegendary.score.mul(Rational.from_integer(100)).toDecimal(1),
                            )}
                          </div>
                          <div>
                            {formatCanadianNumber(
                              operation.selfRecyclingLegendary.outputPerSecondPerMachine.toDecimal(3),
                            )}
                            {"/s × ("}
                            {formatPercent(operation.selfRecyclingLegendary.sourceQualityChance, 3)}
                            {" + "}
                            {formatPercent(operation.selfRecyclingLegendary.recyclerQualityChance, 3)}
                            {" / 3)"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={UI.td}>{operationQuality(operation, row.qualityLevels)}</td>
                    <td style={{ ...UI.td, textAlign: "right" }}>{specification.format.rate(row.rate)}</td>
                    <td style={{ ...UI.td, textAlign: "right" }}>{specification.format.count(row.machineCount)}</td>
                    <td style={{ ...UI.td, textAlign: "right" }}>{formatPower(specification, row.power)}</td>
                    <td style={UI.td}>
                      <div style={UI.row}>
                        <CopyFriendlyText>
                          {`Machine: ${operation.configuration.building === null ? "None" : qualifiedEquipmentName(operation.configuration.building, operation.configuration.machineQuality)}. Modules: ${moduleSelectionText(operation.configuration.modules, operation.configuration.moduleQualities, specification.getNormalQuality())}. Beacons: ${operation.configuration.beaconCount.toString()} ${qualifiedEquipmentName({ name: "beacon" }, operation.configuration.beaconQuality)}; modules: ${moduleSelectionText(operation.configuration.beaconModules, operation.configuration.beaconModuleQualities, specification.getNormalQuality())}. `}
                        </CopyFriendlyText>
                        {operation.configuration.building === null ? null : (
                          <SpriteIcon
                            icon={operation.configuration.building.icon}
                            quality={operation.configuration.machineQuality}
                            size={24}
                            title={operation.configuration.building.name}
                          />
                        )}
                        {operation.configuration.modules.map((module, moduleIndex) =>
                          module === null ? null : (
                            <SpriteIcon
                              key={`${module.key}-${moduleIndex}`}
                              icon={module.icon}
                              quality={operation.configuration.moduleQualities[moduleIndex] ?? null}
                              size={22}
                              title={module.name}
                            />
                          ),
                        )}
                        {!operation.configuration.beaconCount.isZero() &&
                        operation.configuration.beaconModules.some((module) => module !== null) ? (
                          <>
                            <span style={{ ...UI.muted, margin: "0 1px" }}>+</span>
                            {beaconItem === undefined ? (
                              <span style={UI.muted}>{operation.configuration.beaconQuality.name} beacon</span>
                            ) : (
                              <SpriteIcon
                                icon={beaconItem.icon}
                                quality={operation.configuration.beaconQuality}
                                size={22}
                                title={`${operation.configuration.beaconQuality.name} Beacon`}
                              />
                            )}
                            {operation.configuration.beaconModules.map((module, moduleIndex) =>
                              module === null ? null : (
                                <SpriteIcon
                                  key={`beacon-${module.key}-${moduleIndex}`}
                                  icon={module.icon}
                                  quality={operation.configuration.beaconModuleQualities[moduleIndex] ?? null}
                                  size={20}
                                  title={`${module.name} in beacon`}
                                />
                              ),
                            )}
                            <span style={{ ...UI.muted, fontFamily: "monospace" }}>
                              ×{operation.configuration.beaconCount.toDecimal()}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {plan.surplusOutputs.length > 0 ? (
          <div>
            <strong>Surplus outputs</strong>
            <QualifiedAmountList specification={specification} values={plan.surplusOutputs} />
          </div>
        ) : null}
        {plan.warnings.map((warning) => (
          <div key={warning} style={UI.callout}>
            {warning}
          </div>
        ))}
      </div>
    </details>
  )
}

function PlanningDetails({
  specification,
  totals,
}: {
  readonly specification: FactorySpecification
  readonly totals: Totals
}) {
  const planning = getPlanningSummary(specification, totals)
  const hasDetails =
    (specification.selectedPlanets.size > 1 && planning.perLocation.length > 0) ||
    planning.transport.length > 0 ||
    planning.freshness.length > 0 ||
    planning.asteroidConstraints.length > 0 ||
    planning.qualityPlans.length > 0
  if (!hasDetails) return null
  return (
    <section style={{ ...UI.stack, marginTop: 10 }}>
      {planning.qualityPlans.map((plan) => (
        <QualityPlanView
          key={`${plan.item.key}-${plan.qualityLevel}-${plan.planetKey}`}
          specification={specification}
          plan={plan}
        />
      ))}
      <details style={UI.details}>
        <summary style={UI.detailsSummary}>Planning diagnostics</summary>
        <div style={{ ...UI.stack, marginTop: 9 }}>
          <div style={UI.summary}>
            <SummaryCard label="Beacon power" value={formatPower(specification, planning.beaconPower)} />
            <SummaryCard label="Pollution/min" value={specification.format.count(planning.pollution)} />
            <SummaryCard label="Spores/min" value={specification.format.count(planning.spores)} />
            <SummaryCard label="Aquilo heat" value={formatPower(specification, planning.aquiloHeat)} />
          </div>
          {specification.selectedPlanets.size > 1 && planning.perLocation.length > 0 ? (
            <div className="settings-columns" style={UI.twoColumns}>
              {planning.perLocation.map((entry) => (
                <div key={entry.location.key} style={UI.summaryCard}>
                  <IconLabel icon={entry.location.icon} name={entry.location.name} size={24} />
                  <div>{specification.format.count(entry.machines)} machines</div>
                  <div>{formatPower(specification, entry.electricPower.add(entry.beaconPower))}</div>
                </div>
              ))}
            </div>
          ) : null}
          {planning.transport.length > 0 ? (
            <div>
              <strong>Interplanetary flows</strong>
              {planning.transport.map((flow, index) => (
                <div
                  key={`${flow.item.key}-${flow.from.key}-${flow.to.key}-${index}`}
                  style={{ ...UI.row, marginTop: 5 }}
                >
                  <SpriteIcon icon={flow.item.icon} size={22} />
                  {flow.from.name} → {flow.to.name}: {specification.format.rate(flow.rate)}/
                  {specification.format.longRate}
                  {flow.fuel ? " fuel" : ""}
                </div>
              ))}
            </div>
          ) : null}
          {planning.freshness.map((entry) => (
            <div key={entry.item.key} style={entry.expired ? UI.callout : UI.row}>
              <SpriteIcon icon={entry.item.icon} size={22} />
              {entry.item.name}: {formatPercent(entry.remaining)} freshness,{" "}
              {specification.format.rate(entry.effectiveRate)} effective
            </div>
          ))}
          {planning.asteroidConstraints.map((entry) => (
            <div key={entry.item.key} style={entry.exceeded ? UI.callout : UI.row}>
              <SpriteIcon icon={entry.item.icon} size={22} />
              {entry.item.name}: {specification.format.rate(entry.required)} required /{" "}
              {specification.format.rate(entry.limit)} cap
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

function FactoryPanel({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const [pipetteSelection, setPipetteSelection] = useState<ModulePipetteSelection | null>(null)
  const [hoveredPipetteSource, setHoveredPipetteSource] = useState<ModulePipetteSelection | null | undefined>(undefined)
  const [pipetteMessage, setPipetteMessage] = useState("")
  const [pointerPosition, setPointerPosition] = useState({ x: 16, y: 16 })
  const normalQuality = snapshot.specification.getNormalQuality()
  const samplePipette = (selection: ModulePipetteSelection | null) => {
    setPipetteSelection(selection)
    setPipetteMessage(
      selection === null
        ? "Module pipette cleared."
        : `Pipette: ${qualifiedModuleName(selection, normalQuality)}. Click compatible module slots to apply; press Q or Esc to clear.`,
    )
  }
  const pipette: ModulePipetteController = {
    selection: pipetteSelection,
    sample: samplePipette,
    setHovered: setHoveredPipetteSource,
    setMessage: setPipetteMessage,
  }

  useEffect(() => {
    setPipetteSelection(null)
    setHoveredPipetteSource(undefined)
    setPipetteMessage("")
  }, [snapshot.specification])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pipetteSelection !== null) {
        samplePipette(null)
        return
      }
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key.toLowerCase() !== "q"
      ) {
        return
      }
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      samplePipette(hoveredPipetteSource ?? null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hoveredPipetteSource, pipetteSelection, normalQuality])

  if (snapshot.status === "loading") return <div style={UI.panel}>Loading calculator data…</div>
  if (snapshot.status === "error" || snapshot.totals === null) {
    return (
      <div style={UI.error} role="alert">
        <strong>Unable to calculate this factory.</strong>
        <div style={{ marginTop: 6, fontFamily: "monospace" }}>
          {snapshot.errorMessage ?? "Unknown calculation error"}
        </div>
        <div style={{ marginTop: 6 }}>Check targets, selected locations, recipes, and quality settings.</div>
      </div>
    )
  }
  return (
    <div
      id="totals_tab"
      style={UI.stack}
      onPointerMove={
        pipetteSelection === null
          ? undefined
          : (event) => {
              const gap = 12
              const ghostSize = 40
              setPointerPosition({
                x:
                  event.clientX + gap + ghostSize <= window.innerWidth
                    ? event.clientX + gap
                    : Math.max(4, event.clientX - ghostSize),
                y:
                  event.clientY + gap + ghostSize <= window.innerHeight
                    ? event.clientY + gap
                    : Math.max(4, event.clientY - ghostSize),
              })
            }
      }
    >
      <div id="module_pipette_status" role="status" aria-live="polite" style={UI.visuallyHidden}>
        {pipetteMessage}
      </div>
      {pipetteSelection === null ? null : (
        <div
          id="module_pipette_ghost"
          aria-hidden="true"
          style={{
            ...UI.pipetteGhost,
            left: pointerPosition.x,
            top: pointerPosition.y,
          }}
        >
          <SpriteIcon
            icon={pipetteSelection.module.icon}
            quality={pipetteSelection.quality}
            title={qualifiedModuleName(pipetteSelection, normalQuality)}
          />
        </div>
      )}
      <FactorySummaryView specification={snapshot.specification} totals={snapshot.totals} />
      <ItemTable specification={snapshot.specification} totals={snapshot.totals} pipette={pipette} />
      <PlanningDetails specification={snapshot.specification} totals={snapshot.totals} />
    </div>
  )
}

interface GraphNode {
  readonly recipe: FactoryRecipe
  readonly rate: Rational
  readonly column: number
  readonly row: number
}

interface GraphLink {
  readonly key: string
  readonly from: GraphNode
  readonly to: GraphNode
  readonly item: Item
  readonly rate: Rational
  readonly fuel: boolean
}

export function buildDeclarativeGraph(totals: Totals): {
  readonly nodes: GraphNode[]
  readonly links: GraphLink[]
} {
  const rates = [...totals.rates].filter((entry): entry is [FactoryRecipe, Rational] => isFactoryRecipe(entry[0]))
  const recipeSet = new Set(rates.map(([recipe]) => recipe))
  const dependencies = new Map<FactoryRecipe, FactoryRecipe[]>()
  for (const link of totals.proportionate) {
    const from = link.from as FactoryRecipe
    const to = link.to as FactoryRecipe
    if (!recipeSet.has(from) || !recipeSet.has(to)) continue
    const values = dependencies.get(from) ?? []
    if (!values.includes(to)) values.push(to)
    dependencies.set(from, values)
  }
  const depths = new Map<FactoryRecipe, number>()
  const dependencyDepth = (recipe: FactoryRecipe, visiting: ReadonlySet<FactoryRecipe>): number => {
    const cached = depths.get(recipe)
    if (cached !== undefined) return cached
    if (visiting.has(recipe)) return 0
    const nextVisiting = new Set(visiting).add(recipe)
    let depth = 0
    for (const dependency of dependencies.get(recipe) ?? []) {
      depth = Math.max(depth, dependencyDepth(dependency, nextVisiting) + 1)
    }
    depths.set(recipe, depth)
    return depth
  }
  for (const [recipe] of rates) dependencyDepth(recipe, new Set())
  const maximumDepth = Math.max(0, ...depths.values())
  const rowsByColumn = new Map<number, number>()
  const nodes = rates
    .sort(
      ([a], [b]) =>
        maximumDepth - (depths.get(a) ?? 0) - (maximumDepth - (depths.get(b) ?? 0)) || a.name.localeCompare(b.name),
    )
    .map(([recipe, rate]) => {
      const column = maximumDepth - (depths.get(recipe) ?? 0)
      const row = rowsByColumn.get(column) ?? 0
      rowsByColumn.set(column, row + 1)
      return { recipe, rate, column, row }
    })
  const nodeMap = new Map(nodes.map((node) => [node.recipe, node]))
  const links = totals.proportionate.flatMap((link, index): GraphLink[] => {
    if (!(link.item instanceof Item)) return []
    const from = nodeMap.get(link.from as FactoryRecipe)
    const to = nodeMap.get(link.to as FactoryRecipe)
    if (from === undefined || to === undefined) return []
    return [
      {
        key: `${from.recipe.key}-${to.recipe.key}-${link.item.key}-${index}`,
        from,
        to,
        item: link.item,
        rate: link.rate,
        fuel: link.fuel,
      },
    ]
  })
  return { nodes, links }
}

function SvgSprite({
  icon,
  x,
  y,
  size,
}: {
  readonly icon: Icon
  readonly x: number
  readonly y: number
  readonly size: number
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox={`${icon.obj.icon_col * PX_WIDTH} ${icon.obj.icon_row * PX_HEIGHT} ${PX_WIDTH} ${PX_HEIGHT}`}
      aria-hidden="true"
    >
      <image href={`images/sprite-sheet-${sheetHash}.webp`} width={sheetWidth} height={sheetHeight} />
    </svg>
  )
}

function graphColour(key: string, lightness: number): string {
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return `hsl(${hash % 360} 52% ${lightness}%)`
}

function GraphPanel({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const { specification, totals, visualizerType, visualizerRender, visualizerDirection } = snapshot
  const [hovered, setHovered] = useState<FactoryRecipe | null>(null)
  if (totals === null) return <div style={UI.panel}>No graph is available until the calculation succeeds.</div>
  const graph = buildDeclarativeGraph(totals)
  const horizontal = visualizerDirection === "right"
  const nodeWidth = visualizerType === "sankey" ? 92 : 180
  const nodeHeight = visualizerType === "sankey" ? 60 : 58
  const rowGap = 18
  const width = 1390
  const height = 780
  const columns = Math.max(1, ...graph.nodes.map((node) => node.column + 1))
  const nodesPerColumn = new Map<number, number>()
  for (const node of graph.nodes) nodesPerColumn.set(node.column, (nodesPerColumn.get(node.column) ?? 0) + 1)
  const columnStep = columns <= 1 ? 0 : (width - nodeWidth - 40) / (columns - 1)
  const position = (node: GraphNode) => {
    const count = nodesPerColumn.get(node.column) ?? 1
    const centeredRow = node.row - (count - 1) / 2
    return horizontal
      ? {
          x: 20 + node.column * columnStep,
          y: height * 0.34 - nodeHeight / 2 + centeredRow * (nodeHeight + rowGap),
        }
      : {
          x: width / 2 - nodeWidth / 2 + centeredRow * (nodeWidth + rowGap),
          y: 20 + node.column * ((height - nodeHeight - 40) / Math.max(1, columns - 1)),
        }
  }
  const connected = (recipe: FactoryRecipe) =>
    hovered === null ||
    recipe === hovered ||
    graph.links.some(
      (link) =>
        (link.from.recipe === hovered && link.to.recipe === recipe) ||
        (link.to.recipe === hovered && link.from.recipe === recipe),
    )

  return (
    <div id="graph_tab" style={UI.stack}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 30,
          padding: "4px 0 12px",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <fieldset className="density-switch" style={{ ...UI.row, gap: 8, margin: 0, padding: 0, border: 0 }}>
          <legend style={{ ...UI.label, marginBottom: 3, textTransform: "uppercase" }}>View</legend>
          {(
            [
              ["sankey", "Flow"],
              ["boxline", "Recipe graph"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="graph-view"
                value={value}
                checked={visualizerType === value}
                onChange={() =>
                  runMutation(
                    specification,
                    () => {
                      setVisualizerType(value)
                      setVisualizerDirection(getDefaultVisualizerDirection())
                    },
                    false,
                  )
                }
              />
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 5px",
                  borderBottom: "1px solid transparent",
                }}
              >
                {label}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="density-switch" style={{ ...UI.row, gap: 8, margin: 0, padding: 0, border: 0 }}>
          <legend style={{ ...UI.label, marginBottom: 3, textTransform: "uppercase" }}>Viewport</legend>
          {(
            [
              ["zoom", "Zoom & pan"],
              ["fix", "Fit"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="graph-viewport"
                value={value}
                checked={visualizerRender === value}
                onChange={() => runMutation(specification, () => setVisualizerRender(value), false)}
              />
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 5px",
                  borderBottom: "1px solid transparent",
                }}
              >
                {label}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="density-switch" style={{ ...UI.row, gap: 8, margin: 0, padding: 0, border: 0 }}>
          <legend style={{ ...UI.label, marginBottom: 3, textTransform: "uppercase" }}>Direction</legend>
          {(
            [
              ["right", "Left to right"],
              ["down", "Top to bottom"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="graph-direction"
                value={value}
                checked={visualizerDirection === value}
                onChange={() => runMutation(specification, () => setVisualizerDirection(value), false)}
              />
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 5px",
                  borderBottom: "1px solid transparent",
                }}
              >
                {label}
              </span>
            </label>
          ))}
        </fieldset>
        <span style={{ ...UI.muted, marginLeft: "auto" }}>
          {graph.nodes.length} processes · {graph.links.length} flows · Width = rate; fluids use a 10:1 scale. Dashed =
          fuel. Hover = isolate.
        </span>
      </div>
      <div style={{ ...UI.graphWrap, minHeight: height }}>
        <svg
          id="graph"
          role="img"
          aria-label="Factory recipe flow graph"
          viewBox={`0 0 ${width} ${height}`}
          width={visualizerRender === "zoom" ? width : "100%"}
          height={height}
          style={{
            display: "block",
            minWidth: visualizerRender === "zoom" ? width : undefined,
          }}
        >
          <title>Factory recipe flow graph</title>
          {graph.links.map((link) => {
            const from = position(link.from)
            const to = position(link.to)
            const active = hovered === null || link.from.recipe === hovered || link.to.recipe === hovered
            const startX = horizontal ? from.x + nodeWidth : from.x + nodeWidth / 2
            const startY = horizontal ? from.y + nodeHeight / 2 : from.y + nodeHeight
            const endX = horizontal ? to.x : to.x + nodeWidth / 2
            const endY = horizontal ? to.y + nodeHeight / 2 : to.y
            const path = horizontal
              ? `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`
              : `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`
            const scaledRate =
              link.rate.mul(specification.format.rateFactor).toFloat() / (link.item.phase === "fluid" ? 10 : 1)
            const widthValue = visualizerType === "sankey" ? Math.max(2, Math.min(48, Math.sqrt(scaledRate) * 5)) : 2
            return (
              <path
                key={link.key}
                d={path}
                fill="none"
                stroke={active ? graphColour(link.item.key, 43) : "var(--light)"}
                strokeOpacity={active ? 0.5 : 0.1}
                strokeWidth={widthValue}
                strokeDasharray={link.fuel ? "8 5" : undefined}
              >
                <title>{`${link.item.name}: ${specification.format.rate(link.rate)}/${specification.format.longRate}`}</title>
              </path>
            )
          })}
          {graph.nodes.map((node) => {
            const point = position(node)
            const active = connected(node.recipe)
            const building = node.recipe instanceof Recipe ? specification.getBuilding(node.recipe) : null
            const machineQuality =
              node.recipe instanceof Recipe
                ? specification.getMachineQuality(node.recipe)
                : specification.getNormalQuality()
            const product = node.recipe.products.find((candidate) => candidate.item instanceof Item)?.item
            const fill = product instanceof Item ? graphColour(product.key, 27) : "var(--medium)"
            return (
              <g
                key={node.recipe.key}
                transform={`translate(${point.x} ${point.y})`}
                opacity={active ? 1 : 0.22}
                onMouseEnter={() => setHovered(node.recipe)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                <rect
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={visualizerType === "sankey" ? 0 : 3}
                  fill={fill}
                  stroke={hovered === node.recipe ? "var(--accent)" : "var(--rule)"}
                  strokeWidth={hovered === node.recipe ? 2 : 1}
                />
                <SvgSprite icon={node.recipe.icon} x={6} y={14} size={30} />
                {building === null ? null : <SvgSprite icon={building.icon} x={38} y={14} size={30} />}
                {visualizerType === "boxline" ? (
                  <text x={74} y={24} fill="var(--bright)" fontSize={12}>
                    {node.recipe.name.length > 17 ? `${node.recipe.name.slice(0, 16)}…` : node.recipe.name}
                  </text>
                ) : null}
                <text
                  x={visualizerType === "sankey" ? 70 : 74}
                  y={visualizerType === "sankey" ? 34 : 43}
                  fill="var(--bright)"
                  fontSize={visualizerType === "sankey" ? 9 : 11}
                  fontFamily="monospace"
                >
                  {building === null || !(node.recipe instanceof Recipe)
                    ? specification.format.rate(node.rate)
                    : `× ${specification.format.count(specification.getCount(node.recipe, node.rate))}`}
                </text>
                {machineQuality.level > 0 ? <circle cx={66} cy={43} r={4} fill={machineQuality.color} /> : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function PriorityPanel({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const priorities = specification.priority.priorities
  const moveResource = (resourceKey: string, levelIndex: number) => {
    const resource = priorities
      .flatMap((level) => level.resources)
      .find((candidate) => candidate.recipe.key === resourceKey)
    if (resource === undefined) return
    runMutation(specification, () => {
      let targetLevel = priorities[levelIndex]
      if (targetLevel === undefined) targetLevel = specification.priority.addPriorityBefore(null)
      specification.priority.setPriority(resource, targetLevel)
    })
  }
  return (
    <div id="resources_tab">
      <p style={{ maxWidth: 370, margin: "18px 0 14px" }}>
        Drag resources between tiers to choose what your factory should conserve. Higher tiers are preferred.
      </p>
      <div
        style={{
          width: "min(100%, 720px)",
          border: "1px solid var(--rule)",
          background: "var(--dark)",
        }}
      >
        <div
          style={{
            padding: "2px 4px",
            color: "var(--foreground)",
            background: "var(--rule)",
          }}
        >
          less valuable
        </div>
        {priorities.map((level, levelIndex) => (
          <div
            key={levelIndex}
            aria-label={`Priority tier ${levelIndex + 1}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, 65px)",
              gap: 5,
              minHeight: 92,
              padding: 5,
              borderTop: levelIndex === 0 ? 0 : "10px solid var(--rule)",
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              moveResource(event.dataTransfer.getData("text/plain"), levelIndex)
            }}
          >
            {level.resources.map((resource) => (
              <div
                key={resource.recipe.key}
                draggable
                title={`${resource.recipe.name}. Drag to another tier.`}
                style={{
                  position: "relative",
                  display: "grid",
                  gap: 3,
                  width: 65,
                }}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", resource.recipe.key)}
              >
                <span style={{ display: "grid", placeItems: "center", height: 48 }}>
                  <SpriteIcon icon={resource.recipe.icon} size={48} title={resource.recipe.name} />
                </span>
                <select
                  aria-label={`Priority tier for ${resource.recipe.name}`}
                  value={levelIndex}
                  title={`Priority tier for ${resource.recipe.name}`}
                  style={{
                    position: "absolute",
                    inset: "0 0 auto",
                    width: 65,
                    height: 48,
                    opacity: 0,
                    cursor: "grab",
                  }}
                  onChange={(event) => moveResource(resource.recipe.key, Number(event.currentTarget.value))}
                >
                  {priorities.map((_, index) => (
                    <option key={index} value={index}>
                      Tier {index + 1}
                    </option>
                  ))}
                  <option value={priorities.length}>New lowest tier</option>
                </select>
                <CommitInput
                  key={`${snapshot.revision}-${resource.weight.toString()}`}
                  ariaLabel={`Weight for ${resource.recipe.name}`}
                  value={resource.weight.toString()}
                  style={{ minHeight: 30, padding: "3px 4px" }}
                  onCommit={(value) =>
                    runMutation(specification, () =>
                      specification.priority.setWeight(resource, Rational.from_string(value)),
                    )
                  }
                />
              </div>
            ))}
          </div>
        ))}
        <div
          style={{
            padding: "2px 4px",
            color: "var(--foreground)",
            background: "var(--rule)",
          }}
        >
          more valuable
        </div>
      </div>
      <button
        type="button"
        style={{ ...UI.button, marginTop: 10 }}
        onClick={() => runMutation(specification, () => specification.setDefaultPriority())}
      >
        Restore defaults
      </button>
    </div>
  )
}

function SettingSection({
  title,
  children,
  wide = false,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly wide?: boolean
}) {
  return (
    <section
      style={{
        width: wide ? "min(90rem, 100%)" : "min(65rem, 100%)",
        maxWidth: "100%",
        marginTop: 25,
      }}
    >
      <h3
        style={{
          margin: "0 0 13px",
          paddingBottom: 6,
          color: "var(--bright)",
          borderBottom: "1px solid var(--rule)",
          fontSize: 13,
        }}
      >
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  children,
  style,
}: {
  readonly label: ReactNode
  readonly children: ReactNode
  readonly style?: CSSProperties
}) {
  return (
    <div
      className="settings-row"
      style={mergeStyles(
        {
          display: "grid",
          gap: 5,
          width: "min(30rem, 100%)",
          marginBottom: 15,
        },
        style,
      )}
    >
      <div style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}

function SettingsPair({ children }: { readonly children: ReactNode }) {
  return (
    <div
      className="settings-columns"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 15rem))",
        gap: "0 24px",
        maxWidth: 504,
      }}
    >
      {children}
    </div>
  )
}

const compactSettingControl: CSSProperties = {
  ...UI.control,
  width: "auto",
  minWidth: 122,
  minHeight: 30,
  padding: 3.5,
}

function GeneralSettings({ snapshot, commands }: CalculatorViewProps) {
  const specification = snapshot.specification
  return (
    <Fragment>
      <SettingSection title="Data">
        <SettingsRow label="Use recipe set" style={{ width: 240 }}>
          <select
            value={snapshot.datasetKey}
            aria-label="Recipe set"
            style={{ ...compactSettingControl, maxWidth: 240 }}
            onChange={(event) => commands.setDataset(event.currentTarget.value)}
          >
            {[...MODIFICATIONS].map(([key, modification]) => (
              <option key={key} value={key}>
                {modification.name}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingSection>
      <SettingSection title="Display">
        <SettingsRow label="Title" style={{ width: 232 }}>
          <CommitInput
            key={snapshot.title}
            value={snapshot.title === "Factorio Calculator" ? "" : snapshot.title}
            ariaLabel="Plan title"
            placeholder="Factorio Calculator"
            inputMode="text"
            style={{ width: 232 }}
            onCommit={(value) => runMutation(specification, () => setTitle(value), false)}
          />
        </SettingsRow>
        <SettingsRow label="Display rates as">
          <fieldset
            style={{
              display: "grid",
              gap: 2,
              margin: 0,
              padding: 0,
              border: 0,
            }}
          >
            {(
              [
                ["s", "items/second"],
                ["m", "items/minute"],
                ["h", "items/hour"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} style={{ display: "inline-flex", alignItems: "center" }}>
                <input
                  type="radio"
                  name="display-rate"
                  value={value}
                  aria-label={label}
                  checked={specification.format.rateName === value}
                  onChange={() =>
                    runMutation(
                      specification,
                      () => {
                        specification.format.setDisplayRate(value)
                      },
                      false,
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        </SettingsRow>
        <SettingsPair>
          <SettingsRow label="Rate precision" style={{ width: 240 }}>
            <CommitInput
              key={specification.format.ratePrecision}
              value={String(specification.format.ratePrecision)}
              ariaLabel="Rate precision"
              inputMode="numeric"
              style={{ width: 56 }}
              onCommit={(value) => {
                const precision = Number(value)
                if (Number.isInteger(precision) && precision >= 0) {
                  runMutation(
                    specification,
                    () => {
                      specification.format.ratePrecision = precision
                    },
                    false,
                  )
                }
              }}
            />
          </SettingsRow>
          <SettingsRow label="Count precision" style={{ width: 240 }}>
            <CommitInput
              key={specification.format.countPrecision}
              value={String(specification.format.countPrecision)}
              ariaLabel="Count precision"
              inputMode="numeric"
              style={{ width: 56 }}
              onCommit={(value) => {
                const precision = Number(value)
                if (Number.isInteger(precision) && precision >= 0) {
                  runMutation(
                    specification,
                    () => {
                      specification.format.countPrecision = precision
                    },
                    false,
                  )
                }
              }}
            />
          </SettingsRow>
        </SettingsPair>
        <SettingsRow label="Format values as">
          <fieldset
            style={{
              display: "grid",
              gap: 2,
              margin: 0,
              padding: 0,
              border: 0,
            }}
          >
            {(
              [
                ["decimal", "Decimals"],
                ["rational", "Rationals"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} style={{ display: "inline-flex", alignItems: "center" }}>
                <input
                  type="radio"
                  name="number-format"
                  value={value}
                  checked={specification.format.displayFormat === value}
                  onChange={() =>
                    runMutation(
                      specification,
                      () => {
                        specification.format.displayFormat = value
                      },
                      false,
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        </SettingsRow>
        <SettingsRow label="Color scheme" style={{ width: 150 }}>
          <select
            value={snapshot.colorSchemeKey}
            aria-label="Color scheme"
            style={compactSettingControl}
            onChange={(event) => runMutation(specification, () => setColorScheme(event.currentTarget.value), false)}
          >
            {colorSchemes.map((scheme) => (
              <option key={scheme.key} value={scheme.key}>
                {scheme.name}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingSection>
    </Fragment>
  )
}

function LogisticsSettings({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const fuels = specification.fuels === null ? [] : [...specification.fuels.values()]
  return (
    <SettingSection title="Factory">
      <SettingsRow label="Belt">
        <div style={{ ...UI.row, gap: 0 }}>
          {[...specification.belts.values()].map((belt) => (
            <IconChoice
              key={belt.key}
              group="preferred-belt"
              value={belt.key}
              label={belt.name}
              icon={belt.icon}
              checked={specification.belt === belt}
              onChange={(checked) => {
                if (!checked) return
                runMutation(specification, () => {
                  specification.belt = belt
                })
              }}
            />
          ))}
        </div>
      </SettingsRow>
      <SettingsRow label="Maximum belt stack" style={{ width: 504, minHeight: 75 }}>
        <select
          aria-label="Maximum belt stack"
          value={specification.beltStackSize.toString()}
          style={compactSettingControl}
          onChange={(event) =>
            applyPlanningSetting(specification, {
              id: "belt_stack_size",
              value: event.currentTarget.value,
            })
          }
        >
          <option value="1">×1 — No belt stacking</option>
          <option value="2">×2 — Stack inserter research</option>
          <option value="3">×3 — Belt capacity 1</option>
          <option value="4">×4 — Belt capacity 2</option>
        </select>
        <div style={UI.muted}>Research sets the maximum; items still need a stacking source.</div>
      </SettingsRow>
      <SettingsRow label="Default item stacking" style={{ width: 240, minHeight: 94 }}>
        <select
          aria-label="Default item stacking"
          value={specification.beltStackDefaultPolicy}
          style={compactSettingControl}
          onChange={(event) =>
            applyPlanningSetting(specification, {
              id: "belt_stack_default_policy",
              value: event.currentTarget.value,
            })
          }
        >
          <option value="auto">Auto — direct output only</option>
          <option value="stacked">Stacked — use maximum</option>
          <option value="unstacked">Unstacked — use ×1</option>
        </select>
        <div style={{ ...UI.muted, maxWidth: 230 }}>
          Auto detects big drills. Override items stacked by inserters or recyclers.
        </div>
      </SettingsRow>
      <SettingsPair>
        <SettingsRow label="Logistics buffer" style={{ width: 205 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CommitInput
              key={specification.bufferMinutes.toString()}
              value={specification.bufferMinutes.toString()}
              ariaLabel="Buffer minutes"
              style={{ width: 168 }}
              onCommit={(value) =>
                applyPlanningSetting(specification, {
                  id: "buffer_minutes",
                  value,
                })
              }
            />
            minutes
          </span>
        </SettingsRow>
        <SettingsRow label="Freshness delay" style={{ width: 205 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CommitInput
              key={specification.freshnessDelayMinutes.toString()}
              value={specification.freshnessDelayMinutes.toString()}
              ariaLabel="Freshness delay"
              style={{ width: 168 }}
              onCommit={(value) =>
                applyPlanningSetting(specification, {
                  id: "freshness_delay",
                  value,
                })
              }
            />
            minutes
          </span>
        </SettingsRow>
      </SettingsPair>
      <SettingsRow label="Quality progression" style={{ width: 200 }}>
        <select
          aria-label="Quality progression"
          value={specification.maxQualityLevel}
          style={compactSettingControl}
          onChange={(event) =>
            applyPlanningSetting(specification, {
              id: "max_quality",
              value: event.currentTarget.value,
            })
          }
        >
          {specification.qualityTiers.map((quality, index) =>
            index === 1 ? null : (
              <option key={quality.key} value={index}>
                {quality.name} {index === 0 ? "only" : "unlocked"}
              </option>
            ),
          )}
        </select>
      </SettingsRow>
      <ResourceYieldSettings snapshot={snapshot} />
      <SettingsRow label="Preferred fuel" style={{ width: 504 }}>
        <div style={{ ...UI.row, gap: 0 }}>
          {fuels.map((fuel) => (
            <IconChoice
              key={fuel.key}
              group="preferred-fuel"
              value={fuel.key}
              label={`${fuel.name} · ${fuel.valueString()}`}
              icon={fuel.icon}
              checked={specification.fuel === fuel}
              onChange={(checked) => {
                if (!checked) return
                runMutation(specification, () => {
                  specification.fuel = fuel
                })
              }}
            />
          ))}
        </div>
      </SettingsRow>
      <DefaultEquipmentSettings snapshot={snapshot} plannerSettings={<QualityPlannerSettings snapshot={snapshot} />} />
      <BuildingSettings snapshot={snapshot} />
    </SettingSection>
  )
}

function DefaultEquipmentSettings({
  snapshot,
  plannerSettings,
}: {
  readonly snapshot: CalculatorSnapshot
  readonly plannerSettings: ReactNode
}) {
  const specification = snapshot.specification
  const modules = sortedByName(specification.modules.values())
  const qualities = specification.getAvailableQualities()
  const moduleOptions = [
    { value: "", label: "Empty" },
    ...modules.map((module) => ({ value: module.key, label: module.name })),
  ]
  const beaconOptions = [
    { value: "", label: "Empty" },
    ...modules.filter((module) => module.canBeacon()).map((module) => ({ value: module.key, label: module.name })),
  ]
  const setDefaultModule = (value: string, secondary = false) => {
    const module = specification.modules.get(value) ?? null
    runMutation(specification, () =>
      secondary ? specification.setSecondaryDefaultModule(module) : specification.setDefaultModule(module),
    )
  }
  return (
    <Fragment>
      {qualities.length <= 1 ? null : (
        <SettingsRow label="Equipment quality defaults" style={{ width: 520 }}>
          <div style={{ ...UI.row, alignItems: "flex-end", gap: 12 }}>
            <label
              style={{
                display: "inline-grid",
                gridTemplateColumns: "auto 104px",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={UI.muted}>Machine</span>
              <select
                aria-label="Default machine quality"
                value={specification.defaultMachineQuality.key}
                style={{
                  ...compactSettingControl,
                  width: 104,
                  minWidth: 104,
                  minHeight: 26,
                  height: 26,
                  padding: 0,
                  fontSize: 12.5,
                }}
                onChange={(event) => {
                  const quality = specification.qualities.get(event.currentTarget.value)
                  if (quality !== undefined)
                    runMutation(specification, () => specification.setDefaultMachineQuality(quality))
                }}
              >
                {qualities.map((quality) => (
                  <option key={quality.key} value={quality.key}>
                    {quality.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "inline-grid",
                gridTemplateColumns: "auto 104px",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={UI.muted}>Module</span>
              <select
                aria-label="Default module quality"
                value={specification.defaultModuleQuality.key}
                style={{
                  ...compactSettingControl,
                  width: 104,
                  minWidth: 104,
                  minHeight: 26,
                  height: 26,
                  padding: 0,
                  fontSize: 12.5,
                }}
                onChange={(event) => {
                  const quality = specification.qualities.get(event.currentTarget.value)
                  if (quality !== undefined)
                    runMutation(specification, () => specification.setDefaultModuleQuality(quality))
                }}
              >
                {qualities.map((quality) => (
                  <option key={quality.key} value={quality.key}>
                    {quality.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "inline-grid",
                gridTemplateColumns: "auto 104px",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={UI.muted}>Beacon</span>
              <select
                aria-label="Default beacon quality"
                value={specification.defaultBeaconQuality.key}
                style={{
                  ...compactSettingControl,
                  width: 104,
                  minWidth: 104,
                  minHeight: 26,
                  height: 26,
                  padding: 0,
                  fontSize: 12.5,
                }}
                onChange={(event) => {
                  const quality = specification.qualities.get(event.currentTarget.value)
                  if (quality !== undefined)
                    runMutation(specification, () => specification.setDefaultBeaconQuality(quality))
                }}
              >
                {qualities.map((quality) => (
                  <option key={quality.key} value={quality.key}>
                    {quality.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SettingsRow>
      )}
      {plannerSettings}
      <SettingsRow label="Default module (all eligible slots)" style={{ width: 300 }}>
        <CompactIconSelect
          label="Default module"
          value={specification.defaultModule?.key ?? ""}
          icon={specification.defaultModule?.icon ?? null}
          quality={specification.defaultModuleQuality}
          options={moduleOptions}
          onChange={(value) => setDefaultModule(value)}
        />
      </SettingsRow>
      <SettingsRow label="Secondary default module" style={{ width: 300 }}>
        <CompactIconSelect
          label="Secondary default module"
          value={specification.secondaryDefaultModule?.key ?? ""}
          icon={specification.secondaryDefaultModule?.icon ?? null}
          quality={specification.defaultModuleQuality}
          options={moduleOptions}
          onChange={(value) => setDefaultModule(value, true)}
        />
      </SettingsRow>
      <SettingsRow label="Default beacon" style={{ width: 300 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {specification.defaultBeacon.map((module, index) => (
            <CompactIconSelect
              key={index}
              label={`Default beacon slot ${index + 1}`}
              value={module?.key ?? ""}
              icon={module?.icon ?? null}
              quality={specification.defaultModuleQuality}
              options={beaconOptions}
              onChange={(value) =>
                runMutation(specification, () =>
                  specification.setDefaultBeacon(specification.modules.get(value) ?? null, index),
                )
              }
            />
          ))}
          <span aria-hidden="true">×</span>
          <CommitInput
            key={specification.defaultBeaconCount.toString()}
            value={specification.defaultBeaconCount.toString()}
            ariaLabel="Default beacon count"
            style={{ width: 56, minHeight: 30 }}
            onCommit={(value) =>
              runMutation(specification, () => specification.setDefaultBeaconCount(Rational.from_string(value)))
            }
          />
        </span>
      </SettingsRow>
    </Fragment>
  )
}

function QualityPlannerSettings({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const qualityModules = sortedByName(specification.modules.values()).filter((module) => module.hasQualityEffect())
  const prodModules = sortedByName(specification.modules.values()).filter((module) => module.hasProdEffect())
  const speedModules = sortedByName(specification.modules.values()).filter(
    (module) => module.canBeacon() && zero.less(module.speedFor(specification.getNormalQuality())),
  )
  const qualities = specification.getAvailableQualities()
  const plannerSelectStyle: CSSProperties = {
    ...UI.control,
    width: "auto",
    minWidth: 144,
    minHeight: 26,
    height: 26,
    padding: 0,
    fontSize: 12.5,
  }
  return (
    <SettingsRow label="Quality factory" style={{ width: 520, minHeight: 280 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "end",
          gap: "7px 13px",
          maxWidth: 504,
        }}
      >
        <Field label="Quality module" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory quality module"
            value={specification.qualityPlannerModule?.key ?? ""}
            style={{ ...plannerSelectStyle, width: 203 }}
            onChange={(event) =>
              runMutation(specification, () => {
                specification.qualityPlannerModule = specification.modules.get(event.currentTarget.value) ?? null
              })
            }
          >
            <option value="">Best compatible quality module</option>
            {qualityModules.map((module) => (
              <option key={module.key} value={module.key}>
                {module.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quality module quality" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory quality module quality"
            value={specification.qualityPlannerModuleQuality.key}
            style={{ ...plannerSelectStyle, width: 144 }}
            onChange={(event) => {
              const quality = specification.qualities.get(event.currentTarget.value)
              if (quality !== undefined)
                runMutation(specification, () => {
                  specification.qualityPlannerModuleQuality = quality
                })
            }}
          >
            {qualities.map((quality) => (
              <option key={quality.key} value={quality.key}>
                {quality.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Productivity module" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory productivity module"
            value={specification.qualityPlannerProductivityModule?.key ?? ""}
            style={{ ...plannerSelectStyle, width: 231 }}
            onChange={(event) =>
              runMutation(specification, () => {
                specification.qualityPlannerProductivityModule =
                  specification.modules.get(event.currentTarget.value) ?? null
              })
            }
          >
            <option value="">Best compatible productivity module</option>
            {prodModules.map((module) => (
              <option key={module.key} value={module.key}>
                {module.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Productivity module quality" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory productivity module quality"
            value={specification.qualityPlannerProductivityModuleQuality.key}
            style={{ ...plannerSelectStyle, width: 144 }}
            onChange={(event) => {
              const quality = specification.qualities.get(event.currentTarget.value)
              if (quality !== undefined)
                runMutation(specification, () => {
                  specification.qualityPlannerProductivityModuleQuality = quality
                })
            }}
          >
            {qualities.map((quality) => (
              <option key={quality.key} value={quality.key}>
                {quality.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Speed beacon module" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory speed beacon module"
            value={specification.qualityPlannerMiningModule?.key ?? ""}
            style={{ ...plannerSelectStyle, width: 203 }}
            onChange={(event) =>
              runMutation(specification, () => {
                specification.qualityPlannerMiningModule = specification.modules.get(event.currentTarget.value) ?? null
              })
            }
          >
            <option value="">No speed beacons</option>
            {speedModules.map((module) => (
              <option key={module.key} value={module.key}>
                {module.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Speed module quality" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory speed module quality"
            value={specification.qualityPlannerMiningModuleQuality.key}
            style={{ ...plannerSelectStyle, width: 144 }}
            onChange={(event) => {
              const quality = specification.qualities.get(event.currentTarget.value)
              if (quality !== undefined)
                runMutation(specification, () => {
                  specification.qualityPlannerMiningModuleQuality = quality
                })
            }}
          >
            {qualities.map((quality) => (
              <option key={quality.key} value={quality.key}>
                {quality.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maximum beacon quality" style={{ width: "max-content" }}>
          <select
            aria-label="Quality factory maximum beacon quality"
            value={specification.qualityPlannerMiningBeaconQuality.key}
            style={{ ...plannerSelectStyle, width: 203 }}
            onChange={(event) => {
              const quality = specification.qualities.get(event.currentTarget.value)
              if (quality !== undefined)
                runMutation(specification, () => {
                  specification.qualityPlannerMiningBeaconQuality = quality
                })
            }}
          >
            {qualities.map((quality) => (
              <option key={quality.key} value={quality.key}>
                {quality.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maximum beacons per machine" style={{ width: "max-content" }}>
          <CommitInput
            key={specification.qualityPlannerMiningBeaconCount.toString()}
            value={specification.qualityPlannerMiningBeaconCount.toString()}
            ariaLabel="Quality factory maximum beacon count"
            style={{ ...plannerSelectStyle, width: 144 }}
            onCommit={(value) =>
              runMutation(specification, () => {
                specification.qualityPlannerMiningBeaconCount = Rational.max(zero, Rational.from_string(value || "0"))
              })
            }
          />
        </Field>
      </div>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          marginTop: 8,
        }}
      >
        <span>Optimize quality for</span>
        <select
          aria-label="Quality factory optimization objective"
          value={specification.qualityPlannerObjective}
          style={compactSettingControl}
          onChange={(event) =>
            applyPlanningSetting(specification, {
              id: "quality_planner_objective",
              value: event.currentTarget.value,
            })
          }
        >
          <option value="quality-modules">Fewer quality modules (recommended)</option>
          <option value="materials">Fewer raw resources</option>
          <option value="machines">Fewer machines</option>
          <option value="power">Lower power</option>
        </select>
      </label>
      <div style={{ ...UI.muted, marginTop: 5, maxWidth: 510 }}>
        For self-recycling ores, choose whether to save raw ore or save quality modules. Miners and recyclers are
        optimized together, and speed beacons can be used on either.
      </div>
    </SettingsRow>
  )
}

function BuildingSettings({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const groups = [...new Set(specification.buildings.values())]
    .filter((group) => group.buildings.length > 1)
    .sort((a, b) => (a.getDefault()?.name ?? "").localeCompare(b.getDefault()?.name ?? ""))
  return (
    <SettingsRow label="Machines" style={{ width: 504, minHeight: 184 }}>
      <div style={{ display: "grid", gridAutoRows: 40 }}>
        {groups.map((group, groupIndex) => (
          <span key={groupIndex} style={{ display: "inline-flex", gap: 0 }}>
            {group.buildings.map((building) => (
              <IconChoice
                key={building.key}
                group={`automatic-machine-${groupIndex}`}
                value={building.key}
                label={building.name}
                icon={building.icon}
                checked={group.selectedBuildings.has(building)}
                type="checkbox"
                onChange={(checked) =>
                  runMutation(specification, () => {
                    specification.setAutomaticBuildingEnabled(building, checked)
                  })
                }
              />
            ))}
          </span>
        ))}
      </div>
      <div style={{ ...UI.muted, marginTop: 4, maxWidth: 510 }}>
        Select one or more preferred machines. Automatic uses the fastest compatible selection; choose a machine in a
        Factory row for an exact override.
      </div>
    </SettingsRow>
  )
}

function ProductivityResearchSettings({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const [transferStatus, setTransferStatus] = useState<{
    readonly message: string
    readonly error: boolean
  } | null>(null)
  const miningIcon = specification.items.get("electric-mining-drill") ?? specification.items.get("burner-mining-drill")
  const research = [...specification.recipeProductivityResearch.values()].sort((a, b) => a.name.localeCompare(b.name))

  const copyExportCommand = async () => {
    try {
      await navigator.clipboard.writeText(FACTORIO_PRODUCTIVITY_EXPORT_COMMAND)
      setTransferStatus({ message: "Game command copied.", error: false })
    } catch {
      setTransferStatus({
        message: "Could not copy the game command.",
        error: true,
      })
    }
  }

  const pasteProductivity = async () => {
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      setTransferStatus({
        message: "Clipboard access was not allowed.",
        error: true,
      })
      return
    }

    try {
      const imported = parseFactorioProductivityExport(text)
      let appliedResearches = 0
      runMutation(specification, () => {
        appliedResearches = applyFactorioProductivityExport(specification, imported)
      })
      setTransferStatus({
        message: `Imported mining and ${appliedResearches} recipe productivity values.`,
        error: false,
      })
    } catch (error) {
      setTransferStatus({
        message: error instanceof Error ? error.message : "Could not import productivity.",
        error: true,
      })
    }
  }

  return (
    <SettingSection title="Research">
      <SettingsRow label="Productivity" style={{ width: 504 }}>
        <div style={{ display: "grid", gap: 5.5 }}>
          <label
            style={{
              display: "grid",
              gridTemplateColumns: "26px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 6,
            }}
          >
            {miningIcon === undefined ? (
              <span />
            ) : (
              <SpriteIcon icon={miningIcon.icon} size={24} title="Mining productivity" />
            )}
            <span>Mining productivity</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CommitInput
                key={specification.miningProd.toString()}
                value={specification.miningProd.mul(Rational.from_integer(100)).toString()}
                ariaLabel="Mining productivity bonus percentage"
                inputMode="numeric"
                style={{
                  width: 44,
                  minHeight: 27,
                  height: 27,
                  padding: 0,
                  fontSize: 12.5,
                }}
                onCommit={(value) =>
                  runMutation(specification, () => {
                    specification.miningProd = Rational.from_string(value || "0").div(Rational.from_integer(100))
                  })
                }
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>
          {research.map((entry) => {
            const level = specification.getRecipeProductivityLevel(entry.key)
            return (
              <label
                key={entry.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <SpriteIcon icon={entry.icon} size={24} title={entry.name} />
                <span>{entry.name}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <CommitInput
                    key={`${entry.key}-${level}`}
                    ariaLabel={`${entry.name} bonus percentage`}
                    value={recipeProductivityPercent(entry, level) ?? "0"}
                    inputMode="numeric"
                    style={{
                      width: 44,
                      minHeight: 27,
                      height: 27,
                      padding: 0,
                      fontSize: 12.5,
                    }}
                    onCommit={(value) =>
                      runMutation(specification, () => {
                        specification.setRecipeProductivityLevel(
                          entry.key,
                          recipeProductivityLevelFromPercent(entry, value),
                        )
                      })
                    }
                  />
                  <span aria-hidden="true">%</span>
                </span>
              </label>
            )
          })}
        </div>
        <div style={{ ...UI.muted, marginTop: 5 }}>
          Enter the bonus percentages shown in-game. Recipe productivity is capped at +300% total; mining productivity
          is uncapped.
        </div>
        <div style={{ ...UI.row, marginTop: 7, gap: 6 }}>
          <button
            type="button"
            style={{
              ...UI.button,
              minHeight: 27,
              padding: "3px 8px",
              fontSize: 12,
            }}
            onClick={() => void copyExportCommand()}
          >
            Copy game command
          </button>
          <button
            type="button"
            style={{
              ...UI.button,
              minHeight: 27,
              padding: "3px 8px",
              fontSize: 12,
            }}
            onClick={() => void pasteProductivity()}
          >
            Paste productivity
          </button>
          {transferStatus !== null && (
            <span
              role="status"
              aria-live="polite"
              style={{
                color: transferStatus.error ? "var(--danger)" : "var(--muted)",
              }}
            >
              {transferStatus.message}
            </span>
          )}
        </div>
      </SettingsRow>
    </SettingSection>
  )
}

function RecipeSettings({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const [search, setSearch] = useState("")
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [showChangedOnly, setShowChangedOnly] = useState(false)
  const specification = snapshot.specification
  const allRecipes = getConfigurableRecipes(specification)
  const overrides = specification.getNetDisable()
  const changedRecipes = new Set([...overrides.disable, ...overrides.enable])
  const displayRecipes = allRecipes.filter(
    (recipe) =>
      recipeMatchesSettingsSearch(specification, recipe, search) && (!showChangedOnly || changedRecipes.has(recipe)),
  )
  const recipes = displayRecipes.filter((recipe) => showUnavailable || !isRecipeUnavailable(specification, recipe))
  const productionRecipes = displayRecipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = allRecipes.filter(isRecyclingRecipe)
  const visibleRecyclingRecipes = recipes.filter(isRecyclingRecipe)
  const displayRecyclingRecipes = displayRecipes.filter(isRecyclingRecipe)
  const groups = groupRecipesForSettings(productionRecipes)
  const renderRecipeTile = (recipe: Recipe) => {
    const unavailable = isRecipeUnavailable(specification, recipe)
    const enabled = !specification.disable.has(recipe)
    return (
      <button
        key={recipe.key}
        type="button"
        className="recipe-tile"
        aria-label={`${enabled ? "Disable" : "Enable"} ${recipe.name}`}
        aria-pressed={enabled}
        disabled={unavailable}
        title={`${recipe.name}${unavailable ? " — unavailable at the selected location" : ""}`}
        style={{
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          padding: 2,
          border: `2px solid ${enabled ? "var(--accent)" : "var(--rule)"}`,
          borderRadius: 3,
          background: "var(--dark)",
          cursor: unavailable ? "not-allowed" : "pointer",
        }}
        onClick={() => runMutation(specification, () => setRecipeEnabled(specification, recipe, !enabled))}
      >
        <SpriteIcon icon={recipe.icon} size={32} dimmed={!enabled || unavailable} title={recipe.name} />
      </button>
    )
  }
  return (
    <SettingSection title="Recipes" wide>
      <SettingsRow label="Recipes" style={{ width: "min(90vw, 90rem)", maxWidth: "none" }}>
        <div style={{ ...UI.row, alignItems: "center", gap: 8 }}>
          <input
            aria-label="Search recipes"
            value={search}
            placeholder="Search recipes, items, ingredients, or machines"
            style={{ ...UI.control, flex: "0 1 448px" }}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input
              type="checkbox"
              checked={showUnavailable}
              onChange={(event) => setShowUnavailable(event.currentTarget.checked)}
            />
            Show unavailable recipes
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input
              type="checkbox"
              checked={showChangedOnly}
              onChange={(event) => setShowChangedOnly(event.currentTarget.checked)}
            />
            Changed only
          </label>
          <button
            type="button"
            style={{ ...UI.button, marginLeft: "auto" }}
            disabled={changedRecipes.size === 0}
            onClick={() =>
              runMutation(specification, () => {
                specification.setDefaultDisable()
                syncLocationDisabledRecipes(specification)
              })
            }
          >
            Reset recipe changes
          </button>
        </div>
        <div style={{ ...UI.muted, marginTop: 4 }}>Orange: enabled · Dimmed: disabled · Click to toggle</div>
        <div style={{ ...UI.muted, margin: "3px 0 6px" }} aria-live="polite">
          {recipes.length} {search.trim() === "" ? "recipes" : `matching recipe${recipes.length === 1 ? "" : "s"}`}
        </div>
        <h4 style={{ margin: "0 0 2px", color: "var(--bright)", fontSize: 13 }}>Production recipes</h4>
        {groups.map((group) => (
          <details key={group.name} open style={{ border: 0 }}>
            <summary
              style={{
                ...UI.detailsSummary,
                margin: "5px 0 2px",
                paddingLeft: 14,
                fontSize: 13,
              }}
            >
              {group.name}
            </summary>
            <div style={{ ...UI.row, gap: 4, marginLeft: 2 }}>{group.recipes.map(renderRecipeTile)}</div>
          </details>
        ))}
        {displayRecyclingRecipes.length === 0 ? null : (
          <details style={{ marginTop: 8 }}>
            <summary style={{ ...UI.detailsSummary, fontSize: 13 }}>
              Recycling recipes
              {visibleRecyclingRecipes.length === 0 ? "" : ` (${visibleRecyclingRecipes.length})`}
            </summary>
            <div style={{ marginTop: 7 }}>
              <button
                type="button"
                title="Disable recycling"
                style={{ ...UI.button, marginBottom: 7 }}
                disabled={
                  recyclingRecipes.length === 0 || recyclingRecipes.every((recipe) => specification.disable.has(recipe))
                }
                onClick={(event) => {
                  event.preventDefault()
                  runMutation(specification, () => {
                    for (const recipe of recyclingRecipes) specification.setDisable(recipe)
                  })
                }}
              >
                Disable all recycling recipes
              </button>
              <div style={{ ...UI.row, gap: 4, marginLeft: 2 }}>{displayRecyclingRecipes.map(renderRecipeTile)}</div>
            </div>
          </details>
        )}
        {recipes.length === 0 ? <div style={{ ...UI.muted, marginTop: 8 }}>No recipes match your search.</div> : null}
      </SettingsRow>
    </SettingSection>
  )
}

function ResourceYieldSettings({ snapshot }: { readonly snapshot: CalculatorSnapshot }) {
  const specification = snapshot.specification
  const resources = [...specification.recipes.values()].filter((recipe) => recipe.categories.has("basic-fluid"))
  const asteroidItems = [...specification.items.values()].filter((item) => item.key.endsWith("asteroid-chunk"))
  if (resources.length === 0 && asteroidItems.length === 0) return null
  return (
    <SettingsRow label="Resource assumptions" style={{ width: 504 }}>
      <details style={{ border: "1px solid var(--rule)", padding: "7px 9px" }}>
        <summary style={{ cursor: "pointer", color: "var(--foreground)" }}>Fluid yields and asteroid limits</summary>
        <div style={{ display: "grid", gap: 14, paddingTop: 10 }}>
          {resources.length === 0 ? null : (
            <section>
              <h4 style={{ margin: "0 0 3px", color: "var(--bright)" }}>Fluid resource yields</h4>
              <p style={{ ...UI.muted, margin: "0 0 7px" }}>
                Adjust each pumpjack resource relative to its nominal yield.
              </p>
              <div className="settings-columns" style={UI.twoColumns}>
                {resources.map((recipe) => (
                  <Field key={recipe.key} label={recipe.name}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <CommitInput
                        key={`${recipe.key}-${specification.getResourceYield(recipe).toString()}`}
                        ariaLabel={`${recipe.name} yield percent`}
                        value={specification.getResourceYield(recipe).mul(Rational.from_integer(100)).toString()}
                        style={{ width: 82 }}
                        onCommit={(value) =>
                          applyPlanningSetting(specification, {
                            id: "resource_yield",
                            value,
                            resourceKey: recipe.key,
                          })
                        }
                      />
                      <span aria-hidden="true">%</span>
                    </span>
                  </Field>
                ))}
              </div>
            </section>
          )}
          {asteroidItems.length === 0 ? null : (
            <section>
              <h4 style={{ margin: "0 0 3px", color: "var(--bright)" }}>Asteroid collection limits</h4>
              <p style={{ ...UI.muted, margin: "0 0 7px" }}>
                Leave a field blank for unlimited collection. Values use the selected display rate.
              </p>
              <div className="settings-columns" style={UI.twoColumns}>
                {asteroidItems.map((item) => (
                  <Field key={item.key} label={item.name}>
                    <CommitInput
                      key={`${item.key}-${specification.asteroidLimits.get(item.key)?.toString() ?? ""}`}
                      ariaLabel={`${item.name} cap`}
                      value={
                        specification.asteroidLimits.get(item.key)?.mul(specification.format.rateFactor).toString() ??
                        ""
                      }
                      placeholder="Unlimited"
                      onCommit={(value) =>
                        applyPlanningSetting(specification, {
                          id: "asteroid_cap",
                          value,
                          itemKey: item.key,
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            </section>
          )}
        </div>
      </details>
    </SettingsRow>
  )
}

function SettingsPanel({ snapshot, commands }: CalculatorViewProps) {
  return (
    <div id="settings_tab" style={UI.stack}>
      <GeneralSettings snapshot={snapshot} commands={commands} />
      <LogisticsSettings snapshot={snapshot} />
      <ProductivityResearchSettings snapshot={snapshot} />
      <RecipeSettings snapshot={snapshot} />
    </div>
  )
}

function HelpPanel() {
  return (
    <div id="help_tab" style={{ width: "min(65rem, 100%)", padding: "16px 0 48px" }}>
      <section>
        <header>
          <h1
            style={{
              margin: 0,
              color: "var(--bright)",
              fontSize: 21,
              letterSpacing: "-0.01em",
            }}
          >
            Help
          </h1>
          <div style={{ marginBottom: 12, color: "var(--muted)", fontSize: 12.5 }}>
            <span>Factorio 2.1.14</span>
            <span aria-hidden="true"> · </span>
            <span>Space Age</span>
            <span aria-hidden="true"> · </span>
            <a href="https://github.com/anthfgreco/factorio-calculator" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </div>
        </header>
      </section>

      <HelpSection title="Using the calculator">
        <ol
          style={{
            margin: 0,
            paddingLeft: 22,
            color: "var(--foreground)",
            fontSize: 13.75,
            lineHeight: 1.48,
          }}
        >
          <li>Add a production target.</li>
          <li>Choose the output quality, target rate, and production planet.</li>
          <li>
            Open <strong>Factory</strong> to choose recipes, machines, modules, and imported ingredients.
          </li>
          <li>
            Check <strong>Resources</strong> and <strong>Visualize</strong> for totals and bottlenecks.
          </li>
        </ol>
      </HelpSection>

      <HelpSection title="Useful controls">
        <HelpTable
          firstColumn="Action"
          secondColumn="Control"
          rows={[
            ["Combine production locations", "Shift-click location buttons"],
            ["Treat an ingredient as externally supplied", "Click its icon in the Factory table"],
            ["Restore an imported ingredient to the production chain", "Click the icon again"],
            ["Change a recipe for one item", "Use the recipe selector in its Factory row"],
            ["Copy a module and its quality between slots", "Hover a module or module choice and press Q"],
            ["Change belt stacking for one item", "Use the stacking selector beside its belt count"],
            ["Plan a quality factory", "Set the output quality and production planet"],
            ["Choose available quality gear", "Settings → Quality factory"],
            ["Change recipe defaults", "Open Settings"],
            ["Share the current calculation", "Copy plan link"],
          ]}
        />
      </HelpSection>

      <HelpSection title="Something looks wrong?">
        <HelpTable
          firstColumn="Problem"
          secondColumn="Check"
          rows={[
            ["An item cannot be produced", "Enabled recipes and selected locations"],
            ["An ingredient is missing from the chain", "Whether it is marked as imported"],
            ["The calculator chose an unexpected resource", "Resource priorities and alternate recipes"],
            ["A quality plan cannot solve", "Selected planet, target recipe, recycler recipe, and available machines"],
            ["A Vulcanus plan imports basic metal", "Selected planet and whether lava casting recipes are enabled"],
            ["Machine counts look higher than expected", "Recipe, modules, beacons, and machine quality"],
          ]}
        />
      </HelpSection>

      <details open style={{ marginTop: 32 }}>
        <summary
          style={{
            paddingBottom: 7,
            color: "var(--bright)",
            borderBottom: "1px solid var(--rule)",
            fontSize: 12,
            fontWeight: 650,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Changelog
        </summary>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ChangelogEntry date="2026-08-16" title="Vulcanus Quality Throughput">
            <li>Added Vulcanus LDS and concrete quality shuffles to the practical Legendary planner.</li>
            <li>Full Legendary now includes the Late Space Age research, belts, stacking, and machine baseline.</li>
            <li>
              Self-recycling mined resources now optimize no-beacon through the Quality factory mining limits for beacon
              count, beacon quality, and speed-module quality. Results show expected Legendary/min per miner plus the
              throughput × (mining quality + recycler quality / 3) comparison score.
            </li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-15" title="Q-Key Module Pipette">
            <li>
              Hover a module slot or picker choice and press Q to copy that module and quality, then click compatible
              machine or beacon slots to place it repeatedly.
            </li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-13" title="Practical Quality Factories & Presets">
            <li>
              Added recursive exact quality factories for Nauvis intermediates and a curated Vulcanus route from lava
              and calcite through casting, crafting, and real recycling.
            </li>
            <li>
              Added Full Legendary as a separate quality-only preset; progression presets preserve locations and Late
              Space Age uses express belts.
            </li>
            <li>
              Results now lead with feed, machines, module loadouts, recycling, imports, and power; detailed quality
              math is collapsed, and quality-only plans omit the ordinary Factory table and header.
            </li>
            <li>
              Progression presets now set every productivity research value, with Late Space Age using +100% across
              mining and all eight recipe technologies; Recipe Settings no longer includes the broken jump links or
              Debug page.
            </li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-12" title="Machine, Module & Beacon Quality Support">
            <li>Added quality controls for machines, modules, and beacons.</li>
            <li>
              Quality now changes machine speed, module effects, beacon transmission, mining drill drain, and rocket
              launch speed.
            </li>
            <li>Shared plan links now include quality defaults and recipe-specific choices.</li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-10" title="Belt Production Targets & Stacking">
            <li>Plan production by belt throughput as well as machine count or item rate.</li>
            <li>Choose automatic or per-item belt stacking, including Big mining drill output.</li>
            <li>Press Enter on a displayed Machines, Rate, or Belts value to make it the active target.</li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-06" title="Factorio 2.1.14">
            <li>Updated to Factorio 2.1.14, production values unchanged.</li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-05" title="Factorio 2.1.13">
            <li>
              Updated Space Age recipes for Factorio 2.1.13, including faster recycling for recipes that produce
              multiple items.
            </li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-03" title="Space Age Planning">
            <li>
              Added planning for Gleba agriculture and freshness, quality targets, production locations, and
              interplanetary transfers.
            </li>
            <li>
              Added planning for rocket launches, fluid and asteroid resources, stacked belts, storage, cargo wagons,
              beacon power, pollution, and Aquilo heat.
            </li>
            <li>
              Corrected rocket launch timing, Gleba spores, location warnings, and exact-quality totals, and removed
              unreliable estimates.
            </li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-08-02" title="Machine Selection, Search & Productivity">
            <li>
              Choose a machine for each recipe or let the calculator select one automatically, with preferences
              preserved in shared plan links.
            </li>
            <li>Search with common Factorio shorthand for circuits, belts, robots, magazines, and more.</li>
            <li>Set each Space Age recipe productivity technology independently.</li>
            <li>Tooltips and recipe menus now stay visible near screen edges.</li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-07-31" title="Factory Planning & Calculation Fixes">
            <li>
              Added factory summaries, progression presets, location controls, clearer errors, and share-link copying.
            </li>
            <li>
              Corrected production rates, machine speed limits, catalyst and coolant productivity, burner fuels, and
              recipes with multiple probabilities.
            </li>
            <li>Improved location and beacon-power warnings and kept settings in sync as plans change.</li>
            <li>Shared links now preserve recipe and module choices, including very large factories.</li>
          </ChangelogEntry>
          <ChangelogEntry date="2026-07-30" title="Factorio 2.1.12 & Space Age">
            <li>Added Factorio 2.1.12 and Space Age support and made it the default.</li>
            <li>
              Improved recipe search, aliases, location restrictions, asteroid resources, and per-row recipe selection.
            </li>
            <li>
              Improved Recipe Settings with search, crafting-category groups, unavailable-recipe filters, and recycling
              controls.
            </li>
          </ChangelogEntry>
        </div>
      </details>
    </div>
  )
}

function HelpSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2
        style={{
          margin: "0 0 12px",
          paddingBottom: 7,
          color: "var(--bright)",
          borderBottom: "1px solid var(--rule)",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function HelpTable({
  firstColumn,
  secondColumn,
  rows,
}: {
  readonly firstColumn: string
  readonly secondColumn: string
  readonly rows: ReadonlyArray<readonly [string, string]>
}) {
  return (
    <table
      className="help-table"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        color: "var(--foreground)",
        fontSize: 13.75,
      }}
    >
      <thead>
        <tr>
          <th scope="col" style={{ width: "48%", padding: "7px 10px", textAlign: "left" }}>
            {firstColumn}
          </th>
          <th scope="col" style={{ padding: "7px 10px", textAlign: "left" }}>
            {secondColumn}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([first, second]) => (
          <tr key={first}>
            <td style={{ padding: "7px 10px" }}>{first}</td>
            <td style={{ padding: "7px 10px" }}>{second}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChangelogEntry({
  date,
  title,
  children,
}: {
  readonly date: string
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <article
      className="changelog-entry"
      style={{
        display: "grid",
        gridTemplateColumns: "120px minmax(0, 1fr)",
        gap: 24,
        padding: "12px 0",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <time dateTime={date} style={{ color: "var(--muted)", fontFamily: "monospace", fontSize: 12 }}>
        {date}
      </time>
      <div>
        <h3 style={{ margin: "0 0 5px", color: "var(--bright)", fontSize: 14 }}>{title}</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--foreground)" }}>{children}</ul>
      </div>
    </article>
  )
}

export function CalculatorView({ snapshot, commands }: CalculatorViewProps) {
  return (
    <Fragment>
      <style>{BASE_CSS}</style>
      <div
        className="calculator-app"
        data-density={snapshot.factoryDensity}
        style={mergeStyles(UI.app, themeVariables(snapshot.colorSchemeKey))}
      >
        <div style={UI.page}>
          <TargetsPanel snapshot={snapshot} commands={commands} />
          <TabBar snapshot={snapshot} commands={commands} />
          {snapshot.activeTab === "totals" ? <FactoryPanel snapshot={snapshot} /> : null}
          {snapshot.activeTab === "graph" ? <GraphPanel snapshot={snapshot} /> : null}
          {snapshot.activeTab === "resources" ? <PriorityPanel snapshot={snapshot} /> : null}
          {snapshot.activeTab === "settings" ? <SettingsPanel snapshot={snapshot} commands={commands} /> : null}
          {snapshot.activeTab === "help" ? <HelpPanel /> : null}
          <footer style={UI.footer}>
            <a href="https://github.com/anthfgreco/factorio-calculator" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </footer>
        </div>
      </div>
    </Fragment>
  )
}

export function useCalculatorStore() {
  return useSyncExternalStore(calculatorStore.subscribe, calculatorStore.getSnapshot, calculatorStore.getSnapshot)
}
// endregion react-ui.tsx

// region app.ts
function configureQualityOptimizerLoader(specification: FactorySpecification): void {
  specification.setQualityGraphOptimizerLoader(loadBrowserHighsQualityOptimizer)
}

configureQualityOptimizerLoader(spec)

function reset(clearHash = true): void {
  if (clearHash) clearUrlHash()
  spec.setQualityGraphOptimizerLoader(null)
  resetSpec()
  configureQualityOptimizerLoader(spec)
  bindCalculatorSpecification(spec)
  window.spec = spec
}

export function changeMod(): void {
  const currentSettings = loadSettings(`#${formatSettings()}`)
  currentSettings.delete("data")
  const modName = currentMod()
  reset()
  loadData(modName, currentSettings)
}

const OIL_EXCLUSION = new Map([
  ["basic", ["advanced-oil-processing"]],
  ["coal", ["advanced-oil-processing", "basic-oil-processing"]],
])

function fixLegacySettings(settings: Map<string, string>): void {
  if ((settings.has("use_3") || settings.has("min") || settings.has("furnace")) && !settings.has("buildings")) {
    const parts: string[] = []
    if (settings.has("min")) {
      let value = settings.get("min")
      if (value === "4") value = "3"
      parts.push(`assembling-machine-${value}`)
      settings.delete("min")
    } else if (settings.has("use_3")) {
      parts.push("assembling-machine-3")
      settings.delete("use_3")
    }
    const furnace = settings.get("furnace")
    if (furnace !== undefined) {
      parts.push(furnace)
      settings.delete("furnace")
    }
    settings.set("buildings", parts.join(","))
  }
  if ((settings.has("k") || settings.has("p")) && !settings.has("disable")) {
    const parts: string[] = []
    if (settings.has("k")) {
      settings.delete("k")
      parts.push("kovarex-processing")
    }
    if (settings.has("p")) {
      for (const recipeKey of OIL_EXCLUSION.get(settings.get("p") ?? "") ?? []) parts.push(recipeKey)
      settings.delete("p")
    }
    settings.set("disable", parts.join(","))
  }
}

const dataRequests = new Map<string, Promise<unknown>>()

function fetchData(filename: string): Promise<unknown> {
  const existing = dataRequests.get(filename)
  if (existing !== undefined) return existing
  const request = fetch(filename, {
    cache: "force-cache",
    credentials: "same-origin",
  }).then((response) => {
    if (!response.ok) throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`)
    return response.json() as Promise<unknown>
  })
  dataRequests.set(filename, request)
  return request
}

let loadGeneration = 0

function loadData(modName: string, settings: Map<string, string>): void {
  const generation = ++loadGeneration
  const mod = MODIFICATIONS.get(modName)
  if (mod === undefined) throw new Error(`Unknown dataset: ${modName}`)
  setLegacyCalculation(mod.legacy)
  void fetchData(`data/${mod.filename}`)
    .then((rawData) => {
      if (generation !== loadGeneration) return
      const data = parseCalculatorData(rawData)
      const items = getItems(data)
      const recipes = getRecipes(data, items)
      const buildings = getBuildings(data, items)
      const planets = getPlanets(data, recipes, buildings)
      const modules = getModules(data, items)
      const qualities = getQualities(data)
      const belts = getBelts(data)
      const fuel = getFuel(data, items)
      const recipeProductivityResearch = getRecipeProductivityResearch(data, recipes)
      getSprites(data)
      spec.setData(
        items,
        recipes,
        planets,
        modules,
        buildings,
        belts,
        fuel,
        getItemGroups(items, data),
        recipeProductivityResearch,
        getDatasetBeaconPower(data),
        qualities,
      )
      fixLegacySettings(settings)
      applySettings(settings)
      spec.updateSolution()
      finishUrlInitialization()
    })
    .catch((error: unknown) => {
      if (generation !== loadGeneration) return
      spec.lastTotals = null
      spec.lastError = error
      spec.notifyStateChanged()
    })
}

let initialized = false

function handleUrlHashChange(): void {
  const hash = window.location.hash
  if (hash === `#${formatSettings()}`) return
  const settings = loadSettings(hash)
  initializeUrlState()
  selectDatasetFromSettings(settings)
  reset(false)
  loadData(currentMod(), settings)
}

export function init(): void {
  if (initialized) return
  initialized = true
  initializeFactoryDensity()
  configureFactoryPersistence(() => syncUrlHash(formatSettings()))
  configureDatasetChangeHandler(changeMod)
  window.spec = spec
  configureModelRuntime({
    getSpecification: () => spec,
    useLegacyCalculation: usesLegacyCalculation,
  })
  initializeUrlState()
  const settings = loadSettings(window.location.hash)
  selectDatasetFromSettings(settings)
  loadData(currentMod(), settings)
  window.addEventListener("hashchange", handleUrlHashChange)
  window.addEventListener("popstate", handleUrlHashChange)
}

export function dispose(): void {
  if (!initialized) return
  initialized = false
  loadGeneration++
  window.removeEventListener("hashchange", handleUrlHashChange)
  window.removeEventListener("popstate", handleUrlHashChange)
}
// endregion app.ts

// region main.tsx
export function CalculatorApp() {
  const snapshot = useCalculatorStore()
  useEffect(() => {
    calculatorStore.start()
    init()
    return () => {
      dispose()
      calculatorStore.dispose()
    }
  }, [])
  return <CalculatorView snapshot={snapshot} commands={calculatorStore.commands} />
}

export function mountCalculator(rootElement: HTMLElement): void {
  createRoot(rootElement).render(<CalculatorApp />)
}

if (typeof document !== "undefined") {
  const rootElement = document.getElementById("root")
  if (rootElement !== null) mountCalculator(rootElement)
}
// endregion main.tsx

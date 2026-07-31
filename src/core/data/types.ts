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
  order: string
  subgroup: string
  surface_conditions?: SurfaceCondition[]
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
  resources: ResourceData[]
  planets?: PlanetData[]
  sprites: SpriteSheetData
  [key: string]: unknown
}

export interface LocalizedName {
  en: string
  [locale: string]: string
}

export interface SpriteReference {
  icon_col: number
  icon_row: number
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

export interface RecipeAmount {
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

export interface SurfaceCondition {
  property: string
  min?: number
  max?: number
}

export interface RecipeData extends SpriteReference {
  key: string
  localized_name: LocalizedName
  categories?: string[]
  category?: string
  energy_required: number
  ingredients: RecipeAmount[]
  results: RecipeAmount[]
  allow_productivity: boolean
  order: string
  subgroup: string
  surface_conditions?: SurfaceCondition[]
}

export interface CalculatorData {
  game_version?: string
  game_build?: number
  experimental?: boolean
  recipe_aliases?: Record<string, string>
  items: ItemData[]
  recipes: RecipeData[]
  [key: string]: unknown
}

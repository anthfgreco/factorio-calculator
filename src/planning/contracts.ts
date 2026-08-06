import type { Rational } from "../math.js"
import type { Building, ModelFactorySpecification, Module, ModuleSpec, Planet } from "../models.js"
import type { DisabledRecipe, Item, Recipe } from "../recipes.js"

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

export interface LogisticsReport {
  readonly stackRate: Rational
  readonly bufferSlots: Rational
  readonly wagonLoads: Rational
}

export interface QualityTargetRow {
  readonly item: Item
  readonly recipe: Recipe
  readonly tier: (typeof QUALITY_TIERS)[number]
  readonly qualityLevel: number
  readonly chance: Rational
  readonly probability: Rational
  readonly requested: Rational
  readonly totalProduction: Rational
  readonly otherQualityByproduct: Rational
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

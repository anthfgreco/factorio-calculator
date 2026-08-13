import type { Rational } from "../math.js"
import type { Building, Module, Quality } from "../models.js"
import type { Item, Recipe } from "../recipes.js"

export type QualityStrategy = "direct" | "auto"
export type QualityOptimizationObjective = "configured" | "materials" | "machines" | "power"
export type QualityPlannerObjective = "practical" | "materials" | "machines" | "power"
export type QualityPlanProfile = "planet" | "vulcanus"

export function isQualityStrategy(value: string): value is QualityStrategy {
  return value === "direct" || value === "auto"
}

export function isQualityPlannerObjective(value: string): value is QualityPlannerObjective {
  return value === "practical" || value === "materials" || value === "machines" || value === "power"
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

export interface QualityOperationRate {
  readonly recipe: Recipe
  readonly qualityLevel: number
  readonly rate: Rational
  readonly machineCount: Rational
  readonly power: Rational
  readonly kind: "craft" | "recycle" | "source" | "dispose"
  readonly configuration: QualityTierConfiguration
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
  readonly totalPower: Rational
  readonly warnings: readonly string[]
}

import type { DisplayFormat, DisplayRate } from "../math.js"
import type { QualityPlannerObjective, QualityStrategy } from "../quality/contracts.js"

export type CalculatorTab = "totals" | "graph" | "settings" | "resources" | "debug" | "help"
export type FactoryDensity = "comfortable" | "compact"
export type ProgressionPreset = "early" | "pre-rocket" | "first-planets" | "late-space-age"
export type QualityPreset = "full-legendary"

const PROGRESSION_PRESET_VALUES: ReadonlySet<string> = new Set([
  "early",
  "pre-rocket",
  "first-planets",
  "late-space-age",
])

export function isProgressionPreset(value: string): value is ProgressionPreset {
  return PROGRESSION_PRESET_VALUES.has(value)
}

export function isQualityPreset(value: string): value is QualityPreset {
  return value === "full-legendary"
}
export type CalculationStatus = "loading" | "ready" | "error"

export interface PlanningSettingValue {
  readonly id: string
  readonly value: string
  readonly resourceKey: string | undefined
  readonly itemKey: string | undefined
}

export interface TargetSnapshot {
  readonly index: number
  readonly itemKey: string
  readonly itemName: string
  readonly recipeKey: string | null
  readonly recipeName: string | null
  readonly buildings: string
  readonly rate: string
  readonly qualityLevel: number
  readonly qualityStrategy: QualityStrategy
}

export interface CalculatorSettingsSnapshot {
  readonly displayRate: DisplayRate
  readonly ratePrecision: number
  readonly countPrecision: number
  readonly displayFormat: DisplayFormat
  readonly miningProductivityPercent: string
  readonly beltStackSize: string
  readonly beltStackDefaultPolicy: "auto" | "stacked" | "unstacked"
  readonly bufferMinutes: string
  readonly freshnessDelayMinutes: string
  readonly maxQualityLevel: number
  readonly equipmentQualityAvailable: boolean
  readonly qualityPlannerObjective: QualityPlannerObjective
  readonly visualizationType: string
  readonly visualizationRender: string
  readonly visualizationDirection: string
  readonly debugEnabled: boolean
}

export interface CalculatorSnapshot {
  readonly revision: number
  readonly datasetKey: string
  readonly activeTab: CalculatorTab
  readonly factoryDensity: FactoryDensity
  readonly title: string
  readonly status: CalculationStatus
  readonly errorMessage: string | null
  readonly targets: readonly TargetSnapshot[]
  readonly settings: CalculatorSettingsSnapshot
}

export interface CalculatorCommands {
  addTarget(itemKey?: string): void
  removeTarget(index: number): void
  selectTab(tab: CalculatorTab): void
  openVisualization(): void
  copyShareLink(): Promise<void>
  applyProgressionPreset(value: ProgressionPreset): void
  applyQualityPreset(value: QualityPreset): void
  setFactoryDensity(value: FactoryDensity): void
  setTitle(value: string): void
  setRatePrecision(value: number): void
  setCountPrecision(value: number): void
  setDisplayFormat(value: DisplayFormat): void
  setMiningProductivityPercent(value: string): void
  setPlanningSetting(input: PlanningSettingValue): void
  setVisualizationType(value: string): void
  setVisualizationRender(value: string): void
  setVisualizationDirection(value: string): void
  setDebugEnabled(enabled: boolean): void
  recalculate(): void
}

export interface CalculatorBrowserPort {
  readDatasetKey(): string
  readTitle(): string
}

export interface CalculatorStore {
  getSnapshot(): CalculatorSnapshot
  subscribe(listener: () => void): () => void
  start(): void
  dispose(): void
  readonly commands: CalculatorCommands
}

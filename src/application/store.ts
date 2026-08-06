import type {
  CalculatorBrowserPort,
  CalculatorCommands,
  CalculatorSnapshot,
  CalculatorStore,
  CalculationStatus,
  FactoryDensity,
  PlanningSettingValue,
  ProgressionPreset,
} from "./contracts.js"
import type { FactorySpecification } from "../factory.js"
import { spec } from "../factory.js"
import { Rational, type DisplayFormat } from "../math.js"
import {
  applyProgressionPresetValue,
  clickTab,
  clickVisualize,
  copyShareLink,
  currentTab,
  factoryDensity,
  setCalculatorTitle,
  setCountPrecision,
  setDebugEnabled,
  setDisplayFormat,
  setFactoryDensity,
  setMiningProductivityPercent,
  setPlanningSetting,
  setRatePrecision,
  changeVisualizationDirection,
  changeVisualizationRender,
  changeVisualizationType,
  visualizerDirection,
  visualizerRender,
  visualizerType,
} from "../state.js"

const INITIAL_SNAPSHOT: CalculatorSnapshot = {
  revision: 0,
  datasetKey: "",
  activeTab: "totals",
  factoryDensity: "compact",
  title: "Factorio Calculator",
  status: "loading",
  errorMessage: null,
  targets: [],
  settings: {
    ratePrecision: 3,
    countPrecision: 1,
    displayFormat: "decimal",
    miningProductivityPercent: "0",
    beltStackSize: "1",
    bufferMinutes: "1",
    freshnessDelayMinutes: "0",
    maxQualityLevel: 4,
    visualizationType: "sankey",
    visualizationRender: "zoom",
    visualizationDirection: "right",
    debugEnabled: false,
  },
}

export const browserCalculatorPort: CalculatorBrowserPort = {
  readDatasetKey() {
    const selector = document.getElementById("data_set")
    return selector instanceof HTMLSelectElement ? selector.value : ""
  },
  readTitle() {
    return document.title
  },
}

function getCalculationStatus(specification: FactorySpecification): CalculationStatus {
  if (specification.lastError !== null) return "error"
  if (specification.items.size === 0 || specification.lastTotals === null) return "loading"
  return "ready"
}

function getErrorMessage(error: unknown): string | null {
  if (error === null) return null
  if (error instanceof Error) return error.message
  return String(error)
}

function createSnapshot(
  specification: FactorySpecification,
  revision: number,
  browser: CalculatorBrowserPort,
): CalculatorSnapshot {
  return {
    revision,
    datasetKey: browser.readDatasetKey(),
    activeTab: currentTab,
    factoryDensity,
    title: browser.readTitle(),
    status: getCalculationStatus(specification),
    errorMessage: getErrorMessage(specification.lastError),
    targets: specification.buildTargets.map((target) => ({
      index: target.index,
      itemKey: target.itemKey,
      itemName: target.item.name,
      recipeKey: target.recipe?.key ?? null,
      recipeName: target.recipe?.name ?? null,
      buildings: target.buildings.toString(),
      rate: target.rate.toString(),
      qualityLevel: target.qualityLevel,
    })),
    settings: {
      ratePrecision: specification.format.ratePrecision,
      countPrecision: specification.format.countPrecision,
      displayFormat: specification.format.displayFormat,
      miningProductivityPercent: specification.miningProd.mul(Rational.from_integer(100)).toDecimal(),
      beltStackSize: specification.beltStackSize.toString(),
      bufferMinutes: specification.bufferMinutes.toString(),
      freshnessDelayMinutes: specification.freshnessDelayMinutes.toString(),
      maxQualityLevel: specification.maxQualityLevel,
      visualizationType: visualizerType,
      visualizationRender: visualizerRender,
      visualizationDirection: visualizerDirection,
      debugEnabled: specification.debug,
    },
  }
}

export class BrowserCalculatorStore implements CalculatorStore {
  private readonly listeners = new Set<() => void>()
  private specification: FactorySpecification = spec
  private unsubscribeSpecification: (() => void) | null = null
  private snapshot: CalculatorSnapshot = INITIAL_SNAPSHOT
  private revision = 0
  private started = false

  constructor(private readonly browser: CalculatorBrowserPort = browserCalculatorPort) {}

  readonly getSnapshot = (): CalculatorSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly commands: CalculatorCommands = {
    addTarget: (itemKey?: string) => {
      if (this.snapshot.status !== "ready") return
      this.specification.addTarget(itemKey)
      this.specification.updateSolution()
    },
    removeTarget: (index: number) => {
      const target = this.specification.buildTargets[index]
      if (target === undefined) return
      this.specification.removeTarget(target)
      this.specification.updateSolution()
    },
    selectTab: (tab) => {
      clickTab(tab)
      this.refresh()
    },
    openVisualization: () => {
      clickVisualize()
      this.refresh()
    },
    copyShareLink,
    applyProgressionPreset: (value: ProgressionPreset) => {
      applyProgressionPresetValue(value)
    },
    setFactoryDensity: (value: FactoryDensity) => {
      setFactoryDensity(value)
      this.refresh()
    },
    setTitle: (value: string) => {
      setCalculatorTitle(value)
    },
    setRatePrecision: (value: number) => {
      setRatePrecision(value)
    },
    setCountPrecision: (value: number) => {
      setCountPrecision(value)
    },
    setDisplayFormat: (value: DisplayFormat) => {
      setDisplayFormat(value)
    },
    setMiningProductivityPercent: (value: string) => {
      setMiningProductivityPercent(value)
    },
    setPlanningSetting: (input: PlanningSettingValue) => {
      setPlanningSetting(input)
    },
    setVisualizationType: (value: string) => {
      changeVisualizationType(value)
    },
    setVisualizationRender: (value: string) => {
      changeVisualizationRender(value)
    },
    setVisualizationDirection: (value: string) => {
      changeVisualizationDirection(value)
    },
    setDebugEnabled: (enabled: boolean) => {
      setDebugEnabled(enabled)
    },
    recalculate: () => {
      this.specification.updateSolution()
    },
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
    this.snapshot = createSnapshot(this.specification, this.revision, this.browser)
    for (const listener of this.listeners) listener()
  }
}

export const calculatorStore = new BrowserCalculatorStore()

export function bindCalculatorSpecification(specification: FactorySpecification): void {
  calculatorStore.bindSpecification(specification)
}

import {
  compressCalculatorSettings,
  parseCalculatorFragment,
  bytesToBinaryString,
  formatBeltStackItemSettings,
  formatTargetSetting,
} from "./url/codec.js"
import { CalculatorUrlHistory } from "./url/history.js"
import { sorted } from "./data.js"
import {
  DEFAULT_BELT,
  DEFAULT_FUEL,
  DEFAULT_QUALITY_PLANNER_MODULE_KEY,
  DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY,
  DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY,
  DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY,
  spec,
  type FactorySpecification,
} from "./factory.js"
import { DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_RATE, DEFAULT_RATE_PRECISION, Rational } from "./math.js"
import type { Module } from "./models.js"
import type { Item } from "./recipes.js"
import { colorScheme, DEFAULT_COLOR_SCHEME } from "./settings.js"
import {
  currentMod,
  currentTab,
  DEFAULT_RENDER,
  DEFAULT_TAB,
  DEFAULT_TITLE,
  DEFAULT_VISUALIZER,
  isDefaultVisualizerDirection,
  visualizerDirection,
  visualizerRender,
  visualizerType,
  type CalculatorTab,
} from "./state.js"

// -----------------------------------------------------------------------------
// Browser URL history
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Calculator fragment format
// -----------------------------------------------------------------------------

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

export { bytesToBinaryString } from "./url/codec.js"

export function formatSettings(
  excludeTitle = false,
  overrideTab: CalculatorTab | null = null,
  targets: Iterable<readonly [Item, Rational]> | null = null,
): string {
  let settings = ""
  if (!excludeTitle && document.title !== DEFAULT_TITLE) {
    settings += "title=" + encodeURIComponent(document.title) + "&"
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
  if (spec.format.rateName !== DEFAULT_RATE) {
    settings += "rate=" + spec.format.rateName + "&"
  }
  if (spec.format.ratePrecision !== DEFAULT_RATE_PRECISION) {
    settings += "rp=" + spec.format.ratePrecision + "&"
  }
  if (spec.format.countPrecision !== DEFAULT_COUNT_PRECISION) {
    settings += "cp=" + spec.format.countPrecision + "&"
  }
  if (spec.format.displayFormat !== DEFAULT_FORMAT) {
    settings += "vf=" + spec.format.displayFormat[0] + "&"
  }
  if (!spec.miningProd.isZero()) {
    let hundred = Rational.from_float(100)
    let mprod = spec.miningProd.mul(hundred).toString()
    settings += "mprod=" + mprod + "&"
  }
  let recipeProductivityLevels = serializeRecipeProductivityLevels(spec)
  if (recipeProductivityLevels.length > 0) {
    settings += "rprod=" + recipeProductivityLevels.join(",") + "&"
  }
  let buildings = serializeAutomaticBuildings(spec)
  if (buildings.length > 0) {
    settings += "buildings=" + buildings.join(",") + "&"
  }
  let machineSettings = serializeBuildingOverrides(spec)
  if (machineSettings.length > 0) {
    settings += "machines=" + machineSettings.join(",") + "&"
  }
  const machineQualities = serializeMachineQualities(spec)
  if (machineQualities.length > 0) settings += "machineq=" + machineQualities.join(",") + "&"
  if (spec.belt !== null && spec.belt.key !== DEFAULT_BELT) {
    settings += "belt=" + spec.belt.key + "&"
  }
  if (!spec.beltStackSize.equal(Rational.from_float(1))) settings += "bstack=" + spec.beltStackSize.toString() + "&"
  const beltStackOverrides = serializeBeltStackOverrides(spec)
  if (
    !spec.beltStackSize.equal(Rational.from_float(1)) ||
    spec.beltStackDefaultPolicy !== "auto" ||
    beltStackOverrides !== ""
  ) {
    settings += "bstackmode=" + spec.beltStackDefaultPolicy + "&"
  }
  if (beltStackOverrides !== "") settings += "bstackitems=" + beltStackOverrides + "&"
  if (!spec.bufferMinutes.equal(Rational.from_float(1))) settings += "buffer=" + spec.bufferMinutes.toString() + "&"
  if (!spec.freshnessDelayMinutes.isZero()) settings += "fresh=" + spec.freshnessDelayMinutes.toString() + "&"
  let resourceYields = [...spec.resourceYields]
    .filter(([recipe, value]) => recipe.categories?.has("basic-fluid") && !value.equal(Rational.from_float(1)))
    .sort(([a], [b]) => a.key.localeCompare(b.key))
    .map(([recipe, value]) => `${recipe.key}:${value.mul(Rational.from_float(100)).toString()}`)
  if (resourceYields.length > 0) settings += "ryield=" + resourceYields.join(",") + "&"
  if (spec.maxQualityLevel !== 4) settings += "maxq=" + spec.maxQualityLevel + "&"
  if (spec.asteroidLimits.size > 0) {
    settings +=
      "astcap=" +
      [...spec.asteroidLimits]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value.mul(spec.format.rateFactor).toString()}`)
        .join(",") +
      "&"
  }
  if (spec.recipeLocations.size > 0) {
    settings +=
      "rloc=" +
      [...spec.recipeLocations]
        .sort(([a], [b]) => a.key.localeCompare(b.key))
        .map(([recipe, location]) => `${recipe.key}:${location.key}`)
        .join(",") +
      "&"
  }
  if (spec.fuel !== null && spec.fuel.key !== DEFAULT_FUEL) {
    settings += "fuel=" + spec.fuel.key + "&"
  }
  if (spec.defaultModule !== null) {
    settings += "dm=" + spec.defaultModule.shortName() + "&"
  }
  if (spec.defaultMachineQuality.key !== "normal") settings += "dmachq=" + spec.defaultMachineQuality.key + "&"
  if (spec.defaultModuleQuality.key !== "normal") settings += "dmq=" + spec.defaultModuleQuality.key + "&"
  if (spec.defaultBeaconQuality.key !== "normal") settings += "dbq=" + spec.defaultBeaconQuality.key + "&"
  const defaultQualityPlannerModule = spec.modules.get(DEFAULT_QUALITY_PLANNER_MODULE_KEY) ?? null
  if (spec.qualityPlannerModule !== defaultQualityPlannerModule) {
    settings += "qpm=" + getModuleKey(spec.qualityPlannerModule) + "&"
  }
  if (spec.qualityPlannerModuleQuality.key !== DEFAULT_QUALITY_PLANNER_MODULE_QUALITY_KEY) {
    settings += "qpmq=" + spec.qualityPlannerModuleQuality.key + "&"
  }
  const defaultQualityPlannerProductivityModule =
    spec.modules.get(DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_KEY) ?? null
  if (spec.qualityPlannerProductivityModule !== defaultQualityPlannerProductivityModule) {
    settings += "qppm=" + getModuleKey(spec.qualityPlannerProductivityModule) + "&"
  }
  if (spec.qualityPlannerProductivityModuleQuality.key !== DEFAULT_QUALITY_PLANNER_PRODUCTIVITY_MODULE_QUALITY_KEY) {
    settings += "qppmq=" + spec.qualityPlannerProductivityModuleQuality.key + "&"
  }
  if (spec.qualityPlannerObjective !== "practical") settings += "qpo=" + spec.qualityPlannerObjective + "&"
  if (spec.secondaryDefaultModule !== null) {
    settings += "dm2=" + spec.secondaryDefaultModule.shortName() + "&"
  }
  if (!spec.isDefaultDefaultBeacon()) {
    let parts = []
    for (let module of spec.defaultBeacon) {
      if (module === null) {
        parts.push("null")
      } else {
        parts.push(module.shortName())
      }
    }
    settings += "db=" + parts.join(":") + "&"
  }
  if (!spec.defaultBeaconCount.isZero()) {
    settings += "dbc=" + spec.defaultBeaconCount.toDecimal(0) + "&"
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
      targetStrings.push(`${item.key}:r:${rate.mul(spec.format.rateFactor).toString()}`)
    }
  } else {
    for (let target of spec.buildTargets) {
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
        value = target.rate.mul(spec.format.rateFactor).toString()
      }
      targetStrings.push(
        formatTargetSetting({
          itemKey: target.itemKey,
          mode,
          value,
          recipeKey:
            mode === "f" && target.recipe !== null && target.recipe !== target.defaultRecipe ? target.recipe.key : null,
          qualityLevel: target.qualityLevel,
          qualityStrategy: target.qualityStrategy,
        }),
      )
    }
  }
  settings += targetStrings.join(",")

  let ignore = []
  for (let item of spec.ignore) {
    ignore.push(item.key)
  }
  if (ignore.length > 0) {
    settings += "&ignore=" + ignore.sort().join(",")
  }

  if (!spec.isDefaultPlanet()) {
    let planets = []
    for (let p of sorted(spec.selectedPlanets, (p) => p.order)) {
      planets.push(p.key)
    }
    settings += "&planet=" + planets.join(",")
  }
  let { disable, enable } = spec.getNetDisable()
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

  let moduleSettings = serializeModuleSettings(spec)
  if (moduleSettings.length > 0) {
    settings += "&modules=" + moduleSettings.join(",")
  }
  const moduleQualitySettings = serializeModuleQualitySettings(spec)
  if (moduleQualitySettings.length > 0) settings += "&moduleq=" + moduleQualitySettings.join(",")

  if (!spec.isDefaultPriority()) {
    let priority = []
    for (let level of spec.priority) {
      let keys = []
      for (let { recipe, weight } of level) {
        keys.push(`${recipe.key}=${weight.toString()}`)
      }
      priority.push(keys.join(","))
    }
    settings += "&priority=" + priority.join(";")
  }

  if (spec.debug) {
    settings += "&debug=1"
  }

  return compressCalculatorSettings(settings, {
    encode: (binary) => window.btoa(binary),
    decode: (encoded) => window.atob(encoded),
  })
}

export function loadSettings(fragment: string): Map<string, string> {
  return parseCalculatorFragment(fragment, {
    encode: (binary) => window.btoa(binary),
    decode: (encoded) => window.atob(encoded),
  })
}

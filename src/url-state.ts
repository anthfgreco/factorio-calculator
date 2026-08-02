import { sorted } from "./data.js"
import { DEFAULT_BELT, DEFAULT_FUEL, spec } from "./factory.js"
import { DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_RATE, DEFAULT_RATE_PRECISION, Rational } from "./math.js"
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
} from "./state.js"

// -----------------------------------------------------------------------------
// Browser URL history
// -----------------------------------------------------------------------------

let suppressInitialHashWrites = false

/**
 * Preserve a clean URL throughout a fresh calculator startup.
 *
 * Shared links already containing a fragment are never suppressed. A hashless
 * visit suppresses every URL write caused by initial rendering; later user
 * changes are still serialized into a shareable URL.
 */
export function initializeUrlState() {
  suppressInitialHashWrites = window.location.hash === ""
}

export function finishUrlInitialization() {
  suppressInitialHashWrites = false
}

export function clearUrlHash() {
  const cleanUrl = `${window.location.pathname}${window.location.search}`
  window.history.replaceState(null, "", cleanUrl)
}

export function syncUrlHash(settings: string) {
  if (suppressInitialHashWrites) {
    return
  }

  const nextHash = `#${settings}`
  if (window.location.hash === nextHash) {
    return
  }

  window.history.replaceState(null, "", nextHash)
}

// -----------------------------------------------------------------------------
// Calculator fragment format
// -----------------------------------------------------------------------------

function getModuleKey(module) {
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
export function serializeModuleSettings(factorySpec) {
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

export function serializeBuildingOverrides(factorySpec) {
  return [...factorySpec.buildingOverrides]
    .map(([recipe, building]: [any, any]) => `${recipe.key}:${building.key}`)
    .sort()
}

export function serializeAutomaticBuildings(factorySpec) {
  let buildings = []
  let groupSet = new Set<any>(factorySpec.buildings.values())
  for (let group of groupSet) {
    let defaultBuilding = group.getDefault()
    if (group.selectedBuildings.size !== 1 || !group.selectedBuildings.has(defaultBuilding)) {
      for (let building of group.buildings) {
        if (group.selectedBuildings.has(building)) {
          buildings.push(building.key)
        }
      }
    }
  }
  return buildings
}

export function serializeRecipeProductivityLevels(factorySpec) {
  return [...factorySpec.recipeProductivityLevels.entries()]
    .filter(([researchKey, level]) => level > 0 && factorySpec.recipeProductivityResearch.has(researchKey))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([researchKey, level]) => `${researchKey}:${level}`)
}

/** Convert compressed bytes to a browser-safe binary string in bounded chunks. */
export function bytesToBinaryString(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let result = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return result
}

export function formatSettings(excludeTitle = false, overrideTab = null, targets = null) {
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
  if (spec.belt.key !== DEFAULT_BELT) {
    settings += "belt=" + spec.belt.key + "&"
  }
  if (spec.fuel.key !== DEFAULT_FUEL) {
    settings += "fuel=" + spec.fuel.key + "&"
  }
  if (spec.defaultModule !== null) {
    settings += "dm=" + spec.defaultModule.shortName() + "&"
  }
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
  let targetStrings = []
  if (targets) {
    for (let [item, rate] of targets) {
      targetStrings.push(`${item.key}:r:${rate.mul(spec.format.rateFactor).toString()}`)
    }
  } else {
    for (let target of spec.buildTargets) {
      let targetString = ""
      if (target.changedBuilding) {
        targetString = `${target.itemKey}:f:${target.buildingInput.value}`
        if (target.recipe !== null && target.recipe !== target.defaultRecipe) {
          targetString += `:${target.recipe.key}`
        }
      } else {
        targetString = `${target.itemKey}:r:${target.rate.mul(spec.format.rateFactor).toString()}`
      }
      targetStrings.push(targetString)
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
    for (let d of enable as Set<any>) {
      parts.push(d.key)
    }
    settings += "&enable=" + parts.sort().join(",")
  }

  let moduleSettings = serializeModuleSettings(spec)
  if (moduleSettings.length > 0) {
    settings += "&modules=" + moduleSettings.join(",")
  }

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

  let zip = "zip=" + window.btoa(bytesToBinaryString(pako.deflateRaw(settings)))
  if (zip.length < settings.length) {
    return zip
  }
  return settings
}

export function loadSettings(fragment) {
  let settings = new Map()
  fragment = fragment.substr(1)
  let pairs = fragment.split("&")
  for (let pair of pairs) {
    let i = pair.indexOf("=")
    if (i === -1) {
      continue
    }
    let name = pair.substr(0, i)
    let value = pair.substr(i + 1)
    settings.set(name, value)
  }
  if (settings.has("zip")) {
    let z = window.atob(settings.get("zip"))
    let a = z.split("").map((c) => c.charCodeAt(0))
    let unzip = pako.inflateRaw(a, { to: "string" })
    return loadSettings("#" + unzip)
  }
  return settings
}

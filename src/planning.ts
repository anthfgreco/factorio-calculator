import { one, Rational, zero } from "./math.js"

export const QUALITY_TIERS = ["Normal", "Uncommon", "Rare", "Epic", "Legendary"] as const

const AQUILO_MACHINE_HEAT_KW: Readonly<Record<string, number>> = {
  "offshore-pump": 0,
  pumpjack: 50,
  "oil-refinery": 200,
  foundry: 300,
  "rocket-silo": 300,
}

const DEFAULT_AQUILO_MACHINE_HEAT_KW = 100
const AQUILO_BEACON_HEAT_W = Rational.from_integer(400_000)

export type QualityTargetFeasibility =
  | {
      status: "feasible"
      qualityChance: Rational
    }
  | {
      status: "auto-configurable"
      building: any
      module: any
      slotCount: number
    }
  | {
      status: "conflict"
      building: any
      module: any
      reason: "explicit-building" | "explicit-modules"
    }
  | {
      status: "unavailable"
      reason: "no-compatible-building" | "no-module-slots" | "no-quality-module" | "module-incompatible"
    }

function isQualityModule(module): boolean {
  return module !== null && module !== undefined && module.quality !== undefined && zero.less(module.quality)
}

function moduleTier(module): number {
  if (module === null || module === undefined) return 1
  const match = String(module.key ?? "").match(/(\d+)$/)
  return match === null ? 1 : Number(match[1])
}

function getModuleSpecWithoutMutation(specification, recipe) {
  return specification.spec?.get(recipe) ?? null
}

function getQualityChanceFromModules(modules): Rational {
  let quality = zero
  for (const module of modules ?? []) {
    if (module) quality = quality.add(module.quality)
  }
  return Rational.max(zero, Rational.min(one, quality))
}

export function qualityProbability(chance: Rational, targetLevel: number, maxLevel: number): Rational {
  if (targetLevel <= 0) return one
  if (targetLevel > maxLevel || chance.less(zero) || chance.isZero()) return zero

  const tenPercent = Rational.from_floats(1, 10)
  const ninetyPercent = Rational.from_floats(9, 10)
  if (targetLevel === maxLevel) {
    return chance.mul(tenPercent.pow(targetLevel - 1))
  }
  return chance.mul(ninetyPercent).mul(tenPercent.pow(targetLevel - 1))
}

export function getRecipeQualityChance(specification, recipe): Rational {
  const building = specification.getBuilding(recipe)
  const moduleSpec = getModuleSpecWithoutMutation(specification, recipe)
  let modules = moduleSpec?.building === building ? moduleSpec.modules : null
  if (modules === null && building !== null && building !== undefined && building.moduleSlots > 0) {
    const defaultModule = specification.getDefaultModule?.(recipe, building) ?? null
    modules = Array.from({ length: building.moduleSlots }, () => defaultModule)
  }
  return getQualityChanceFromModules(modules)
}

function chooseQualityModule(specification, recipe, building, moduleSpec, qualityModules) {
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
    if (lowerTiers.length > 0) return lowerTiers[0]
  }

  return [...compatible].sort((a, b) => moduleTier(a) - moduleTier(b))[0]
}

export function getQualityTargetFeasibility(
  specification,
  recipe,
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
  const buildingOverrideSource =
    specification.getBuildingOverrideSource?.(recipe) ??
    (specification.getBuildingOverride?.(recipe) === null ? "default" : "user")
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

  const compatibleBuildings = specification.getCompatibleBuildings?.(recipe, true) ?? []
  if (compatibleBuildings.length === 0) {
    return { status: "unavailable", reason: "no-compatible-building" }
  }

  const qualityModules = [...(specification.modules?.values?.() ?? [])].filter(isQualityModule)
  if (qualityModules.length === 0) {
    return { status: "unavailable", reason: "no-quality-module" }
  }

  const orderedBuildings = compatibleBuildings.includes(currentBuilding)
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

export function getQualityTargetMultiplier(specification, recipe, qualityLevel: number): Rational {
  if (!qualityLevel) return one
  const chance = getRecipeQualityChance(specification, recipe)
  const probability = qualityProbability(chance, qualityLevel, specification.maxQualityLevel)
  if (probability.isZero()) {
    const tier = QUALITY_TIERS[qualityLevel] ?? `quality ${qualityLevel}`
    throw new Error(
      `${recipe.name} cannot produce ${tier} output with the current quality settings. Choose a lower tier or add quality modules.`,
    )
  }
  return probability.reciprocate()
}

export function getCompatibleLocations(specification, recipe, building = null) {
  if (!specification.selectedPlanets?.size || !recipe.isReal?.() || recipe.isDisable?.()) return []
  return [...specification.selectedPlanets]
    .filter((location) => location.allowsRecipe(recipe) && (building === null || location.allowsBuilding(building)))
    .sort((a, b) => String(a.order).localeCompare(String(b.order)))
}

export function getAssignedLocation(specification, recipe, building = null) {
  const compatible = getCompatibleLocations(specification, recipe, building)
  const assigned = specification.recipeLocations.get(recipe)
  if (assigned && compatible.includes(assigned)) return assigned
  return compatible[0] ?? null
}

export function getTransportFlows(specification, totals) {
  const flows = new Map<string, any>()
  for (const link of totals.proportionate ?? []) {
    if (!link.from.isReal() || !link.to.isReal() || link.from.isDisable?.() || link.to.isDisable?.()) continue
    const from = getAssignedLocation(specification, link.from, specification.getBuilding(link.from))
    const to = getAssignedLocation(specification, link.to, specification.getBuilding(link.to))
    if (!from || !to || from === to) continue
    const key = `${from.key}\u0000${to.key}\u0000${link.item.key}`
    const existing = flows.get(key)
    if (existing) {
      existing.rate = existing.rate.add(link.rate)
    } else {
      flows.set(key, { from, to, item: link.item, rate: link.rate, fuel: link.fuel })
    }
  }
  return [...flows.values()].sort((a, b) =>
    `${a.from.order}:${a.to.order}:${a.item.order}`.localeCompare(`${b.from.order}:${b.to.order}:${b.item.order}`),
  )
}

export function getAsteroidConstraintReport(specification, totals) {
  const report: any[] = []
  for (const [itemKey, limit] of specification.asteroidLimits) {
    const item = specification.items.get(itemKey)
    if (!item) continue
    const required = totals.items.get(item) ?? zero
    report.push({ item, required, limit, exceeded: limit.less(required) })
  }
  return report
}

export function getFreshnessReport(specification, totals) {
  const delaySeconds = specification.freshnessDelayMinutes.mul(Rational.from_float(60))
  const rows: any[] = []
  for (const [item, rate] of totals.items) {
    if (!item.spoilTime || item.spoilTime.isZero()) continue
    const remaining = Rational.max(zero, one.sub(delaySeconds.div(item.spoilTime)))
    const effectiveRate = item.key === "agricultural-science-pack" ? rate.mul(remaining) : rate
    rows.push({ item, remaining, effectiveRate, expired: remaining.isZero() })
  }
  return rows.sort((a, b) => a.remaining.toFloat() - b.remaining.toFloat())
}

function buildingEmissions(building, pollutant: string): Rational {
  const value = building?.emissions?.[pollutant] ?? zero
  return value instanceof Rational ? value : Rational.from_float_approximate(value)
}

function recipeEmissions(recipe, pollutant: string): Rational {
  const value = recipe?.harvestEmissions?.[pollutant] ?? zero
  return value instanceof Rational ? value : Rational.from_float_approximate(value)
}

export function getPollutionComponents(specification, recipe, rate, pollutant = "pollution") {
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
  const pollutionEffect = moduleSpec?.pollutionEffect?.() ?? one
  const consumptionEffect = moduleSpec?.powerEffect?.(specification) ?? one
  const machine = buildingEmissions(building, pollutant).mul(count).mul(consumptionEffect).mul(pollutionEffect)
  const process = recipeEmissions(recipe, pollutant).mul(rate).mul(Rational.from_float(60))
  return { machine, process, total: machine.add(process) }
}

export function getPollution(specification, recipe, rate, pollutant = "pollution"): Rational {
  return getPollutionComponents(specification, recipe, rate, pollutant).total
}

export function getRocketLaunchReport(specification, totals) {
  const recipe = specification.recipes.get("rocket-part")
  if (!recipe) return null
  const rate = totals.rates.get(recipe)
  if (!rate || rate.isZero()) return null
  const building = specification.getBuilding(recipe)
  const stats = building?.getLaunchStats?.(specification)
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

export function getBeaconPower(specification, recipe, rate): Rational {
  const moduleSpec = specification.getModuleSpec(recipe)
  if (!moduleSpec || moduleSpec.beaconCount.isZero() || specification.beaconPower.isZero()) return zero
  if (!moduleSpec.beaconModules.some((module) => module !== null)) return zero
  const placedMachines = specification.getCount(recipe, rate).ceil()
  return specification.beaconPower.mul(placedMachines).mul(moduleSpec.beaconCount)
}

export function getAquiloHeat(specification, recipe, rate): Rational {
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

export function getLogistics(item, rate, specification) {
  if (item.phase !== "solid") return null
  const stackSize = Rational.from_float(item.stackSize ?? 1)
  const stackRate = rate.div(stackSize)
  const bufferItems = rate.mul(specification.bufferMinutes).mul(Rational.from_float(60))
  const bufferSlots = bufferItems.div(stackSize).ceil()
  const wagonLoads = stackRate.div(Rational.from_float(40))
  return { stackRate, bufferSlots, wagonLoads }
}

export function getQualityTargetReport(specification) {
  const rows: any[] = []
  for (const target of specification.buildTargets ?? []) {
    if (!target.qualityLevel) continue
    const recipe = target.recipe ?? specification.getRecipes(target.item)[0]
    if (!recipe) continue
    const chance = getRecipeQualityChance(specification, recipe)
    const probability = qualityProbability(chance, target.qualityLevel, specification.maxQualityLevel)
    if (probability.isZero()) continue
    const requested = target.getRate()
    const totalProduction = requested.div(probability)
    rows.push({
      item: target.item,
      recipe,
      tier: QUALITY_TIERS[target.qualityLevel],
      qualityLevel: target.qualityLevel,
      chance,
      probability,
      requested,
      totalProduction,
      otherQualityByproduct: totalProduction.sub(requested),
    })
  }
  return rows
}

export function getPlanningSummary(specification, totals) {
  let beaconPower = zero
  let pollution = zero
  let spores = zero
  let pollutionMachine = zero
  let pollutionProcess = zero
  let sporeMachine = zero
  let sporeProcess = zero
  let aquiloHeat = zero
  const perLocation = new Map<any, any>()

  for (const [recipe, rate] of totals.rates) {
    if (!recipe.isReal?.() || recipe.isDisable?.()) continue
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
      recipeHeat = recipeHeat.add(
        AQUILO_BEACON_HEAT_W.mul(moduleSpec.beaconCount).mul(specification.getCount(recipe, rate).ceil()),
      )
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
      pollution: { machine: pollutionMachine, process: pollutionProcess, total: pollution },
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
    qualityTargets: getQualityTargetReport(specification),
  }
}

import { type FactorySpecification, getRecipeLocations } from "../factory.js"
import { Rational, zero } from "../math.js"
import type { Fuel, ModuleSpec, Planet } from "../models.js"
import { getPlanningSummary } from "../planning.js"
import { Item, Recipe } from "../recipes.js"
import type { Totals } from "../solver.js"

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

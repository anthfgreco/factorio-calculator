import type { FactorySpecification } from "../factory.js"
import { one, Rational, zero } from "../math.js"
import { Building, Module, ModuleSpec, type Quality } from "../models.js"
import { Item, Recipe } from "../recipes.js"
import { Ingredient } from "../solver.js"
import { type QualifiedItemAmount, type QualityTierConfiguration } from "./contracts.js"
import { addIngredient, ingredientsFromMap, QualityGraph, QualityGraphItem, QualityGraphRecipe } from "./graph.js"
import { qualityTransitionDistribution, qualityTransitionProbability, solveExactLinearSystem } from "./math.js"

interface TargetRecycleClosure {
  readonly operationsByInputQuality: readonly Rational[]
  readonly products: ReadonlyMap<QualityGraphItem, Rational>
  readonly extraIngredients: ReadonlyMap<QualityGraphItem, Rational>
}

export function isQualifiedSolid(item: Item): boolean {
  return item.phase === "solid"
}

export function qualifiedItem(graph: QualityGraph, item: Item, qualityLevel: number): QualityGraphItem {
  return graph.item(item, isQualifiedSolid(item) ? qualityLevel : null)
}

export function addProductivity(recipe: Recipe, product: Ingredient<Item, Rational>, productivity: Rational): Rational {
  if (!one.less(productivity)) return product.amount
  let productiveAmount = product.productivityAmount
  if (productiveAmount === null) {
    productiveAmount = product.amount
    for (const ingredient of recipe.ingredients) {
      if (ingredient.item === product.item) productiveAmount = productiveAmount.sub(ingredient.amount)
    }
    if (productiveAmount.less(zero)) return product.amount
  }
  return product.amount.add(productiveAmount.mul(productivity.sub(one)))
}

export function findRecyclerRecipe(specification: FactorySpecification, item: Item): Recipe | null {
  const exact = specification.recipes.get(`${item.key}-recycling`)
  if (exact !== undefined && exact.ingredients.some((ingredient) => ingredient.item === item)) return exact
  return (
    item.uses.find(
      (candidate) =>
        candidate.categories.has("recycling") && candidate.ingredients.some((ingredient) => ingredient.item === item),
    ) ?? null
  )
}

function cloneModuleSpec(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building,
  configured: ModuleSpec | null,
): ModuleSpec {
  const clone = new ModuleSpec(recipe, specification)
  clone.setBuilding(building, specification)
  if (configured === null || configured.building !== building) return clone

  clone.modules.splice(0, clone.modules.length, ...configured.modules)
  clone.moduleQualities.splice(0, clone.moduleQualities.length, ...configured.moduleQualities)
  clone.beaconModules.splice(0, clone.beaconModules.length, ...configured.beaconModules)
  clone.beaconModuleQualities.splice(0, clone.beaconModuleQualities.length, ...configured.beaconModuleQualities)
  clone.beaconQuality = configured.beaconQuality
  clone.beaconCount = configured.beaconCount
  return clone
}

function productivityForConfiguration(
  specification: FactorySpecification,
  recipe: Recipe,
  moduleSpec: ModuleSpec,
): Rational {
  let productivity = moduleSpec.prodEffect(specification).add(specification.getRecipeProductivityBonus(recipe))
  if (recipe.maximumProductivity !== null) {
    productivity = Rational.min(productivity, one.add(recipe.maximumProductivity))
  }
  return productivity
}

function configurationFromModuleSpec(
  specification: FactorySpecification,
  recipe: Recipe,
  qualityLevel: number,
  moduleSpec: ModuleSpec,
): QualityTierConfiguration {
  const building = moduleSpec.building
  return {
    qualityLevel,
    building,
    machineQuality: specification.getMachineQuality(recipe),
    modules: [...moduleSpec.modules],
    moduleQualities: [...moduleSpec.moduleQualities],
    beaconModules: [...moduleSpec.beaconModules],
    beaconModuleQualities: [...moduleSpec.beaconModuleQualities],
    beaconQuality: moduleSpec.beaconQuality,
    beaconCount: moduleSpec.beaconCount,
    qualityChance: recipe.allow_quality ? moduleSpec.qualityEffect() : zero,
    productivity: productivityForConfiguration(specification, recipe, moduleSpec),
    speedEffect: moduleSpec.speedEffect(),
    powerEffect: moduleSpec.powerEffect(specification),
  }
}

export function moduleTierConfiguration(options: {
  readonly specification: FactorySpecification
  readonly recipe: Recipe
  readonly qualityLevel: number
  readonly building: Building | null
  readonly module: Module | null
  readonly moduleQuality: Quality
  readonly preserveBeacons?: boolean
}): QualityTierConfiguration {
  const { specification, recipe, qualityLevel, building, module, moduleQuality } = options
  if (building === null) {
    const normal = specification.getNormalQuality()
    return {
      qualityLevel,
      building: null,
      machineQuality: normal,
      modules: [],
      moduleQualities: [],
      beaconModules: [],
      beaconModuleQualities: [],
      beaconQuality: normal,
      beaconCount: zero,
      qualityChance: zero,
      productivity: one.add(specification.getRecipeProductivityBonus(recipe)),
      speedEffect: one,
      powerEffect: one,
    }
  }

  const configured = specification.spec.get(recipe) ?? null
  const moduleSpec = cloneModuleSpec(specification, recipe, building, configured)
  for (let index = 0; index < moduleSpec.modules.length; index++) {
    moduleSpec.modules[index] = module !== null && module.canUse(recipe, building) ? module : null
    moduleSpec.moduleQualities[index] =
      moduleSpec.modules[index] === null ? specification.getNormalQuality() : moduleQuality
  }
  if (options.preserveBeacons === false) {
    moduleSpec.beaconModules.fill(null)
    moduleSpec.beaconModuleQualities.fill(specification.getNormalQuality())
    moduleSpec.beaconCount = zero
  }
  return configurationFromModuleSpec(specification, recipe, qualityLevel, moduleSpec)
}

function moduleSpecFromConfiguration(
  specification: FactorySpecification,
  recipe: Recipe,
  configuration: QualityTierConfiguration,
): ModuleSpec | null {
  const building = configuration.building
  if (building === null) return null
  const moduleSpec = new ModuleSpec(recipe, specification)
  moduleSpec.setBuilding(building, specification)
  moduleSpec.modules.splice(0, moduleSpec.modules.length, ...configuration.modules)
  moduleSpec.moduleQualities.splice(0, moduleSpec.moduleQualities.length, ...configuration.moduleQualities)
  moduleSpec.beaconModules.splice(0, moduleSpec.beaconModules.length, ...configuration.beaconModules)
  moduleSpec.beaconModuleQualities.splice(
    0,
    moduleSpec.beaconModuleQualities.length,
    ...configuration.beaconModuleQualities,
  )
  moduleSpec.beaconQuality = configuration.beaconQuality
  moduleSpec.beaconCount = configuration.beaconCount
  return moduleSpec
}

export function operationCapacity(
  specification: FactorySpecification,
  recipe: Recipe,
  rate: Rational,
  configuration: QualityTierConfiguration,
): { readonly machineCount: Rational; readonly power: Rational } {
  const building = configuration.building
  if (building === null || rate.isZero()) return { machineCount: zero, power: zero }

  const moduleSpec = moduleSpecFromConfiguration(specification, recipe, configuration)
  const adapter = Object.create(specification) as FactorySpecification
  adapter.getModuleSpec = (candidate: Recipe) =>
    candidate === recipe ? moduleSpec : specification.getModuleSpec(candidate)
  adapter.getMachineQuality = (candidate: Recipe) =>
    candidate === recipe ? configuration.machineQuality : specification.getMachineQuality(candidate)

  const machineCount = building.getCount(adapter, recipe, rate)
  let power = building.powerForQuality(configuration.machineQuality).mul(machineCount).mul(configuration.powerEffect)
  if (building.fuel === null) {
    power = power.add(building.drainForQuality(configuration.machineQuality).mul(machineCount.ceil()))
  }
  if (
    !configuration.beaconCount.isZero() &&
    configuration.beaconModules.some((module) => module !== null) &&
    !specification.beaconPower.isZero()
  ) {
    power = power.add(
      specification.beaconPower
        .mul(configuration.beaconQuality.beaconPowerUsageMultiplier)
        .mul(machineCount.ceil())
        .mul(configuration.beaconCount),
    )
  }
  return { machineCount, power }
}

export function recyclerClosure(
  graph: QualityGraph,
  target: Item,
  recyclerRecipe: Recipe,
  keepLevel: number,
  maxLevel: number,
  configurations: readonly QualityTierConfiguration[],
): readonly TargetRecycleClosure[] {
  const targetIngredient = recyclerRecipe.ingredients.find((ingredient) => ingredient.item === target)
  if (targetIngredient === undefined || targetIngredient.amount.isZero()) {
    throw new Error(`${recyclerRecipe.name} does not consume ${target.name}`)
  }
  const transientSize = keepLevel
  if (transientSize === 0) return []

  // One column per recycled input quality. Values are expected target items
  // returned into another transient recycler state per one target item consumed.
  const transition: Rational[][] = Array.from({ length: transientSize }, () =>
    Array.from({ length: transientSize }, () => zero),
  )
  const immediateProducts: Map<QualityGraphItem, Rational>[] = Array.from({ length: transientSize }, () => new Map())
  const immediateIngredients: Map<QualityGraphItem, Rational>[] = Array.from({ length: transientSize }, () => new Map())

  for (let inputQuality = 0; inputQuality < transientSize; inputQuality++) {
    const configuration = configurations[inputQuality]
    if (configuration === undefined) throw new Error("Missing recycler quality configuration")
    const operationsPerItem = targetIngredient.amount.reciprocate()

    for (const ingredient of recyclerRecipe.ingredients) {
      if (ingredient.item === target) continue
      addIngredient(
        immediateIngredients[inputQuality]!,
        qualifiedItem(graph, ingredient.item, inputQuality),
        ingredient.amount.mul(operationsPerItem),
      )
    }

    for (const product of recyclerRecipe.products) {
      const amount = addProductivity(recyclerRecipe, product, configuration.productivity).mul(operationsPerItem)
      if (!isQualifiedSolid(product.item)) {
        addIngredient(immediateProducts[inputQuality]!, graph.item(product.item, null), amount)
        continue
      }
      const distribution = qualityTransitionDistribution(configuration.qualityChance, inputQuality, maxLevel)
      for (let outputQuality = inputQuality; outputQuality <= maxLevel; outputQuality++) {
        const probability = distribution[outputQuality] ?? zero
        if (probability.isZero()) continue
        const outputAmount = amount.mul(probability)
        if (product.item === target && outputQuality < keepLevel) {
          transition[outputQuality]![inputQuality] = transition[outputQuality]![inputQuality]!.add(outputAmount)
        } else {
          addIngredient(immediateProducts[inputQuality]!, graph.item(product.item, outputQuality), outputAmount)
        }
      }
    }
  }

  const coefficients: Rational[][] = Array.from({ length: transientSize }, (_, row) =>
    Array.from({ length: transientSize }, (_, column) =>
      row === column ? one.sub(transition[row]![column]!) : zero.sub(transition[row]![column]!),
    ),
  )

  return Array.from({ length: transientSize }, (_, initialQuality) => {
    const visits = solveExactLinearSystem(
      coefficients,
      Array.from({ length: transientSize }, (_, quality) => (quality === initialQuality ? one : zero)),
    )
    if (visits.some((value) => value.less(zero))) {
      throw new Error("Quality recycler contains a positive production cycle")
    }
    const products = new Map<QualityGraphItem, Rational>()
    const extraIngredients = new Map<QualityGraphItem, Rational>()
    for (let inputQuality = 0; inputQuality < transientSize; inputQuality++) {
      const visitCount = visits[inputQuality] ?? zero
      for (const [item, amount] of immediateProducts[inputQuality] ?? []) {
        addIngredient(products, item, amount.mul(visitCount))
      }
      for (const [item, amount] of immediateIngredients[inputQuality] ?? []) {
        addIngredient(extraIngredients, item, amount.mul(visitCount))
      }
    }
    const operationsPerItem = targetIngredient.amount.reciprocate()
    return {
      operationsByInputQuality: visits.map((visitCount) => visitCount.mul(operationsPerItem)),
      products,
      extraIngredients,
    }
  })
}

export function addCraftRecipe(
  graph: QualityGraph,
  target: Item,
  recipe: Recipe,
  inputQuality: number,
  keepLevel: number,
  maxLevel: number,
  configuration: QualityTierConfiguration,
  closures: readonly TargetRecycleClosure[],
  keyPrefix = "quality-craft",
): QualityGraphRecipe {
  const ingredients = new Map<QualityGraphItem, Rational>()
  const products = new Map<QualityGraphItem, Rational>()
  const recycleRates = Array.from({ length: maxLevel + 1 }, () => zero)

  for (const ingredient of recipe.ingredients) {
    addIngredient(ingredients, qualifiedItem(graph, ingredient.item, inputQuality), ingredient.amount)
  }

  for (const product of recipe.products) {
    const amount = addProductivity(recipe, product, configuration.productivity)
    if (!isQualifiedSolid(product.item)) {
      addIngredient(products, graph.item(product.item, null), amount)
      continue
    }

    const distribution = qualityTransitionDistribution(configuration.qualityChance, inputQuality, maxLevel)
    for (let outputQuality = inputQuality; outputQuality <= maxLevel; outputQuality++) {
      const probability = distribution[outputQuality] ?? zero
      if (probability.isZero()) continue
      const outputAmount = amount.mul(probability)
      if (product.item !== target || outputQuality >= keepLevel) {
        addIngredient(products, graph.item(product.item, outputQuality), outputAmount)
        continue
      }

      const closure = closures[outputQuality]
      if (closure === undefined) throw new Error("Missing target recycler closure")
      for (const [item, returned] of closure.products) {
        addIngredient(products, item, returned.mul(outputAmount))
      }
      for (const [item, consumed] of closure.extraIngredients) {
        addIngredient(ingredients, item, consumed.mul(outputAmount))
      }
      for (let recyclerQuality = 0; recyclerQuality < closure.operationsByInputQuality.length; recyclerQuality++) {
        recycleRates[recyclerQuality] = recycleRates[recyclerQuality]!.add(
          (closure.operationsByInputQuality[recyclerQuality] ?? zero).mul(outputAmount),
        )
      }
    }
  }

  return graph.recipe(
    `${keyPrefix}:${recipe.key}:q${inputQuality}`,
    `${recipe.name} quality ${inputQuality}`,
    ingredientsFromMap(ingredients),
    ingredientsFromMap(products),
    {
      baseRecipe: recipe,
      qualityLevel: inputQuality,
      kind: "craft",
      recycleRatesByQuality: recycleRates,
    },
  )
}

export function sortedQualifiedAmounts(values: Iterable<[QualityGraphItem, Rational]>): QualifiedItemAmount[] {
  return [...values]
    .filter(([, amount]) => !amount.isZero())
    .map(([item, amount]) => ({ item: item.item, qualityLevel: item.qualityLevel ?? 0, amount }))
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}

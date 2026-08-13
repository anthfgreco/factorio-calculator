import type { FactorySpecification } from "../factory.js"
import { one, Rational, zero } from "../math.js"
import type { Item, Recipe } from "../recipes.js"
import type { QualifiedItemAmount, QualityOperationRate, QualityTierConfiguration } from "./contracts.js"
import { qualityTransitionDistribution, solveExactLinearSystem } from "./math.js"
import { addProductivity, findRecyclerRecipe, isQualifiedSolid, operationCapacity } from "./operations.js"

interface DisposalState {
  readonly item: Item
  readonly qualityLevel: number
  readonly recipe: Recipe
  readonly configuration: QualityTierConfiguration
  readonly operationsPerItem: Rational
}

interface QualityDisposalResult {
  readonly operations: readonly QualityOperationRate[]
  readonly terminalOutputs: readonly QualifiedItemAmount[]
  readonly extraFreshInputs: readonly QualifiedItemAmount[]
  readonly totalMachineCount: Rational
  readonly totalPower: Rational
  readonly totalRecycles: Rational
}

function stateKey(item: Item, qualityLevel: number): string {
  return `${item.key}@q${qualityLevel}`
}

function sortedAmountMap(values: ReadonlyMap<string, QualifiedItemAmount>): QualifiedItemAmount[] {
  return [...values.values()]
    .filter(({ amount }) => !amount.isZero())
    .sort((left, right) =>
      left.item.order === right.item.order
        ? left.qualityLevel - right.qualityLevel
        : left.item.order.localeCompare(right.item.order),
    )
}

function recyclerDescriptor(
  specification: FactorySpecification,
  recipe: Recipe,
  inputItem: Item,
  inputQuality: number,
  configuration: QualityTierConfiguration,
): {
  readonly products: readonly QualifiedItemAmount[]
  readonly extraIngredients: readonly QualifiedItemAmount[]
} {
  const consumed = recipe.ingredients.find((ingredient) => ingredient.item === inputItem)
  if (consumed === undefined || consumed.amount.isZero()) {
    throw new Error(`${recipe.name} does not consume ${inputItem.name}`)
  }
  const operationsPerItem = consumed.amount.reciprocate()
  const products: QualifiedItemAmount[] = []
  const extraIngredients: QualifiedItemAmount[] = []

  for (const ingredient of recipe.ingredients) {
    if (ingredient.item === inputItem) continue
    extraIngredients.push({
      item: ingredient.item,
      qualityLevel: isQualifiedSolid(ingredient.item) ? inputQuality : 0,
      amount: ingredient.amount.mul(operationsPerItem),
    })
  }

  for (const product of recipe.products) {
    const amount = addProductivity(recipe, product, configuration.productivity).mul(operationsPerItem)
    if (!isQualifiedSolid(product.item)) {
      products.push({ item: product.item, qualityLevel: 0, amount })
      continue
    }
    const chance = recipe.allow_quality ? configuration.qualityChance : zero
    const distribution = qualityTransitionDistribution(chance, inputQuality, specification.maxQualityLevel)
    for (let outputQuality = inputQuality; outputQuality <= specification.maxQualityLevel; outputQuality++) {
      const probability = distribution[outputQuality] ?? zero
      if (probability.isZero()) continue
      products.push({ item: product.item, qualityLevel: outputQuality, amount: amount.mul(probability) })
    }
  }
  return { products, extraIngredients }
}

export function planQualitySurplusDisposal(options: {
  readonly specification: FactorySpecification
  readonly target: Item
  readonly keepLevel: number
  readonly surplus: readonly QualifiedItemAmount[]
  readonly canRecycle: (recipe: Recipe) => boolean
  readonly getConfiguration: (recipe: Recipe, qualityLevel: number) => QualityTierConfiguration
  readonly cycleLabel: string
}): QualityDisposalResult {
  const { specification, target, keepLevel, surplus, canRecycle, getConfiguration, cycleLabel } = options
  const states: DisposalState[] = []
  const stateIndexes = new Map<string, number>()
  const terminalInitial = new Map<string, QualifiedItemAmount>()

  const addMapAmount = (map: Map<string, QualifiedItemAmount>, value: QualifiedItemAmount): void => {
    const key = stateKey(value.item, value.qualityLevel)
    const current = map.get(key)
    map.set(key, {
      item: value.item,
      qualityLevel: value.qualityLevel,
      amount: (current?.amount ?? zero).add(value.amount),
    })
  }

  const addTerminal = (value: QualifiedItemAmount): void => addMapAmount(terminalInitial, value)

  const ensureState = (item: Item, qualityLevel: number): number | null => {
    if (!isQualifiedSolid(item) || (item === target && qualityLevel >= keepLevel)) return null
    const key = stateKey(item, qualityLevel)
    const existing = stateIndexes.get(key)
    if (existing !== undefined) return existing
    const recipe = findRecyclerRecipe(specification, item)
    if (recipe === null || !canRecycle(recipe)) return null
    const consumed = recipe.ingredients.find((ingredient) => ingredient.item === item)
    if (consumed === undefined || consumed.amount.isZero()) return null

    const index = states.length
    stateIndexes.set(key, index)
    states.push({
      item,
      qualityLevel,
      recipe,
      configuration: getConfiguration(recipe, qualityLevel),
      operationsPerItem: consumed.amount.reciprocate(),
    })
    return index
  }

  for (const value of surplus) {
    if (ensureState(value.item, value.qualityLevel) === null) addTerminal(value)
  }

  for (let index = 0; index < states.length; index++) {
    const state = states[index]
    if (state === undefined) continue
    const descriptor = recyclerDescriptor(
      specification,
      state.recipe,
      state.item,
      state.qualityLevel,
      state.configuration,
    )
    for (const product of descriptor.products) ensureState(product.item, product.qualityLevel)
  }

  if (states.length === 0) {
    return {
      operations: [],
      terminalOutputs: sortedAmountMap(terminalInitial),
      extraFreshInputs: [],
      totalMachineCount: zero,
      totalPower: zero,
      totalRecycles: zero,
    }
  }

  const transition: Rational[][] = Array.from({ length: states.length }, () =>
    Array.from({ length: states.length }, () => zero),
  )
  const terminalByState: Map<string, QualifiedItemAmount>[] = Array.from({ length: states.length }, () => new Map())
  const extraByState: Map<string, QualifiedItemAmount>[] = Array.from({ length: states.length }, () => new Map())

  for (let column = 0; column < states.length; column++) {
    const state = states[column]
    if (state === undefined) continue
    const descriptor = recyclerDescriptor(
      specification,
      state.recipe,
      state.item,
      state.qualityLevel,
      state.configuration,
    )
    for (const product of descriptor.products) {
      const row = stateIndexes.get(stateKey(product.item, product.qualityLevel))
      if (row === undefined) addMapAmount(terminalByState[column]!, product)
      else transition[row]![column] = transition[row]![column]!.add(product.amount)
    }
    for (const ingredient of descriptor.extraIngredients) addMapAmount(extraByState[column]!, ingredient)
  }

  const coefficients = transition.map((row, rowIndex) =>
    row.map((value, columnIndex) => (rowIndex === columnIndex ? one.sub(value) : zero.sub(value))),
  )
  const initial = Array.from({ length: states.length }, () => zero)
  for (const value of surplus) {
    const index = stateIndexes.get(stateKey(value.item, value.qualityLevel))
    if (index !== undefined) initial[index] = initial[index]!.add(value.amount)
  }
  const visits = solveExactLinearSystem(coefficients, initial)
  if (visits.some((value) => value.less(zero))) {
    throw new Error(`${cycleLabel} disposal contains a positive production cycle`)
  }

  const operations: QualityOperationRate[] = []
  const terminal = new Map(terminalInitial)
  const extraFresh = new Map<string, QualifiedItemAmount>()
  let totalMachineCount = zero
  let totalPower = zero
  let totalRecycles = zero

  for (let index = 0; index < states.length; index++) {
    const state = states[index]
    if (state === undefined) continue
    const visitCount = visits[index] ?? zero
    if (visitCount.isZero()) continue
    const rate = visitCount.mul(state.operationsPerItem)
    const capacity = operationCapacity(specification, state.recipe, rate, state.configuration)
    operations.push({
      recipe: state.recipe,
      qualityLevel: state.qualityLevel,
      rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind: "dispose",
      configuration: state.configuration,
    })
    totalRecycles = totalRecycles.add(rate)
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)
    for (const [, value] of terminalByState[index] ?? []) {
      addMapAmount(terminal, { ...value, amount: value.amount.mul(visitCount) })
    }
    for (const [, value] of extraByState[index] ?? []) {
      addMapAmount(extraFresh, { ...value, amount: value.amount.mul(visitCount) })
    }
  }

  return {
    operations,
    terminalOutputs: sortedAmountMap(terminal),
    extraFreshInputs: sortedAmountMap(extraFresh),
    totalMachineCount,
    totalPower,
    totalRecycles,
  }
}

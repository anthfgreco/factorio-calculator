import highsLoader from "highs"
import { one, Rational, zero } from "../math.js"
import { solveExactLinearSystemFractionFree } from "./math.js"
import {
  type QualityGraphOptimizer,
  type QualityGraphSolution,
  QualityGraph,
  QualityGraphItem,
  QualityGraphRecipe,
} from "./graph.js"

type Highs = Awaited<ReturnType<typeof highsLoader>>

export interface HighsLoaderOptions {
  readonly locateFile?: (file: string) => string
}

export interface QualityOptimizationRun {
  readonly certified: boolean
  readonly cacheHit: boolean
  readonly columns: number
  readonly rows: number
  readonly basicColumns: number
  readonly solveMilliseconds: number
  readonly certificationMilliseconds: number
  readonly reason: string | null
}

interface CachedSolution {
  readonly rates: readonly Rational[]
  readonly surplus: readonly Rational[]
}

interface ExactModel {
  readonly recipes: readonly QualityGraphRecipe[]
  readonly items: readonly QualityGraphItem[]
  readonly coefficients: readonly (readonly Rational[])[]
  readonly demand: readonly Rational[]
  readonly costs: readonly Rational[]
}

function addAmount(amounts: Map<QualityGraphItem, Rational>, item: QualityGraphItem, amount: Rational): void {
  amounts.set(item, (amounts.get(item) ?? zero).add(amount))
}

function modelForGraph(graph: QualityGraph, output: QualityGraphItem, rate: Rational): ExactModel {
  const recipes = [...graph.solverRecipes()]
  const itemSet = new Set<QualityGraphItem>([output])
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) itemSet.add(ingredient.item)
    for (const product of recipe.products) itemSet.add(product.item)
  }
  const items = [...itemSet]
  const itemRows = new Map(items.map((item, index) => [item, index]))
  const coefficients = Array.from({ length: items.length }, () => Array.from({ length: recipes.length }, () => zero))
  let minimum = one
  let maximum = one
  const observe = (value: Rational): void => {
    if (value.isZero()) return
    const absolute = value.abs()
    if (absolute.less(minimum)) minimum = absolute
    if (maximum.less(absolute)) maximum = absolute
  }
  observe(rate)

  for (let column = 0; column < recipes.length; column++) {
    const recipe = recipes[column]
    if (recipe === undefined) throw new Error("Missing quality recipe")
    const net = new Map<QualityGraphItem, Rational>()
    for (const product of recipe.products) addAmount(net, product.item, product.amount)
    for (const ingredient of recipe.ingredients) addAmount(net, ingredient.item, zero.sub(ingredient.amount))
    for (const [item, amount] of net) {
      const row = itemRows.get(item)
      if (row === undefined) throw new Error("Missing quality item row")
      coefficients[row]![column] = amount
      observe(amount)
    }
  }

  const combinedCosts = Array.from({ length: recipes.length }, () => one)
  const costRatio = Rational.max(Rational.from_integer(2), maximum.div(minimum).mul(Rational.from_integer(2)))
  let priorityCost = costRatio
  for (const level of graph.priorityLevels) {
    let minimumWeight: Rational | null = null
    for (const [recipe, weight] of level) {
      if (!recipes.includes(recipe)) continue
      if (minimumWeight === null || weight.less(minimumWeight)) minimumWeight = weight
    }
    if (minimumWeight === null) continue
    let normalizedTotal = zero
    for (const [recipe, weight] of level) {
      const column = recipes.indexOf(recipe)
      if (column === -1) continue
      const normalizedWeight = weight.div(minimumWeight)
      normalizedTotal = normalizedTotal.add(normalizedWeight)
      combinedCosts[column] = one.add(priorityCost.mul(normalizedWeight))
    }
    if (!normalizedTotal.isZero()) priorityCost = priorityCost.mul(costRatio).mul(normalizedTotal)
  }
  return {
    recipes,
    items,
    coefficients,
    demand: items.map((item) => (item === output ? rate : zero)),
    costs: combinedCosts,
  }
}

function finiteFloat(value: Rational, label: string): number {
  const result = value.toFloat()
  if (!Number.isFinite(result)) throw new Error(`${label} is outside the Float64 range`)
  return Object.is(result, -0) ? 0 : result
}

function modelSignature(model: ExactModel, output: QualityGraphItem): string {
  return JSON.stringify([
    output.key,
    model.items.map((item) => item.key),
    model.recipes.map((recipe) => recipe.key),
    model.coefficients.map((row) => row.map((value) => value.toString())),
    model.costs.map((value) => value.toString()),
  ])
}

function cachedSolutionForModel(model: ExactModel, cached: CachedSolution, rate: Rational): QualityGraphSolution {
  const rates = new Map<QualityGraphRecipe, Rational>()
  for (let column = 0; column < model.recipes.length; column++) {
    const recipe = model.recipes[column]
    const unitRate = cached.rates[column]
    if (recipe === undefined || unitRate === undefined) throw new Error("Cached quality solution is incomplete")
    const scaled = unitRate.mul(rate)
    if (!scaled.isZero()) rates.set(recipe, scaled)
  }
  const surplus = new Map<QualityGraphItem, Rational>()
  for (let row = 0; row < model.items.length; row++) {
    const item = model.items[row]
    const unitRate = cached.surplus[row]
    if (item === undefined || unitRate === undefined) throw new Error("Cached quality surplus is incomplete")
    const scaled = unitRate.mul(rate)
    if (!scaled.isZero()) surplus.set(item, scaled)
  }
  return { rates, surplus }
}

function lpTerm(value: Rational, name: string, first: boolean): string {
  const numeric = finiteFloat(value, name)
  const sign = numeric < 0 ? "-" : first ? "" : "+"
  return `${sign} ${Math.abs(numeric).toPrecision(17)} ${name}`
}

function lpForModel(model: ExactModel): string {
  const maximumCost = model.costs.reduce((maximum, cost) => (maximum.less(cost) ? cost : maximum), zero)
  const objective = model.costs
    .map((cost, column) => lpTerm(cost.div(maximumCost), `x${column}`, column === 0))
    .join(" ")
  const constraints = model.items.map((_, row) => {
    const terms: string[] = []
    for (let column = 0; column < model.recipes.length; column++) {
      const coefficient = model.coefficients[row]?.[column]
      if (coefficient === undefined || coefficient.isZero()) continue
      terms.push(lpTerm(coefficient, `x${column}`, terms.length === 0))
    }
    if (terms.length === 0) terms.push("0")
    const demand = model.demand[row]
    if (demand === undefined) throw new Error("Missing quality demand")
    return ` c${row}: ${terms.join(" ")} >= ${finiteFloat(demand, `c${row}`).toPrecision(17)}`
  })
  const bounds = model.recipes.map((_, column) => ` 0 <= x${column}`)
  return ["Minimize", ` obj: ${objective}`, "Subject To", ...constraints, "Bounds", ...bounds, "End"].join("\n")
}

function dot(left: readonly Rational[], right: readonly Rational[]): Rational {
  let result = zero
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index]
    const rightValue = right[index]
    if (leftValue === undefined || rightValue === undefined) throw new Error("Mismatched exact vectors")
    result = result.add(leftValue.mul(rightValue))
  }
  return result
}

const RANK_PRIME = 2_147_483_647n

function modularPower(base: bigint, exponent: bigint): bigint {
  let result = 1n
  while (exponent > 0n) {
    if ((exponent & 1n) === 1n) result = (result * base) % RANK_PRIME
    base = (base * base) % RANK_PRIME
    exponent >>= 1n
  }
  return result
}

function rationalModulo(value: Rational): bigint {
  const numerator = ((value.p % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
  const denominator = ((value.q % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
  if (denominator === 0n) throw new Error("Exact basis denominator is not invertible")
  return (numerator * modularPower(denominator, RANK_PRIME - 2n)) % RANK_PRIME
}

function selectIndependentRows(
  model: ExactModel,
  basicColumns: readonly number[],
  candidates: readonly number[],
): number[] {
  const selected: number[] = []
  const echelon = new Map<number, bigint[]>()
  for (const row of candidates) {
    const values = basicColumns.map((column) => rationalModulo(model.coefficients[row]?.[column] ?? zero))
    for (const [pivot, pivotValues] of echelon) {
      const factor = values[pivot]
      if (factor === undefined || factor === 0n) continue
      for (let column = pivot; column < values.length; column++) {
        const value = values[column]
        const pivotValue = pivotValues[column]
        if (value === undefined || pivotValue === undefined) throw new Error("Missing modular basis coefficient")
        values[column] = (((value - factor * pivotValue) % RANK_PRIME) + RANK_PRIME) % RANK_PRIME
      }
    }
    const pivot = values.findIndex((value) => value !== 0n)
    if (pivot === -1) continue
    const pivotValue = values[pivot]
    if (pivotValue === undefined) throw new Error("Missing modular basis pivot")
    const inverse = modularPower(pivotValue, RANK_PRIME - 2n)
    for (let column = pivot; column < values.length; column++) {
      const value = values[column]
      if (value === undefined) throw new Error("Missing modular basis coefficient")
      values[column] = (value * inverse) % RANK_PRIME
    }
    echelon.set(pivot, values)
    selected.push(row)
    if (selected.length === basicColumns.length) return selected
  }
  throw new Error(`Candidate active rows have rank ${selected.length}, expected ${basicColumns.length}`)
}

function certify(
  model: ExactModel,
  basicColumns: readonly number[],
  activeRows: readonly number[],
): QualityGraphSolution {
  if (basicColumns.length === 0 || activeRows.length !== basicColumns.length) {
    throw new Error(`Candidate basis is not square (${activeRows.length} rows, ${basicColumns.length} columns)`)
  }

  const basis = activeRows.map((row) =>
    basicColumns.map((column) => {
      const value = model.coefficients[row]?.[column]
      if (value === undefined) throw new Error("Missing candidate basis coefficient")
      return value
    }),
  )
  const basicRates = solveExactLinearSystemFractionFree(
    basis,
    activeRows.map((row) => {
      const value = model.demand[row]
      if (value === undefined) throw new Error("Missing candidate demand")
      return value
    }),
  )
  const negativeIndex = basicRates.findIndex((value) => value.less(zero))
  if (negativeIndex !== -1) {
    throw new Error(`Candidate basis is not primal feasible (${basicRates[negativeIndex]?.toString() ?? "unknown"})`)
  }

  const ratesByColumn = Array.from({ length: model.recipes.length }, () => zero)
  for (let index = 0; index < basicColumns.length; index++) {
    const column = basicColumns[index]
    const value = basicRates[index]
    if (column === undefined || value === undefined) throw new Error("Missing candidate basic rate")
    ratesByColumn[column] = value
  }

  const surplus = new Map<QualityGraphItem, Rational>()
  for (let row = 0; row < model.coefficients.length; row++) {
    const coefficients = model.coefficients[row]
    const demand = model.demand[row]
    if (coefficients === undefined || demand === undefined) {
      throw new Error("Missing candidate material balance")
    }
    const remainder = dot(coefficients, ratesByColumn).sub(demand)
    const item = model.items[row]
    if (item === undefined) throw new Error("Missing candidate material item")
    if (remainder.less(zero)) throw new Error(`Candidate basis underproduces ${item.name}`)
    if (!remainder.isZero()) surplus.set(item, remainder)
  }

  const dualBasis = basicColumns.map((column) =>
    activeRows.map((row) => {
      const value = model.coefficients[row]?.[column]
      if (value === undefined) throw new Error("Missing candidate dual coefficient")
      return value
    }),
  )
  const activeDual = solveExactLinearSystemFractionFree(
    dualBasis,
    basicColumns.map((column) => {
      const value = model.costs[column]
      if (value === undefined) throw new Error("Missing candidate basic cost")
      return value
    }),
  )
  for (let index = 0; index < activeDual.length; index++) {
    const row = activeRows[index]
    const value = activeDual[index]
    if (row === undefined || value === undefined) throw new Error("Missing candidate dual value")
    if (value.less(zero)) throw new Error("Candidate basis is not dual feasible")
  }

  const dual = Array.from({ length: model.coefficients.length }, () => zero)
  for (let index = 0; index < activeRows.length; index++) {
    const row = activeRows[index]
    const value = activeDual[index]
    if (row === undefined || value === undefined) throw new Error("Missing candidate dual value")
    dual[row] = value
  }
  for (let column = 0; column < model.recipes.length; column++) {
    const coefficients = model.coefficients.map((row) => row[column] ?? zero)
    const cost = model.costs[column]
    if (cost === undefined) throw new Error("Missing candidate cost")
    if (cost.less(dot(coefficients, dual))) throw new Error("Candidate basis has a negative exact reduced cost")
  }

  const primalObjective = dot(model.costs, ratesByColumn)
  const dualObjective = dot(model.demand, dual)
  if (!primalObjective.equal(dualObjective)) throw new Error("Candidate primal and dual objectives differ")

  const rates = new Map<QualityGraphRecipe, Rational>()
  for (let column = 0; column < model.recipes.length; column++) {
    const recipe = model.recipes[column]
    const rate = ratesByColumn[column]
    if (recipe !== undefined && rate !== undefined && !rate.isZero()) rates.set(recipe, rate)
  }
  return { rates, surplus }
}

export class HighsQualityOptimizer implements QualityGraphOptimizer {
  lastRun: QualityOptimizationRun | null = null
  private readonly solutionCache = new Map<string, CachedSolution>()

  constructor(private readonly highs: Highs) {}

  solve(graph: QualityGraph, output: QualityGraphItem, rate: Rational): QualityGraphSolution | null {
    const baseModel = modelForGraph(graph, output, rate)
    const signature = modelSignature(baseModel, output)
    const cached = this.solutionCache.get(signature)
    if (cached !== undefined) {
      this.solutionCache.delete(signature)
      this.solutionCache.set(signature, cached)
      this.lastRun = {
        certified: true,
        cacheHit: true,
        columns: baseModel.recipes.length,
        rows: baseModel.coefficients.length,
        basicColumns: 0,
        solveMilliseconds: 0,
        certificationMilliseconds: 0,
        reason: null,
      }
      return cachedSolutionForModel(baseModel, cached, rate)
    }
    const model = baseModel
    const solveStarted = performance.now()
    const solution = this.highs.solve(lpForModel(model), {
      solver: "simplex",
      presolve: "on",
      output_flag: false,
      log_to_console: false,
      small_matrix_value: 1e-12,
      primal_feasibility_tolerance: 1e-9,
      dual_feasibility_tolerance: 1e-9,
    })
    const solveMilliseconds = performance.now() - solveStarted
    const certificationStarted = performance.now()
    let reason: string | null = null
    let certified: QualityGraphSolution | null = null
    let basicColumns: number[] = []
    try {
      if (solution.Status !== "Optimal") {
        throw new Error(
          `HiGHS returned ${solution.Status} (${Object.keys(solution.Columns).length} columns, ${solution.Rows.length} rows, objective ${solution.ObjectiveValue})`,
        )
      }
      basicColumns = model.recipes
        .map((_, column) => column)
        .filter((column) => {
          const candidate = solution.Columns[`x${column}`]
          return candidate !== undefined && "Status" in candidate && candidate.Status === "BS"
        })
      const rowIndexes = model.coefficients.map((_, row) => row)
      const nonbasicRows = rowIndexes.filter((row) => {
        const candidate = solution.Rows[row]
        return candidate !== undefined && "Status" in candidate && candidate.Status !== "BS"
      })
      const tightRows = rowIndexes.filter((row) => {
        const candidate = solution.Rows[row]
        const demand = model.demand[row]
        return (
          candidate !== undefined &&
          "Primal" in candidate &&
          demand !== undefined &&
          Math.abs(candidate.Primal - finiteFloat(demand, `c${row}`)) <= 1e-7
        )
      })
      const activeRows = selectIndependentRows(model, basicColumns, [...new Set([...nonbasicRows, ...tightRows])])
      certified = certify(model, basicColumns, activeRows)
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error)
      certified = null
    }
    this.lastRun = {
      certified: certified !== null,
      cacheHit: false,
      columns: model.recipes.length,
      rows: model.coefficients.length,
      basicColumns: basicColumns.length,
      solveMilliseconds,
      certificationMilliseconds: performance.now() - certificationStarted,
      reason,
    }
    if (certified !== null && !rate.isZero()) {
      const unitRates = baseModel.recipes.map((recipe) => (certified.rates.get(recipe) ?? zero).div(rate))
      const unitSurplus = baseModel.items.map((item) => (certified.surplus.get(item) ?? zero).div(rate))
      this.solutionCache.set(signature, { rates: unitRates, surplus: unitSurplus })
      if (this.solutionCache.size > 8) {
        const oldest = this.solutionCache.keys().next().value
        if (oldest !== undefined) this.solutionCache.delete(oldest)
      }
    }
    return certified
  }
}

export async function loadHighsQualityOptimizer(options: HighsLoaderOptions = {}): Promise<HighsQualityOptimizer> {
  const highs = await highsLoader(options)
  return new HighsQualityOptimizer(highs)
}

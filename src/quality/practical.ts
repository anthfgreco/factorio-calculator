import type { FactorySpecification } from "../factory.js"
import { one, Rational, zero } from "../math.js"
import type { Building, Module, Planet, Quality } from "../models.js"
import type { Item, Recipe } from "../recipes.js"
import type {
  QualifiedItemAmount,
  QualityOperationRate,
  QualityOptimizationObjective,
  QualityPlanProfile,
  QualityTargetPlan,
  QualityTierConfiguration,
} from "./contracts.js"
import { planQualitySurplusDisposal } from "./disposal.js"
import { addIngredient, QualityGraph, QualityGraphItem, QualityGraphRecipe } from "./graph.js"
import { qualityTransitionProbability } from "./math.js"
import {
  addCraftRecipe,
  findRecyclerRecipe,
  isQualifiedSolid,
  moduleTierConfiguration,
  operationCapacity,
  qualifiedItem,
  recyclerClosure,
  sortedQualifiedAmounts,
} from "./operations.js"

const IMPORT_WEIGHT = Rational.from_integer(1_000_000)
const LOCAL_RESOURCE_WEIGHT = one
const LOCAL_OPERATION_LEVEL = 0
const SOURCE_LEVEL = 1
const FULGORA_CURATED_PRODUCERS = new Map<string, string>([
  ["water", "ice-melting"],
  ["light-oil", "heavy-oil-cracking"],
  ["petroleum-gas", "light-oil-cracking"],
])

interface EmbeddedRecycler {
  readonly recipe: Recipe
  readonly configurations: readonly QualityTierConfiguration[]
}

function amountKey(item: Item, qualityLevel: number): string {
  return `${item.key}@q${qualityLevel}`
}

function mergeQualifiedAmounts(target: Map<string, QualifiedItemAmount>, values: Iterable<QualifiedItemAmount>): void {
  for (const value of values) {
    const key = amountKey(value.item, value.qualityLevel)
    const current = target.get(key)
    target.set(key, {
      item: value.item,
      qualityLevel: value.qualityLevel,
      amount: (current?.amount ?? zero).add(value.amount),
    })
  }
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

function isLocalRecipe(planet: Planet, recipe: Recipe): boolean {
  return planet.allowsRecipe(recipe)
}

function isUsableProducer(specification: FactorySpecification, planet: Planet, recipe: Recipe, item: Item): boolean {
  return (
    recipe.isReal() &&
    !recipe.isDisable() &&
    !recipe.categories.has("recycling") &&
    !specification.getNetDisable().disable.has(recipe) &&
    isLocalRecipe(planet, recipe) &&
    recipe.products.some((product) => product.item === item) &&
    (recipe.isResource() || choosePracticalBuilding(specification, planet, recipe) !== null)
  )
}

function choosePracticalBuilding(specification: FactorySpecification, planet: Planet, recipe: Recipe): Building | null {
  if (!planet.allowsRecipe(recipe)) return null
  const override = specification.getBuildingOverride(recipe)
  if (override !== null && override.canCraft(recipe) && planet.allowsBuilding(override)) return override

  const configured = specification.getBuilding(recipe)
  const candidates = specification
    .getCompatibleBuildings(recipe, false)
    .filter((building) => planet.allowsBuilding(building))
  const preferredKey = recipe.categories.has("metallurgy")
    ? "foundry"
    : recipe.categories.has("recycling")
      ? "recycler"
      : recipe.categories.has("electronics") || recipe.categories.has("electromagnetics")
        ? "electromagnetic-plant"
        : null
  return (
    candidates.find((building) => building.key === preferredKey) ??
    (configured !== null && candidates.includes(configured) ? configured : null) ??
    candidates.at(-1) ??
    null
  )
}

function getPreferredPracticalQualityRecipe(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly item: Item
  readonly preferredRecipe?: Recipe | null
  readonly curatedProducers?: ReadonlyMap<string, string>
}): Recipe | null {
  const { specification, planet, item, preferredRecipe = null, curatedProducers } = options

  const curatedKey = curatedProducers?.get(item.key)
  if (curatedKey !== undefined) {
    const curated = specification.recipes.get(curatedKey)
    if (curated !== undefined && isUsableProducer(specification, planet, curated, item)) {
      return curated
    }
  }
  if (preferredRecipe !== null && isUsableProducer(specification, planet, preferredRecipe, item)) {
    return preferredRecipe
  }

  const candidates = item.recipes.filter((candidate) => isUsableProducer(specification, planet, candidate, item))
  const resource = candidates.find((candidate) => candidate.isResource() && planet.resources.has(candidate))
  if (resource !== undefined) return resource
  const canonical = candidates.find((candidate) => candidate.key === item.key)
  return canonical ?? candidates.sort((left, right) => (left.order ?? "").localeCompare(right.order ?? ""))[0] ?? null
}

function availableModuleQuality(specification: FactorySpecification, configured: Quality): Quality {
  const available = specification.getAvailableQualities()
  return available.includes(configured) ? configured : (available.at(-1) ?? specification.getNormalQuality())
}

function bestModule(
  specification: FactorySpecification,
  recipe: Recipe,
  building: Building,
  quality: Quality,
  effect: "quality" | "productivity",
): Module | null {
  const explicit =
    effect === "quality" ? specification.qualityPlannerModule : specification.qualityPlannerProductivityModule
  if (
    explicit !== null &&
    zero.less(effect === "quality" ? explicit.qualityFor(quality) : explicit.productivityFor(quality)) &&
    explicit.canUse(recipe, building)
  ) {
    return explicit
  }

  let best: Module | null = null
  let bestEffect = zero
  for (const module of specification.modules.values()) {
    if (!module.canUse(recipe, building)) continue
    const value = effect === "quality" ? module.qualityFor(quality) : module.productivityFor(quality)
    if (best === null || bestEffect.less(value)) {
      best = module
      bestEffect = value
    }
  }
  return zero.less(bestEffect) ? best : null
}

function objectiveForPlan(specification: FactorySpecification): QualityOptimizationObjective {
  return specification.qualityPlannerObjective === "practical" ? "configured" : specification.qualityPlannerObjective
}

class PracticalQualityGraphBuilder {
  readonly graph = new QualityGraph()
  readonly operations = new Map<QualityGraphRecipe, QualityTierConfiguration>()
  readonly embeddedRecyclers = new Map<QualityGraphRecipe, EmbeddedRecycler>()
  private readonly expandedItems = new Set<string>()
  private readonly expandedProducers = new Set<string>()
  private readonly importedItems = new Set<QualityGraphItem>()
  private readonly configurations = new Map<string, readonly QualityTierConfiguration[]>()
  private readonly userDisabledRecipes: ReadonlySet<Recipe>
  private readonly plannerQuality: Quality
  private readonly productivityQuality: Quality

  constructor(
    readonly specification: FactorySpecification,
    readonly planet: Planet,
    readonly target: Item,
    readonly targetRecipe: Recipe,
    readonly targetQualityLevel: number,
    readonly objective: QualityOptimizationObjective,
    readonly curatedProducers: ReadonlyMap<string, string>,
    readonly profile: QualityPlanProfile,
  ) {
    this.userDisabledRecipes = specification.getNetDisable().disable
    this.plannerQuality = availableModuleQuality(specification, specification.qualityPlannerModuleQuality)
    this.productivityQuality = availableModuleQuality(
      specification,
      specification.qualityPlannerProductivityModuleQuality,
    )
  }

  build(): QualityGraphItem {
    if (this.planet.key === "fulgora") this.addFulgoraScrapNetwork()
    const output = this.graph.item(this.target, this.targetQualityLevel)
    this.ensureItem(output)
    return output
  }

  private addFulgoraScrapNetwork(): void {
    const scrap = this.specification.items.get("scrap")
    const miningRecipe = this.specification.recipes.get("scrap")
    if (scrap === undefined || miningRecipe === undefined || !this.isUsableProducer(miningRecipe, scrap)) return

    const miningConfiguration = this.getCraftConfigurations(miningRecipe, 0)[0]
    if (miningConfiguration === undefined) throw new Error("Missing Fulgora scrap mining configuration")
    const miningOperation = addCraftRecipe(
      this.graph,
      scrap,
      miningRecipe,
      0,
      0,
      this.specification.maxQualityLevel,
      miningConfiguration,
      [],
      `${this.planet.key}:scrap-source`,
    )
    this.operations.set(miningOperation, miningConfiguration)
    this.graph.setPriority(miningOperation, LOCAL_RESOURCE_WEIGHT, SOURCE_LEVEL)

    const queuedItems = new Set<string>([scrap.key])
    const recycledRecipes = new Set<Recipe>()
    const queue: Item[] = [scrap]
    while (queue.length > 0) {
      const recycledItem = queue.shift()
      if (recycledItem === undefined) break
      const recyclingRecipe = findRecyclerRecipe(this.specification, recycledItem)
      if (
        recyclingRecipe === null ||
        recycledRecipes.has(recyclingRecipe) ||
        !this.canRecycle(recyclingRecipe)
      ) {
        continue
      }
      recycledRecipes.add(recyclingRecipe)

      const recyclingConfigurations = this.getRecyclerConfigurations(recyclingRecipe)
      for (let inputQuality = 0; inputQuality <= this.specification.maxQualityLevel; inputQuality++) {
        const configuration = recyclingConfigurations[inputQuality]
        if (configuration === undefined) {
          throw new Error(`Missing Fulgora recycling configuration for ${recycledItem.name}`)
        }
        const operation = addCraftRecipe(
          this.graph,
          recycledItem,
          recyclingRecipe,
          inputQuality,
          0,
          this.specification.maxQualityLevel,
          configuration,
          [],
          `${this.planet.key}:source-recycling`,
        )
        this.operations.set(operation, configuration)
        this.setOperationTiebreak(operation, configuration)
      }

      for (const product of recyclingRecipe.products) {
        if (!isQualifiedSolid(product.item) || queuedItems.has(product.item.key)) continue
        queuedItems.add(product.item.key)
        queue.push(product.item)
      }
    }
  }

  getTargetConfigurations(): readonly QualityTierConfiguration[] {
    return this.getCraftConfigurations(this.targetRecipe, this.targetQualityLevel)
  }

  private chooseProducer(item: Item): Recipe | null {
    if (item === this.target) return this.isUsableProducer(this.targetRecipe, item) ? this.targetRecipe : null
    const curatedKey = this.curatedProducers.get(item.key)
    if (curatedKey !== undefined) {
      const curated = this.specification.recipes.get(curatedKey)
      if (curated !== undefined && this.isUsableProducer(curated, item)) return curated
    }

    const candidates = item.recipes.filter((recipe) => this.isUsableProducer(recipe, item))
    const resource = candidates.find((recipe) => recipe.isResource() && this.planet.resources.has(recipe))
    if (resource !== undefined) return resource
    const canonical = candidates.find((recipe) => recipe.key === item.key)
    return canonical ?? candidates.sort((left, right) => (left.order ?? "").localeCompare(right.order ?? ""))[0] ?? null
  }

  private isUsableProducer(recipe: Recipe, item: Item): boolean {
    return isUsableProducer(this.specification, this.planet, recipe, item)
  }

  private ensureItem(graphItem: QualityGraphItem): void {
    const item = graphItem.item
    if (this.expandedItems.has(graphItem.key)) return
    this.expandedItems.add(graphItem.key)

    const keepLevel = graphItem.qualityLevel ?? 0
    const producer = this.chooseProducer(item)
    if (producer !== null) this.ensureProducer(item, keepLevel, producer)

    if (keepLevel === 0 || producer === null) this.addImport(graphItem, item)
  }

  private addImport(graphItem: QualityGraphItem, item: Item): void {
    if (this.importedItems.has(graphItem)) return
    this.importedItems.add(graphItem)
    const qualityPenalty = graphItem.qualityLevel === null ? one : Rational.from_integer(10 ** graphItem.qualityLevel)
    this.graph.source(graphItem, item, IMPORT_WEIGHT.mul(qualityPenalty), SOURCE_LEVEL)
  }

  private ensureProducer(item: Item, keepLevel: number, recipe: Recipe): void {
    const producerKey = `${recipe.key}->${item.key}@q${keepLevel}`
    if (this.expandedProducers.has(producerKey)) return
    this.expandedProducers.add(producerKey)

    const craftConfigurations = this.getCraftConfigurations(recipe, keepLevel)
    const recycler = keepLevel > 0 && isQualifiedSolid(item) ? findRecyclerRecipe(this.specification, item) : null
    const usableRecycler =
      recycler !== null &&
      !this.userDisabledRecipes.has(recycler) &&
      isLocalRecipe(this.planet, recycler) &&
      choosePracticalBuilding(this.specification, this.planet, recycler) !== null
        ? recycler
        : null
    const recyclerConfigurations = usableRecycler === null ? [] : this.getRecyclerConfigurations(usableRecycler)
    const closures =
      usableRecycler === null
        ? []
        : recyclerClosure(
            this.graph,
            item,
            usableRecycler,
            keepLevel,
            this.specification.maxQualityLevel,
            recyclerConfigurations,
          )

    const hasSolidIngredients = recipe.ingredients.some(({ item: ingredient }) => isQualifiedSolid(ingredient))
    const highestInputQuality = isQualifiedSolid(item) && hasSolidIngredients ? this.specification.maxQualityLevel : 0
    for (let inputQuality = 0; inputQuality <= highestInputQuality; inputQuality++) {
      const configuration = craftConfigurations[inputQuality]
      if (configuration === undefined) throw new Error(`Missing practical configuration for ${recipe.name}`)
      const operation = addCraftRecipe(
        this.graph,
        item,
        recipe,
        inputQuality,
        usableRecycler === null ? 0 : keepLevel,
        this.specification.maxQualityLevel,
        configuration,
        closures,
        `${this.planet.key}:${item.key}:keep${keepLevel}`,
      )
      this.operations.set(operation, configuration)
      if (usableRecycler !== null) {
        this.embeddedRecyclers.set(operation, { recipe: usableRecycler, configurations: recyclerConfigurations })
      }
      this.setOperationTiebreak(operation, configuration)
      if (recipe.isResource()) this.graph.setPriority(operation, LOCAL_RESOURCE_WEIGHT, SOURCE_LEVEL)
      for (const ingredient of operation.ingredients) this.ensureItem(ingredient.item)
    }
  }

  private getCraftConfigurations(recipe: Recipe, keepLevel: number): readonly QualityTierConfiguration[] {
    const cacheKey = `craft:${recipe.key}:keep${keepLevel}`
    let configurations = this.configurations.get(cacheKey)
    if (configurations !== undefined) return configurations
    const building = choosePracticalBuilding(this.specification, this.planet, recipe)
    const qualityModule =
      building === null ? null : bestModule(this.specification, recipe, building, this.plannerQuality, "quality")
    const productivityModule =
      building === null
        ? null
        : bestModule(this.specification, recipe, building, this.productivityQuality, "productivity")
    configurations = Array.from({ length: this.specification.maxQualityLevel + 1 }, (_, qualityLevel) => {
      const qualityGoal = this.profile === "planet" ? this.targetQualityLevel : keepLevel
      const wantsQuality = qualityGoal > qualityLevel && recipe.allow_quality
      return moduleTierConfiguration({
        specification: this.specification,
        recipe,
        qualityLevel,
        building,
        module: wantsQuality ? qualityModule : productivityModule,
        moduleQuality: wantsQuality ? this.plannerQuality : this.productivityQuality,
        preserveBeacons: true,
      })
    })
    this.configurations.set(cacheKey, configurations)
    return configurations
  }

  private getRecyclerConfigurations(recipe: Recipe): readonly QualityTierConfiguration[] {
    const cacheKey = `recycler:${recipe.key}`
    let configurations = this.configurations.get(cacheKey)
    if (configurations !== undefined) return configurations
    const building = choosePracticalBuilding(this.specification, this.planet, recipe)
    const qualityModule =
      building === null ? null : bestModule(this.specification, recipe, building, this.plannerQuality, "quality")
    configurations = Array.from({ length: this.specification.maxQualityLevel + 1 }, (_, qualityLevel) =>
      moduleTierConfiguration({
        specification: this.specification,
        recipe,
        qualityLevel,
        building,
        module: qualityModule,
        moduleQuality: this.plannerQuality,
        preserveBeacons: true,
      }),
    )
    this.configurations.set(cacheKey, configurations)
    return configurations
  }

  private setOperationTiebreak(operation: QualityGraphRecipe, configuration: QualityTierConfiguration): void {
    const recipe = operation.metadata.baseRecipe
    if (recipe === null || recipe.isResource()) return
    const capacity = operationCapacity(this.specification, recipe, one, configuration)
    const cost = this.objective === "power" ? capacity.power : capacity.machineCount
    this.graph.setPriority(operation, cost.isZero() ? one : cost, LOCAL_OPERATION_LEVEL)
  }

  canRecycle(recipe: Recipe): boolean {
    return (
      !this.userDisabledRecipes.has(recipe) &&
      isLocalRecipe(this.planet, recipe) &&
      choosePracticalBuilding(this.specification, this.planet, recipe) !== null
    )
  }

  disposalConfiguration(recipe: Recipe, qualityLevel: number): QualityTierConfiguration {
    const configuration = this.getRecyclerConfigurations(recipe)[qualityLevel]
    if (configuration === undefined) throw new Error(`Missing recycler configuration for ${recipe.name}`)
    return configuration
  }
}

export function planPracticalQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly profile: QualityPlanProfile
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
  readonly curatedProducers?: ReadonlyMap<string, string>
  readonly profileWarnings?: readonly string[]
}): QualityTargetPlan {
  const {
    specification,
    planet,
    profile,
    item,
    recipe: preferredRecipe,
    requested,
    qualityLevel,
    curatedProducers = new Map(),
    profileWarnings = [],
  } = options
  if (qualityLevel <= 0) throw new Error(`${planet.name} quality planning requires a non-Normal target.`)
  const recipe = getPreferredPracticalQualityRecipe({
    specification,
    planet,
    item,
    preferredRecipe,
    curatedProducers,
  })
  if (recipe === null) throw new Error(`${item.name} has no usable ${planet.name} production recipe.`)

  const objective = objectiveForPlan(specification)
  const builder = new PracticalQualityGraphBuilder(
    specification,
    planet,
    item,
    recipe,
    qualityLevel,
    objective,
    curatedProducers,
    profile,
  )
  const output = builder.build()
  const totals = builder.graph.solve(output, requested, specification.getQualityGraphOptimizer())
  const sourceAmounts = new Map<string, QualifiedItemAmount>()
  const importedAmounts = new Map<string, QualifiedItemAmount>()
  const operations: QualityOperationRate[] = []
  const hiddenRecyclerRates = new Map<
    string,
    { recipe: Recipe; qualityLevel: number; rate: Rational; configuration: QualityTierConfiguration }
  >()
  let totalCrafts = zero
  let totalRecycles = zero
  let totalMachineCount = zero
  let totalPower = zero

  const addSource = (graphItem: QualityGraphItem, amount: Rational): void => {
    if (amount.isZero()) return
    mergeQualifiedAmounts(sourceAmounts, [{ item: graphItem.item, qualityLevel: graphItem.qualityLevel ?? 0, amount }])
  }

  for (const [solverRecipe, rate] of totals.rates) {
    if (!(solverRecipe instanceof QualityGraphRecipe) || rate.isZero()) continue
    const baseRecipe = solverRecipe.metadata.baseRecipe
    if (baseRecipe === null) {
      if (solverRecipe.metadata.kind === "source") {
        const product = solverRecipe.products[0]
        if (product !== undefined) {
          const amount = rate.mul(product.amount)
          addSource(product.item, amount)
          mergeQualifiedAmounts(importedAmounts, [
            { item: product.item.item, qualityLevel: product.item.qualityLevel ?? 0, amount },
          ])
        }
      }
      continue
    }
    const quality = solverRecipe.metadata.qualityLevel
    const configuration = builder.operations.get(solverRecipe)
    if (quality === null || configuration === undefined) continue
    const capacity = operationCapacity(specification, baseRecipe, rate, configuration)
    let kind: QualityOperationRate["kind"] = "craft"
    if (baseRecipe.isResource()) kind = "source"
    else if (baseRecipe.categories.has("recycling")) kind = "recycle"
    operations.push({
      recipe: baseRecipe,
      qualityLevel: quality,
      rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind,
      configuration,
    })
    if (kind === "source") {
      for (const product of solverRecipe.products) addSource(product.item, rate.mul(product.amount))
    } else if (kind === "recycle") {
      totalRecycles = totalRecycles.add(rate)
    } else {
      totalCrafts = totalCrafts.add(rate)
    }
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)

    const embedded = builder.embeddedRecyclers.get(solverRecipe)
    if (embedded === undefined) continue
    for (let recyclerQuality = 0; recyclerQuality <= specification.maxQualityLevel; recyclerQuality++) {
      const recycleRate = rate.mul(solverRecipe.metadata.recycleRatesByQuality?.[recyclerQuality] ?? zero)
      if (recycleRate.isZero()) continue
      const key = `${embedded.recipe.key}@q${recyclerQuality}`
      const current = hiddenRecyclerRates.get(key)
      const configuration = embedded.configurations[recyclerQuality]
      if (configuration === undefined) continue
      hiddenRecyclerRates.set(key, {
        recipe: embedded.recipe,
        qualityLevel: recyclerQuality,
        rate: (current?.rate ?? zero).add(recycleRate),
        configuration,
      })
    }
  }

  for (const row of hiddenRecyclerRates.values()) {
    const capacity = operationCapacity(specification, row.recipe, row.rate, row.configuration)
    operations.push({
      recipe: row.recipe,
      qualityLevel: row.qualityLevel,
      rate: row.rate,
      machineCount: capacity.machineCount,
      power: capacity.power,
      kind: "recycle",
      configuration: row.configuration,
    })
    totalRecycles = totalRecycles.add(row.rate)
    totalMachineCount = totalMachineCount.add(capacity.machineCount)
    totalPower = totalPower.add(capacity.power)
  }

  let surplusOutputs: readonly QualifiedItemAmount[] = sortedQualifiedAmounts(
    [...totals.surplus].filter(([surplus]) => surplus instanceof QualityGraphItem) as [QualityGraphItem, Rational][],
  )
  const disposal = planQualitySurplusDisposal({
    specification,
    target: item,
    keepLevel: qualityLevel,
    surplus: surplusOutputs,
    canRecycle: (candidate) => builder.canRecycle(candidate),
    getConfiguration: (candidate, level) => builder.disposalConfiguration(candidate, level),
    cycleLabel: planet.name,
  })
  operations.push(...disposal.operations)
  surplusOutputs = disposal.terminalOutputs
  mergeQualifiedAmounts(sourceAmounts, disposal.extraFreshInputs)
  mergeQualifiedAmounts(importedAmounts, disposal.extraFreshInputs)
  totalRecycles = totalRecycles.add(disposal.totalRecycles)
  totalMachineCount = totalMachineCount.add(disposal.totalMachineCount)
  totalPower = totalPower.add(disposal.totalPower)

  operations.sort((left, right) => {
    const kindOrder = { source: 0, craft: 1, recycle: 2, dispose: 3 } as const
    const kind = kindOrder[left.kind] - kindOrder[right.kind]
    if (kind !== 0) return kind
    const order = (left.recipe.order ?? "").localeCompare(right.recipe.order ?? "")
    return order === 0 ? left.qualityLevel - right.qualityLevel : order
  })

  const fresh = sortedAmountMap(sourceAmounts)
  const freshInputs = fresh.filter(({ item: input }) => input.phase === "solid")
  const importedInputs = sortedAmountMap(importedAmounts)
  const fluidInputs = fresh.filter(({ item: input }) => input.phase !== "solid")
  const craftConfigurations = builder.getTargetConfigurations()
  const firstPassChance = qualityTransitionProbability(
    craftConfigurations[0]?.qualityChance ?? zero,
    0,
    qualityLevel,
    specification.maxQualityLevel,
  )
  const recyclerRecipe = findRecyclerRecipe(specification, item)
  const warnings = [
    ...profileWarnings,
    "Quality modules are used before the requested quality; guaranteed requested-quality crafting uses the configured productivity module and quality where compatible.",
    "Lower-quality products are processed through their real recycler recipes. Irreducible or intentionally retained byproducts remain listed.",
    "Expected steady-state throughput; low-volume high-quality output will be lumpy.",
  ]
  if (!specification.selectedPlanets.has(planet)) {
    warnings.unshift(`The plan uses ${planet.name} availability because the target is in automatic quality mode.`)
  }
  warnings.push(
    `Inputs unavailable from ${planet.name} resources are shown as imports rather than silently treated as Normal local materials.`,
  )

  return {
    profile,
    planetKey: planet.key,
    objective,
    item,
    recipe,
    recyclerRecipe,
    qualityLevel,
    requested,
    firstPassChance,
    freshInputs,
    importedInputs,
    fluidInputs,
    surplusOutputs,
    operations,
    totalCrafts,
    totalRecycles,
    totalMachineCount,
    totalPower,
    warnings,
  }
}

export function planPlanetQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly planet: Planet
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
}): QualityTargetPlan {
  return planPracticalQualityTarget({
    ...options,
    profile: "planet",
    curatedProducers: options.planet.key === "fulgora" ? FULGORA_CURATED_PRODUCERS : undefined,
    profileWarnings: [
      options.planet.key === "fulgora"
        ? "Fulgora practical mode starts at quality-moduled scrap mining, recycles every scrap quality locally, " +
          "and reuses generated recycler outputs before importing materials."
        : `${options.planet.name} practical mode recursively produces quality-qualified intermediates from local resources and qualityless fluids.`,
    ],
  })
}

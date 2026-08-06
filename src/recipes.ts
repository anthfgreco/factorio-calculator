import { create } from "d3"
import { normalizeSearchText, sorted, type CalculatorData, type RecipeAmountData, type RecipeData } from "./data.js"
import { one, Rational, zero } from "./math.js"
import { currentSpecification } from "./models.js"
import { Icon, sprites } from "./presentation.js"
import { addItemToMaximumPriority, DISABLED_RECIPE_PREFIX, type PriorityMutationList } from "./priorities.js"
import { Ingredient, type SolverRecipe } from "./solver.js"

function requireItem(items: ReadonlyMap<string, Item>, key: string): Item {
  const item = items.get(key)
  if (item === undefined) throw new Error(`Dataset is missing required item ${key}`)
  return item
}

function requireElement<T extends Element>(element: T | null, label: string): T {
  if (element === null) throw new Error(`Unable to create ${label}`)
  return element
}

function requireSprite(key: string): { icon: Icon } {
  const sprite = sprites.get(key)
  if (sprite === undefined) throw new Error(`Sprite sheet is missing ${key}`)
  return sprite
}

// -----------------------------------------------------------------------------
// Items
// -----------------------------------------------------------------------------

export type ItemPhase = "solid" | "fluid" | "abstract"

export class Item {
  readonly recipes: Recipe[] = []
  readonly uses: Recipe[] = []
  readonly icon: Icon
  readonly disableRecipe: DisabledRecipe
  spoilTime: Rational | null = null
  spoilResult: Item | null = null

  constructor(
    readonly key: string,
    readonly name: string,
    readonly icon_col: number,
    readonly icon_row: number,
    readonly phase: ItemPhase,
    readonly group: string,
    readonly subgroup: string,
    readonly order: string,
    readonly stackSize = 1,
  ) {
    this.icon = new Icon(this)

    this.disableRecipe = new DisabledRecipe(this)
  }
  allRecipes(): (Recipe | DisabledRecipe)[] {
    return [...this.recipes, this.disableRecipe]
  }
  addRecipe(recipe: Recipe): void {
    this.recipes.push(recipe)
  }
  addUse(recipe: Recipe): void {
    this.uses.push(recipe)
  }
  renderTooltip(extra?: Node): HTMLElement {
    if (this.recipes.length === 1 && this.recipes[0]!.name === this.name) {
      return this.recipes[0]!.renderTooltip(extra)
    }
    let self = this
    let t = create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true, undefined))
    header.append("span").text(self.name)
    if (extra) {
      requireElement(t.node(), "item tooltip").append(extra)
    }
    return requireElement(t.node(), "item tooltip")
  }
}

export function getItems(data: CalculatorData): Map<string, Item> {
  const items = new Map<string, Item>()
  for (let d of data.items) {
    if (!d.localized_name) {
      console.log("bad item:", d)
      continue
    }
    const phase: ItemPhase = d.type === "fluid" ? "fluid" : "solid"
    items.set(
      d.key,
      new Item(
        d.key,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        phase,
        d.group,
        d.subgroup,
        d.order,
        d.stack_size ?? 1,
      ),
    )
  }
  let cycleKey = "nuclear-reactor-cycle"
  const reactor = requireItem(items, "nuclear-reactor")
  items.set(
    cycleKey,
    new Item(
      cycleKey,
      "Nuclear reactor cycle",
      reactor.icon_col,
      reactor.icon_row,
      "abstract",
      "production",
      "energy",
      "f[nuclear-energy]-d[reactor-cycle]",
    ),
  )
  return items
}

// -----------------------------------------------------------------------------
// Recipes
// -----------------------------------------------------------------------------

export { Ingredient } from "./solver.js"

export class SurfaceCondition {
  readonly min?: number
  readonly max?: number

  constructor(
    readonly property: string,
    min: number | undefined,
    max: number | undefined,
  ) {
    if (min !== undefined) this.min = min
    if (max !== undefined) this.max = max
  }
}

export class Recipe implements SolverRecipe {
  readonly categories: Set<string>
  readonly category: string | null
  readonly icon: Icon
  readonly allow_productivity: boolean
  readonly allow_quality: boolean
  readonly defaultPriority: number | undefined = undefined
  readonly defaultWeight: Rational | undefined = undefined
  readonly processKind: string | undefined = undefined
  readonly harvestEmissions: Readonly<Record<string, Rational>> | undefined = undefined
  readonly miningTime: Rational | undefined = undefined

  constructor(
    readonly key: string,
    readonly name: string,
    readonly order: string | null,
    readonly icon_col: number,
    readonly icon_row: number,
    allowProductivity: boolean,
    allowQuality: boolean | undefined,
    categories: string | readonly string[] | null | undefined,
    readonly time: Rational,
    readonly ingredients: Ingredient<Item, Rational>[],
    readonly products: Ingredient<Item, Rational>[],
    readonly conditions: SurfaceCondition[] = [],
    readonly maximumProductivity: Rational | null = null,
  ) {
    this.allow_productivity = allowProductivity
    this.allow_quality = allowQuality !== false
    const normalizedCategories =
      categories === undefined || categories === null ? [] : typeof categories === "string" ? [categories] : categories
    this.categories = new Set(normalizedCategories)
    // Retain the old property for third-party consumers. Internal code
    // uses categories so Factorio 2.1 recipes can be made in any eligible
    // machine category.
    this.category = this.categories.values().next().value ?? null
    for (let ing of ingredients) {
      ing.item.addUse(this)
    }
    for (let ing of products) {
      ing.item.addRecipe(this)
    }

    const primaryProduct = products[0]
    if (primaryProduct === undefined) throw new Error(`Recipe ${key} has no products`)
    this.icon = new Icon(this, primaryProduct.item.name)
  }
  fuelIngredient(): Ingredient<Item, Rational>[] {
    let spec = currentSpecification()
    let building = spec.getBuilding(this)
    let fuel = spec.getFuelForRecipe(this)
    if (building === null || fuel === null) {
      return []
    }
    // baseRate = craft/s
    // basePower = J/s
    // perCraftEnergy = J/s / craft/s = J/craft
    // fuel.value = J/i
    // fuelAmount = J/craft / J/i = i/craft
    const baseRate = spec.getRecipeRate(this)
    if (baseRate === null) {
      throw new Error(`Recipe ${this.key} has no machine rate`)
    }
    let basePower = spec.getPowerUsage(this, baseRate).power
    let perCraftEnergy = basePower.div(baseRate)
    let fuelAmount = perCraftEnergy.div(fuel.value)
    return [new Ingredient(fuel.item, fuelAmount)]
  }
  getIngredients(): Ingredient<Item, Rational>[] {
    return this.ingredients.concat(this.fuelIngredient())
  }
  gives(item: Item): Rational {
    let spec = currentSpecification()
    let prodEffect = spec.getProdEffect(this).sub(one)
    for (let ing of this.products) {
      if (ing.item === item) {
        if (!prodEffect.isZero()) {
          let productiveAmount = ing.productivityAmount
          if (productiveAmount === null) {
            // Compatibility with older datasets that did not
            // export ignored_by_productivity. Their return products
            // were represented by subtracting same-item inputs.
            productiveAmount = ing.amount.sub(this.uses(item))
            if (productiveAmount.less(zero)) {
              return ing.amount
            }
          }
          return ing.amount.add(productiveAmount.mul(prodEffect))
        }
        return ing.amount
      }
    }
    throw new Error("recipe does not give item")
  }
  // There's an asymmetry with gives() here: It returns zero if the recipe
  // does not have this item as an ingredient.
  uses(item: Item): Rational {
    for (let ing of this.getIngredients()) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    return zero
  }
  isNetProducer(item: Item): boolean {
    let amount = this.gives(item)
    return zero.less(amount.sub(this.uses(item)))
  }
  isResource(): boolean {
    return false
  }
  isReal(): boolean {
    return true
  }
  isDisable(): boolean {
    return false
  }
  renderTooltip(extra?: Node): HTMLElement {
    let self = this
    let t = create("div").classed("frame recipe", true).datum(this)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true, undefined))
    let name = this.name
    if (this.products.length === 1 && this.products[0]!.item.name === this.name && one.less(this.products[0]!.amount)) {
      name = this.products[0]!.amount.toDecimal() + " \u00d7 " + name
    }
    header.append("span").text("\u00A0" + name)
    if (extra) {
      requireElement(t.node(), "recipe tooltip").append(extra)
    }
    if (this.ingredients.length === 0) {
      return requireElement(t.node(), "recipe tooltip")
    }
    if (this.products.length > 1 || this.products[0]!.item.name !== this.name) {
      let productLine = t.append("div")
      productLine.append("span").text("Products:")
      let product = productLine.append("span").selectAll("span").data(this.products).join("span")
      product.append("span").text("\u00A0")
      let prodIcon = product.append("div").classed("product", true)
      prodIcon.append((d: Ingredient<Item, Rational>) => d.item.icon.make(32, true, undefined))
      prodIcon
        .append("span")
        .classed("count", true)
        .text((d: Ingredient<Item, Rational>) => d.amount.toDecimal())
    }
    let time = t.append("div")
    time
      .append("div")
      .classed("product", true)
      .append(() => requireSprite("clock").icon.make(32, true, undefined))
    time.append("span").text("\u00A0" + this.time.toDecimal())
    let ingredient = t.append("div").selectAll("div").data(this.ingredients).join("div")
    ingredient
      .append("div")
      .classed("product", true)
      .append((d: Ingredient<Item, Rational>) => d.item.icon.make(32, true, undefined))
    ingredient
      .append("span")
      .text((d: Ingredient<Item, Rational>) => `\u00A0${d.amount.toDecimal()} \u00d7 ${d.item.name}`)
    return requireElement(t.node(), "recipe tooltip")
  }
}

const ASTEROID_CHUNK_RESOURCE_KEYS = new Set([
  "carbonic-asteroid-chunk",
  "metallic-asteroid-chunk",
  "oxide-asteroid-chunk",
  "promethium-asteroid-chunk",
])

// Pseudo-recipe representing the ex nihilo production of items with all
// recipes disabled.
export class DisabledRecipe implements SolverRecipe {
  readonly key: string
  readonly name: string
  readonly categories = new Set<string>()
  readonly category: null = null
  readonly ingredients: Ingredient<Item, Rational>[] = []
  readonly products: Ingredient<Item, Rational>[]
  readonly icon_col: number
  readonly icon_row: number
  readonly icon: Icon

  constructor(item: Item) {
    this.key = DISABLED_RECIPE_PREFIX + item.key
    this.name = item.name
    this.products = [new Ingredient(item, one)]
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
  getIngredients(): Ingredient<Item, Rational>[] {
    return this.ingredients
  }
  gives(item: Item): Rational {
    for (let ing of this.products) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    throw new Error(`Disabled recipe ${this.key} does not produce ${item.key}`)
  }
  isResource(): boolean {
    return false
  }
  isReal(): boolean {
    return true
  }
  isDisable(): boolean {
    return true
  }
}

function getResultProbability(result: RecipeAmountData): number | null {
  let probability = result.independent_probability ?? result.probability ?? 1
  if (result.shared_probability !== undefined) {
    let min = result.shared_probability.min ?? 0
    let max = result.shared_probability.max ?? 1
    probability *= max - min
  }
  return probability === 1 ? null : probability
}

function applyResultProbability(amount: Rational, result: RecipeAmountData): Rational {
  let probability = getResultProbability(result)
  if (probability !== null) {
    amount = amount.mul(Rational.from_float_approximate(probability))
  }
  return amount
}

export function getExpectedResultAmount(result: RecipeAmountData): Rational {
  let amount
  if (result.amount !== undefined) {
    amount = Rational.from_float_approximate(result.amount)
  } else if (result.amount_min !== undefined || result.amount_max !== undefined) {
    const min = result.amount_min ?? result.amount_max
    const max = result.amount_max ?? result.amount_min
    if (min === undefined || max === undefined) throw new Error("Recipe result range is incomplete")
    amount = Rational.from_float_approximate((min + max) / 2)
  } else {
    amount = one
  }

  if (result.extra_count_fraction !== undefined) {
    amount = amount.add(Rational.from_float_approximate(result.extra_count_fraction))
  }

  return applyResultProbability(amount, result)
}

function getProductivityAmount(result: RecipeAmountData, totalAmount: Rational): Rational | null {
  if (result.ignored_by_productivity === undefined) {
    return null
  }
  let ignored = Rational.from_float_approximate(result.ignored_by_productivity)
  ignored = applyResultProbability(ignored, result)
  return totalAmount.sub(ignored)
}

function makeRecipe(_data: CalculatorData, items: Map<string, Item>, d: RecipeData): Recipe | null {
  let time = Rational.from_float_approximate(d.energy_required)
  const products: Ingredient<Item, Rational>[] = []
  for (let result of d.results) {
    const item = items.get(result.name)
    if (item === undefined) return null
    let amount = getExpectedResultAmount(result)
    products.push(new Ingredient(item, amount, getProductivityAmount(result, amount)))
  }
  const ingredients: Ingredient<Item, Rational>[] = []
  for (let { name, amount } of d.ingredients) {
    const item = items.get(name)
    if (!item) {
      return null
    }
    if (amount === undefined) return null
    ingredients.push(new Ingredient(item, Rational.from_float_approximate(amount)))
  }
  const conditions: SurfaceCondition[] = []
  if (d.surface_conditions) {
    for (let { property, min, max } of d.surface_conditions) {
      conditions.push(new SurfaceCondition(property, min, max))
    }
  }
  return new Recipe(
    d.key,
    d.localized_name.en,
    d.order,
    d.icon_col,
    d.icon_row,
    d.allow_productivity,
    d.allow_quality,
    d.categories ?? d.category,
    time,
    ingredients,
    products,
    conditions,
    Rational.from_float_approximate(d.maximum_productivity ?? 3),
  )
}

export class RecipeMap extends Map<string, Recipe> {
  private readonly aliases: Map<string, string>

  constructor(aliases: Record<string, string> | undefined) {
    super()
    this.aliases = new Map(Object.entries(aliases ?? {}))
  }
  resolveKey(key: string): string {
    return this.aliases.get(key) ?? key
  }
  override get(key: string): Recipe | undefined {
    return super.get(this.resolveKey(key))
  }
  override has(key: string): boolean {
    return super.has(this.resolveKey(key))
  }
}

export class ResourceRecipe extends Recipe {
  override readonly defaultPriority: number
  override readonly defaultWeight: Rational

  constructor(item: Item, category: string | null, priority: number, weight: Rational) {
    super(
      item.key,
      item.name,
      item.order,
      item.icon_col,
      item.icon_row,
      false,
      true,
      category,
      zero,
      [],
      [new Ingredient(item, one)],
      [],
    )
    this.defaultPriority = priority
    this.defaultWeight = weight
  }
  override isResource(): boolean {
    return true
  }
}

export class SpoilageRecipe extends Recipe {
  override readonly processKind = "spoilage"

  constructor(from_item: Item, to_item: Item, spoilTime: Rational) {
    let key = `${from_item.key}-spoilage`
    let name = `${from_item.name} to ${to_item.name} (Spoilage)`
    super(
      key,
      name,
      null,
      to_item.icon_col,
      to_item.icon_row,
      false,
      true,
      null,
      spoilTime,
      [new Ingredient(from_item, one)],
      [new Ingredient(to_item, one)],
      [],
    )
  }
}

export class PlantRecipe extends Recipe {
  override readonly processKind = "growth"
  override readonly harvestEmissions: Readonly<Record<string, Rational>>
  override readonly defaultPriority = 1
  override readonly defaultWeight = Rational.from_float(100)

  constructor(
    key: string,
    name: string,
    order: string | null,
    col: number,
    row: number,
    seed: Item,
    results: Ingredient<Item, Rational>[],
    conditions: SurfaceCondition[],
    growthTime: Rational,
    harvestEmissions: Readonly<Record<string, number>> = {},
  ) {
    super(
      key,
      name,
      order,
      col,
      row,
      false,
      true,
      "agriculture",
      growthTime,
      [new Ingredient(seed, one)],
      results,
      conditions,
    )
    this.harvestEmissions = Object.fromEntries(
      Object.entries(harvestEmissions).map(([pollutant, amount]) => [
        pollutant,
        Rational.from_float_approximate(amount),
      ]),
    )
  }
  override isResource(): boolean {
    return true
  }
}

export class MiningRecipe extends Recipe {
  override readonly miningTime: Rational
  override readonly defaultPriority = 1
  override readonly defaultWeight = Rational.from_float(100)

  constructor(
    key: string,
    name: string,
    order: string | null,
    col: number,
    row: number,
    category: string,
    miningTime: Rational,
    ingredients: Ingredient<Item, Rational>[] | null,
    products: Ingredient<Item, Rational>[],
  ) {
    if (!ingredients) {
      ingredients = []
    }
    super(key, name, order, col, row, true, true, category, zero, ingredients, products, [])
    this.miningTime = miningTime
  }
  override isResource(): boolean {
    return true
  }
}

export class OffshorePumpRecipe extends Recipe {
  override readonly defaultPriority = 0
  override readonly defaultWeight = Rational.from_float(100)

  constructor(key: string, name: string, order: string | null, col: number, row: number, product: Item) {
    super(key, name, order, col, row, false, true, "offshore-pumping", zero, [], [new Ingredient(product, one)], [])
  }
  override isResource(): boolean {
    return true
  }
}

function getSteam(data: CalculatorData): [Rational, Rational] {
  let R = Rational.from_float
  let boilerDef = data.boilers.find((entry) => entry.key === "boiler")
  let water = data.fluids.find((entry) => entry.item_key === "water")
  let steam = data.fluids.find((entry) => entry.item_key === "steam")
  if (boilerDef === undefined || water === undefined || steam === undefined) {
    throw new Error("Dataset is missing the base boiler, water, or steam prototype")
  }
  let power = R(boilerDef.energy_consumption)
  let tempDelta = R(boilerDef.target_temperature).sub(R(water.default_temperature))
  // heat_capacity is denominated in J/degrees C/unit.
  let waterCap = R(water.heat_capacity)
  let steamCap = R(steam.heat_capacity)
  // water/second
  let waterRate = power.div(tempDelta.mul(waterCap))
  // steam/second
  let steamRate = power.div(tempDelta.mul(steamCap))
  return [waterRate, steamRate]
}

export function getRecipes(data: CalculatorData, items: Map<string, Item>): RecipeMap {
  let hundred = Rational.from_float(100)
  let recipes = new RecipeMap(data.recipe_aliases)
  let reactor = requireItem(items, "nuclear-reactor")
  let used_cell_name = "used-up-uranium-fuel-cell"
  if (!items.has(used_cell_name)) {
    used_cell_name = "depleted-uranium-fuel-cell"
  }
  recipes.set(
    "nuclear-reactor-cycle",
    new Recipe(
      "nuclear-reactor-cycle",
      "Nuclear reactor cycle",
      reactor.order,
      reactor.icon_col,
      reactor.icon_row,
      false,
      true,
      "nuclear",
      Rational.from_float(200),
      [new Ingredient(requireItem(items, "uranium-fuel-cell"), one)],
      [
        new Ingredient(requireItem(items, used_cell_name), one),
        new Ingredient(requireItem(items, "nuclear-reactor-cycle"), one),
      ],
    ),
  )
  if (items.has("satellite")) {
    let rocket = requireItem(items, "rocket-silo")
    recipes.set(
      "rocket-launch",
      new Recipe(
        "rocket-launch",
        "Rocket launch",
        rocket.order,
        rocket.icon_col,
        rocket.icon_row,
        false,
        true,
        "rocket-launch",
        one,
        [
          new Ingredient(
            requireItem(items, "rocket-part"),
            Rational.from_float_approximate(data.rocket_launch?.parts_per_launch ?? 100),
          ),
          new Ingredient(requireItem(items, "satellite"), one),
        ],
        [new Ingredient(requireItem(items, "space-science-pack"), Rational.from_float(1000))],
      ),
    )
  }
  let steam = requireItem(items, "steam")
  let [waterRate, steamRate] = getSteam(data)
  recipes.set(
    "steam",
    new Recipe(
      "steam",
      "Steam",
      steam.order,
      steam.icon_col,
      steam.icon_row,
      false,
      true,
      "boiler",
      one,
      [new Ingredient(requireItem(items, "water"), waterRate)],
      [new Ingredient(requireItem(items, "steam"), steamRate)],
    ),
  )
  for (let d of data.recipes) {
    /*if (d.key.endsWith("-recycling")) {
            continue
        }*/
    let r = makeRecipe(data, items, d)
    if (r) {
      recipes.set(d.key, r)
    }
  }
  for (let d of data.resources) {
    let category = d.category
    if (!category) {
      category = "basic-solid"
    }
    if (category === "basic-fluid") {
      const products: Ingredient<Item, Rational>[] = []
      for (let result of d.results) {
        products.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
      }
      recipes.set(
        d.key,
        new MiningRecipe(
          d.key,
          d.localized_name.en,
          d.order ?? null,
          d.icon_col,
          d.icon_row,
          category,
          Rational.from_float_approximate(d.mining_time),
          [],
          products,
        ),
      )
      continue
    }
    let ingredients = null
    if (d.required_fluid !== undefined && d.fluid_amount !== undefined) {
      ingredients = [
        new Ingredient(requireItem(items, d.required_fluid), Rational.from_float_approximate(d.fluid_amount / 10)),
      ]
    }
    const products: Ingredient<Item, Rational>[] = []
    for (let result of d.results) {
      products.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
    }
    recipes.set(
      d.key,
      new MiningRecipe(
        d.key,
        d.localized_name.en,
        d.order ?? null,
        d.icon_col,
        d.icon_row,
        category,
        Rational.from_float_approximate(d.mining_time),
        ingredients,
        products,
      ),
    )
  }
  const offshoreItems = new Set<string>()
  if (data.planets) {
    for (let planet of data.planets) {
      for (let key of planet.resources.offshore ?? []) {
        offshoreItems.add(key)
      }
    }
  } else {
    offshoreItems.add("water")
  }
  for (let key of offshoreItems) {
    const item = requireItem(items, key)
    const r = new OffshorePumpRecipe(key, item.name, item.order, item.icon_col, item.icon_row, item)
    if (recipes.has(key)) {
      console.log("duplicate key:", key)
    }
    recipes.set(key, r)
  }
  if (data.plants) {
    for (let plant of data.plants) {
      const results: Ingredient<Item, Rational>[] = []
      for (let result of plant.results) {
        results.push(new Ingredient(requireItem(items, result.name), getExpectedResultAmount(result)))
      }
      const conditions: SurfaceCondition[] = []
      if (plant.surface_conditions) {
        for (let { property, min, max } of plant.surface_conditions) {
          conditions.push(new SurfaceCondition(property, min, max))
        }
      }
      let r = new PlantRecipe(
        plant.key,
        plant.localized_name.en,
        plant.order ?? null,
        plant.icon_col,
        plant.icon_row,
        requireItem(items, plant.seed),
        results,
        conditions,
        Rational.from_float_approximate(plant.growth_ticks / 60),
        plant.harvest_emissions ?? {},
      )
      recipes.set(plant.key, r)
    }
  }
  if (data.spoilage) {
    for (let spoil of data.spoilage) {
      const from_item = requireItem(items, spoil.from_item)
      const to_item = requireItem(items, spoil.to_item)
      let spoilTime = Rational.from_float_approximate(spoil.time / 60)
      from_item.spoilTime = spoilTime
      from_item.spoilResult = to_item
      let r = new SpoilageRecipe(from_item, to_item, spoilTime)
      recipes.set(r.key, r)
    }
  }
  // Asteroid chunks are gathered directly by platform collectors. They may
  // also be returned by processing recipes, so they need explicit resource
  // recipes even though they already have other producers.
  for (let itemKey of ASTEROID_CHUNK_RESOURCE_KEYS) {
    let item = items.get(itemKey)
    if (item !== undefined && !recipes.has(itemKey)) {
      recipes.set(itemKey, new ResourceRecipe(item, null, 1, hundred))
    }
  }

  // Reap items both produced by no recipes and consumed by no recipes.
  let reapItems = []
  for (let [itemKey, item] of items) {
    if (item.recipes.length === 0 && item.uses.length === 0) {
      reapItems.push(itemKey)
    } else if (item.recipes.length === 0) {
      console.log("item with no recipes:", item)
      let priority = ASTEROID_CHUNK_RESOURCE_KEYS.has(itemKey) ? 1 : 2
      recipes.set(itemKey, new ResourceRecipe(item, null, priority, hundred))
    }
  }
  for (let key of reapItems) {
    items.delete(key)
  }
  return recipes
}

export interface RecipeSettingsSpecification {
  readonly recipes: Map<string, Recipe>
  readonly buildingKeys: Map<string, { readonly name: string; canCraft(recipe: Recipe): boolean }> | null
  readonly planetaryBaseline: Set<Recipe> | null
  readonly disable: Set<Recipe>
  readonly ignore: Set<Item>
  readonly buildTargets: readonly {
    readonly item: Item
    readonly recipe: Recipe | null
    readonly changedBuilding: boolean
    displayRecipes(): void
  }[]
  readonly priority: PriorityMutationList
}

// -----------------------------------------------------------------------------
// Recipe settings queries
// -----------------------------------------------------------------------------

const CATEGORY_ORDER = new Map([
  ["resources", 0],
  ["crafting", 10],
  ["advanced-crafting", 11],
  ["crafting-with-fluid", 12],
  ["smelting", 20],
  ["metallurgy", 21],
  ["chemistry", 30],
  ["oil-processing", 31],
  ["organic", 40],
  ["captive-spawner-process", 41],
  ["electromagnetics", 50],
  ["cryogenics", 60],
  ["crushing", 70],
  ["centrifuging", 80],
  ["rocket-building", 90],
  ["hand-crafting", 100],
  ["other", 1000],
])

function compactRecipeSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function humanizeRecipeCategory(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function isRecyclingRecipe(recipe: Recipe): boolean {
  return recipe.categories?.has("recycling") || recipe.category === "recycling" || recipe.key.endsWith("-recycling")
}

export interface RecipeSelectorGroup {
  readonly key: string
  readonly name: string
  readonly recipes: Recipe[]
}

export function getRecipeSelectorGroups(recipes: readonly Recipe[], activeRecipe: Recipe): RecipeSelectorGroup[] {
  function orderGroup(groupRecipes: readonly Recipe[]): Recipe[] {
    return [...groupRecipes].sort((recipeA, recipeB) => {
      if (recipeA === activeRecipe) {
        return -1
      }
      if (recipeB === activeRecipe) {
        return 1
      }
      const nameOrder = recipeA.name.localeCompare(recipeB.name)
      return nameOrder === 0 ? recipeA.key.localeCompare(recipeB.key) : nameOrder
    })
  }

  const productionRecipes = recipes.filter((recipe) => !isRecyclingRecipe(recipe))
  const recyclingRecipes = recipes.filter(isRecyclingRecipe)
  return [
    { key: "production", name: "Production", recipes: orderGroup(productionRecipes) },
    { key: "recycling", name: "Recycling", recipes: orderGroup(recyclingRecipes) },
  ].filter((group) => group.recipes.length > 0)
}

export function getRecipeSettingsCategory(recipe: Recipe): string {
  if (recipe.isResource?.()) {
    return "resources"
  }
  return recipe.category ?? recipe.categories?.values().next().value ?? "other"
}

function getCompatibleBuildingNames(spec: RecipeSettingsSpecification, recipe: Recipe): string[] {
  const names = []
  for (const building of spec.buildingKeys?.values?.() ?? []) {
    if (building.canCraft?.(recipe)) {
      names.push(building.name)
    }
  }
  return names
}

export function recipeMatchesSettingsSearch(spec: RecipeSettingsSpecification, recipe: Recipe, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const values = [
    recipe.name,
    recipe.key,
    humanizeRecipeCategory(getRecipeSettingsCategory(recipe)),
    ...recipe.products.map(({ item }) => item.name),
    ...recipe.products.map(({ item }) => item.key),
    ...recipe.getIngredients().map(({ item }) => item.name),
    ...recipe.getIngredients().map(({ item }) => item.key),
    ...getCompatibleBuildingNames(spec, recipe),
  ]
  const normalizedValues = values.map(normalizeSearchText)
  const compactQuery = compactRecipeSearchText(normalizedQuery)

  if (normalizedValues.some((value) => compactRecipeSearchText(value).includes(compactQuery))) {
    return true
  }

  return normalizedQuery.split(" ").every((token) => normalizedValues.some((value) => value.includes(token)))
}

export function getConfigurableRecipes(spec: RecipeSettingsSpecification): Recipe[] {
  return [...spec.recipes.values()].filter((recipe) => recipe.isReal() && !recipe.isDisable())
}

export function isRecipeUnavailable(spec: RecipeSettingsSpecification, recipe: Recipe): boolean {
  return spec.planetaryBaseline?.has(recipe) ?? false
}

export function recipeVisibleInSettings(
  spec: RecipeSettingsSpecification,
  recipe: Recipe,
  options: {
    searchText: string
    showUnavailable: boolean
  },
) {
  return (
    (options.showUnavailable || !isRecipeUnavailable(spec, recipe)) &&
    recipeMatchesSettingsSearch(spec, recipe, options.searchText)
  )
}

function categorySortKey(category: string) {
  return CATEGORY_ORDER.get(category) ?? 500
}

export interface RecipeSettingsGroup {
  readonly category: string
  readonly name: string
  readonly recipes: Recipe[]
}

export function groupRecipesForSettings(recipes: readonly Recipe[]): RecipeSettingsGroup[] {
  const groups = new Map<string, Recipe[]>()
  for (const recipe of recipes) {
    const category = getRecipeSettingsCategory(recipe)
    const group = groups.get(category) ?? []
    group.push(recipe)
    groups.set(category, group)
  }

  return [...groups.entries()]
    .sort(([categoryA], [categoryB]) => {
      const order = categorySortKey(categoryA) - categorySortKey(categoryB)
      return order === 0 ? categoryA.localeCompare(categoryB) : order
    })
    .map(([category, categoryRecipes]) => ({
      category,
      name: humanizeRecipeCategory(category),
      recipes: sorted(categoryRecipes, (recipe) => recipe.order ?? recipe.name),
    }))
}

// -----------------------------------------------------------------------------
// Recipe policy
// -----------------------------------------------------------------------------

function refreshTargetsForItems(specification: RecipeSettingsSpecification, items: ReadonlySet<Item>): void {
  for (let target of specification.buildTargets) {
    if (items.has(target.item)) {
      target.displayRecipes()
    }
  }
}

export function disableRecipe(specification: RecipeSettingsSpecification, recipe: Recipe): void {
  if (specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<Item>()
  let affectedItems = new Set<Item>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.add(recipe)
  for (let item of candidateItems) {
    if (isItemDisabled(specification, item)) {
      addItemToMaximumPriority(specification, item)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function enableRecipe(specification: RecipeSettingsSpecification, recipe: Recipe): void {
  if (!specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<Item>()
  let affectedItems = new Set<Item>()
  for (let product of recipe.products) {
    let item = product.item
    affectedItems.add(item)
    if (isItemDisabled(specification, item) && !specification.ignore.has(item)) {
      candidateItems.add(item)
    }
  }
  specification.disable.delete(recipe)
  for (let item of candidateItems) {
    if (!isItemDisabled(specification, item)) {
      specification.priority.removeRecipe(item.disableRecipe)
    }
  }
  refreshTargetsForItems(specification, affectedItems)
}

export function getEnabledUses(specification: RecipeSettingsSpecification, item: Item): Recipe[] {
  return item.uses.filter((recipe) => !specification.disable.has(recipe))
}

export function isItemDisabled(specification: RecipeSettingsSpecification, item: Item): boolean {
  return !item.recipes.some((recipe) => !specification.disable.has(recipe) && recipe.isNetProducer(item))
}

export function getEnabledRecipes(specification: RecipeSettingsSpecification, item: Item): (Recipe | DisabledRecipe)[] {
  let enabled = item.recipes.filter((recipe) => !specification.disable.has(recipe))
  if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
    return enabled
  }
  return [
    item.disableRecipe,
    ...enabled.filter((recipe) => recipe.products.some((product) => !specification.ignore.has(product.item))),
  ]
}

function addItemGraph(
  specification: RecipeSettingsSpecification,
  item: Item,
  graph: Set<Recipe | DisabledRecipe>,
): void {
  for (let recipe of getEnabledRecipes(specification, item)) {
    if (graph.has(recipe)) {
      continue
    }
    graph.add(recipe)
    for (let ingredient of recipe.getIngredients()) {
      addItemGraph(specification, ingredient.item, graph)
    }
  }
}

export function getRecipeGraph(
  specification: RecipeSettingsSpecification,
  items: ReadonlyMap<Item, Rational>,
): Set<Recipe | DisabledRecipe> {
  const graph = new Set<Recipe | DisabledRecipe>()
  for (let item of items.keys()) {
    addItemGraph(specification, item, graph)
  }
  return graph
}

export function isFactoryTarget(specification: RecipeSettingsSpecification, recipe: Recipe): boolean {
  return specification.buildTargets.some((target) => target.recipe === recipe && target.changedBuilding)
}

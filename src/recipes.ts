import { normalizeSearchText, sorted } from "./data.js"
import { one, Rational, zero } from "./math.js"
import { currentSpecification } from "./models.js"
import { Icon, sprites } from "./presentation.js"
import { addItemToMaximumPriority, DISABLED_RECIPE_PREFIX } from "./priorities.js"
import { Ingredient, Totals } from "./solver.js"

// -----------------------------------------------------------------------------
// Items
// -----------------------------------------------------------------------------

export class Item {
  [key: string]: any
  constructor(key, name, col, row, phase, group, subgroup, order) {
    this.key = key
    this.name = name
    this.phase = phase
    this.recipes = []
    this.uses = []

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)

    this.group = group
    this.subgroup = subgroup
    this.order = order

    this.disableRecipe = new DisabledRecipe(this)
  }
  allRecipes() {
    return this.recipes.concat([this.disableRecipe])
  }
  addRecipe(recipe) {
    this.recipes.push(recipe)
  }
  addUse(recipe) {
    this.uses.push(recipe)
  }
  renderTooltip(extra) {
    if (this.recipes.length === 1 && this.recipes[0].name === this.name) {
      return this.recipes[0].renderTooltip(extra)
    }
    let self = this
    let t = d3.create("div").classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
    if (extra) {
      t.append(() => extra)
    }
    return t.node()
  }
}

export function getItems(data) {
  let items = new Map()
  for (let d of data.items) {
    if (!d.localized_name) {
      console.log("bad item:", d)
      continue
    }
    let phase = d.type === "fluid" ? "fluid" : "solid"
    items.set(d.key, new Item(d.key, d.localized_name.en, d.icon_col, d.icon_row, phase, d.group, d.subgroup, d.order))
  }
  let cycleKey = "nuclear-reactor-cycle"
  let reactor = items.get("nuclear-reactor")
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

class SurfaceCondition {
  [key: string]: any
  constructor(property, min, max) {
    this.property = property
    this.min = min
    this.max = max
  }
}

class Recipe {
  [key: string]: any
  constructor(
    key,
    name,
    order,
    col,
    row,
    allow_prod,
    allow_quality,
    categories,
    time,
    ingredients,
    products,
    conditions = [],
  ) {
    this.key = key
    this.name = name
    this.order = order
    this.allow_productivity = allow_prod
    this.allow_quality = allow_quality !== false
    if (categories === undefined || categories === null) {
      categories = []
    } else if (!Array.isArray(categories)) {
      categories = [categories]
    }
    this.categories = new Set(categories)
    // Retain the old property for third-party consumers. Internal code
    // uses categories so Factorio 2.1 recipes can be made in any eligible
    // machine category.
    this.category = this.categories.values().next().value ?? null
    this.time = time
    this.ingredients = ingredients
    for (let ing of ingredients) {
      ing.item.addUse(this)
    }
    this.products = products
    for (let ing of products) {
      ing.item.addRecipe(this)
    }

    if (conditions === undefined || conditions === null) {
      conditions = []
    }
    this.conditions = conditions

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this, products[0].item.name)
  }
  fuelIngredient() {
    let spec = currentSpecification()
    let building = spec.getBuilding(this)
    if (building === null || building.fuel === null || building.fuel !== "chemical") {
      return []
    }
    // baseRate = craft/s
    // basePower = J/s
    // perCraftEnergy = J/s / craft/s = J/craft
    // fuel.value = J/i
    // fuelAmount = J/craft / J/i = i/craft
    let baseRate = spec.getRecipeRate(this)
    let basePower = spec.getPowerUsage(this, baseRate).power
    let perCraftEnergy = basePower.div(baseRate)
    let fuelAmount = perCraftEnergy.div(spec.fuel.value)
    return [new Ingredient(spec.fuel.item, fuelAmount)]
  }
  getIngredients() {
    return this.ingredients.concat(this.fuelIngredient())
  }
  gives(item) {
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
  uses(item) {
    for (let ing of this.getIngredients()) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    return zero
  }
  isNetProducer(item) {
    let amount = this.gives(item)
    return zero.less(amount.sub(this.uses(item)))
  }
  isResource() {
    return false
  }
  isReal() {
    return true
  }
  isDisable() {
    return false
  }
  renderTooltip(extra) {
    let self = this
    let t = d3.create("div").classed("frame recipe", true).datum(this)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    let name = this.name
    if (this.products.length === 1 && this.products[0].item.name === this.name && one.less(this.products[0].amount)) {
      name = this.products[0].amount.toDecimal() + " \u00d7 " + name
    }
    header.append(() => new Text("\u00A0" + name))
    if (extra) {
      t.append(() => extra)
    }
    if (this.ingredients.length === 0) {
      return t.node()
    }
    if (this.products.length > 1 || this.products[0].item.name !== this.name) {
      let productLine = t.append("div")
      productLine.append("span").text("Products:")
      let product = productLine.append("span").selectAll("span").data(this.products).join("span")
      product.append("span").text("\u00A0")
      let prodIcon = product.append("div").classed("product", true)
      prodIcon.append((d) => d.item.icon.make(32, true))
      prodIcon
        .append("span")
        .classed("count", true)
        .text((d) => d.amount.toDecimal())
    }
    let time = t.append("div")
    time
      .append("div")
      .classed("product", true)
      .append(() => sprites.get("clock").icon.make(32, true))
    time.append("span").text("\u00A0" + this.time.toDecimal())
    let ingredient = t.append("div").selectAll("div").data(this.ingredients).join("div")
    ingredient
      .append("div")
      .classed("product", true)
      .append((d) => d.item.icon.make(32, true))
    ingredient.append("span").text((d) => `\u00A0${d.amount.toDecimal()} \u00d7 ${d.item.name}`)
    return t.node()
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
export class DisabledRecipe {
  [key: string]: any
  constructor(item) {
    this.key = DISABLED_RECIPE_PREFIX + item.key
    this.name = item.name
    this.categories = new Set()
    this.category = null
    this.ingredients = []
    this.products = [new Ingredient(item, one)]

    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
    this.icon = new Icon(this)
  }
  getIngredients() {
    return this.ingredients
  }
  gives(item) {
    for (let ing of this.products) {
      if (ing.item === item) {
        return ing.amount
      }
    }
    return null
  }
  isResource() {
    return false
  }
  isReal() {
    return true
  }
  isDisable() {
    return true
  }
}

function getResultProbability(result) {
  if (result.independent_probability !== undefined) {
    return result.independent_probability
  } else if (result.shared_probability !== undefined) {
    let min = result.shared_probability.min ?? 0
    let max = result.shared_probability.max ?? 1
    return max - min
  } else if (result.probability !== undefined) {
    // Compatibility with Factorio 2.0 and older mod exports.
    return result.probability
  }
  return null
}

function applyResultProbability(amount, result) {
  let probability = getResultProbability(result)
  if (probability !== null) {
    amount = amount.mul(Rational.from_float_approximate(probability))
  }
  return amount
}

function getExpectedResultAmount(result) {
  let amount
  if (result.amount !== undefined) {
    amount = Rational.from_float_approximate(result.amount)
  } else if (result.amount_min !== undefined || result.amount_max !== undefined) {
    let min = result.amount_min ?? result.amount_max
    let max = result.amount_max ?? result.amount_min
    amount = Rational.from_float_approximate((min + max) / 2)
  } else {
    amount = one
  }

  if (result.extra_count_fraction !== undefined) {
    amount = amount.add(Rational.from_float_approximate(result.extra_count_fraction))
  }

  return applyResultProbability(amount, result)
}

function getProductivityAmount(result, totalAmount) {
  if (result.ignored_by_productivity === undefined) {
    return null
  }
  let ignored = Rational.from_float_approximate(result.ignored_by_productivity)
  ignored = applyResultProbability(ignored, result)
  return totalAmount.sub(ignored)
}

function makeRecipe(data, items, d) {
  let time = Rational.from_float_approximate(d.energy_required)
  let products = []
  for (let result of d.results) {
    let item = items.get(result.name)
    let amount = getExpectedResultAmount(result)
    products.push(new Ingredient(item, amount, getProductivityAmount(result, amount)))
  }
  let ingredients = []
  for (let { name, amount } of d.ingredients) {
    let item = items.get(name)
    if (!item) {
      return null
    }
    ingredients.push(new Ingredient(item, Rational.from_float_approximate(amount)))
  }
  let conditions = []
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
  )
}

class RecipeMap extends Map {
  [key: string]: any
  constructor(aliases) {
    super()
    this.aliases = new Map(Object.entries(aliases ?? {}))
  }
  resolveKey(key) {
    return this.aliases.get(key) ?? key
  }
  get(key) {
    return super.get(this.resolveKey(key))
  }
  has(key) {
    return super.has(this.resolveKey(key))
  }
}

class ResourceRecipe extends Recipe {
  [key: string]: any
  constructor(item, category, priority, weight) {
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
  isResource() {
    return true
  }
}

class SpoilageRecipe extends Recipe {
  [key: string]: any
  constructor(from_item, to_item) {
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
      zero,
      [new Ingredient(from_item, one)],
      [new Ingredient(to_item, one)],
      [],
    )
  }
}

class PlantRecipe extends Recipe {
  [key: string]: any
  constructor(key, name, order, col, row, seed, results, conditions) {
    super(
      key,
      name,
      order,
      col,
      row,
      false,
      true,
      null,
      zero,
      [new Ingredient(seed, one)],
      //[new Ingredient(item, quantity)],
      results,
      conditions,
    )
    if (this.isResource()) {
      this.defaultPriority = 1
      this.defaultWeight = Rational.from_float(100)
    }
  }
  isResource() {
    return this.conditions.length === 0
  }
}

class MiningRecipe extends Recipe {
  [key: string]: any
  constructor(key, name, order, col, row, category, miningTime, ingredients, products) {
    if (!ingredients) {
      ingredients = []
    }
    super(key, name, order, col, row, true, true, category, zero, ingredients, products, [])
    this.miningTime = miningTime

    this.defaultPriority = 1
    this.defaultWeight = Rational.from_float(100)
  }
  isResource() {
    return true
  }
}

// XXX: Still a hack.
class PumpjackRecipe extends Recipe {
  [key: string]: any
  constructor(key, name, col, row, category, product) {
    super(key, name, undefined, col, row, false, true, category, zero, [], [new Ingredient(product, one)], [])
    this.defaultPriority = 1
    this.defaultWeight = Rational.from_float(100)
  }
  isResource() {
    return true
  }
}

class OffshorePumpRecipe extends Recipe {
  [key: string]: any
  constructor(key, name, order, col, row, product) {
    super(key, name, order, col, row, false, true, "offshore-pumping", zero, [], [new Ingredient(product, one)], [])

    this.defaultPriority = 0
    this.defaultWeight = Rational.from_float(100)
  }
  isResource() {
    return true
  }
}

function getSteam(data) {
  let R = Rational.from_float
  let boilerDef
  for (let d of data.boilers) {
    if (d.key === "boiler") {
      boilerDef = d
      break
    }
  }
  let water
  let steam
  for (let fluid of data.fluids) {
    if (fluid.item_key === "water") {
      water = fluid
    } else if (fluid.item_key === "steam") {
      steam = fluid
    }
    if (water !== undefined && steam !== undefined) {
      break
    }
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

export function getRecipes(data, items) {
  let hundred = Rational.from_float(100)
  let recipes = new RecipeMap(data.recipe_aliases)
  let reactor = items.get("nuclear-reactor")
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
      [new Ingredient(items.get("uranium-fuel-cell"), one)],
      [new Ingredient(items.get(used_cell_name), one), new Ingredient(items.get("nuclear-reactor-cycle"), one)],
    ),
  )
  if (items.has("satellite")) {
    let rocket = items.get("rocket-silo")
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
          new Ingredient(items.get("rocket-part"), Rational.from_float(100)),
          new Ingredient(items.get("satellite"), one),
        ],
        [new Ingredient(items.get("space-science-pack"), Rational.from_float(1000))],
      ),
    )
  }
  let steam = items.get("steam")
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
      [new Ingredient(items.get("water"), waterRate)],
      [new Ingredient(items.get("steam"), steamRate)],
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
      // XXX: Do something about pumpjacks.
      let item = items.get(d.results[0].name)
      recipes.set(d.key, new PumpjackRecipe(d.key, d.localized_name.en, d.icon_col, d.icon_row, null, item))
      continue
    }
    let ingredients = null
    if ("required_fluid" in d) {
      ingredients = [new Ingredient(items.get(d.required_fluid), Rational.from_float_approximate(d.fluid_amount / 10))]
    }
    let products = []
    for (let result of d.results) {
      let item = items.get(result.name)
      products.push(new Ingredient(item, getExpectedResultAmount(result)))
    }
    recipes.set(
      d.key,
      new MiningRecipe(
        d.key,
        d.localized_name.en,
        d.order, // this may be undefined
        d.icon_col,
        d.icon_row,
        category,
        Rational.from_float_approximate(d.mining_time),
        ingredients,
        products,
      ),
    )
  }
  let offshoreItems = new Set()
  if (data.planets) {
    for (let planet of data.planets) {
      for (let key of planet.resources.offshore) {
        offshoreItems.add(key)
      }
    }
  } else {
    offshoreItems.add("water")
  }
  for (let key of offshoreItems) {
    let item = items.get(key)
    let r = new OffshorePumpRecipe(key, item.name, item.order, item.icon_col, item.icon_row, item)
    if (recipes.has(key)) {
      console.log("duplicate key:", key)
    }
    recipes.set(key, r)
  }
  if (data.plants) {
    for (let plant of data.plants) {
      let results = []
      for (let result of plant.results) {
        results.push(new Ingredient(items.get(result.name), getExpectedResultAmount(result)))
      }
      let conditions = []
      if (plant.surface_conditions) {
        for (let { property, min, max } of plant.surface_conditions) {
          conditions.push(new SurfaceCondition(property, min, max))
        }
      }
      let r = new PlantRecipe(
        plant.key,
        plant.localized_name.en,
        plant.order,
        plant.icon_col,
        plant.icon_row,
        items.get(plant.seed),
        results,
        conditions,
      )
      recipes.set(plant.key, r)
    }
  }
  if (data.spoilage) {
    for (let spoil of data.spoilage) {
      let from_item = items.get(spoil.from_item)
      let to_item = items.get(spoil.to_item)
      let r = new SpoilageRecipe(from_item, to_item)
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

export function isRecyclingRecipe(recipe: any) {
  return recipe.categories?.has("recycling") || recipe.category === "recycling" || recipe.key.endsWith("-recycling")
}

export function getRecipeSelectorGroups(recipes: any[], activeRecipe: any) {
  function orderGroup(groupRecipes: any[]) {
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

export function getRecipeSettingsCategory(recipe: any) {
  if (recipe.isResource?.()) {
    return "resources"
  }
  return recipe.category ?? recipe.categories?.values().next().value ?? "other"
}

function getCompatibleBuildingNames(spec: any, recipe: any) {
  const names = []
  for (const building of spec.buildingKeys?.values?.() ?? []) {
    if (building.canCraft?.(recipe)) {
      names.push(building.name)
    }
  }
  return names
}

export function recipeMatchesSettingsSearch(spec: any, recipe: any, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const values = [
    recipe.name,
    recipe.key,
    humanizeRecipeCategory(getRecipeSettingsCategory(recipe)),
    ...recipe.products.map(({ item }: any) => item.name),
    ...recipe.products.map(({ item }: any) => item.key),
    ...recipe.getIngredients().map(({ item }: any) => item.name),
    ...recipe.getIngredients().map(({ item }: any) => item.key),
    ...getCompatibleBuildingNames(spec, recipe),
  ]
  const normalizedValues = values.map(normalizeSearchText)
  const compactQuery = compactRecipeSearchText(normalizedQuery)

  if (normalizedValues.some((value) => compactRecipeSearchText(value).includes(compactQuery))) {
    return true
  }

  return normalizedQuery.split(" ").every((token) => normalizedValues.some((value) => value.includes(token)))
}

export function getConfigurableRecipes(spec: any) {
  return [...spec.recipes.values()].filter((recipe: any) => recipe.isReal?.() && !recipe.isDisable?.())
}

export function isRecipeUnavailable(spec: any, recipe: any) {
  return spec.planetaryBaseline?.has(recipe) ?? false
}

export function recipeVisibleInSettings(
  spec: any,
  recipe: any,
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

export function groupRecipesForSettings(recipes: any[]) {
  const groups = new Map<string, any[]>()
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

function refreshTargetsForItems(specification, items: Set<any>): void {
  for (let target of specification.buildTargets) {
    if (items.has(target.item)) {
      target.displayRecipes()
    }
  }
}

export function disableRecipe(specification, recipe): void {
  if (specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<any>()
  let affectedItems = new Set<any>()
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

export function enableRecipe(specification, recipe): void {
  if (!specification.disable.has(recipe)) {
    return
  }
  let candidateItems = new Set<any>()
  let affectedItems = new Set<any>()
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

export function getEnabledUses(specification, item) {
  return item.uses.filter((recipe) => !specification.disable.has(recipe))
}

export function isItemDisabled(specification, item): boolean {
  return !item.recipes.some(
    (recipe) => !specification.disable.has(recipe) && recipe.isNetProducer(item),
  )
}

export function getEnabledRecipes(specification, item) {
  let enabled = item.recipes.filter((recipe) => !specification.disable.has(recipe))
  if (!isItemDisabled(specification, item) && !specification.ignore.has(item)) {
    return enabled
  }
  return [
    item.disableRecipe,
    ...enabled.filter((recipe) => recipe.products.some((product) => !specification.ignore.has(product.item))),
  ]
}

function addItemGraph(specification, item, graph: Set<any>): void {
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

export function getRecipeGraph(specification, items): Set<any> {
  let graph = new Set<any>()
  for (let item of items.keys()) {
    addItemGraph(specification, item, graph)
  }
  return graph
}

export function isFactoryTarget(specification, recipe): boolean {
  return specification.buildTargets.some(
    (target) => target.recipe === recipe && target.changedBuilding,
  )
}

import { Icon } from "./icon.js"

class SurfaceProperty {
  [key: string]: any
}

class Planet {
  [key: string]: any
  constructor(key, name, order, col, row, resources, properties) {
    this.key = key
    this.name = name
    this.order = order
    this.resources = resources
    this.properties = properties
    this.disable = new Set()

    this.icon_col = col
    this.icon_row = row
    this.icon = new Icon(this)
  }
  allowsConditions(conditions) {
    for (let condition of conditions ?? []) {
      let value = this.properties.get(condition.property)
      if (value === undefined) {
        value = defaultProperties.get(condition.property)
      }
      let aboveMinimum = true
      let belowMaximum = true
      if (condition.min !== undefined) {
        aboveMinimum = value >= condition.min
      }
      if (condition.max !== undefined) {
        belowMaximum = value <= condition.max
      }
      if (!(aboveMinimum && belowMaximum)) {
        return false
      }
    }
    return true
  }
  allowsRecipe(recipe) {
    if (recipe.isResource()) {
      return this.resources.has(recipe)
    }
    return this.allowsConditions(recipe.conditions)
  }
  allowsBuilding(building) {
    return building.allowedOn(this)
  }
  allows(recipe, buildings) {
    if (!this.allowsRecipe(recipe)) {
      return false
    }
    if (recipe.isResource() || recipe.categories.size === 0) {
      return true
    }
    return buildings.some((building) => building.canCraft(recipe) && this.allowsBuilding(building))
  }
}

let defaultProperties

const RECYCLING_ROOT_KEYS = new Set(["scrap"])

function traverseRecycling(recipe, found) {
  for (let { item } of recipe.products) {
    for (let subrecipe of item.uses) {
      if (subrecipe.key.endsWith("-recycling")) {
        if (!found.has(subrecipe)) {
          found.add(subrecipe)
          traverseRecycling(subrecipe, found)
        }
      }
    }
  }
}

export function getPlanets(data, recipes, buildings) {
  if (!data.planets) {
    // For legacy 1.1 datasets.
    return null
  }
  defaultProperties = new Map()
  for (let { name, default_value } of data.surface_properties) {
    defaultProperties.set(name, default_value)
  }

  let planets = new Map()
  for (let d of data.planets) {
    let resources = new Set()
    let roots = new Set()
    for (let key of d.resources.resource.concat(d.resources.offshore).concat(d.resources.plants)) {
      let r = recipes.get(key)
      resources.add(r)
      if (RECYCLING_ROOT_KEYS.has(key)) {
        roots.add(r)
      }
    }
    let properties = new Map()
    for (let key in d.surface_properties) {
      let value = d.surface_properties[key]
      properties.set(key, value)
    }
    let planet = new Planet(d.key, d.localized_name.en, d.order, d.icon_col, d.icon_row, resources, properties)
    for (let recipe of recipes.values()) {
      if (!planet.allows(recipe, buildings) || recipe.key.endsWith("-recycling")) {
        planet.disable.add(recipe)
      }
      if (roots.size > 0) {
        let recycling = new Set()
        for (let root of roots) {
          traverseRecycling(root, recycling)
        }
        for (let recycle of recycling) {
          planet.disable.delete(recycle)
        }
      }
    }
    planets.set(planet.key, planet)
  }
  return planets
}

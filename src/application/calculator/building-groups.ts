import { DEFAULT_BUILDING_KEYS } from "./defaults.js"

export function getCategories(value) {
  let categories = value.categories ?? value.category
  if (categories === undefined || categories === null) {
    return []
  }
  if (typeof categories === "string") {
    return [categories]
  }
  return categories
}

export function buildingCanCraft(building, recipe) {
  let buildingCategories = getCategories(building)
  for (let category of getCategories(recipe)) {
    if (typeof buildingCategories.has === "function") {
      if (buildingCategories.has(category)) {
        return true
      }
    } else if ([...buildingCategories].includes(category)) {
      return true
    }
  }
  return false
}

class BuildingSet {
  [key: string]: any
  categories = new Set()
  buildings = new Set()

  constructor(building = null) {
    if (building !== null) {
      for (let category of building.categories) {
        this.categories.add(category)
      }
      this.buildings.add(building)
    }
  }

  merge(other) {
    for (let category of other.categories) {
      this.categories.add(category)
    }
    for (let building of other.buildings) {
      this.buildings.add(building)
    }
  }

  overlaps(other) {
    return [...this.categories].some((category) => other.categories.has(category))
  }
}

export function buildingSort(buildings) {
  buildings.sort((a, b) => {
    if (a.less(b)) {
      return -1
    }
    if (b.less(a)) {
      return 1
    }
    return 0
  })
}

class BuildingGroup {
  [key: string]: any
  constructor(buildingSet) {
    this.buildings = [...buildingSet]
    buildingSort(this.buildings)
    this.building = this.getDefault()
  }

  getDefault() {
    return (
      this.buildings.find((building) => DEFAULT_BUILDING_KEYS.has(building.key)) ??
      this.buildings.at(-1)
    )
  }

  getBuilding(recipe, available: (building: any) => boolean = () => true) {
    let candidate = null
    for (let building of this.buildings) {
      if (buildingCanCraft(building, recipe) && available(building)) {
        candidate = building
        if (building === this.building || this.building.less(building)) {
          return building
        }
      }
    }
    return candidate
  }
}

function mergeBuildingSet(sets: Set<any>, buildingSet: any) {
  for (let other of [...sets]) {
    if (buildingSet.overlaps(other)) {
      buildingSet.merge(other)
      sets.delete(other)
    }
  }
  sets.add(buildingSet)
}

export function getBuildingGroups(buildings, recipes) {
  let sets = new Set<any>()
  for (let building of buildings) {
    mergeBuildingSet(sets, new BuildingSet(building))
  }

  // Multi-category recipes link equivalent crafting-machine groups.
  for (let recipe of recipes) {
    let categories = [...getCategories(recipe)]
    if (categories.length < 2) {
      continue
    }
    let set = new BuildingSet()
    for (let category of categories) {
      set.categories.add(category)
    }
    mergeBuildingSet(sets, set)
  }

  let groups = new Map()
  for (let { categories, buildings: groupBuildings } of sets) {
    if (groupBuildings.size === 0) {
      continue
    }
    let group = new BuildingGroup(groupBuildings)
    for (let category of categories) {
      groups.set(category, group)
    }
  }
  return groups
}

import { DEFAULT_PLANET } from "./defaults.js"

export function syncLocationDisabledRecipes(specification) {
  let selected = [...specification.selectedPlanets]
  let unavailable =
    selected.length === 0
      ? new Set()
      : selected.slice(1).reduce(
          (intersection, location) => new Set([...intersection].filter((recipe) => location.disable.has(recipe))),
          new Set(selected[0].disable),
        )

  specification.planetaryBaseline = unavailable
  for (let recipe of [...specification.disable]) {
    if (!unavailable.has(recipe)) {
      specification.setEnable(recipe)
    }
  }
  for (let recipe of unavailable) {
    if (!specification.disable.has(recipe)) {
      specification.setDisable(recipe)
    }
  }
}

export function isDefaultLocationSelection(specification): boolean {
  if (!specification.planets || specification.planets.size === 1) {
    return true
  }
  let selected = [...specification.selectedPlanets]
  return selected.length === 1 && selected[0].key === DEFAULT_PLANET
}

export function getUserRecipeOverrides(specification) {
  if (!specification.planetaryBaseline) {
    return { disable: specification.disable, enable: new Set() }
  }
  return {
    disable: new Set([...specification.disable].filter((recipe) => !specification.planetaryBaseline.has(recipe))),
    enable: new Set([...specification.planetaryBaseline].filter((recipe) => !specification.disable.has(recipe))),
  }
}

export function selectOnlyLocation(specification, location): void {
  specification.selectedPlanets.clear()
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function selectLocation(specification, location): void {
  specification.selectedPlanets.add(location)
  syncLocationDisabledRecipes(specification)
}

export function unselectLocation(specification, location): void {
  specification.selectedPlanets.delete(location)
  syncLocationDisabledRecipes(specification)
}

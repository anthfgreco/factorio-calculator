function sortedLocations(locations) {
  return [...locations].sort((a, b) => a.order - b.order)
}

function locationName(location, indefinite = false) {
  if (indefinite && location.key === "space-platform") {
    return "a Space platform"
  }
  return location.name
}

export function formatLocationList(locations, conjunction = "or", indefinite = false) {
  let names = locations.map((location) => locationName(location, indefinite))
  if (names.length === 0) {
    return ""
  }
  if (names.length === 1) {
    return names[0]
  }
  if (names.length === 2) {
    return `${names[0]} ${conjunction} ${names[1]}`
  }
  return `${names.slice(0, -1).join(", ")}, ${conjunction} ${names[names.length - 1]}`
}

export function getUnavailableLocationInfo(spec, item) {
  if (!spec.planets || spec.planets.size <= 1 || !spec.planetaryBaseline || spec.ignore.has(item)) {
    return null
  }

  let recipes = item.recipes.filter((recipe) => recipe.isNetProducer(item))
  if (recipes.length === 0 || recipes.some((recipe) => !spec.disable.has(recipe))) {
    return null
  }

  // Only show this message when the selected locations are the reason every
  // real production recipe is disabled. Manually-disabled recipes should not
  // be presented as a location problem.
  if (!recipes.every((recipe) => spec.planetaryBaseline.has(recipe))) {
    return null
  }

  let allLocations: any[] = Array.from(spec.planets.values()) as any[]
  let compatibleLocations = sortedLocations(
    allLocations.filter((location) => recipes.some((recipe) => !location.disable.has(recipe))),
  )
  if (compatibleLocations.length === 0) {
    return null
  }

  return {
    selectedLocations: sortedLocations(spec.selectedPlanets),
    compatibleLocations,
  }
}

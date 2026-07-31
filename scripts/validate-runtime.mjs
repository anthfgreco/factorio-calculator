import { readFile, rm } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import vm from "node:vm"
import { compileTypeScript } from "./lib/compile-typescript.mjs"

const root = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(root, ".tmp/runtime")
await rm(outputDirectory, { recursive: true, force: true })
await compileTypeScript({ root, outputDirectory })

const bigIntegerSource = await readFile(resolve(root, "public/third_party/BigInteger.min.js"), "utf8")
vm.runInThisContext(bigIntegerSource)

globalThis.window = {}
globalThis.d3 = {
  local: () => ({
    get: () => null,
    set: () => undefined,
  }),
}

const loadModule = (name) => import(pathToFileURL(resolve(outputDirectory, `${name}.js`)).href)

const { getItems, getRecipes } = await loadModule("recipes")
const { ModuleSpec, getBelts, getBuildings, getFuel, getItemGroups, getModules, getPlanets, configureModelRuntime } =
  await loadModule("models")
const factory = await loadModule("factory")
const { itemMatchesSearch, formatLocationList, getUnavailableLocationInfo } = await loadModule("data")
const { getItemProductionRecipes, getRecipeLocations, setRecipeEnabled } = factory
const {
  getRecipeSelectorGroups,
  getRecipeSettingsCategory,
  isRecyclingRecipe,
  recipeMatchesSettingsSearch,
  recipeVisibleInSettings,
} = await loadModule("recipes")
const { one, zero } = await loadModule("math")
const { getFactorySummary } = await loadModule("results")
const { solve } = await loadModule("solver")
configureModelRuntime({ getSpecification: () => factory.spec, useLegacyCalculation: () => false })

const searchCases = [
  [{ key: "underground-belt", name: "Underground belt" }, "underground belt"],
  [{ key: "fast-underground-belt", name: "Fast underground belt" }, "underground belt"],
  [{ key: "fast-underground-belt", name: "Fast underground belt" }, "fast belt"],
  [{ key: "automation-science-pack", name: "Automation science pack" }, "red"],
  [{ key: "automation-science-pack", name: "Automation science pack" }, "red science"],
  [{ key: "logistic-science-pack", name: "Logistic science pack" }, "green"],
  [{ key: "military-science-pack", name: "Military science pack" }, "grey"],
  [{ key: "military-science-pack", name: "Military science pack" }, "gray"],
  [{ key: "military-science-pack", name: "Military science pack" }, "black"],
  [{ key: "chemical-science-pack", name: "Chemical science pack" }, "blue"],
  [{ key: "production-science-pack", name: "Production science pack" }, "purple"],
  [{ key: "utility-science-pack", name: "Utility science pack" }, "yellow"],
  [{ key: "space-science-pack", name: "Space science pack" }, "white"],
  [{ key: "metallurgic-science-pack", name: "Metallurgic science pack" }, "orange"],
  [{ key: "electromagnetic-science-pack", name: "Electromagnetic science pack" }, "pink"],
  [{ key: "electromagnetic-science-pack", name: "Electromagnetic science pack" }, "magenta"],
  [{ key: "agricultural-science-pack", name: "Agricultural science pack" }, "lime"],
  [{ key: "agricultural-science-pack", name: "Agricultural science pack" }, "light green"],
  [{ key: "cryogenic-science-pack", name: "Cryogenic science pack" }, "cyan"],
  [{ key: "cryogenic-science-pack", name: "Cryogenic science pack" }, "light blue"],
  [{ key: "cryogenic-science-pack", name: "Cryogenic science pack" }, "blue"],
  [{ key: "promethium-science-pack", name: "Promethium science pack" }, "black"],
  [{ key: "promethium-science-pack", name: "Promethium science pack" }, "dark blue"],
  [{ key: "promethium-science-pack", name: "Promethium science pack" }, "dark purple"],
]

for (const [item, query] of searchCases) {
  if (!itemMatchesSearch(item, query)) {
    throw new Error(`Search query ${JSON.stringify(query)} did not match ${item.name}`)
  }
}

if (itemMatchesSearch({ key: "automation-science-pack", name: "Automation science pack" }, "cyan")) {
  throw new Error("Unrelated search alias matched the wrong science pack")
}

const datasets = [
  "vanilla-1.1.110.json",
  "vanilla-1.1.110-expensive.json",
  "vanilla-2.0.55.json",
  "space-age-2.0.55.json",
  "space-age-2.1.12.json",
]

const originalLog = console.log
const summaries = []

try {
  // Legacy datasets intentionally contain raw resources without recipes. The
  // loader logs those items while creating disabled-resource pseudo-recipes.
  console.log = () => undefined

  for (const filename of datasets) {
    factory.resetSpec()
    const data = JSON.parse(await readFile(resolve(root, "public/data", filename), "utf8"))
    const items = getItems(data)
    const recipes = getRecipes(data, items)
    const buildings = getBuildings(data, items)
    const modules = getModules(data, items)
    const belts = getBelts(data)
    const fuels = getFuel(data, items)
    const planets = getPlanets(data, recipes, buildings)
    const groups = getItemGroups(items, data)

    factory.spec.setData(items, recipes, planets, modules, buildings, belts, fuels, groups)
    if (!(factory.spec.minerSettings instanceof Map)) {
      throw new Error("Factory specification did not initialize miner settings")
    }

    if (filename === "space-age-2.1.12.json") {
      const spacePlatform = planets.get("space-platform")
      const asteroidChunkKeys = [
        "carbonic-asteroid-chunk",
        "metallic-asteroid-chunk",
        "oxide-asteroid-chunk",
        "promethium-asteroid-chunk",
      ]
      for (const key of asteroidChunkKeys) {
        const recipe = recipes.get(key)
        if (recipe.defaultPriority !== 1) {
          throw new Error(`${key} was not assigned normal raw-resource priority`)
        }
        if (spacePlatform.disable.has(recipe)) {
          throw new Error(`${key} was disabled on the Space platform`)
        }
      }

      const biterEgg = recipes.get("biter-egg")
      if (!spacePlatform.disable.has(biterEgg)) {
        throw new Error("Space platform allowed a recipe whose only machine is surface-restricted")
      }

      factory.spec.setDefaultPriority()
      factory.spec.selectOnePlanet(spacePlatform)
      const spaceScience = items.get("space-science-pack")
      const spaceTotals = solve(factory.spec, [{ item: spaceScience, rate: one, recipe: null }])
      const usedRecipes = [...spaceTotals.rates.keys()]
      const usedRecipeKeys = new Set(usedRecipes.filter((recipe) => recipe.isReal()).map((recipe) => recipe.key))
      factory.spec.populateModuleSpec(spaceTotals)
      const spaceSummary = getFactorySummary(factory.spec, spaceTotals)
      if (spaceSummary.recipeCount !== usedRecipeKeys.size) {
        throw new Error(`Factory summary counted ${spaceSummary.recipeCount} recipes, expected ${usedRecipeKeys.size}`)
      }
      if (!zero.less(spaceSummary.exactMachines) || !zero.less(spaceSummary.electricalPower)) {
        throw new Error("Factory summary did not calculate machine or power totals")
      }
      if (spaceSummary.selectedLocations.length !== 1 || spaceSummary.selectedLocations[0] !== spacePlatform) {
        throw new Error("Factory summary did not retain the selected production location")
      }
      const unavailableSources = usedRecipes.filter((recipe) => recipe.isDisable?.())
      if (unavailableSources.length > 0) {
        throw new Error(
          `Space science used unavailable source recipes: ${unavailableSources.map((recipe) => recipe.key).join(", ")}`,
        )
      }
      const unexpectedResources = usedRecipes.filter(
        (recipe) => recipe.isResource?.() && !asteroidChunkKeys.includes(recipe.key),
      )
      if (unexpectedResources.length > 0) {
        throw new Error(
          `Space science used non-asteroid resources: ${unexpectedResources.map((recipe) => recipe.key).join(", ")}`,
        )
      }
      for (const key of ["metallic-asteroid-chunk", "carbonic-asteroid-chunk", "oxide-asteroid-chunk"]) {
        if (!usedRecipeKeys.has(key)) {
          throw new Error(`Space science did not use ${key} as a Space-platform resource`)
        }
      }
      if (usedRecipeKeys.has("biter-egg")) {
        throw new Error("Space science used a surface-restricted captive-spawner recipe")
      }

      const qualityModule = modules.get("quality-module")
      const qualityModule2 = modules.get("quality-module-2")
      const qualityModule3 = modules.get("quality-module-3")
      if (qualityModule.quality.toString() !== "1/100") {
        throw new Error("Quality module 1 did not retain its +1% quality effect")
      }
      if (qualityModule2.quality.toString() !== "1/50") {
        throw new Error("Quality module 2 did not retain its +2% quality effect")
      }
      if (qualityModule3.quality.toString() !== "1/40") {
        throw new Error("Quality module 3 did not retain its +2.5% quality effect")
      }
      if (qualityModule.canBeacon()) {
        throw new Error("Quality modules were incorrectly allowed in beacons")
      }
      const speedModule = modules.get("speed-module")
      const speedModule2 = modules.get("speed-module-2")
      const speedModule3 = modules.get("speed-module-3")
      if (speedModule.quality.toString() !== "-1/100") {
        throw new Error("Speed module 1 did not retain its -1% quality penalty")
      }
      if (speedModule2.quality.toString() !== "-3/200") {
        throw new Error("Speed module 2 did not retain its -1.5% quality penalty")
      }
      if (speedModule3.quality.toString() !== "-1/40") {
        throw new Error("Speed module 3 did not retain its -2.5% quality penalty")
      }
      if (!speedModule.canBeacon()) {
        throw new Error("Speed modules were incorrectly excluded from beacons")
      }
      const electronicCircuit = recipes.get("electronic-circuit")
      const ironOreRecipe = recipes.get("iron-ore")
      const electricMiningDrill = buildings.find((building) => building.key === "electric-mining-drill")
      if (!speedModule.canUse(ironOreRecipe, electricMiningDrill)) {
        throw new Error("Default mining-drill effects were incorrectly treated as an explicit empty restriction")
      }
      if (!qualityModule.canUse(ironOreRecipe, electricMiningDrill)) {
        throw new Error("Quality modules were incorrectly excluded from the electric mining drill")
      }
      const assembler1 = buildings.find((building) => building.key === "assembling-machine-1")
      const assembler2 = buildings.find((building) => building.key === "assembling-machine-2")
      if (qualityModule.canUse(electronicCircuit, assembler1)) {
        throw new Error("Quality modules were allowed in a machine without the quality effect")
      }
      if (!qualityModule.canUse(electronicCircuit, assembler2)) {
        throw new Error("Quality modules were excluded from a compatible machine")
      }
      if (!speedModule.canUse(electronicCircuit, assembler1)) {
        throw new Error("A speed module quality penalty incorrectly required machine quality support")
      }
      const qualityDisabledRecipes = [
        "kovarex-enrichment-process",
        "heavy-oil-cracking",
        "light-oil-cracking",
        "lubricant",
        "basic-oil-processing",
        "advanced-oil-processing",
        "metallic-asteroid-reprocessing",
        "carbonic-asteroid-reprocessing",
        "oxide-asteroid-reprocessing",
        "steam-condensation",
        "fish-breeding",
        "nutrients-from-fish",
        "nutrients-from-biter-egg",
      ]
      for (const key of qualityDisabledRecipes) {
        const recipe = recipes.get(key)
        if (recipe.allow_quality !== false || qualityModule.canUse(recipe, assembler2)) {
          throw new Error(`${key} did not preserve its Factorio 2.1 quality restriction`)
        }
      }
      const restrictedBeaconReceiver = buildings.find((building) => building.key === "oil-refinery")
      const beaconSpec = new ModuleSpec(recipes.get("basic-oil-processing"), factory.spec)
      beaconSpec.setBuilding(restrictedBeaconReceiver, factory.spec)
      beaconSpec.setBeaconModule(speedModule, 0)
      if (beaconSpec.beaconModules[0] !== speedModule) {
        throw new Error("A compatible speed beacon was rejected by the receiver machine")
      }
      const receiverRestrictedBeaconModule = {
        canBeacon: () => true,
        canUse: (_recipe, building) => building.allowsModule(qualityModule),
      }
      beaconSpec.setBeaconModule(receiverRestrictedBeaconModule, 0)
      if (beaconSpec.beaconModules[0] !== null) {
        throw new Error("A receiver-incompatible beacon module was accepted")
      }
      factory.spec.setDefaultBeacon(qualityModule, 0)
      if (factory.spec.defaultBeacon[0] !== null) {
        throw new Error("An incompatible default beacon module was not sanitized")
      }

      const recyclingRecipe = recipes.get("accumulator-recycling")
      if (!isRecyclingRecipe(recyclingRecipe)) {
        throw new Error("Recipe settings did not classify recycling separately")
      }
      const ironPlate = items.get("iron-plate")
      const ironPlateRecipes = getItemProductionRecipes(ironPlate)
      const activeIronPlateRecipe = ironPlateRecipes.find((recipe) => !isRecyclingRecipe(recipe))
      const selectorGroups = getRecipeSelectorGroups(ironPlateRecipes, activeIronPlateRecipe)
      if (selectorGroups.at(-1)?.key !== "recycling") {
        throw new Error("Recipe selector did not place recycling recipes last")
      }
      if (selectorGroups[0]?.recipes[0] !== activeIronPlateRecipe) {
        throw new Error("Recipe selector did not place the active production recipe first")
      }
      if (selectorGroups.at(-1)?.recipes.some((recipe) => !isRecyclingRecipe(recipe))) {
        throw new Error("Recipe selector mixed production recipes into the recycling group")
      }
      if (getRecipeSettingsCategory(recipes.get("metallic-asteroid-crushing")) !== "crushing") {
        throw new Error("Recipe settings did not preserve crafting-category grouping")
      }
      if (!recipeMatchesSettingsSearch(factory.spec, recipes.get("cryogenic-science-pack"), "cryogenic plant")) {
        throw new Error("Recipe search did not match a compatible machine")
      }
      if (
        !recipeMatchesSettingsSearch(factory.spec, recipes.get("metallic-asteroid-crushing"), "metallic asteroid chunk")
      ) {
        throw new Error("Recipe search did not match an ingredient")
      }
      if (!recipeVisibleInSettings(factory.spec, recipes.get("space-science-pack"), {
        searchText: "",
        showUnavailable: false,
      })) {
        throw new Error("Recipe settings hid an available recipe")
      }
      const solidFuel = items.get("solid-fuel")
      const solidFuelRecipes = getItemProductionRecipes(solidFuel)
      if (solidFuelRecipes.length < 2) {
        throw new Error("Row-level recipe selection did not find Solid fuel production alternatives")
      }
      const toggledRecipe = solidFuelRecipes[0]
      setRecipeEnabled(factory.spec, toggledRecipe, false)
      if (!factory.spec.disable.has(toggledRecipe)) {
        throw new Error("Row-level recipe disabling did not disable its recipe")
      }
      setRecipeEnabled(factory.spec, toggledRecipe, true)
      if (factory.spec.disable.has(toggledRecipe)) {
        throw new Error("Row-level recipe enabling did not restore its recipe")
      }

      const nauvis = planets.get("nauvis")
      factory.spec.selectedPlanets = new Set([nauvis])
      factory.spec.planetaryBaseline = new Set(nauvis.disable)
      factory.spec.disable = new Set(nauvis.disable)

      const item = items.get("cryogenic-science-pack")
      const locationInfo = getUnavailableLocationInfo(factory.spec, item)
      if (locationInfo === null) {
        throw new Error("Cryogenic science pack did not report its unavailable production location")
      }
      const selected = formatLocationList(locationInfo.selectedLocations, "and")
      const compatible = formatLocationList(locationInfo.compatibleLocations, "or", true)
      if (selected !== "Nauvis") {
        throw new Error(`Unexpected selected production locations: ${selected}`)
      }
      if (compatible !== "Aquilo") {
        throw new Error(`Unexpected compatible production locations: ${compatible}`)
      }
      const cryogenicRecipe = recipes.get("cryogenic-science-pack")
      if (recipeVisibleInSettings(factory.spec, cryogenicRecipe, {
        searchText: "",
        showUnavailable: false,
      })) {
        throw new Error("Recipe settings showed an unavailable recipe by default")
      }
      if (!recipeVisibleInSettings(factory.spec, cryogenicRecipe, {
        searchText: "",
        showUnavailable: true,
      })) {
        throw new Error("Recipe settings could not reveal unavailable recipes")
      }

      const aquilo = planets.get("aquilo")
      const combinedDisable = new Set([...nauvis.disable].filter((recipe) => aquilo.disable.has(recipe)))
      factory.spec.selectedPlanets.add(aquilo)
      factory.spec.planetaryBaseline = combinedDisable
      factory.spec.disable = new Set(combinedDisable)
      const cryogenicLocations = getRecipeLocations(
        factory.spec,
        cryogenicRecipe,
        factory.spec.getBuilding(cryogenicRecipe),
      )
      if (cryogenicLocations.length !== 1 || cryogenicLocations[0] !== aquilo) {
        throw new Error("Cryogenic science was not assigned exclusively to Aquilo")
      }
      const ironPlateRecipe = getItemProductionRecipes(items.get("iron-plate")).find(
        (recipe) => recipe.key === "iron-plate",
      )
      const ironPlateLocations = getRecipeLocations(
        factory.spec,
        ironPlateRecipe,
        factory.spec.getBuilding(ironPlateRecipe),
      )
      if (ironPlateLocations.length !== 2) {
        throw new Error("A generally craftable recipe did not report both selected locations")
      }
      if (getUnavailableLocationInfo(factory.spec, item) !== null) {
        throw new Error("Location warning remained after enabling a compatible production location")
      }
    }

    factory.spec.selectedPlanets = new Set()
    for (const recipe of recipes.values()) {
      if (recipe.categories?.size > 0 && !factory.spec.getBuilding(recipe)) {
        throw new Error(`${filename}: no compatible building for ${recipe.key}`)
      }
    }

    summaries.push(`${filename}: ${data.recipes.length} data recipes, ${recipes.size} runtime recipes`)
  }
} finally {
  console.log = originalLog
  await rm(resolve(root, ".tmp"), { recursive: true, force: true })
}

console.log(`Validated ${datasets.length} datasets and ${searchCases.length} search cases through the emitted TypeScript runtime.`)
for (const summary of summaries) {
  console.log(`- ${summary}`)
}

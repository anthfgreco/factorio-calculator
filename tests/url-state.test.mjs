import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

const {
  bytesToBinaryString,
  serializeAutomaticBuildings,
  serializeBuildingOverrides,
  serializeModuleSettings,
  serializeRecipeProductivityLevels,
} = await import(pathToFileURL(resolve(build, "url-state.js")).href)

function module(key) {
  return { shortName: () => key }
}

function count(value) {
  return {
    equal: (other) => other?.value === value,
    toString: () => String(value),
    value,
  }
}

test("URL module settings preserve slot positions, inactive customizations, and stable ordering", () => {
  const defaultModule = module("default")
  const productivity = module("prod")
  const speed = module("speed")
  const defaultCount = count(0)

  const recipeA = { key: "a-recipe" }
  const recipeB = { key: "b-recipe" }
  const recipeC = { key: "c-recipe" }
  const factorySpec = {
    defaultBeacon: [null, null],
    defaultBeaconCount: defaultCount,
    getDefaultModule: () => defaultModule,
    spec: new Map([
      [
        recipeB,
        {
          building: {},
          modules: [defaultModule, speed, defaultModule],
          beaconModules: [null, null],
          beaconCount: defaultCount,
        },
      ],
      [
        recipeC,
        {
          building: {},
          modules: [defaultModule, defaultModule],
          beaconModules: [speed, null],
          beaconCount: count(8),
        },
      ],
      [
        recipeA,
        {
          building: {},
          modules: [productivity, defaultModule],
          beaconModules: [null, null],
          beaconCount: defaultCount,
        },
      ],
    ]),
  }

  assert.deepEqual(serializeModuleSettings(factorySpec), ["a-recipe:prod", "b-recipe::speed", "c-recipe:;speed:null:8"])
})

test("URL compression handles calculator states larger than the argument limit", () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, index) => index % 256)
  const binary = bytesToBinaryString(bytes)

  assert.equal(binary.length, bytes.length)
  assert.equal(binary.charCodeAt(0), 0)
  assert.equal(binary.charCodeAt(32_768), 0)
  assert.equal(binary.charCodeAt(99_999), 159)
})

test("URL building overrides are stable and recipe-specific", () => {
  const recipeA = { key: "a-recipe" }
  const recipeB = { key: "b-recipe" }
  const buildingA = { key: "assembling-machine-2" }
  const buildingB = { key: "electromagnetic-plant" }
  const factorySpec = {
    buildingOverrides: new Map([
      [recipeB, buildingB],
      [recipeA, buildingA],
    ]),
  }

  assert.deepEqual(serializeBuildingOverrides(factorySpec), [
    "a-recipe:assembling-machine-2",
    "b-recipe:electromagnetic-plant",
  ])
})

test("URL automatic-machine settings preserve multiple selections", () => {
  const assemblingMachine1 = { key: "assembling-machine-1" }
  const assemblingMachine3 = { key: "assembling-machine-3" }
  const electromagneticPlant = { key: "electromagnetic-plant" }
  const group = {
    buildings: [assemblingMachine1, assemblingMachine3, electromagneticPlant],
    getDefault: () => assemblingMachine1,
    selectedBuildings: new Set([assemblingMachine3, electromagneticPlant]),
  }
  const factorySpec = {
    buildings: new Map([
      ["crafting", group],
      ["electromagnetics", group],
    ]),
  }

  assert.deepEqual(serializeAutomaticBuildings(factorySpec), ["assembling-machine-3", "electromagnetic-plant"])
})

test("URL recipe productivity levels are stable and omit defaults or unknown research", () => {
  const factorySpec = {
    recipeProductivityResearch: new Map([
      ["steel-plate-productivity", {}],
      ["processing-unit-productivity", {}],
    ]),
    recipeProductivityLevels: new Map([
      ["steel-plate-productivity", 12],
      ["unknown-productivity", 99],
      ["processing-unit-productivity", 0.5],
      ["plastic-bar-productivity", 0],
    ]),
  }

  assert.deepEqual(serializeRecipeProductivityLevels(factorySpec), [
    "processing-unit-productivity:0.5",
    "steel-plate-productivity:12",
  ])
})

const { compressCalculatorSettings, parseCalculatorFragment, parseSettingsParameters } = await import(
  pathToFileURL(resolve(build, "url/codec.js")).href
)
const { CalculatorUrlHistory } = await import(pathToFileURL(resolve(build, "url/history.js")).href)

const nodeBase64 = {
  encode: (binary) => Buffer.from(binary, "latin1").toString("base64"),
  decode: (encoded) => Buffer.from(encoded, "base64").toString("latin1"),
}

test("pure URL codec preserves uncompressed parameter values exactly", () => {
  assert.deepEqual(
    [...parseSettingsParameters("title=A%20Factory&items=advanced-circuit:r:60&empty=")],
    [
      ["title", "A%20Factory"],
      ["items", "advanced-circuit:r:60"],
      ["empty", ""],
    ],
  )
})

test("pure URL codec round-trips compressed calculator fragments", () => {
  const settings = `data=space-age-2-1-13&items=${"advanced-circuit:r:60,".repeat(250)}`
  const compressed = compressCalculatorSettings(settings, nodeBase64)
  assert.match(compressed, /^zip=/)
  assert.deepEqual(parseCalculatorFragment(`#${compressed}`, nodeBase64), parseSettingsParameters(settings))
})

test("URL history controller suppresses startup writes and replaces later state atomically", () => {
  const replacements = []
  const port = {
    hash: "",
    pathname: "/calc.html",
    search: "?embed=1",
    replace(url) {
      replacements.push(url)
      this.hash = url.startsWith("#") ? url : ""
    },
  }
  const history = new CalculatorUrlHistory(port)

  history.initialize()
  history.sync("data=space-age-2-1-13&items=")
  assert.deepEqual(replacements, [])

  history.finishInitialization()
  history.sync("data=space-age-2-1-13&items=")
  history.sync("data=space-age-2-1-13&items=")
  history.clearHash()
  assert.deepEqual(replacements, ["#data=space-age-2-1-13&items=", "/calc.html?embed=1"])
})

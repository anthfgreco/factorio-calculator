import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import { deflateRaw } from "pako"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

const {
  bytesToBinaryString,
  serializeAutomaticBuildings,
  serializeBeltStackOverrides,
  serializeBuildingOverrides,
  serializeMachineQualities,
  serializeModuleQualitySettings,
  serializeModuleSettings,
  serializeRecipeProductivityLevels,
} = await import(pathToFileURL(resolve(build, "main.js")).href)

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

test("URL equipment quality is sparse, positional, and stable", () => {
  const normal = { key: "normal" }
  const rare = { key: "rare" }
  const legendary = { key: "legendary" }
  const recipeA = { key: "a-recipe" }
  const recipeB = { key: "b-recipe" }
  const factorySpec = {
    defaultMachineQuality: legendary,
    defaultModuleQuality: legendary,
    defaultBeaconQuality: legendary,
    machineQualityOverrides: new Map([
      [recipeB, legendary],
      [recipeA, rare],
    ]),
    spec: new Map([
      [
        recipeB,
        {
          moduleQualities: [normal, legendary, normal],
          moduleQualityOverrides: new Set([1]),
          beaconModuleQualities: [rare, normal],
          beaconModuleQualityOverrides: new Set([0]),
          beaconQuality: legendary,
          beaconQualityOverride: true,
        },
      ],
      [
        recipeA,
        {
          moduleQualities: [normal, normal],
          moduleQualityOverrides: new Set(),
          beaconModuleQualities: [normal, normal],
          beaconModuleQualityOverrides: new Set(),
          beaconQuality: normal,
          beaconQualityOverride: false,
        },
      ],
    ]),
  }

  assert.deepEqual(serializeMachineQualities(factorySpec), ["a-recipe:rare", "b-recipe:legendary"])
  assert.deepEqual(serializeModuleQualitySettings(factorySpec), ["b-recipe::legendary;rare;legendary"])
})

test("URL automatic-machine settings preserve multiple selections", () => {
  const assemblingMachine1 = { key: "assembling-machine-1" }
  const assemblingMachine3 = { key: "assembling-machine-3" }
  const electromagneticPlant = { key: "electromagnetic-plant" }
  const group = {
    buildings: [assemblingMachine1, assemblingMachine3, electromagneticPlant],
    getDefaults: () => [assemblingMachine1],
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

test("URL automatic-machine settings omit multiple default selections", () => {
  const assemblingMachine1 = { key: "assembling-machine-1" }
  const chemicalPlant = { key: "chemical-plant" }
  const group = {
    buildings: [assemblingMachine1, chemicalPlant],
    getDefaults: () => [assemblingMachine1, chemicalPlant],
    selectedBuildings: new Set([assemblingMachine1, chemicalPlant]),
  }
  const factorySpec = {
    buildings: new Map([
      ["crafting", group],
      ["chemistry", group],
    ]),
  }

  assert.deepEqual(serializeAutomaticBuildings(factorySpec), [])
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
  pathToFileURL(resolve(build, "main.js")).href
)
const {
  formatBeltStackItemSettings,
  formatTargetSetting,
  parseBeltStackItemSettings,
  parseBeltStackSettingPolicy,
  parseTargetSetting,
} = await import(pathToFileURL(resolve(build, "main.js")).href)
const { CalculatorUrlHistory } = await import(pathToFileURL(resolve(build, "main.js")).href)

const nodeBase64 = {
  encode: (binary) => Buffer.from(binary, "latin1").toString("base64"),
  decode: (encoded) => {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new Error("Invalid base64")
    }
    return Buffer.from(encoded, "base64").toString("latin1")
  },
}

function compressFragment(value) {
  return `zip=${nodeBase64.encode(bytesToBinaryString(deflateRaw(value)))}`
}

test("production target URL settings preserve machine, rate, and belt intent", () => {
  const targets = [
    {
      itemKey: "iron-plate",
      mode: "f",
      value: "24",
      recipeKey: "iron-plate",
      qualityLevel: 0,
      qualityStrategy: "direct",
    },
    {
      itemKey: "advanced-circuit",
      mode: "r",
      value: "198",
      recipeKey: null,
      qualityLevel: 2,
      qualityStrategy: "auto",
    },
    {
      itemKey: "processing-unit",
      mode: "b",
      value: "0.5",
      recipeKey: null,
      qualityLevel: 0,
      qualityStrategy: "direct",
    },
  ]

  const settings = targets.map(formatTargetSetting)
  assert.deepEqual(settings, [
    "iron-plate:f:24:iron-plate",
    "advanced-circuit:r:198:q2:qs-auto",
    "processing-unit:b:0.5",
  ])
  assert.deepEqual(settings.map(parseTargetSetting), targets)
})

test("production target URL settings round-trip automatic planet quality planning", () => {
  const target = {
    itemKey: "iron-plate",
    mode: "r",
    value: "100",
    recipeKey: null,
    qualityLevel: 4,
    qualityStrategy: "auto",
  }
  const setting = formatTargetSetting(target)
  assert.equal(setting, "iron-plate:r:100:q4:qs-auto")
  assert.deepEqual(parseTargetSetting(setting), target)
})

test("production target URL settings reject removed planning modes without weakening direct links", () => {
  assert.deepEqual(parseTargetSetting("advanced-circuit:f:24:q1"), {
    itemKey: "advanced-circuit",
    mode: "f",
    value: "24",
    recipeKey: null,
    qualityLevel: 1,
    qualityStrategy: "direct",
  })
  assert.deepEqual(parseTargetSetting("advanced-circuit:r:198"), {
    itemKey: "advanced-circuit",
    mode: "r",
    value: "198",
    recipeKey: null,
    qualityLevel: 0,
    qualityStrategy: "direct",
  })
  for (const malformed of [
    "",
    "advanced-circuit",
    "advanced-circuit:x:1",
    "advanced-circuit:b:",
    "x:b:1:q1:q2",
    "advanced-circuit:r:1:qs-recycle",
    "advanced-circuit:r:1:q1:qo-materials",
    "advanced-circuit:r:1:q1:qs-recycle:qx-recycle",
    "mech-armor:r:1:q4:qs-fulgora:qo-power:qx-recycle",
  ]) {
    assert.equal(parseTargetSetting(malformed), null)
  }
})

test("belt-stack URL settings preserve item policies in stable order", () => {
  const ironOre = { key: "iron-ore" }
  const processingUnit = { key: "processing-unit" }
  const factorySpec = {
    beltStackOverrides: new Map([
      [processingUnit, "unstacked"],
      [ironOre, "stacked"],
    ]),
  }

  assert.equal(serializeBeltStackOverrides(factorySpec), "iron-ore:stacked,processing-unit:unstacked")
  const settings = [
    { itemKey: "iron-ore", policy: "stacked" },
    { itemKey: "processing-unit", policy: "unstacked" },
  ]
  assert.equal(formatBeltStackItemSettings(settings), "iron-ore:stacked,processing-unit:unstacked")
  assert.deepEqual(parseBeltStackItemSettings(formatBeltStackItemSettings(settings)), settings)
})

test("belt-stack URL settings reject malformed or duplicate item policies", () => {
  assert.equal(parseBeltStackSettingPolicy("auto"), "auto")
  assert.equal(parseBeltStackSettingPolicy("all"), null)
  for (const malformed of ["iron-ore", ":stacked", "iron-ore:all", "iron-ore:stacked,iron-ore:unstacked"]) {
    assert.equal(parseBeltStackItemSettings(malformed), null)
  }
})

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

test("pure URL codec falls back to empty settings for invalid base64", () => {
  assert.deepEqual(parseCalculatorFragment("#zip=%%%not-base64%%%", nodeBase64), new Map())
})

test("pure URL codec falls back to empty settings for invalid deflate data", () => {
  const invalidDeflate = nodeBase64.encode("this is not raw deflate data")
  assert.deepEqual(parseCalculatorFragment(`#zip=${invalidDeflate}`, nodeBase64), new Map())
})

test("pure URL codec rejects excessively nested compressed fragments", () => {
  let nested = "title=Nested%20factory"
  for (let depth = 0; depth < 10; depth++) nested = compressFragment(nested)

  assert.deepEqual(parseCalculatorFragment(`#${nested}`, nodeBase64), new Map())
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

test("URL history controller preserves a shared hash until initialization finishes", () => {
  const replacements = []
  const port = {
    hash: "#mprod=230&rprod=steel-plate-productivity:9",
    pathname: "/calc.html",
    search: "",
    replace(url) {
      replacements.push(url)
      this.hash = url
    },
  }
  const history = new CalculatorUrlHistory(port)

  history.initialize()
  history.sync("data=space-age-2-1-13&items=")
  assert.deepEqual(replacements, [])

  history.finishInitialization()
  history.sync("mprod=240&rprod=steel-plate-productivity:9")
  assert.deepEqual(replacements, ["#mprod=240&rprod=steel-plate-productivity:9"])
})

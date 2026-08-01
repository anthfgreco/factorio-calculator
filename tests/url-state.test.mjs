import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"
import vm from "node:vm"

const root = resolve(import.meta.dirname, "..")
const build = process.env.FACTORIO_TEST_BUILD
if (!build) {
  throw new Error("FACTORIO_TEST_BUILD is required; run pnpm test")
}

vm.runInThisContext(await readFile(resolve(root, "public/third_party/BigInteger.min.js"), "utf8"))
globalThis.d3 = {
  local: () => ({
    get: () => null,
    set: () => undefined,
  }),
}

const { bytesToBinaryString, serializeModuleSettings } = await import(
  pathToFileURL(resolve(build, "url-state.js")).href
)

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

  assert.deepEqual(serializeModuleSettings(factorySpec), [
    "a-recipe:prod",
    "b-recipe::speed",
    "c-recipe:;speed:null:8",
  ])
})

test("URL compression handles calculator states larger than the argument limit", () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, index) => index % 256)
  const binary = bytesToBinaryString(bytes)

  assert.equal(binary.length, bytes.length)
  assert.equal(binary.charCodeAt(0), 0)
  assert.equal(binary.charCodeAt(32_768), 0)
  assert.equal(binary.charCodeAt(99_999), 159)
})

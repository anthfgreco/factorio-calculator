import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")
const read = (path) => readFile(resolve(root, path), "utf8")

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory() && [".git", ".tmp", "dist", "node_modules"].includes(entry.name)) return []
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? findFiles(path) : [path]
    }),
  )
  return nested.flat()
}

test("runtime source is deliberately monolithic", async () => {
  const [main, html] = await Promise.all([read("src/main.tsx"), read("calc.html")])
  const codeFiles = (await findFiles(resolve(root, "src")))
    .filter((file) => [".ts", ".tsx", ".js", ".jsx", ".css"].includes(extname(file)))
    .map((file) => relative(resolve(root, "src"), file).replaceAll("\\", "/"))
    .sort()

  assert.deepEqual(codeFiles, ["main.tsx", "vendor-sankey.js"])
  assert.match(html, /<div id="root"><\/div>/)
  assert.match(html, /src="\.\/src\/main\.tsx"/)
  assert.doesNotMatch(html, /src\/styles\//)
  assert.match(main, /^import \* as d3sankey from "\.\/vendor-sankey\.js"/m)
  assert.deepEqual(
    [...main.matchAll(/from "(\.\/[^"]+)"/g)].map((match) => match[1]),
    ["./vendor-sankey.js"],
  )
  assert.match(main, /const CALCULATOR_CSS = String\.raw`/)
  assert.match(main, /\/\/ region math\.ts/)
  assert.match(main, /\/\/ region react\/CalculatorApp\.tsx/)
})

test("one repository-wide agent guide replaces nested guides and skills", async () => {
  const instructionFiles = (await findFiles(root))
    .filter((file) => ["AGENTS.md", "SKILL.md"].includes(file.split(/[\\/]/).at(-1)))
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .sort()
  const agents = await read("AGENTS.md")

  assert.deepEqual(instructionFiles, ["AGENTS.md"])
  assert.match(agents, /src\/main\.tsx/)
  assert.match(agents, /one authoritative runtime file/i)
  assert.match(agents, /^# Code Review Rules$/m)
})

test("strict TypeScript and the typed React/store boundary remain intact", async () => {
  const [main, packageJson, tsconfig, lockfile] = await Promise.all([
    read("src/main.tsx"),
    read("package.json"),
    read("tsconfig.json"),
    read("pnpm-lock.yaml"),
  ])
  const packageData = JSON.parse(packageJson)
  const config = JSON.parse(tsconfig)

  assert.equal(packageData.dependencies.react, "19.2.8")
  assert.equal(packageData.dependencies["react-dom"], "19.2.8")
  assert.match(lockfile, /react:\n\s+specifier: 19\.2\.8\n\s+version: 19\.2\.8/)
  assert.equal(config.compilerOptions.jsx, "react-jsx")
  for (const option of [
    "strict",
    "noImplicitAny",
    "strictNullChecks",
    "strictPropertyInitialization",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "useUnknownInCatchVariables",
  ]) {
    assert.equal(config.compilerOptions[option], true, `${option} must stay enabled`)
  }

  assert.match(main, /class BrowserCalculatorStore/)
  assert.match(main, /specification\.subscribe\(this\.refresh\)/)
  assert.match(main, /export interface CalculatorCommands/)
  assert.match(main, /useCalculatorStore\(\)/)
  assert.match(main, /commands\.setFactoryDensity/)
  assert.match(main, /commands\.setPlanningSetting/)
  assert.doesNotMatch(main, /forwardNativeEvent|CalculatorHandlers|handlers:/)
})

test("monolith keeps expensive native engines deferred", async () => {
  const [main, budgets, packageJson] = await Promise.all([
    read("src/main.tsx"),
    read("config/build-budgets.json"),
    read("package.json"),
  ])
  const requiredDeferred = JSON.parse(budgets).requiredDeferredModuleFragments
  const scripts = JSON.parse(packageJson).scripts

  assert.match(main, /import\("@dagrejs\/dagre"\)/)
  assert.match(main, /import\("highs"\)/)
  assert.match(main, /import\("highs\/runtime\?url"\)/)
  assert.doesNotMatch(main, /^import .* from "(?:@dagrejs\/dagre|highs(?:\/runtime\?url)?)"/m)
  assert.ok(requiredDeferred.includes("node_modules/@dagrejs/dagre"))
  assert.ok(requiredDeferred.includes("node_modules/.pnpm/highs@"))
  assert.equal(scripts["bench:check"], "node scripts/bench-solver.mjs --check")
})

test("core calculation, URL, renderer, and dense UI invariants survived consolidation", async () => {
  const main = await read("src/main.tsx")

  assert.match(main, /public readonly p: bigint/)
  assert.match(main, /export class Rational/)
  assert.match(main, /export function parseCalculatorData/)
  assert.match(main, /export function compressCalculatorSettings/)
  assert.match(main, /class CalculatorUrlHistory/)
  assert.match(main, /private ensureInstance\(\): Instance \| null/)
  assert.match(main, /displayRows\.selectAll\("td\.building-icon > :not\(\.recipe-selector\)"\)\.remove\(\)/)
  assert.match(main, /tippy-box\[data-theme~="factorio-dropdown"\]/)
  assert.match(main, /grid-template-columns:repeat\(2,minmax\(0,15rem\)\)/)
  assert.match(main, /\.beacon-controls/)
  assert.doesNotMatch(main, /Popper\.createPopper|classed\("clicker"/)
})

test("runtime dependencies and generated sprite pairs remain complete", async () => {
  const packageData = JSON.parse(await read("package.json"))
  for (const dependency of ["d3", "@dagrejs/dagre", "highs", "pako", "tippy.js"]) {
    assert.ok(packageData.dependencies[dependency], `missing ${dependency}`)
  }

  const dataDirectory = resolve(root, "public/data")
  const datasets = (await readdir(dataDirectory)).filter((name) => name.endsWith(".json"))
  const hashes = new Set()
  for (const dataset of datasets)
    hashes.add(JSON.parse(await readFile(resolve(dataDirectory, dataset), "utf8")).sprites.hash)
  assert.ok(hashes.size > 0)
  for (const hash of hashes) {
    const png = await stat(resolve(root, `public/images/sprite-sheet-${hash}.png`))
    const webp = await stat(resolve(root, `public/images/sprite-sheet-${hash}.webp`))
    assert.ok(webp.size < png.size, `${hash}: expected WebP ${webp.size} to be smaller than PNG ${png.size}`)
  }
})

test("player-facing copy excludes implementation terminology", async () => {
  const playerCopy = `${await read("src/main.tsx")}\n${await read("public/docs/changelog.html")}`.toLowerCase()
  for (const phrase of [
    "is not exported",
    "synthetic solver",
    "dataset validation",
    "transport pseudo-recipes",
    "quality-qualified",
    "internal production",
  ]) {
    assert.doesNotMatch(playerCopy, new RegExp(phrase), `Found implementation phrase: ${phrase}`)
  }
})

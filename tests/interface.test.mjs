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

test("runtime source is the React monolith plus one deferred visualization island", async () => {
  const [main, html] = await Promise.all([read("src/main.tsx"), read("calc.html")])
  const codeFiles = (await findFiles(resolve(root, "src")))
    .filter((file) => [".ts", ".tsx", ".js", ".jsx", ".css"].includes(extname(file)))
    .map((file) => relative(resolve(root, "src"), file).replaceAll("\\", "/"))
    .sort()

  assert.deepEqual(codeFiles, ["main.tsx", "vendor-sankey.js", "visualization.ts"])
  assert.match(html, /<div id="root"><\/div>/)
  assert.match(html, /src="\.\/src\/main\.tsx"/)
  assert.doesNotMatch(html, /<link[^>]+stylesheet|src\/styles\//)
  assert.deepEqual(
    [...main.matchAll(/^import .* from "([^"]+)"/gm)].map((match) => match[1]),
    ["pako", "react", "react-dom/client"],
  )
  assert.doesNotMatch(main, /^import .* from "\.\//m)
  assert.match(main, /import\("\.\/visualization"\)/)
  assert.match(main, /const BASE_CSS = String\.raw`/)
  assert.match(main, /<style>\{BASE_CSS\}<\/style>/)
  assert.match(main, /const UI = \{/)
  assert.match(main, /const THEME_VARIABLES = \{/)
  assert.match(main, /mergeStyles\(UI\.app, THEME_VARIABLES\)/)
  assert.doesNotMatch(main, /colorSchemes|colorSchemeKey|setColorScheme/)
  assert.doesNotMatch(main, /CALCULATOR_CSS|GLOBAL_CSS/)
})

test("React owns the application shell and D3 owns only the graph SVG children", async () => {
  const [main, visualization] = await Promise.all([read("src/main.tsx"), read("src/visualization.ts")])

  for (const legacy of [
    /from "d3"/,
    /tippy\.js/,
    /@dagrejs\/dagre/,
    /vendor-sankey/,
    /querySelector/,
    /document\.createElement/,
    /\.append\(/,
    /\.attr\(/,
    /innerHTML/,
    /xlink:href/,
  ]) {
    assert.doesNotMatch(main, legacy)
  }

  assert.match(main, /void import\("\.\/visualization"\)/)
  assert.match(main, /<svg ref=\{svgRef\} id="graph" role="img" aria-label="Factory recipe flow graph" \/>/)
  assert.match(visualization, /from "@dagrejs\/dagre"/)
  assert.match(visualization, /from "d3"/)
  assert.match(visualization, /from "\.\/vendor-sankey\.js"/)
  assert.match(visualization, /export function renderVisualization\(/)
  assert.doesNotMatch(visualization, /querySelector|innerHTML/)
})

test("state ownership is explicit across the model, store, and React boundary", async () => {
  const main = await read("src/main.tsx")

  assert.match(main, /export interface CalculatorSnapshot \{[\s\S]+readonly specification: FactorySpecification/)
  assert.match(main, /readonly totals: Totals \| null/)
  assert.match(main, /class BrowserCalculatorStore/)
  assert.match(main, /specification\.subscribe\(this\.refresh\)/)
  assert.match(main, /function runMutation\(\s*specification: FactorySpecification/)
  assert.match(main, /class BuildTarget \{[\s\S]+readonly specification: FactorySpecification/)
  assert.match(main, /new BuildTarget\(this, this\.buildTargets\.length, item\)/)
  assert.doesNotMatch(
    main.slice(main.indexOf("// region target-model.ts"), main.indexOf("// endregion target-model.ts")),
    /\bspec\./,
  )
  assert.doesNotMatch(
    main.slice(main.indexOf("// region react-ui.tsx"), main.indexOf("// endregion react-ui.tsx")),
    /\bspec\./,
  )
})

test("one repository-wide agent guide replaces nested guides and skills", async () => {
  const instructionFiles = (await findFiles(root))
    .filter((file) => ["AGENTS.md", "SKILL.md"].includes(file.split(/[\\/]/).at(-1)))
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .sort()
  const agents = await read("AGENTS.md")

  assert.deepEqual(instructionFiles, ["AGENTS.md"])
  assert.match(agents, /src\/main\.tsx/)
  assert.match(agents, /React owns application DOM/i)
  assert.match(agents, /one deferred visualization island/i)
})

test("strict TypeScript and deferred HiGHS remain enforced", async () => {
  const [main, packageJson, tsconfig, budgets, lockfile] = await Promise.all([
    read("src/main.tsx"),
    read("package.json"),
    read("tsconfig.json"),
    read("config/build-budgets.json"),
    read("pnpm-lock.yaml"),
  ])
  const packageData = JSON.parse(packageJson)
  const config = JSON.parse(tsconfig)
  const requiredDeferred = JSON.parse(budgets).requiredDeferredModuleFragments

  assert.deepEqual(Object.keys(packageData.dependencies).sort(), [
    "@dagrejs/dagre",
    "d3",
    "highs",
    "pako",
    "react",
    "react-dom",
  ])
  assert.match(lockfile, /react:\n\s+specifier: 19\.2\.8\n\s+version: 19\.2\.8/)
  assert.match(lockfile, /(?:^|\n)\s+d3:/)
  assert.match(lockfile, /(?:^|\n)\s+'@dagrejs\/dagre':/)
  assert.match(lockfile, /(?:^|\n)\s+'@types\/d3':/)
  assert.doesNotMatch(lockfile, /(?:^|\n)\s+tippy\.js:/)
  assert.equal(config.compilerOptions.jsx, "react-jsx")
  assert.deepEqual(config.include, ["src/main.tsx", "src/visualization.ts", "src/vendor-sankey.js"])
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

  assert.match(main, /import\("highs"\)/)
  assert.match(main, /import\("highs\/runtime\?url"\)/)
  assert.match(main, /import\("\.\/visualization"\)/)
  assert.doesNotMatch(main, /^import .* from "highs/m)
  assert.deepEqual(requiredDeferred, [
    "node_modules/.pnpm/@dagrejs+dagre@",
    "node_modules/.pnpm/d3@",
    "node_modules/.pnpm/highs@",
  ])
})

test("core calculation and URL behavior remain in the monolith", async () => {
  const main = await read("src/main.tsx")

  assert.match(main, /public readonly p: bigint/)
  assert.match(main, /export class Rational/)
  assert.match(main, /export function parseCalculatorData/)
  assert.match(main, /export function compressCalculatorSettings/)
  assert.match(main, /class CalculatorUrlHistory/)
  assert.match(main, /export class FactorySpecification/)
  assert.match(main, /export class BuildTarget/)
  assert.match(main, /export function CalculatorView/)
  assert.match(main, /createRoot\(rootElement\)\.render\(<CalculatorApp \/>\)/)
})

test("generated sprite pairs remain complete", async () => {
  const dataDirectory = resolve(root, "public/data")
  const datasets = (await readdir(dataDirectory)).filter((name) => name.endsWith(".json"))
  const hashes = new Set()
  for (const dataset of datasets) {
    hashes.add(JSON.parse(await readFile(resolve(dataDirectory, dataset), "utf8")).sprites.hash)
  }
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

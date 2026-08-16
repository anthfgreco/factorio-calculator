import { readFile, readdir } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const sourceRoot = resolve(root, "src")
const violations = []
const expectedSourceFiles = ["main.tsx"]

const sourceFiles = (await walk(sourceRoot))
  .filter((file) => [".js", ".jsx", ".ts", ".tsx"].includes(extname(file)))
  .map((file) => relative(sourceRoot, file).replaceAll("\\", "/"))
  .sort()

if (JSON.stringify(sourceFiles) !== JSON.stringify(expectedSourceFiles)) {
  violations.push(
    `src must contain exactly ${expectedSourceFiles.join(", ")}; found ${sourceFiles.join(", ") || "none"}`,
  )
}

const sourceStyles = (await walk(sourceRoot))
  .filter((file) => [".css", ".less", ".sass", ".scss"].includes(extname(file)))
  .map((file) => relative(sourceRoot, file).replaceAll("\\", "/"))
if (sourceStyles.length > 0) violations.push(`src must not contain stylesheets: ${sourceStyles.join(", ")}`)

const main = await readFile(resolve(sourceRoot, "main.tsx"), "utf8")
const html = await readFile(resolve(root, "calc.html"), "utf8")
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))

const staticRelativeImports = [...main.matchAll(/^import\s+[^\n]*?from\s+["'](\.[^"']+)["']/gm)].map(
  (match) => match[1],
)
if (staticRelativeImports.length > 0) {
  violations.push(`main.tsx must not statically import first-party modules: ${staticRelativeImports.join(", ")}`)
}

const allDynamicImports = [...main.matchAll(/import\(["']([^"']+)["']\)/g)].map((match) => match[1])
const dynamicDependencies = [...new Set(allDynamicImports)].sort()
const expectedDynamicDependencies = ["highs", "highs/runtime?url"]
if (JSON.stringify(dynamicDependencies) !== JSON.stringify(expectedDynamicDependencies)) {
  violations.push(`only HiGHS may be dynamically imported; found ${dynamicDependencies.join(", ") || "none"}`)
}
if (/^import\s+(?!type\s)[^\n]*?["']highs(?:\/runtime\?url)?["']/m.test(main)) {
  violations.push("HiGHS must not be statically imported")
}

const regions = [...main.matchAll(/^\/\/ region (.+)$/gm)].map((match) => match[1])
if (regions.length < 35 || regions.at(-1) !== "main.tsx") {
  violations.push(`main.tsx must retain at least 35 ordered region markers ending in main.tsx; found ${regions.length}`)
}

for (const requiredText of [
  "const BASE_CSS = String.raw`",
  "const UI = {",
  "function themeVariables(",
  "<style>{BASE_CSS}</style>",
  "style={mergeStyles(UI.app, themeVariables(snapshot.colorSchemeKey))}",
  "export function buildDeclarativeGraph(",
  'id="graph"',
  "export function CalculatorApp()",
  "readonly specification: FactorySpecification",
  "new BuildTarget(this, this.buildTargets.length, item)",
]) {
  if (!main.includes(requiredText))
    violations.push(`main.tsx is missing architecture marker ${JSON.stringify(requiredText)}`)
}

const forbiddenPatterns = [
  ["legacy calculator stylesheet", /CALCULATOR_CSS|GLOBAL_CSS/],
  ["D3", /(?:from|import\()[\s\S]{0,20}["']d3["']/],
  ["Tippy", /tippy(?:\.js)?/i],
  ["Dagre", /@dagrejs\/dagre|\bdagre\b/i],
  ["vendored Sankey renderer", /vendor-sankey|sankeyCircular/i],
  ["manual element creation", /document\.createElement(?:NS)?\s*\(/],
  ["selector-driven rendering", /\.(?:querySelector|querySelectorAll)\s*\(/],
  ["imperative HTML mutation", /\.innerHTML\s*=|\.insertAdjacentHTML\s*\(/],
  ["chained DOM/SVG construction", /\.(?:append|attr|classed)\s*\(/],
  ["legacy xlink sprite assignment", /xlink:href|xlinkHref/],
]
for (const [name, pattern] of forbiddenPatterns) {
  if (pattern.test(main)) violations.push(`main.tsx still contains ${name}`)
}

const documentMembers = [...main.matchAll(/document\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1])
const forbiddenDocumentMembers = [...new Set(documentMembers)].filter(
  (member) => !["getElementById", "title"].includes(member),
)
if (forbiddenDocumentMembers.length > 0) {
  violations.push(`main.tsx uses unsupported document APIs: ${forbiddenDocumentMembers.join(", ")}`)
}

if (/src\/styles\//.test(html) || /<link[^>]+rel=["']stylesheet["'][^>]+src\//i.test(html)) {
  violations.push("calc.html must not reference source stylesheets")
}
if (!html.includes('src="./src/main.tsx"')) violations.push("calc.html must load ./src/main.tsx")
if (!html.includes('<div id="root"></div>')) violations.push("calc.html must expose one React root")

const runtimeDependencies = Object.keys(packageJson.dependencies ?? {}).sort()
const expectedRuntimeDependencies = ["highs", "pako", "react", "react-dom"]
if (JSON.stringify(runtimeDependencies) !== JSON.stringify(expectedRuntimeDependencies)) {
  violations.push(
    `runtime dependencies must be ${expectedRuntimeDependencies.join(", ")}; found ${runtimeDependencies.join(", ") || "none"}`,
  )
}

const instructionFiles = (await walk(root))
  .filter((file) => ["AGENTS.md", "SKILL.md"].includes(file.split(/[\\/]/).at(-1)))
  .map((file) => relative(root, file).replaceAll("\\", "/"))
  .filter((file) => !file.startsWith("node_modules/"))
  .sort()
if (JSON.stringify(instructionFiles) !== JSON.stringify(["AGENTS.md"])) {
  violations.push(
    `repository must have one instruction file: AGENTS.md; found ${instructionFiles.join(", ") || "none"}`,
  )
}

if (violations.length > 0) {
  console.error("Monolithic React architecture check failed:\n")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  `Monolithic React architecture check passed: one runtime file, ${regions.length} regions, inline React styling, declarative SVG, one AGENTS.md.`,
)

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if ([".git", ".tmp", "dist", "node_modules"].includes(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else files.push(path)
  }
  return files
}

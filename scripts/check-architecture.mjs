import { readFile, readdir } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const sourceRoot = resolve(root, "src")
const expectedSourceFiles = ["main.tsx", "vendor-sankey.js"]
const violations = []

const sourceFiles = (await walk(sourceRoot))
  .filter((file) => [".js", ".jsx", ".ts", ".tsx"].includes(extname(file)))
  .map((file) => relative(sourceRoot, file).replaceAll("\\", "/"))
  .sort()

if (JSON.stringify(sourceFiles) !== JSON.stringify(expectedSourceFiles)) {
  violations.push(
    `src must contain exactly ${expectedSourceFiles.join(", ")}; found ${sourceFiles.join(", ") || "none"}`,
  )
}

const main = await readFile(resolve(sourceRoot, "main.tsx"), "utf8")
const html = await readFile(resolve(root, "calc.html"), "utf8")
const staticRelativeImports = [...main.matchAll(/^import\s+[^\n]*?from\s+["'](\.[^"']+)["']/gm)].map(
  (match) => match[1],
)
const internalDynamicImports = [...main.matchAll(/import\(["'](\.[^"']+)["']\)/g)].map((match) => match[1])

if (JSON.stringify(staticRelativeImports) !== JSON.stringify(["./vendor-sankey.js"])) {
  violations.push(
    `main.tsx may statically import only ./vendor-sankey.js; found ${staticRelativeImports.join(", ") || "none"}`,
  )
}
if (internalDynamicImports.length > 0) {
  violations.push(
    `main.tsx must not hide first-party modules behind dynamic imports: ${internalDynamicImports.join(", ")}`,
  )
}
for (const dependency of ["@dagrejs/dagre", "highs", "highs/runtime?url"]) {
  if (!main.includes(`import(${JSON.stringify(dependency)})`)) {
    violations.push(`main.tsx must keep ${dependency} behind a dynamic import`)
  }
}
for (const dependency of ["@dagrejs/dagre", "highs"]) {
  const staticPattern = new RegExp(`^import\\s+(?!type\\s)[^\\n]*?["']${escapeRegExp(dependency)}["']`, "m")
  if (staticPattern.test(main)) violations.push(`main.tsx must not statically import ${dependency}`)
}

const regions = [...main.matchAll(/^\/\/ region (.+)$/gm)].map((match) => match[1])
if (regions.length < 40 || regions.at(-1) !== "main.tsx") {
  violations.push(`main.tsx must retain navigable region markers; found ${regions.length}`)
}
if (!main.includes("const CALCULATOR_CSS = String.raw`"))
  violations.push("main.tsx must embed the calculator stylesheet")
if (/src\/styles\//.test(html)) violations.push("calc.html must not reference deleted source stylesheets")
if (!html.includes('src="./src/main.tsx"')) violations.push("calc.html must load ./src/main.tsx")

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
  console.error("Monolithic architecture check failed:\n")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  `Monolithic architecture check passed: ${sourceFiles.length} source files, ${regions.length} navigable regions, one AGENTS.md.`,
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

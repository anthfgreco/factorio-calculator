import { readFile, readdir } from "node:fs/promises"
import { dirname, extname, relative, resolve, sep } from "node:path"

const root = resolve(import.meta.dirname, "..")
const sourceRoot = resolve(root, "src")
const sourceExtensions = new Set([".ts", ".js"])
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g

const files = await collectFiles(sourceRoot)
const fileSet = new Set(files)
const importGraph = new Map(files.map((file) => [file, []]))
const violations = []

for (const file of files) {
  const source = await readFile(file, "utf8")
  const sourcePath = normalize(relative(sourceRoot, file))
  const sourceLayer = layerOf(sourcePath)

  const mustBeBrowserIndependent =
    sourceLayer === "core" ||
    sourceLayer === "infrastructure" && !sourcePath.startsWith("infrastructure/url/") ||
    sourceLayer === "application" && sourcePath !== "application/bootstrap.ts"
  if (mustBeBrowserIndependent) {
    for (const forbidden of ["document", "window", "localStorage", "sessionStorage", "d3."]) {
      if (source.includes(forbidden)) {
        violations.push(`${sourcePath}: ${sourceLayer} contains browser dependency ${JSON.stringify(forbidden)}`)
      }
    }
  }

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (!specifier.startsWith(".")) {
      continue
    }
    const target = resolveImport(file, specifier)
    if (target === null || !target.startsWith(sourceRoot + sep)) {
      continue
    }
    if (fileSet.has(target)) {
      importGraph.get(file).push(target)
    }
    const targetPath = normalize(relative(sourceRoot, target))
    const targetLayer = layerOf(targetPath)
    const allowed = allowedLayers(sourcePath, sourceLayer)
    if (!allowed.has(targetLayer)) {
      violations.push(
        `${sourcePath}: ${sourceLayer} must not import ${targetLayer} (${specifier} -> ${targetPath})`,
      )
    }
  }
}

for (const cycle of findImportCycles(importGraph)) {
  violations.push(`import cycle: ${cycle.map((file) => normalize(relative(sourceRoot, file))).join(" -> ")}`)
}

if (violations.length > 0) {
  console.error("Architecture check failed:\n")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log(`Architecture check passed for ${files.length} source files.`)

function findImportCycles(graph) {
  const state = new Map()
  const stack = []
  const stackIndex = new Map()
  const cycles = []
  const seen = new Set()

  function visit(file) {
    state.set(file, 1)
    stackIndex.set(file, stack.length)
    stack.push(file)

    for (const dependency of graph.get(file) ?? []) {
      if (!state.has(dependency)) {
        visit(dependency)
      } else if (state.get(dependency) === 1) {
        const start = stackIndex.get(dependency)
        const cycle = [...stack.slice(start), dependency]
        const key = [...new Set(cycle.slice(0, -1))].sort().join("|")
        if (!seen.has(key)) {
          seen.add(key)
          cycles.push(cycle)
        }
      }
    }

    stack.pop()
    stackIndex.delete(file)
    state.set(file, 2)
  }

  for (const file of graph.keys()) {
    if (!state.has(file)) {
      visit(file)
    }
  }
  return cycles
}

async function collectFiles(directory) {
  const results = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "vendor") {
        results.push(...(await collectFiles(path)))
      }
    } else if (sourceExtensions.has(extname(entry.name))) {
      results.push(path)
    }
  }
  return results
}

function resolveImport(sourceFile, specifier) {
  let target = resolve(dirname(sourceFile), specifier)
  if (target.endsWith(".js")) {
    target = target.slice(0, -3) + ".ts"
  }
  return target
}

function normalize(path) {
  return path.split(sep).join("/")
}

function layerOf(path) {
  return path.split("/", 1)[0]
}

function allowedLayers(sourcePath, sourceLayer) {
  if (sourcePath === "application/bootstrap.ts" || sourcePath === "main.ts") {
    return new Set(["application", "core", "infrastructure", "runtime", "shared", "ui", "visualization", "vendor", "styles", "presentation"])
  }

  switch (sourceLayer) {
    case "core":
      return new Set(["core"])
    case "shared":
      return new Set(["core", "shared"])
    case "infrastructure":
      return new Set(["core", "infrastructure", "shared"])
    case "application":
      return new Set(["application", "core", "runtime", "shared"])
    case "presentation":
      return new Set(["core", "presentation", "shared"])
    case "runtime":
      return new Set(["core", "presentation", "runtime", "shared"])
    case "ui":
      return new Set(["application", "core", "infrastructure", "presentation", "runtime", "shared", "ui", "visualization"])
    case "visualization":
      return new Set(["application", "core", "presentation", "runtime", "shared", "ui", "vendor", "visualization"])
    default:
      return new Set([sourceLayer])
  }
}

import { readFile, readdir } from "node:fs/promises"
import { basename, extname, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const sourceRoot = resolve(root, "src")
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g

const allowedImports = new Map([
  ["data.ts", new Set()],
  ["math.ts", new Set()],
  ["solver.ts", new Set(["math.ts"])],
  ["planning.ts", new Set(["math.ts"])],
  ["color-schemes.ts", new Set()],
  ["presentation.ts", new Set()],
  ["models.ts", new Set(["data.ts", "math.ts", "presentation.ts"])],
  ["priorities.ts", new Set(["math.ts"])],
  ["recipes.ts", new Set(["data.ts", "math.ts", "models.ts", "presentation.ts", "priorities.ts", "solver.ts"])],
  ["factory.ts", new Set(["math.ts", "models.ts", "planning.ts", "priorities.ts", "recipes.ts", "solver.ts"])],
  ["state.ts", new Set(["factory.ts", "math.ts"])],
  ["graph.ts", new Set(["factory.ts", "math.ts", "presentation.ts"])],
  ["visualization.ts", new Set(["factory.ts", "graph.ts", "math.ts", "presentation.ts", "state.ts"])],
  [
    "settings.ts",
    new Set([
      "color-schemes.ts",
      "data.ts",
      "factory.ts",
      "math.ts",
      "models.ts",
      "priorities.ts",
      "recipes.ts",
      "state.ts",
    ]),
  ],
  [
    "ui.ts",
    new Set(["data.ts", "factory.ts", "math.ts", "planning.ts", "presentation.ts", "recipes.ts", "settings.ts"]),
  ],
  ["url-state.ts", new Set(["data.ts", "factory.ts", "math.ts", "settings.ts", "state.ts"])],
  [
    "results.ts",
    new Set([
      "factory.ts",
      "math.ts",
      "models.ts",
      "planning.ts",
      "presentation.ts",
      "recipes.ts",
      "settings.ts",
      "state.ts",
      "url-state.ts",
    ]),
  ],
  [
    "app.ts",
    new Set([
      "data.ts",
      "factory.ts",
      "models.ts",
      "planning.ts",
      "presentation.ts",
      "recipes.ts",
      "results.ts",
      "settings.ts",
      "state.ts",
      "ui.ts",
      "url-state.ts",
      "visualization.ts",
    ]),
  ],
  ["main.ts", new Set(["app.ts", "state.ts"])],
])

const browserIndependent = new Set(["data.ts", "math.ts", "solver.ts", "factory.ts"])
const sourceFiles = (await readdir(sourceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name) === ".ts" && !entry.name.endsWith(".d.ts"))
  .map((entry) => resolve(sourceRoot, entry.name))
const sourceNames = new Set(sourceFiles.map((file) => basename(file)))
const graph = new Map(sourceFiles.map((file) => [basename(file), []]))
const violations = []

for (const file of sourceFiles) {
  const name = basename(file)
  const source = await readFile(file, "utf8")
  const allowed = allowedImports.get(name)
  if (allowed === undefined) {
    violations.push(`${name}: missing from the architecture module map`)
    continue
  }

  if (browserIndependent.has(name)) {
    for (const forbidden of ["document", "window", "localStorage", "sessionStorage", "d3."]) {
      if (source.includes(forbidden)) {
        violations.push(`${name}: deterministic module contains browser dependency ${JSON.stringify(forbidden)}`)
      }
    }
  }

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (!specifier.startsWith("./")) {
      continue
    }
    const targetName = basename(specifier.replace(/\.js$/, ".ts"))
    if (!sourceNames.has(targetName)) {
      continue
    }
    graph.get(name).push(targetName)
    if (!allowed.has(targetName)) {
      violations.push(`${name}: must not import ${targetName} (${specifier})`)
    }
  }
}

for (const cycle of findImportCycles(graph)) {
  violations.push(`import cycle: ${cycle.join(" -> ")}`)
}

if (violations.length > 0) {
  console.error("Architecture check failed:\n")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log(`Architecture check passed for ${sourceFiles.length} consolidated source modules.`)

function findImportCycles(moduleGraph) {
  const state = new Map()
  const stack = []
  const stackIndex = new Map()
  const cycles = []
  const seen = new Set()

  function visit(moduleName) {
    state.set(moduleName, 1)
    stackIndex.set(moduleName, stack.length)
    stack.push(moduleName)

    for (const dependency of moduleGraph.get(moduleName) ?? []) {
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
    stackIndex.delete(moduleName)
    state.set(moduleName, 2)
  }

  for (const moduleName of moduleGraph.keys()) {
    if (!state.has(moduleName)) {
      visit(moduleName)
    }
  }
  return cycles
}

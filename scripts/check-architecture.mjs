import { readFile, readdir } from "node:fs/promises"
import { dirname, extname, relative, resolve } from "node:path"

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
  ["react/types.ts", new Set()],
  ["react/HelpPanel.tsx", new Set()],
  ["react/SettingsPanel.tsx", new Set(["react/types.ts"])],
  ["react/CalculatorShell.tsx", new Set(["react/HelpPanel.tsx", "react/SettingsPanel.tsx", "react/types.ts"])],
  ["react/CalculatorApp.tsx", new Set(["app.ts", "state.ts", "react/CalculatorShell.tsx", "react/types.ts"])],
  ["main.tsx", new Set(["react/CalculatorApp.tsx"])],
])

const browserIndependent = new Set(["data.ts", "math.ts", "solver.ts", "factory.ts"])
const sourceFiles = await findSourceFiles(sourceRoot)
const sourceByKey = new Map(sourceFiles.map((file) => [moduleKey(file), file]))
const sourceByStem = new Map(sourceFiles.map((file) => [stripExtension(file), file]))
const graph = new Map(sourceByKey.keys().map((key) => [key, []]))
const violations = []

for (const file of sourceFiles) {
  const key = moduleKey(file)
  const source = await readFile(file, "utf8")
  const allowed = allowedImports.get(key)
  if (allowed === undefined) {
    violations.push(`${key}: missing from the architecture module map`)
    continue
  }

  if (browserIndependent.has(key)) {
    for (const forbidden of ["document", "window", "localStorage", "sessionStorage", "d3.", "react"]) {
      if (source.includes(forbidden)) {
        violations.push(`${key}: deterministic module contains browser dependency ${JSON.stringify(forbidden)}`)
      }
    }
  }

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (!specifier.startsWith(".")) {
      continue
    }
    const targetFile = resolveFirstPartyImport(file, specifier)
    if (targetFile === undefined) {
      continue
    }
    const targetKey = moduleKey(targetFile)
    graph.get(key).push(targetKey)
    if (!allowed.has(targetKey)) {
      violations.push(`${key}: must not import ${targetKey} (${specifier})`)
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

console.log(`Architecture check passed for ${sourceFiles.length} source modules.`)

async function findSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        return findSourceFiles(path)
      }
      if (entry.isFile() && [".ts", ".tsx"].includes(extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
        return [path]
      }
      return []
    }),
  )
  return nested.flat().sort()
}

function moduleKey(file) {
  return relative(sourceRoot, file).replaceAll("\\", "/")
}

function stripExtension(file) {
  return file.slice(0, -extname(file).length)
}

function resolveFirstPartyImport(importer, specifier) {
  const resolved = resolve(dirname(importer), specifier)
  const stem = extname(resolved) === ".js" ? resolved.slice(0, -3) : stripExtension(resolved)
  return sourceByStem.get(stem)
}

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

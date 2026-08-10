import { readFile, readdir } from "node:fs/promises"
import { dirname, extname, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const sourceRoot = resolve(root, "src")
const importPattern = /(?:import|export)\s+(type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g

const allowedImports = new Map([
  ["application/contracts.ts", new Set()],
  ["application/store.ts", new Set(["application/contracts.ts", "factory.ts", "math.ts", "state.ts"])],
  ["data.ts", new Set()],
  ["math.ts", new Set()],
  ["solver/contracts.ts", new Set(["math.ts"])],
  ["solver/errors.ts", new Set(["solver/contracts.ts"])],
  ["solver.ts", new Set(["math.ts", "solver/contracts.ts", "solver/errors.ts"])],
  ["planning/contracts.ts", new Set(["math.ts", "models.ts", "recipes.ts"])],
  ["planning.ts", new Set(["math.ts", "models.ts", "planning/contracts.ts", "recipes.ts"])],
  ["color-schemes.ts", new Set()],
  ["presentation.ts", new Set()],
  ["models/item-groups.ts", new Set(["data.ts", "recipes.ts"])],
  ["models/productivity-research.ts", new Set(["data.ts", "math.ts", "presentation.ts", "recipes.ts"])],
  [
    "models.ts",
    new Set(["data.ts", "math.ts", "models/item-groups.ts", "models/productivity-research.ts", "presentation.ts"]),
  ],
  ["priorities.ts", new Set(["math.ts"])],
  ["recipes.ts", new Set(["data.ts", "math.ts", "models.ts", "presentation.ts", "priorities.ts", "solver.ts"])],
  ["factory.ts", new Set(["math.ts", "models.ts", "planning.ts", "priorities.ts", "recipes.ts", "solver.ts"])],
  ["state.ts", new Set(["application/contracts.ts", "factory.ts", "math.ts", "models.ts"])],
  ["graph/types.ts", new Set(["math.ts", "models.ts", "recipes.ts"])],
  ["graph.ts", new Set(["factory.ts", "math.ts", "presentation.ts", "recipes.ts", "graph/types.ts"])],
  [
    "visualization.ts",
    new Set([
      "factory.ts",
      "graph.ts",
      "graph/types.ts",
      "math.ts",
      "models.ts",
      "presentation.ts",
      "recipes.ts",
      "solver.ts",
      "state.ts",
    ]),
  ],
  ["settings/productivity-research.ts", new Set(["math.ts", "models.ts"])],
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
      "settings/productivity-research.ts",
      "url/codec.ts",
    ]),
  ],
  [
    "ui.ts",
    new Set(["data.ts", "factory.ts", "math.ts", "planning.ts", "presentation.ts", "recipes.ts", "settings.ts"]),
  ],
  ["url/codec.ts", new Set()],
  ["url/history.ts", new Set()],
  [
    "url-state.ts",
    new Set(["data.ts", "factory.ts", "math.ts", "settings.ts", "state.ts", "url/codec.ts", "url/history.ts"]),
  ],
  ["results/grouping.ts", new Set(["recipes.ts", "solver.ts"])],
  ["results/summary.ts", new Set(["factory.ts", "math.ts", "models.ts", "planning.ts", "recipes.ts", "solver.ts"])],
  [
    "results.ts",
    new Set([
      "factory.ts",
      "math.ts",
      "models.ts",
      "planning.ts",
      "presentation.ts",
      "results/grouping.ts",
      "results/summary.ts",
      "recipes.ts",
      "settings.ts",
      "state.ts",
      "url-state.ts",
    ]),
  ],
  [
    "app.ts",
    new Set([
      "application/store.ts",
      "data.ts",
      "factory.ts",
      "math.ts",
      "models.ts",
      "planning.ts",
      "presentation.ts",
      "results/grouping.ts",
      "results/summary.ts",
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
  [
    "react/CalculatorShell.tsx",
    new Set(["application/contracts.ts", "react/HelpPanel.tsx", "react/SettingsPanel.tsx", "react/types.ts"]),
  ],
  [
    "react/CalculatorApp.tsx",
    new Set(["application/store.ts", "app.ts", "react/CalculatorShell.tsx", "react/useCalculatorStore.ts"]),
  ],
  ["react/useCalculatorStore.ts", new Set(["application/store.ts"])],
  ["main.tsx", new Set(["react/CalculatorApp.tsx"])],
])

const browserIndependent = new Set([
  "data.ts",
  "math.ts",
  "solver/contracts.ts",
  "solver/errors.ts",
  "solver.ts",
  "planning/contracts.ts",
  "factory.ts",
])

const moduleLayers = new Map([
  ["foundation", new Set(["data.ts", "math.ts", "solver/contracts.ts", "solver/errors.ts", "solver.ts"])],
  [
    "domain",
    new Set([
      "color-schemes.ts",
      "presentation.ts",
      "models/item-groups.ts",
      "models/productivity-research.ts",
      "models.ts",
      "priorities.ts",
      "recipes.ts",
      "planning/contracts.ts",
      "planning.ts",
      "factory.ts",
      "settings/productivity-research.ts",
      "graph/types.ts",
      "results/grouping.ts",
      "results/summary.ts",
    ]),
  ],
  [
    "application",
    new Set(["application/contracts.ts", "application/store.ts", "state.ts", "url/codec.ts", "url/history.ts"]),
  ],
  ["rendering", new Set(["graph.ts", "visualization.ts", "settings.ts", "ui.ts", "results.ts"])],
  ["runtime", new Set(["url-state.ts", "app.ts"])],
  [
    "react",
    new Set([
      "react/types.ts",
      "react/HelpPanel.tsx",
      "react/SettingsPanel.tsx",
      "react/CalculatorShell.tsx",
      "react/CalculatorApp.tsx",
      "react/useCalculatorStore.ts",
      "main.tsx",
    ]),
  ],
])

const allowedLayerImports = new Map([
  ["foundation", new Set(["foundation"])],
  ["domain", new Set(["foundation", "domain"])],
  ["application", new Set(["foundation", "domain", "application"])],
  ["rendering", new Set(["foundation", "domain", "application", "rendering", "runtime"])],
  ["runtime", new Set(["foundation", "domain", "application", "rendering", "runtime"])],
  ["react", new Set(["application", "runtime", "react"])],
])

const layerByModule = new Map()
for (const [layer, modules] of moduleLayers) {
  for (const moduleName of modules) {
    if (layerByModule.has(moduleName)) {
      throw new Error(`Architecture layer map contains duplicate module ${moduleName}`)
    }
    layerByModule.set(moduleName, layer)
  }
}
const sourceFiles = await findSourceFiles(sourceRoot)
const sourceByKey = new Map(sourceFiles.map((file) => [moduleKey(file), file]))
const sourceByStem = new Map(sourceFiles.map((file) => [stripExtension(file), file]))
const graph = new Map(sourceByKey.keys().map((key) => [key, []]))
const violations = []

for (const file of sourceFiles) {
  const key = moduleKey(file)
  const source = await readFile(file, "utf8")
  const allowed = allowedImports.get(key)
  const sourceLayer = layerByModule.get(key)
  if (allowed === undefined) {
    violations.push(`${key}: missing from the architecture module map`)
    continue
  }
  if (sourceLayer === undefined) {
    violations.push(`${key}: missing from the architecture layer map`)
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
    const typeOnly = match[1] !== undefined
    const specifier = match[2]
    if (!specifier.startsWith(".")) {
      continue
    }
    const targetFile = resolveFirstPartyImport(file, specifier)
    if (targetFile === undefined) {
      continue
    }
    const targetKey = moduleKey(targetFile)
    if (!typeOnly) {
      graph.get(key).push(targetKey)
      const targetLayer = layerByModule.get(targetKey)
      if (targetLayer === undefined) {
        violations.push(`${targetKey}: missing from the architecture layer map`)
      } else if (!(allowedLayerImports.get(sourceLayer)?.has(targetLayer) ?? false)) {
        violations.push(`${key} [${sourceLayer}] must not import ${targetKey} [${targetLayer}] (${specifier})`)
      }
      if (!allowed.has(targetKey)) {
        violations.push(`${key}: must not import ${targetKey} (${specifier})`)
      }
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

console.log(`Architecture check passed for ${sourceFiles.length} source modules across ${moduleLayers.size} layers.`)

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

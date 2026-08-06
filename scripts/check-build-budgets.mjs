import { gzipSync } from "node:zlib"
import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const dist = resolve(root, "dist")
const budgets = JSON.parse(await readFile(resolve(root, "config/build-budgets.json"), "utf8"))
const manifestPath = resolve(dist, ".vite/manifest.json")
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const moduleGraph = JSON.parse(await readFile(resolve(dist, ".vite/module-graph.json"), "utf8"))
if (moduleGraph.version !== 1 || typeof moduleGraph.chunks !== "object" || moduleGraph.chunks === null) {
  throw new Error("Vite module graph metadata is missing or unsupported.")
}
const calculatorEntry = Object.values(manifest).find((entry) => entry.isEntry && entry.src === "calc.html")
if (!calculatorEntry) throw new Error("Vite manifest is missing the calculator entry for calc.html")

const initialFiles = collectInitialFiles(calculatorEntry, manifest)
const reachableChunks = collectReachableChunks(calculatorEntry.file, moduleGraph.chunks)
const initialJavaScript = [...initialFiles].filter((file) => file.endsWith(".js"))
const initialCss = new Set()
for (const key of initialFiles) {
  const entry = Object.values(manifest).find((candidate) => candidate.file === key)
  for (const css of entry?.css ?? []) initialCss.add(css)
}
for (const css of calculatorEntry.css ?? []) initialCss.add(css)

const jsBuffers = await Promise.all(initialJavaScript.map((file) => readFile(resolve(dist, file))))
const cssBuffers = await Promise.all([...initialCss].map((file) => readFile(resolve(dist, file))))
const jsBytes = jsBuffers.reduce((sum, value) => sum + value.byteLength, 0)
const gzipBytes = jsBuffers.reduce((sum, value) => sum + gzipSync(value).byteLength, 0)
const cssBytes = cssBuffers.reduce((sum, value) => sum + value.byteLength, 0)

assertBudget("initial JavaScript", jsBytes, budgets.maximumInitialJavaScriptBytes)
assertBudget("initial gzipped JavaScript", gzipBytes, budgets.maximumInitialGzipBytes)
assertBudget("initial CSS", cssBytes, budgets.maximumInitialCssBytes)
assertBudget("initial request count", initialJavaScript.length + initialCss.size, budgets.maximumInitialRequests)

const assets = await listFiles(resolve(dist, "assets"))
for (const file of assets.filter((path) => path.endsWith(".js"))) {
  const size = (await readFile(file)).byteLength
  assertBudget(`chunk ${file.slice(dist.length + 1)}`, size, budgets.maximumSingleChunkBytes)
}

const deferredSummary = []
for (const fragment of budgets.requiredDeferredModuleFragments ?? []) {
  const normalizedFragment = fragment.toLowerCase()
  const matchingChunks = Object.entries(moduleGraph.chunks).filter(([, chunk]) =>
    chunk.modules.some((moduleId) => moduleId.toLowerCase().includes(normalizedFragment)),
  )
  if (matchingChunks.length === 0) {
    throw new Error(`Required deferred module ${fragment} was not found in the production module graph.`)
  }

  for (const [file] of matchingChunks) {
    if (!reachableChunks.has(file)) {
      throw new Error(`Deferred module ${fragment} is not reachable from the calculator entry (${file}).`)
    }
    if (initialFiles.has(file)) {
      throw new Error(`Deferred module ${fragment} was pulled into the initial calculator chunk (${file}).`)
    }
  }
  deferredSummary.push(`${fragment} -> ${matchingChunks.map(([file]) => file).join(", ")}`)
}

console.log(
  `Build budgets passed: ${jsBytes} B JS (${gzipBytes} B gzip), ${cssBytes} B CSS, ${initialJavaScript.length + initialCss.size} initial requests. Deferred modules: ${deferredSummary.join("; ")}.`,
)

function collectInitialFiles(entry, allEntries) {
  const files = new Set([entry.file])
  const visit = (candidate) => {
    for (const importKey of candidate.imports ?? []) {
      const imported = allEntries[importKey]
      if (!imported || files.has(imported.file)) continue
      files.add(imported.file)
      visit(imported)
    }
  }
  visit(entry)
  return files
}

function collectReachableChunks(entryFile, chunks) {
  const files = new Set()
  const visit = (file) => {
    if (files.has(file)) return
    files.add(file)
    const chunk = chunks[file]
    if (chunk === undefined) return
    for (const imported of [...chunk.imports, ...chunk.dynamicImports]) visit(imported)
  }
  visit(entryFile)
  return files
}

function assertBudget(label, actual, maximum) {
  if (actual > maximum) throw new Error(`${label} exceeded its budget: ${actual} > ${maximum}`)
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? listFiles(path) : [path]
    }),
  )
  return nested.flat()
}

import { gzipSync } from "node:zlib"
import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const dist = resolve(root, "dist")
const budgets = JSON.parse(await readFile(resolve(root, "config/build-budgets.json"), "utf8"))
const manifestPath = resolve(dist, ".vite/manifest.json")
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const calculatorEntry = Object.values(manifest).find((entry) => entry.isEntry && entry.src === "src/main.tsx")
if (!calculatorEntry) throw new Error("Vite manifest is missing the calculator entry for src/main.tsx")

const initialFiles = collectInitialFiles(calculatorEntry, manifest)
const initialJavaScript = initialFiles.filter((file) => file.endsWith(".js"))
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

for (const fragment of budgets.requiredDeferredModuleFragments ?? []) {
  const deferredEntries = Object.entries(manifest).filter(
    ([key, entry]) =>
      key.toLowerCase().includes(fragment.toLowerCase()) ||
      String(entry.src ?? "")
        .toLowerCase()
        .includes(fragment.toLowerCase()),
  )
  for (const [, entry] of deferredEntries) {
    if (initialFiles.has(entry.file)) {
      throw new Error(`Deferred module ${fragment} was pulled into the initial calculator chunk (${entry.file}).`)
    }
  }
}

console.log(
  `Build budgets passed: ${jsBytes} B JS (${gzipBytes} B gzip), ${cssBytes} B CSS, ${initialJavaScript.length + initialCss.size} initial requests.`,
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

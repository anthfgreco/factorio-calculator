import { access, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const failures = []
const warnings = []

const requiredNodeVersion = "22.22.3"
if (process.versions.node !== requiredNodeVersion) {
  const message = `Node ${requiredNodeVersion} is required; current runtime is ${process.versions.node}. Use the version in .node-version.`
  if (process.env.FACTORIO_ALLOW_UNSUPPORTED_NODE === "1") warnings.push(message)
  else failures.push(message)
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))
const expectedPackageManager = packageJson.packageManager

try {
  const nodeVersionFile = (await readFile(resolve(root, ".node-version"), "utf8")).trim()
  if (nodeVersionFile !== requiredNodeVersion) {
    failures.push(`.node-version must contain ${requiredNodeVersion}; found ${JSON.stringify(nodeVersionFile)}.`)
  }
} catch {
  failures.push("Required repository file is missing: .node-version")
}

if (packageJson.engines?.node !== requiredNodeVersion) {
  failures.push(`package.json engines.node must be ${requiredNodeVersion}.`)
}
try {
  const expectedVersion = String(expectedPackageManager).split("@").at(-1)
  const actualPackageManager = readPnpmVersion()
  if (actualPackageManager !== expectedVersion) {
    failures.push(`pnpm ${expectedVersion} is required; current pnpm is ${actualPackageManager}. Run corepack enable.`)
  }
} catch {
  failures.push(`Unable to detect pnpm. Run this check with "pnpm run doctor" after enabling Corepack.`)
}

for (const relativePath of [
  "pnpm-lock.yaml",
  "public/data/space-age-2.1.13.json",
  "public/data/vanilla-2.0.55.json",
  "scripts/check-architecture.mjs",
  "config/build-budgets.json",
  "config/performance-budgets.json",
  "tsconfig.json",
  "AGENTS.md",
]) {
  try {
    await access(resolve(root, relativePath))
  } catch {
    failures.push(`Required repository file is missing: ${relativePath}`)
  }
}

try {
  const lockfile = await readFile(resolve(root, "pnpm-lock.yaml"), "utf8")
  const importer = parseRootImporter(lockfile)
  for (const [name, version] of Object.entries({
    react: packageJson.dependencies.react,
    "react-dom": packageJson.dependencies["react-dom"],
    typescript: packageJson.devDependencies.typescript,
    vite: packageJson.devDependencies.vite,
  })) {
    const entry = importer.dependencies.get(name) ?? importer.devDependencies.get(name)
    if (entry?.specifier !== version || !resolvedVersionMatches(entry.version, version)) {
      failures.push(`pnpm-lock.yaml is not synchronized with package.json for ${name}@${version}.`)
    }
  }
} catch (error) {
  failures.push(`Unable to validate pnpm-lock.yaml: ${error instanceof Error ? error.message : String(error)}`)
}

for (const warning of warnings) console.warn(`Doctor warning: ${warning}`)
if (failures.length > 0) {
  console.error("Repository doctor found problems:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Repository doctor passed with Node ${process.versions.node} and ${expectedPackageManager}.`)

function readPnpmVersion() {
  const userAgent = process.env.npm_config_user_agent ?? ""
  const match = /(?:^|\s)pnpm\/([^\s]+)/.exec(userAgent)
  if (match?.[1] === undefined) throw new Error("pnpm user agent is unavailable")
  return match[1]
}

function parseRootImporter(lockfile) {
  const dependencies = new Map()
  const devDependencies = new Map()
  const sections = { dependencies, devDependencies }
  let inRootImporter = false
  let currentSection = null
  let currentEntry = null

  for (const line of lockfile.split(/\r?\n/)) {
    const indent = /^ */.exec(line)?.[0].length ?? 0
    const trimmed = line.trim()
    if (indent === 2) {
      if (trimmed === ".:") {
        inRootImporter = true
        continue
      }
      if (inRootImporter) break
    }
    if (!inRootImporter || trimmed === "") continue

    if (indent === 4 && trimmed.endsWith(":")) {
      const name = parseYamlScalar(trimmed.slice(0, -1))
      currentSection = sections[name] ?? null
      currentEntry = null
      continue
    }
    if (currentSection === null) continue

    if (indent === 6 && trimmed.endsWith(":")) {
      const name = parseYamlScalar(trimmed.slice(0, -1))
      currentEntry = {}
      currentSection.set(name, currentEntry)
      continue
    }
    if (indent === 8 && currentEntry !== null) {
      const separator = trimmed.indexOf(":")
      if (separator === -1) continue
      const key = trimmed.slice(0, separator)
      if (key === "specifier" || key === "version") {
        currentEntry[key] = parseYamlScalar(trimmed.slice(separator + 1).trim())
      }
    }
  }

  return { dependencies, devDependencies }
}

function parseYamlScalar(value) {
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'")
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value)
  return value
}

function resolvedVersionMatches(resolved, requested) {
  return resolved === requested || resolved?.startsWith(`${requested}(`) === true
}

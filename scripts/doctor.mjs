import { access, readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const failures = []
const warnings = []

const requiredNodeMajor = 24
const actualNodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10)
if (actualNodeMajor !== requiredNodeMajor) {
  const message = `Node ${requiredNodeMajor}.x is required; current runtime is ${process.versions.node}. Use the version in .node-version.`
  if (process.env.FACTORIO_ALLOW_UNSUPPORTED_NODE === "1") warnings.push(message)
  else failures.push(message)
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))
const expectedPackageManager = packageJson.packageManager

try {
  const nodeVersionFile = (await readFile(resolve(root, ".node-version"), "utf8")).trim()
  if (nodeVersionFile !== String(requiredNodeMajor)) {
    failures.push(`.node-version must contain ${requiredNodeMajor}; found ${JSON.stringify(nodeVersionFile)}.`)
  }
} catch {
  failures.push("Required repository file is missing: .node-version")
}

if (packageJson.engines?.node !== `${requiredNodeMajor}.x`) {
  failures.push(`package.json engines.node must be ${requiredNodeMajor}.x.`)
}
try {
  const actualPackageManager = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()
  const expectedVersion = String(expectedPackageManager).split("@").at(-1)
  if (actualPackageManager !== expectedVersion) {
    failures.push(`pnpm ${expectedVersion} is required; current pnpm is ${actualPackageManager}. Run corepack enable.`)
  }
} catch {
  failures.push(`pnpm is unavailable. Run corepack enable, then corepack prepare ${expectedPackageManager} --activate.`)
}

for (const relativePath of [
  "pnpm-lock.yaml",
  "data/space-age-2.1.13.json",
  "data/vanilla-2.0.55.json",
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
  for (const [name, version] of Object.entries({
    react: packageJson.dependencies.react,
    "react-dom": packageJson.dependencies["react-dom"],
    typescript: packageJson.devDependencies.typescript,
    vite: packageJson.devDependencies.vite,
  })) {
    const escaped = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (!new RegExp(`\\b${name.replace("-", "\\-")}:\\s*${escaped}(?:\\s|$)`).test(lockfile)) {
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

import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { compileTypeScript } from "./lib/compile-typescript.mjs"

const root = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(root, ".tmp/tests")
await rm(outputDirectory, { recursive: true, force: true })
await compileTypeScript({ root, outputDirectory })

const result = spawnSync(process.execPath, ["--test", "tests/*.test.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, FACTORIO_TEST_BUILD: outputDirectory },
  timeout: 120_000,
})
await rm(outputDirectory, { recursive: true, force: true })

if (result.error?.code === "ETIMEDOUT") {
  console.error("Test suite exceeded the 120 second process timeout.")
  process.exit(1)
}
if (result.error) {
  throw result.error
}
process.exit(result.status ?? 1)

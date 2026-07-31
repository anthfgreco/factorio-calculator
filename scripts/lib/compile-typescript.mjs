import { execFileSync } from "node:child_process"
import { access } from "node:fs/promises"
import { resolve } from "node:path"

export async function compileTypeScript({ root, outputDirectory, extraArguments = [] }) {
  const localCompiler = resolve(root, "node_modules/typescript/bin/tsc")
  let command = "tsc"
  let args = ["--noEmit", "false", "--outDir", outputDirectory, "--declaration", "false", ...extraArguments]
  try {
    await access(localCompiler)
    command = process.execPath
    args = [localCompiler, ...args]
  } catch {
    // Minimal agent environments may provide TypeScript globally. CI and
    // normal development still resolve the pinned package from node_modules.
  }
  execFileSync(command, args, { cwd: root, stdio: "inherit" })
}

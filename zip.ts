#!/usr/bin/env zx

/**
 * Creates a ZIP containing repository working-tree files, using their current
 * on-disk contents.
 *
 * Includes:
 * - Committed files, including commits not pushed
 * - Staged modifications and newly staged files
 * - Unstaged modifications
 * - Untracked files that are not ignored
 *
 * Excludes:
 * - Ignored files such as node_modules
 * - Deleted tracked files
 * - Tracked directories or submodules
 * - The .git directory
 * - The output ZIP itself
 *
 * Usage:
 *   pn zip
 *   pn zip --nocopy
 *   pn zip --output ../custom-name.zip
 *
 * By default, the generated ZIP is copied to the Windows clipboard as a file.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { $, argv, chalk, usePowerShell, usePwsh } from "zx"

if (process.platform === "win32") {
  try {
    usePwsh()
  } catch {
    usePowerShell()
  }
}

if (process.platform !== "win32") {
  throw new Error("This script currently requires Windows' built-in tar.exe.")
}

const copyFileToClipboard = async (filePath: string): Promise<void> => {
  const powershellScript = `
Add-Type -AssemblyName System.Windows.Forms

$fileDropList = [System.Collections.Specialized.StringCollection]::new()
[void]$fileDropList.Add($env:ZIP_CLIPBOARD_PATH)

[System.Windows.Forms.Clipboard]::SetFileDropList($fileDropList)
`

  await $({
    env: {
      ...process.env,
      ZIP_CLIPBOARD_PATH: filePath,
    },
  })`powershell.exe -NoProfile -STA -Command ${powershellScript}`
}

const parseNullSeparatedPaths = (output: string): string[] => {
  return output.split("\0").filter(Boolean)
}

const isPathInside = (parentPath: string, childPath: string): boolean => {
  const relativePath = path.relative(parentPath, childPath)

  return (
    relativePath !== "" &&
    !relativePath.startsWith(`..${path.sep}`) &&
    relativePath !== ".." &&
    !path.isAbsolute(relativePath)
  )
}

const { stdout: repoRootOutput } = await $`git rev-parse --show-toplevel`

const repoRoot = repoRootOutput.trim()

if (!repoRoot) {
  throw new Error("Could not determine the Git repository root.")
}

const repoName = path.basename(repoRoot)
const outputArgument = typeof argv.output === "string" ? argv.output : undefined
const shouldCopyToClipboard = argv.nocopy !== true

const outputPath = path.resolve(repoRoot, outputArgument ?? path.join("..", `${repoName}-working-tree.zip`))

const outputPathInsideRepo = isPathInside(repoRoot, outputPath) ? path.relative(repoRoot, outputPath) : undefined

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zip-"))
const fileListPath = path.join(tempDirectory, "working-tree-files.txt")

try {
  const { stdout: workingTreeOutput } = await $({
    cwd: repoRoot,
  })`git ls-files --cached --others --exclude-standard -z`

  const EXTRA_INCLUSIONS = [
    "factorio-wiki.md",
    "factorio-wiki.sqlite",
    ".tmp/factorio-wiki.sqlite",
    "factorio-2.1.13-space-age-dump.zip",
  ]

  const extraPaths = EXTRA_INCLUSIONS.filter((filePath) => {
    const absolutePath = path.join(repoRoot, filePath)
    return fs.existsSync(absolutePath) && !fs.lstatSync(absolutePath).isDirectory()
  })

  const workingTreePaths = [...new Set([...parseNullSeparatedPaths(workingTreeOutput), ...extraPaths])]

  const filePaths: string[] = []
  const deletedPaths: string[] = []
  const directoryPaths: string[] = []

  for (const filePath of workingTreePaths) {
    if (outputPathInsideRepo && filePath === outputPathInsideRepo) {
      continue
    }

    const absolutePath = path.join(repoRoot, filePath)

    if (!fs.existsSync(absolutePath)) {
      deletedPaths.push(filePath)
      continue
    }

    const stats = fs.lstatSync(absolutePath)

    // Git normally tracks files rather than directories. A tracked directory
    // generally represents a submodule, which should not be recursively zipped
    // as an ordinary folder.
    if (stats.isDirectory()) {
      directoryPaths.push(filePath)
      continue
    }

    filePaths.push(filePath)
  }

  if (filePaths.length === 0) {
    throw new Error("No working-tree files were found.")
  }

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  })

  fs.rmSync(outputPath, {
    force: true,
  })

  // NUL separation safely handles spaces, newlines, and leading dashes.
  fs.writeFileSync(fileListPath, `${filePaths.join("\0")}\0`, "utf8")

  await $({
    cwd: repoRoot,
    stdio: "inherit",
  })`tar.exe -a -c -f ${outputPath} --null -T ${fileListPath}`

  console.log("")
  console.log(`${chalk.green("Created:")} ${outputPath}`)
  console.log(chalk.cyan(`Included: ${filePaths.length} working-tree files`))
  console.log(chalk.cyan(`Size: ${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB`))

  if (shouldCopyToClipboard) {
    try {
      await copyFileToClipboard(outputPath)
      console.log(chalk.green("Copied ZIP to clipboard."))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Clipboard copying is only a convenience. The successfully created ZIP
      // should remain usable even if another process temporarily owns the clipboard.
      console.warn(chalk.yellow(`Could not copy ZIP to clipboard: ${message}`))
    }
  }

  if (deletedPaths.length > 0) {
    console.log(chalk.yellow(`Skipped: ${deletedPaths.length} tracked files deleted locally`))
  }

  if (directoryPaths.length > 0) {
    console.log(chalk.yellow(`Skipped: ${directoryPaths.length} tracked directories or submodules`))
  }
} finally {
  fs.rmSync(tempDirectory, {
    recursive: true,
    force: true,
  })
}

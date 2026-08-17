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
 * By default, a hidden cached ZIP is copied to the Windows clipboard as a file.
 */

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { $, argv, chalk, usePowerShell, usePwsh } from "zx"

interface ZipFileMetadata {
  size: number
  mtimeMs: number
}

interface ZipManifest {
  version: 1
  files: Record<string, ZipFileMetadata>
}

type ArchiveMode = "full" | "incremental" | "reused"

const MANIFEST_VERSION = 1
const MAX_INCREMENTAL_COMMAND_LENGTH = 24_000

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

  await runProcess("powershell.exe", ["-NoProfile", "-STA", "-Command", powershellScript], process.cwd(), {
    env: {
      ...process.env,
      ZIP_CLIPBOARD_PATH: filePath,
    },
  })
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

const isSamePath = (firstPath: string, secondPath: string): boolean => {
  const firstResolvedPath = path.resolve(firstPath).toLowerCase()
  const secondResolvedPath = path.resolve(secondPath).toLowerCase()
  return firstResolvedPath === secondResolvedPath
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const isSafeRepoRelativePath = (repoRoot: string, filePath: string): boolean => {
  return (
    filePath.length > 0 &&
    !path.isAbsolute(filePath) &&
    !filePath.includes("\0") &&
    isPathInside(repoRoot, path.resolve(repoRoot, filePath))
  )
}

const parseManifest = (repoRoot: string, contents: string): ZipManifest | undefined => {
  const value: unknown = JSON.parse(contents)

  if (!isRecord(value) || value.version !== MANIFEST_VERSION || !isRecord(value.files)) {
    return undefined
  }

  const files: Record<string, ZipFileMetadata> = Object.create(null) as Record<string, ZipFileMetadata>

  for (const [filePath, metadata] of Object.entries(value.files)) {
    if (
      !isSafeRepoRelativePath(repoRoot, filePath) ||
      !isRecord(metadata) ||
      typeof metadata.size !== "number" ||
      !Number.isFinite(metadata.size) ||
      metadata.size < 0 ||
      typeof metadata.mtimeMs !== "number" ||
      !Number.isFinite(metadata.mtimeMs)
    ) {
      return undefined
    }

    files[filePath] = {
      size: metadata.size,
      mtimeMs: metadata.mtimeMs,
    }
  }

  return {
    version: MANIFEST_VERSION,
    files,
  }
}

const manifestsMatch = (currentManifest: ZipManifest, cachedManifest: ZipManifest): boolean => {
  const currentPaths = Object.keys(currentManifest.files)
  const cachedPaths = Object.keys(cachedManifest.files)

  if (currentPaths.length !== cachedPaths.length) {
    return false
  }

  return currentPaths.every((filePath) => {
    const currentMetadata = currentManifest.files[filePath]
    const cachedMetadata = cachedManifest.files[filePath]

    return (
      currentMetadata !== undefined &&
      cachedMetadata !== undefined &&
      currentMetadata.size === cachedMetadata.size &&
      currentMetadata.mtimeMs === cachedMetadata.mtimeMs
    )
  })
}

const find7Zip = (): string | undefined => {
  const pathDirectories = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((directoryPath) => directoryPath.replace(/^"|"$/g, ""))
    .filter(Boolean)

  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles ?? "C:\\Program Files"
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"
  const candidates = [
    ...pathDirectories.map((directoryPath) => path.join(directoryPath, "7z.exe")),
    path.join(programFiles, "7-Zip", "7z.exe"),
    path.join(programFilesX86, "7-Zip", "7z.exe"),
  ]

  return candidates.find((candidatePath) => fs.existsSync(candidatePath))
}

const runProcess = async (
  executablePath: string,
  processArguments: string[],
  cwd: string,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<void> => {
  const result = spawnSync(executablePath, processArguments, {
    cwd,
    ...options,
    stdio: "inherit",
    windowsHide: true,
  })

  if (result.error !== undefined) {
    throw result.error
  }

  if (result.status === 0) {
    return
  }

  throw new Error(
    result.signal === null
      ? `${path.basename(executablePath)} exited with code ${String(result.status)}.`
      : `${path.basename(executablePath)} exited after signal ${result.signal}.`,
  )
}

const makeIncrementalArguments = (
  repoRoot: string,
  cacheZipPath: string,
  changedPaths: string[],
  removedPaths: string[],
  cachedPaths: string[],
): string[] | undefined => {
  const selectedPaths = [...changedPaths, ...removedPaths]
  const hasUnsafePath = selectedPaths.some(
    (filePath) =>
      filePath === "--" ||
      filePath.startsWith("@") ||
      filePath.includes("\r") ||
      filePath.includes("\n") ||
      filePath.includes("*") ||
      filePath.includes("?"),
  )

  if (hasUnsafePath) {
    return undefined
  }

  const removalPatterns: string[] = []

  for (const removedPath of removedPaths) {
    const normalizedRemovedPath = removedPath.toLowerCase()
    const matchingCachedPaths = cachedPaths.filter((cachedPath) =>
      cachedPath.toLowerCase().startsWith(normalizedRemovedPath),
    )
    const parentPath = path.dirname(path.join(repoRoot, removedPath))
    const removedName = path.basename(removedPath).toLowerCase()

    try {
      const matchingDiskNames = fs.existsSync(parentPath)
        ? fs.readdirSync(parentPath).filter((fileName) => fileName.toLowerCase().startsWith(removedName))
        : []

      if (
        matchingCachedPaths.length !== 1 ||
        matchingCachedPaths[0] !== removedPath ||
        matchingDiskNames.length !== 0
      ) {
        return undefined
      }
    } catch {
      return undefined
    }

    // An exact missing filename makes 7-Zip return warning exit code 1 even
    // after deleting the entry. A uniqueness-checked suffix wildcard selects
    // the archive entry without weakening the nonzero-exit fallback.
    removalPatterns.push(`${removedPath}*`)
  }

  const processArguments = [...changedPaths, ...removalPatterns]
  const approximateCommandLength =
    cacheZipPath.length + processArguments.reduce((length, filePath) => length + filePath.length + 3, 0)

  return approximateCommandLength <= MAX_INCREMENTAL_COMMAND_LENGTH ? processArguments : undefined
}

const { stdout: repoRootOutput } = await $`git rev-parse --show-toplevel`

const repoRoot = repoRootOutput.trim()

if (!repoRoot) {
  throw new Error("Could not determine the Git repository root.")
}

const repoName = path.basename(repoRoot)
const outputArgument = typeof argv.output === "string" ? argv.output : undefined
const shouldCopyToClipboard = argv.nocopy !== true
const localAppDataPath = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local")
const repoCacheId = createHash("sha256").update(path.resolve(repoRoot).toLowerCase()).digest("hex").slice(0, 16)
const cacheDirectory = path.join(localAppDataPath, "pn-zip-cache", repoCacheId)
const cacheZipPath = path.join(cacheDirectory, `${repoName}-working-tree.zip`)
const manifestPath = path.join(cacheDirectory, "manifest.json")
const outputPath = outputArgument === undefined ? cacheZipPath : path.resolve(repoRoot, outputArgument)

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
  const manifestFiles: Record<string, ZipFileMetadata> = Object.create(null) as Record<string, ZipFileMetadata>

  for (const filePath of workingTreePaths) {
    const absolutePath = path.join(repoRoot, filePath)

    if (isSamePath(absolutePath, outputPath) || isSamePath(absolutePath, cacheZipPath)) {
      continue
    }

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
    // ponytail: size + mtime detects normal working-tree edits without rereading
    // every file. If timestamp-preserving writers become relevant, hash only
    // metadata-unchanged candidates or switch the manifest fingerprint.
    manifestFiles[filePath] = {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    }
  }

  if (filePaths.length === 0) {
    throw new Error("No working-tree files were found.")
  }

  const currentManifest: ZipManifest = {
    version: MANIFEST_VERSION,
    files: manifestFiles,
  }

  let cachedManifest: ZipManifest | undefined

  if (fs.existsSync(manifestPath)) {
    try {
      cachedManifest = parseManifest(repoRoot, fs.readFileSync(manifestPath, "utf8"))

      if (cachedManifest === undefined) {
        console.warn(chalk.yellow("Cached ZIP manifest is invalid. Performing a full ZIP rebuild."))
      }
    } catch {
      console.warn(chalk.yellow("Cached ZIP manifest is corrupt. Performing a full ZIP rebuild."))
    }
  }

  fs.mkdirSync(cacheDirectory, {
    recursive: true,
  })

  const buildFullArchive = async (): Promise<void> => {
    fs.rmSync(cacheZipPath, {
      force: true,
    })

    // NUL separation safely handles spaces, newlines, and leading dashes.
    fs.writeFileSync(fileListPath, `${filePaths.join("\0")}\0`, "utf8")

    await $({
      cwd: cacheDirectory,
      stdio: "inherit",
    })`tar.exe -a -c -f ${path.basename(cacheZipPath)} -C ${repoRoot} --null -T ${fileListPath}`
  }

  let archiveMode: ArchiveMode
  let changedCount = 0
  let removedCount = 0

  if (cachedManifest !== undefined && fs.existsSync(cacheZipPath) && manifestsMatch(currentManifest, cachedManifest)) {
    archiveMode = "reused"
  } else if (cachedManifest !== undefined && fs.existsSync(cacheZipPath)) {
    const changedPaths = filePaths.filter((filePath) => {
      const currentMetadata = currentManifest.files[filePath]
      const cachedMetadata = cachedManifest.files[filePath]

      return (
        currentMetadata === undefined ||
        cachedMetadata === undefined ||
        currentMetadata.size !== cachedMetadata.size ||
        currentMetadata.mtimeMs !== cachedMetadata.mtimeMs
      )
    })
    const removedPaths = Object.keys(cachedManifest.files).filter(
      (filePath) => currentManifest.files[filePath] === undefined,
    )
    const sevenZipPath = find7Zip()
    const incrementalArguments = makeIncrementalArguments(
      repoRoot,
      cacheZipPath,
      changedPaths,
      removedPaths,
      Object.keys(cachedManifest.files),
    )

    changedCount = changedPaths.length
    removedCount = removedPaths.length

    if (sevenZipPath === undefined) {
      console.warn(chalk.yellow("7-Zip not found."))
      console.warn(chalk.yellow("Performing full ZIP rebuild with tar.exe."))
      console.warn(chalk.yellow("Install 7-Zip to enable incremental ZIP updates:"))
      console.warn(chalk.yellow("  winget install --id 7zip.7zip -e"))
      console.warn(chalk.yellow("Or use the Windows x64 .exe from https://www.7-zip.org/download.html"))
      await buildFullArchive()
      archiveMode = "full"
    } else if (incrementalArguments === undefined) {
      console.warn(chalk.yellow("Incremental path list is unsafe or too long for 7-Zip."))
      console.warn(chalk.yellow("Performing full ZIP rebuild with tar.exe."))
      await buildFullArchive()
      archiveMode = "full"
    } else {
      try {
        await runProcess(
          sevenZipPath,
          ["u", cacheZipPath, "-up1q0r2x2y2z2w2", "-bso0", "-bsp0", "--", ...incrementalArguments],
          repoRoot,
        )
        archiveMode = "incremental"
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(chalk.yellow(`Incremental ZIP update failed: ${message}`))
        console.warn(chalk.yellow("Performing full ZIP rebuild with tar.exe."))
        await buildFullArchive()
        archiveMode = "full"
      }
    }
  } else {
    await buildFullArchive()
    archiveMode = "full"
  }

  if (archiveMode !== "reused") {
    fs.writeFileSync(manifestPath, `${JSON.stringify(currentManifest, undefined, 2)}\n`, "utf8")
  }

  if (!isSamePath(outputPath, cacheZipPath)) {
    fs.mkdirSync(path.dirname(outputPath), {
      recursive: true,
    })
    fs.copyFileSync(cacheZipPath, outputPath)
  }

  const displayedOutputPath = outputArgument === undefined ? path.basename(outputPath) : outputPath

  console.log("")
  console.log(`${chalk.green("Ready:")} ${displayedOutputPath}`)
  console.log(chalk.cyan(`Included: ${filePaths.length} working-tree files`))
  console.log(chalk.cyan(`Size: ${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB`))

  if (archiveMode === "reused") {
    console.log(chalk.green("Reused unchanged ZIP."))
  } else if (archiveMode === "incremental") {
    console.log(chalk.green(`Updated ZIP incrementally (${changedCount} changed, ${removedCount} removed).`))
  } else {
    console.log(chalk.green("Created ZIP with a full rebuild."))
  }

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

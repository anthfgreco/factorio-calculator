#!/usr/bin/env zx

/**
 * Creates a ZIP containing tracked repository files, using their current
 * working-copy contents.
 *
 * Includes:
 * - Committed files
 * - Staged modifications
 * - Unstaged modifications
 *
 * Excludes:
 * - Untracked files
 * - Ignored files such as node_modules
 * - Deleted tracked files
 * - The .git directory
 *
 * Usage:
 *   pn zip
 *   pn zip -- --output ../custom-name.zip
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { $, argv, usePwsh } from "zx";

if (process.platform === "win32") {
  usePwsh();
}

if (process.platform !== "win32") {
  throw new Error("This script currently requires Windows' built-in tar.exe.");
}

const parseNullSeparatedPaths = (output: string): string[] => {
  return output.split("\0").filter(Boolean);
};

const { stdout: repoRootOutput } = await $`git rev-parse --show-toplevel`;

const repoRoot = repoRootOutput.trim();

if (!repoRoot) {
  throw new Error("Could not determine the Git repository root.");
}

const repoName = path.basename(repoRoot);
const outputArgument = typeof argv.output === "string" ? argv.output : undefined;

const outputPath = path.resolve(
  repoRoot,
  outputArgument ?? path.join("..", `${repoName}-working-tree.zip`),
);

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zip-"));

const fileListPath = path.join(tempDirectory, "tracked-files.txt");

try {
  const { stdout: trackedOutput } = await $({
    cwd: repoRoot,
  })`git ls-files --cached -z`;

  const trackedPaths = [...new Set(parseNullSeparatedPaths(trackedOutput))];

  const filePaths: string[] = [];
  const deletedPaths: string[] = [];
  const directoryPaths: string[] = [];

  for (const filePath of trackedPaths) {
    const absolutePath = path.join(repoRoot, filePath);

    if (!fs.existsSync(absolutePath)) {
      deletedPaths.push(filePath);
      continue;
    }

    const stats = fs.lstatSync(absolutePath);

    // Git normally tracks files rather than directories. A tracked directory
    // generally represents a submodule, which should not be recursively zipped
    // as an ordinary folder.
    if (stats.isDirectory()) {
      directoryPaths.push(filePath);
      continue;
    }

    filePaths.push(filePath);
  }

  if (filePaths.length === 0) {
    throw new Error("No tracked working-tree files were found.");
  }

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.rmSync(outputPath, {
    force: true,
  });

  // NUL separation safely handles spaces, newlines and leading dashes in paths.
  fs.writeFileSync(fileListPath, `${filePaths.join("\0")}\0`, "utf8");

  await $({
    cwd: repoRoot,
    stdio: "inherit",
  })`tar.exe -a -c -f ${outputPath} --null -T ${fileListPath}`;

  console.log("");
  console.log(`Created: ${outputPath}`);
  console.log(`Included: ${filePaths.length} tracked files`);

  if (deletedPaths.length > 0) {
    console.log(`Skipped: ${deletedPaths.length} tracked files deleted locally`);
  }

  if (directoryPaths.length > 0) {
    console.log(`Skipped: ${directoryPaths.length} tracked directories or submodules`);
  }
} finally {
  fs.rmSync(tempDirectory, {
    recursive: true,
    force: true,
  });
}

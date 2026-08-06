import { readFile, readdir } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const checkedRoots = [resolve(root, "src"), resolve(root, "tests"), resolve(root, "scripts")]
const violations = []
const explicitAnyPatterns = [
  /:\s*any\b/,
  /=\s*any\b/,
  /\bas\s+any\b/,
  /\bany\s*\[\s*\]/,
  /<[^>\n]*\bany\b[^>\n]*>/,
  /\bany\b\s*[|&]/,
  /[|&]\s*\bany\b/,
]

for (const directory of checkedRoots) {
  for (const file of await findFiles(directory)) {
    const source = await readFile(file, "utf8")
    const codeLines = maskNonCode(source, true).split("\n")
    const commentLines = maskNonCode(source, false).split("\n")
    for (let index = 0; index < codeLines.length; index++) {
      const codeLine = codeLines[index]
      const commentLine = commentLines[index] ?? ""
      if (explicitAnyPatterns.some((pattern) => pattern.test(codeLine))) {
        violations.push(`${relative(root, file)}:${index + 1}: explicit any`)
      }
      if (/@ts-(?:ignore|nocheck|expect-error)/.test(commentLine)) {
        violations.push(`${relative(root, file)}:${index + 1}: TypeScript suppression`)
      }
      if (/\bas\s+unknown\s+as\b/.test(codeLine)) {
        violations.push(`${relative(root, file)}:${index + 1}: unsafe double assertion`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Type-debt check failed. Replace unsafe escape hatches with named contracts:\n")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}
console.log("Type-debt check passed: no explicit any, TypeScript suppressions, or unsafe double assertions.")

async function findFiles(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
  const results = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return findFiles(path)
      if (entry.isFile() && [".ts", ".tsx", ".mts", ".cts", ".mjs"].includes(extname(entry.name))) return [path]
      return []
    }),
  )
  return results.flat()
}

function maskNonCode(source, maskComments) {
  const characters = [...source]
  let state = "code"
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]
    const next = characters[index + 1]
    if (state === "code") {
      if (character === '"') {
        characters[index] = " "
        state = "double"
      } else if (character === "'") {
        characters[index] = " "
        state = "single"
      } else if (character === "`") {
        characters[index] = " "
        state = "template"
      } else if (character === "/" && next === "/") {
        if (maskComments) characters[index] = characters[index + 1] = " "
        state = "line-comment"
        index++
      } else if (character === "/" && next === "*") {
        if (maskComments) characters[index] = characters[index + 1] = " "
        state = "block-comment"
        index++
      }
    } else if (state === "single" || state === "double" || state === "template") {
      if (character === "\\") {
        characters[index] = " "
        if (characters[index + 1] !== "\n") characters[index + 1] = " "
        index++
      } else {
        const terminator = state === "single" ? "'" : state === "double" ? '"' : "`"
        if (character === terminator) state = "code"
        if (character !== "\n") characters[index] = " "
      }
    } else if (state === "line-comment") {
      if (character === "\n") state = "code"
      else if (maskComments) characters[index] = " "
    } else if (state === "block-comment") {
      if (character === "*" && next === "/") {
        if (maskComments) characters[index] = characters[index + 1] = " "
        state = "code"
        index++
      } else if (character !== "\n" && maskComments) {
        characters[index] = " "
      }
    }
  }
  return characters.join("")
}

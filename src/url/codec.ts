import { deflateRaw, inflateRaw } from "pako"
import { isQualityStrategy, type QualityStrategy } from "../quality/contracts.js"

const MAX_COMPRESSED_FRAGMENT_DEPTH = 3

export interface Base64Codec {
  encode(binary: string): string
  decode(encoded: string): string
}

export type TargetSettingMode = "f" | "r" | "b"
export type BeltStackSettingPolicy = "auto" | "stacked" | "unstacked"

export interface BeltStackItemSetting {
  readonly itemKey: string
  readonly policy: BeltStackSettingPolicy
}

export interface TargetSetting {
  readonly itemKey: string
  readonly mode: TargetSettingMode
  readonly value: string
  readonly recipeKey: string | null
  readonly qualityLevel: number
  readonly qualityStrategy: QualityStrategy
}

export function formatTargetSetting(target: TargetSetting): string {
  let setting = `${target.itemKey}:${target.mode}:${target.value}`
  if (target.mode === "f" && target.recipeKey !== null) setting += `:${target.recipeKey}`
  if (target.qualityLevel > 0) setting += `:q${target.qualityLevel}`
  if (target.qualityStrategy !== "direct") setting += `:qs-${target.qualityStrategy}`
  return setting
}

export function parseTargetSetting(setting: string): TargetSetting | null {
  const parts = setting.split(":")
  const itemKey = parts[0]
  const mode = parts[1]
  const value = parts[2]
  if (itemKey === undefined || itemKey === "" || value === undefined || value === "") return null
  if (mode !== "f" && mode !== "r" && mode !== "b") return null

  let recipeKey: string | null = null
  let qualityLevel = 0
  let qualityStrategy: QualityStrategy = "direct"
  let seenQuality = false
  let seenStrategy = false

  for (const part of parts.slice(3)) {
    if (/^q\d+$/.test(part)) {
      if (seenQuality) return null
      qualityLevel = Number(part.slice(1))
      seenQuality = true
      continue
    }
    if (part.startsWith("qs-")) {
      const strategy = part.slice(3)
      if (seenStrategy || !isQualityStrategy(strategy)) return null
      qualityStrategy = strategy
      seenStrategy = true
      continue
    }
    if (mode !== "f" || recipeKey !== null || part === "") return null
    recipeKey = part
  }

  if (qualityLevel === 0 && qualityStrategy !== "direct") return null

  return {
    itemKey,
    mode,
    value,
    recipeKey,
    qualityLevel,
    qualityStrategy,
  }
}

export function parseBeltStackSettingPolicy(value: string): BeltStackSettingPolicy | null {
  return value === "auto" || value === "stacked" || value === "unstacked" ? value : null
}

export function formatBeltStackItemSettings(settings: readonly BeltStackItemSetting[]): string {
  return settings.map((setting) => `${setting.itemKey}:${setting.policy}`).join(",")
}

export function parseBeltStackItemSettings(value: string): BeltStackItemSetting[] | null {
  if (value === "") return []
  const settings: BeltStackItemSetting[] = []
  const seen = new Set<string>()
  for (const part of value.split(",")) {
    const separator = part.lastIndexOf(":")
    if (separator <= 0) return null
    const itemKey = part.slice(0, separator)
    const policy = parseBeltStackSettingPolicy(part.slice(separator + 1))
    if (policy === null || seen.has(itemKey)) return null
    seen.add(itemKey)
    settings.push({ itemKey, policy })
  }
  return settings
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let result = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return result
}

export function binaryStringToBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function parseSettingsParameters(value: string): Map<string, string> {
  const settings = new Map<string, string>()
  for (const pair of value.split("&")) {
    const separator = pair.indexOf("=")
    if (separator === -1) continue
    settings.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
  return settings
}

export function parseCalculatorFragment(fragment: string, base64: Base64Codec): Map<string, string> {
  return parseCalculatorFragmentAtDepth(fragment, base64, 0)
}

function parseCalculatorFragmentAtDepth(
  fragment: string,
  base64: Base64Codec,
  compressedDepth: number,
): Map<string, string> {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment
  const settings = parseSettingsParameters(value)
  const compressed = settings.get("zip")
  if (compressed === undefined) return settings
  if (compressedDepth >= MAX_COMPRESSED_FRAGMENT_DEPTH) return new Map()

  try {
    const binary = base64.decode(compressed)
    const unzipped = new TextDecoder().decode(inflateRaw(binaryStringToBytes(binary)))
    return parseCalculatorFragmentAtDepth(unzipped, base64, compressedDepth + 1)
  } catch {
    return new Map()
  }
}

export function compressCalculatorSettings(settings: string, base64: Base64Codec): string {
  const compressed = `zip=${base64.encode(bytesToBinaryString(deflateRaw(settings)))}`
  return compressed.length < settings.length ? compressed : settings
}

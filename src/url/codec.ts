import { deflateRaw, inflateRaw } from "pako"

const MAX_COMPRESSED_FRAGMENT_DEPTH = 3

export interface Base64Codec {
  encode(binary: string): string
  decode(encoded: string): string
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

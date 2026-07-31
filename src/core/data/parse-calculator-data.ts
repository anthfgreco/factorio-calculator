import type { CalculatorData } from "./types.js"

export class DatasetValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`)
    this.name = "DatasetValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DatasetValidationError(path, "expected an object")
  }
  return value
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DatasetValidationError(path, "expected an array")
  }
  return value
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DatasetValidationError(path, "expected a non-empty string")
  }
  return value
}

function validateKeyedEntries(value: unknown, path: string): void {
  for (let [index, entry] of requireArray(value, path).entries()) {
    let record = requireRecord(entry, `${path}[${index}]`)
    requireString(record.key, `${path}[${index}].key`)
  }
}

function validateRecipes(value: unknown): void {
  for (let [index, entry] of requireArray(value, "recipes").entries()) {
    let path = `recipes[${index}]`
    let recipe = requireRecord(entry, path)
    requireString(recipe.key, `${path}.key`)
    requireArray(recipe.ingredients, `${path}.ingredients`)
    requireArray(recipe.results, `${path}.results`)
    if (recipe.categories !== undefined && !Array.isArray(recipe.categories)) {
      throw new DatasetValidationError(`${path}.categories`, "expected an array")
    }
  }
}

/** Validate untrusted JSON once at the application boundary. */
export function parseCalculatorData(value: unknown): CalculatorData {
  let data = requireRecord(value, "dataset")
  validateKeyedEntries(data.items, "items")
  validateRecipes(data.recipes)
  validateKeyedEntries(data.crafting_machines, "crafting_machines")
  validateKeyedEntries(data.mining_drills, "mining_drills")
  validateKeyedEntries(data.belts, "belts")
  requireArray(data.fuel, "fuel")
  requireArray(data.modules, "modules")
  requireArray(data.resources, "resources")
  requireRecord(data.groups, "groups")
  requireRecord(data.sprites, "sprites")
  return data as unknown as CalculatorData
}

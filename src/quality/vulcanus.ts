import type { FactorySpecification } from "../factory.js"
import type { Rational } from "../math.js"
import type { Item, Recipe } from "../recipes.js"
import type { QualityTargetPlan } from "./contracts.js"
import { planPracticalQualityTarget } from "./practical.js"

const CURATED_PRODUCERS = new Map<string, string>([
  ["steam", "acid-neutralisation"],
  ["water", "steam-condensation"],
  ["heavy-oil", "simple-coal-liquefaction"],
  ["light-oil", "heavy-oil-cracking"],
  ["petroleum-gas", "light-oil-cracking"],
  ["molten-iron", "molten-iron-from-lava"],
  ["molten-copper", "molten-copper-from-lava"],
  ["iron-plate", "casting-iron"],
  ["copper-plate", "casting-copper"],
  ["steel-plate", "casting-steel"],
  ["iron-gear-wheel", "casting-iron-gear-wheel"],
  ["iron-stick", "casting-iron-stick"],
  ["copper-cable", "casting-copper-cable"],
  ["pipe", "casting-pipe"],
  ["pipe-to-ground", "casting-pipe-to-ground"],
  ["low-density-structure", "casting-low-density-structure"],
])

export function planVulcanusQualityTarget(options: {
  readonly specification: FactorySpecification
  readonly item: Item
  readonly recipe: Recipe
  readonly requested: Rational
  readonly qualityLevel: number
}): QualityTargetPlan {
  const vulcanus = options.specification.planets?.get("vulcanus")
  if (vulcanus === undefined) throw new Error("Vulcanus quality planning requires a Space Age dataset with Vulcanus.")
  return planPracticalQualityTarget({
    ...options,
    planet: vulcanus,
    profile: "vulcanus",
    curatedProducers: CURATED_PRODUCERS,
    profileWarnings: [
      "Vulcanus practical mode starts local metals at lava and molten-metal casting instead of importing Normal plates.",
    ],
  })
}

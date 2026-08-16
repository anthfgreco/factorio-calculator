# Advanced Space Age planning

The calculator keeps the exact production solver as its deterministic core and layers Space Age planning concerns around that solution. This avoids replacing the mature simplex implementation while still making location, freshness, logistics, power, pollution, and quality visible and shareable.

## Gleba agriculture and freshness

Plant growth is represented with the exported `growth_ticks` duration rather than as an instantaneous free recipe. Agricultural towers are available for the `agriculture` category and are sized around 47 practical growing plots per tower.

The planning controls provide a shared processing/transport delay. Every item with exported spoil metadata contributes to the remaining-freshness summary. Agricultural science also reports effective throughput after freshness loss.

Tower electricity remains a conservative active-load figure because the official export does not provide planting/harvesting duty timing. Spore totals are calculated separately and exactly from two sources: 15 spores per yumako or jellystem harvest, plus 4 spores per minute for every placed agricultural tower. The fixed tower term uses rounded-up placed towers because it applies even while a tower is waiting for plants to mature.

## Quality targets

A newly selected non-Normal production target enters automatic planet-aware quality planning. The normal target row exposes only output, quality, and rate. Planet availability and the shared **Settings → Quality factory** profile supply the remaining intent.

The practical planner recursively expands the active planet's usable recipes until it reaches local resources, qualityless fluids, or explicit imports. On Nauvis, quality-qualified intermediates such as copper cable, plastic, and electronic circuits remain inside the exact graph instead of returning to the scalar solver as Normal feed. Eligible crafts below the requested tier receive the selected quality module profile; requested-tier crafts use the selected Quality factory productivity module and quality.

Vulcanus uses the same graph with a curated policy. It treats lava, calcite, coal, tungsten ore, and explicit imports as the external boundary instead of pretending Normal iron or copper plates appear for free. Curated metal routes prefer lava → molten iron/copper → foundry casting. The first solid-output stage and every recycler receive the selected quality module profile. Once solid ingredients match each locally required quality, guaranteed-quality crafting uses the selected productivity profile. Electronics prefer the electromagnetic plant unless the player explicitly overrides the machine.

The practical graph is lazy and target-driven. Solid commodities are identified by `(item, quality)`, fluids are shared qualityless commodities, solid-to-fluid recipes erase quality, and a recipe with only fluid ingredients begins solid output rolls at Normal. Lower target qualities pass through their real generated recycler recipes. Surplus byproducts are recursively recycled where a valid route exists; irreducible outputs remain visible instead of disappearing through a free sink. Inputs unavailable from the active planet are listed as imports.

The quality calculation is an exact absorbing linear flow composed inside the existing simplex. Each craft and recycler operation uses exact `Rational` transition coefficients; expected steady-state rates require neither floating-point iteration nor Monte Carlo simulation. The result leads with local feed, imports, machine stages, module loadouts, recycling, power, and routing. For mined solids that recycle directly into themselves at 25%, Legendary plans also show expected Legendary/min per miner and the comparison score `output/s × (mining quality + recycler quality / 3)`; the general solver remains authoritative for ingredient-return shuffles such as LDS and concrete. First-pass probability, tier rates, and full operation detail remain behind the **Quality math and full operation rates** disclosure. A quality-only calculation omits the ordinary scalar Factory table and header; mixed Normal and quality targets retain it for the Normal portion.

The global Advanced priority is a route tiebreaker after meeting the target and preferring local resources. **Practical** is the default. It does not silently search every community-discovered chest, belt, underground-belt, or productivity-research upcycling loop. The current curated profile favors direct foundry casting routes and predictable generated recycler behavior.

Machines, modules, and beacons retain their existing quality controls. Machine quality changes crafting speed, module quality scales beneficial effects while preserving penalties, mining-drill quality reduces resource drain without increasing yield, and beacon quality changes distribution effectivity and beacon power. Speed modules transmitted by beacons also apply their negative quality effect. Quality-factory stages use separate quality and productivity module selections; either selector can use its best-compatible automatic option.

Every quality result is an expected long-run rate. A plan requesting one Legendary item per hour may produce nothing for several hours and then several close together. Monte Carlo simulation would answer time-to-first-item or buffer reliability; it is intentionally separate from deterministic throughput.

Legacy one-pass links retain their direct reciprocal-probability behavior. Separate automatic quality targets do not yet share higher-quality intermediate pools.

## Locations and transport

When multiple planets or platforms are selected, active recipe rows can be pinned to a compatible location. Unpinned recipes are assigned deterministically to the first compatible selected location. Material links that cross assignments are reported as explicit transport flows, and summaries are grouped by location.

Transport is currently an accounting layer rather than a routing optimizer. Rocket payload, travel time, and vehicle/network capacities do not constrain recipe selection inside the simplex.

## Rocket launches

Space Age rocket silos require 50 rocket parts and can build a buffered second rocket while the current rocket prepares and launches. The calculator therefore uses the slower of rocket-part crafting and the selected silo quality's launch cycle instead of adding those durations serially.

Factory summaries report launches per selected time interval. Rocket-part rows are marked when the launch animation is the bottleneck, and explain that more speed no longer improves steady-state throughput while productivity can still reduce the crafts required per launch.

## Resource capacity

Basic-fluid mining uses the selected pumpjack/resource yield. Crude oil, sulfuric-acid geysers, fluorine vents, and lithium brine can be configured independently.

Asteroid chunk availability can be capped by type. The resulting plan reports any required chunk rate above the configured collection capacity. This preserves the solved factory for diagnosis instead of silently treating chunks as unlimited.

## Power, pollution, spores, and Aquilo heat

Factory electricity includes production machines and configured beacon equivalents.

Pollution uses exported emissions per minute and scales with both energy-consumption and direct pollution module effects. Emissions are surface-aware: normal pollution is counted on Nauvis, spores are counted on Gleba, and surfaces with no pollutant do not receive misleading totals. Harvest spores are added as process emissions rather than machine emissions.

Aquilo heat estimates cover production machines and configured beacons according to entity heat classes. Layout-dependent belts, pipes, inserters, pumps, tanks, and other entities remain outside the production graph and must be added separately.

## Logistics

Solid-item rows report belt equivalents, inventory-stack flow, buffer slots, and cargo-wagon loads. Belt research sets the maximum stack height. Auto applies that height only to guaranteed direct stacked output, such as a selected big mining drill; mixed or ambiguous production stays at ×1. Use the selector beside any Factory-row belt count for stack-inserter, recycler, or other item-specific layouts.

## Technology progression

Progression presets set mining productivity, belt and stacking research, the quality ceiling, and automatic machine preferences. They preserve the selected location and do not upgrade target or equipment quality. **Full Legendary** starts from the **Late Space Age** progression baseline, then upgrades all targets and equipment to Legendary while preserving the selected location. Exact technology gating is not exposed because the bundled datasets do not contain the prerequisite metadata needed to enforce it honestly.

## Performance

Quality graphs discard exact duplicate operation rows, including their equipment and reporting configuration in the equivalence key. Automatic quality plans lazily load a sparse WASM LP search; the candidate basis is reconstructed from the original exact coefficients and must pass exact feasibility and optimality checks before it is used. Rejected candidates fall back to the exact Rational simplex. Certified unit-rate solutions are cached in a bounded cache for repeated rate changes. `pnpm bench:quality` measures the two representative recursive quality plans without imposing a machine-sensitive unit-test threshold.

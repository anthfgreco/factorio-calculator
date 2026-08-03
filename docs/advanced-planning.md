# Advanced Space Age planning

The calculator keeps the exact production solver as its deterministic core and layers Space Age planning concerns around that solution. This avoids replacing the mature simplex implementation while still making location, freshness, logistics, power, pollution, and quality visible and shareable.

## Gleba agriculture and freshness

Plant growth is represented with the exported `growth_ticks` duration rather than as an instantaneous free recipe. Agricultural towers are available for the `agriculture` category and are sized around 47 practical growing plots per tower.

The planning controls provide a shared processing/transport delay. Every item with exported spoil metadata contributes to the remaining-freshness summary. Agricultural science also reports effective throughput after freshness loss.

Tower electrical load and spores are conservative active-load figures. The official export does not currently provide planting/harvesting duty timing, so the calculator does not claim an exact average tower duty cycle.

## Quality targets

A production target can select an exact quality tier. The calculator applies Factorio's direct quality probability chain to the configured machine quality modules and scales the production chain to the expected throughput required for that tier. It reports the exact-tier yield and output at every other quality tier as one combined byproduct value.

This is an expected-value direct-production model. It does not yet optimize arbitrary recycler/upcycling loops or represent every intermediate item as a separately balanced `(item, quality)` solver node.

## Locations and transport

When multiple planets or platforms are selected, active recipe rows can be pinned to a compatible location. Unpinned recipes are assigned deterministically to the first compatible selected location. Material links that cross assignments are reported as explicit transport flows, and summaries are grouped by location.

Transport is currently an accounting layer rather than a routing optimizer. Rocket cadence, travel time, and vehicle/network capacities do not constrain recipe selection inside the simplex.

## Resource capacity

Basic-fluid mining uses the selected pumpjack/resource yield. Crude oil, sulfuric-acid geysers, fluorine vents, and lithium brine can be configured independently.

Asteroid chunk availability can be capped by type. The resulting plan reports any required chunk rate above the configured collection capacity. This preserves the solved factory for diagnosis instead of silently treating chunks as unlimited.

## Power, pollution, spores, and Aquilo heat

Factory electricity includes production machines and configured beacon equivalents.

Pollution uses exported emissions per minute and scales with both energy-consumption and direct pollution module effects. Gleba spores are reported through the same pollutant mechanism.

Aquilo heat estimates cover production machines and configured beacons according to entity heat classes. Layout-dependent belts, pipes, inserters, pumps, tanks, and other entities remain outside the production graph and must be added separately.

## Logistics

Solid-item rows report belt equivalents using the selected belt-stack height, stacks per interval, buffer slots for the selected duration, and cargo-wagon loads.

## Technology progression

Progression presets set the quality ceiling and belt-stack research level. Exact technology gating is not exposed because the bundled datasets do not contain the prerequisite metadata needed to enforce it honestly.

## Performance

No Web Worker, graph cache, or table virtualization was added in this release. Existing large-chain tests remain fast, and the user explicitly reported acceptable performance. These optimizations should be introduced only after a repeatable browser benchmark demonstrates a bottleneck.

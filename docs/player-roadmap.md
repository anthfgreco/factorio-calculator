# Player-Focused Improvement Roadmap

## Review summary

The calculator's strongest foundations are worth preserving:

- exact rational arithmetic rather than floating-point approximations
- a proven recipe-graph and simplex solver for multi-output systems
- compact, shareable URL state
- no heavy UI framework or server dependency
- generated datasets backed by Factorio prototype exports
- cohesive modules with executable architecture and runtime checks

The highest-value remaining work is not a framework rewrite. It is extending the production model where Space Age and quality introduce dimensions that a single shared item graph cannot represent.

## Completed in this pass

- Added typed failures for missing production paths and infeasible recipe systems, with actionable Factory-tab guidance.
- Enforced recipe, machine, and beacon allowed effects when selecting modules.
- Preserved exported quality-module probabilities and recipe `allow_quality` rules in the 2.1.12 dataset.
- Added a compact factory summary for active recipes, rounded machine counts, machine electrical power, and imported inputs.
- Added per-recipe production-location visibility for plans using multiple selected locations.
- Added concise notes for shared-material multi-location plans, ambiguous recipe placement, quality-tier aggregation, and imported inputs.
- Added a one-click copyable plan link without changing the existing URL format.
- Added relaxed and compact Factory row density controls as a local display preference and placed them beside the Factory tab.
- Added progression presets, direct item labels, visible target/import state, and a clearer evidence-first Factory and visualization interface.
- Consolidated About, FAQ, and recent changelog information into one Help tab.
- Added runtime coverage for quality modules, machine/beacon compatibility, production locations, and missing-recipe failures.

## Priority 0: calculation fidelity

### Quality-qualified production flows

Represent a material as `(item, quality)` rather than only `item` when quality planning is enabled. Keep the current scalar path as the fast default. A quality-aware layer should:

- calculate output-quality probability distributions
- apply module and machine quality effects
- model recycler returns by input and output quality
- support a target such as “10 legendary quality module 3 per minute”
- expose expected value and the assumptions behind probabilistic results

Do not approximate all quality output as normal items. That produces confident but misleading upcycling plans.

### Per-location factory assignment

Extend solver nodes with a location dimension, then add explicit transport edges. A useful first release can be intentionally simple:

- let players pin recipes or whole item chains to a planet/platform
- treat unpinned compatible recipes as solver choices
- show imports and exports per location
- model rocket-stack throughput and platform cargo as configurable capacities
- make transit spoilage optional and explicit

Keep location assignment out of the DOM renderer; it belongs in the deterministic solver/factory boundary.

### Better infeasibility explanations

The current typed error is a safer UI boundary. The next step is a diagnostic trace that identifies the smallest useful cause:

- target item with no enabled compatible recipe
- recipe disabled by selected location
- selected machine unavailable on every compatible surface
- forced alternate recipe that cannot satisfy the requested output
- cyclic or multi-output component missing an external source/sink

## Priority 1: faster player workflows

### Recipe and machine decision support

For an item with alternatives, show a small comparison before selection:

- raw-resource cost
- machine count
- power
- productivity eligibility
- compatible locations
- important by-products

This would make oil, casting, asteroid crushing, biochamber, and recycling choices easier to reason about.

### Factory summaries by location and section

Once recipe assignment exists, expand the current summary into:

- machines and power per planet/platform
- imports and exports per location
- rocket launches or cargo stacks per minute
- belts/pipes/rails needed for major flows
- grouped production blocks that can be copied as a checklist

## Priority 2: megabase performance

Measure before changing algorithms. Add representative 1k, 10k, and multi-output science plans to a benchmark script, then address the measured bottleneck.

Likely high-value changes are:

- cache recipe graphs and strongly connected components until recipe/location settings change
- move solve work into a Web Worker with cancellation for rapid input edits
- debounce text-driven recalculation while keeping direct controls immediate
- virtualize or progressively render very large result tables
- avoid rebuilding breakdown DOM and full graph layouts when only formatting changes

Preserve exact arithmetic; only introduce an approximate mode as an explicit opt-in with visible error bounds.

## Validation expectations

Each calculation feature should include a small deterministic fixture and at least one real 2.1/Space Age runtime case. Keep the existing full-dataset loader, architecture check, strict core typecheck, and release build gate.

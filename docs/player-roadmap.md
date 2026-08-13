# Player-Focused Improvement Roadmap

## Review summary

The calculator's strongest foundations are worth preserving:

- exact rational arithmetic rather than floating-point approximations
- a proven recipe-graph and simplex solver for multi-output systems
- compact, shareable URL state
- no server dependency; keep the React shell thin and the solver framework-independent
- generated datasets backed by Factorio prototype exports
- cohesive modules with executable architecture and runtime checks

The highest-value remaining work is not a framework rewrite. It is extending the production model where Space Age and quality introduce dimensions that a single shared item graph cannot represent.

## Completed in this pass

- Added real plant growth durations and agricultural-tower sizing around 47 practical plots, including seed flows.
- Added spoil-time metadata, configurable elapsed delay, remaining freshness, and freshness-adjusted agricultural science throughput.
- Replaced routine quality-method controls with automatic planet-aware targets, a shared quality-gear profile, and a practical Vulcanus network from lava/calcite through quality casting, electromagnetic production, real recycling, imports, machinery, power, and collapsed exact diagnostics.
- Added explicit recipe location pinning, deterministic automatic assignment, cross-location transport flows, and location-aware accounting.
- Added configurable pumpjack/resource yield for basic fluids and asteroid collection capacity diagnostics.
- Included configured beacon-equivalent electricity, surface-aware pollution, exact harvest-plus-tower spores, and Aquilo production heat.
- Corrected Space Age rocket throughput for 50-part buffered rockets, exposed launches per interval, and marked launch-limited silos.
- Added belt stacking, stacks per interval, configurable buffers, and cargo-wagon loads.
- Added recipe and machine comparison details directly to selectors.
- Preserved existing performance architecture because the 500-step exact solve and current UI remain responsive; worker/caching/virtualization work remains benchmark-driven.
- Retained all earlier correctness, usability, persistence, dataset, and regression improvements.

## Remaining priority 0 work

### Shared multi-target quality and disposal optimization

Recursive selected-planet quality graphs, the curated Vulcanus profile, and real recycler disposal are implemented. The next useful extension is one combined network for multiple quality targets, shared higher-quality intermediates, broader route search, upstream per-tier equipment optimization, and disposal outputs that can re-enter the primary solve instead of being handled in a counted post-pass.

### Capacity-aware interplanetary optimization

Location assignment and transport accounting are explicit, but transport capacity is not yet part of the simplex. A future extension can constrain rocket payload, platform cargo throughput, route time, and transit spoilage while allowing the solver to choose among alternative production locations.

### Agricultural duty-cycle fidelity

Tower area sizing, growth, and spores are modeled. Exact average tower electricity still requires planting/harvesting operation timing rather than the current conservative active-load assumption.

## Remaining priority 1 work

- Full lightning, heating-tower, fusion, and arbitrary nuclear-layout power planning.
- Layout-aware Aquilo heating for belts, pipes, inserters, pumps, and tanks.
- Inserter, pump, train-frequency, and platform-belt capacity analysis.
- Rich side-by-side recipe comparison including complete raw-resource cost and byproduct deltas.
- Regeneration of all bundled datasets with recipe unlock and item cargo metadata.

## Performance policy

Measure before changing algorithms. `pnpm bench` now reports repeatable 500- and 1,000-step exact-chain medians, while the regression suite protects correctness. No Web Worker, graph cache, or virtualization was added; introduce those only after representative large multi-output browser benchmarks identify a real bottleneck.

## Validation expectations

Each calculation feature should include a small deterministic fixture and at least one real 2.1/Space Age runtime case. Keep the existing full-dataset loader, architecture check, strict core typecheck, and release build gate.

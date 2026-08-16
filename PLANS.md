# Current Plan

## Live visual-parity pass

- Match the deployed calculator's player-facing Factory, Settings, and Help views while keeping current calculator behavior intact.
- Restore the sprite-backed item, recipe, machine, module, beacon, fuel, belt, quality, and research icon treatments.
- Preserve the deployed Settings hierarchy, recipe browser density, Factory row pairing, and compact item breakdowns.
- Keep machine, module, beacon, equipment-quality, and multi-planet location changes inline in each Factory row; do not add a second expanded equipment editor.
- Keep the production-target chooser searchable and sprite-first, and retain access to every inline Factory control through horizontal scrolling on narrow screens.
- Keep Help focused entirely on calculator and Factorio workflows; implementation details do not belong in player-facing copy.
- Compare desktop and mobile views against the deployed site with Playwright, then run the UI, core, end-to-end, and release checks.

## Completed architecture cutover

- One authored runtime source file: `src/main.tsx`.
- One repository instruction file: `AGENTS.md`.
- React owns every application DOM and SVG node.
- Production targets and result summaries are plain, DOM-free models.
- `FactorySpecification` is authoritative; every `BuildTarget` is bound to its owner.
- `CalculatorSnapshot` exposes the actual specification and totals rather than duplicate view models.
- Component layout uses inline React styles; themes use React-applied CSS variables.
- `BASE_CSS` contains only resets, pseudo states, density variables, and responsive media queries.
- D3, Tippy, Dagre, Graphlib, and the vendored Sankey implementation are removed.
- HiGHS is the only deferred engine.
- Architecture checks reject new runtime modules, source stylesheets, imperative rendering, and nested agent instructions.

## Current product priorities

1. Shared multi-target quality and disposal optimization.
2. Capacity-aware interplanetary transport optimization.
3. More accurate agricultural duty-cycle electricity.
4. Layout-aware Aquilo heating and logistics capacity.
5. Richer recipe comparison backed by exact resource deltas.

## Performance policy

Profile before changing algorithms. Preserve exact arithmetic unless a measured boundary justifies approximation. Add caching, workers, memoization, or virtualization only for a demonstrated bottleneck and document any real ceiling with a `ponytail:` comment.

## Delivery rule

A feature is complete when the smallest public regression test passes, strict TypeScript remains clean, URL compatibility is preserved where applicable, architecture/build budgets pass, and the final report states validation limitations honestly.

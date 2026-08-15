# Change Guide

All runtime changes go in `src/main.tsx`. Search for the matching `// region …` marker or public symbol; do not create a new source file. The old module names below are region names, not paths.

## Change a Factorio mechanic or dataset field

1. Search `factorio-wiki.md` for the exact edition and mechanic.
2. Update the `data.ts`, models, recipes, planning, or quality region that owns the behavior.
3. When prototype data or sprite coordinates change, update `scripts/build_factorio_dataset.py` and regenerate every affected dataset/report/asset together.
4. Add the smallest named exact scenario under `tests/scenarios/`.
5. Run `pnpm check:quick`, the focused scenario, `pnpm test:core`, `pnpm validate:runtime`, and `pnpm verify`.

## Add or change a React-owned control

1. Identify the state owner first.
2. Add a typed snapshot field or command in the `application/contracts.ts` region only when the existing contract does not cover it.
3. Delegate through `BrowserCalculatorStore`; keep game policy in its owning domain region.
4. Add the control in the relevant `react/*` region without placing React children inside an imperative-owned mount point.
5. Include accessible labeling, keyboard behavior, persistence when applicable, and focused store/UI coverage.

## Change an imperative renderer

1. Find the exact mount point and renderer region (`settings.ts`, `results.ts`, `ui.ts`, `presentation.ts`, or `visualization.ts`).
2. Reuse an existing view model, formatter, and D3 update pattern before adding code.
3. Preserve stable keys and incremental updates; avoid full table/graph rebuilds.
4. Do not mutate React-owned controls or make DOM properties authoritative state.
5. Add a public behavior test; use Playwright only for interaction or layout that cannot be covered below the browser.

## Change solver behavior

1. Reduce the failure to the smallest item/recipe graph and add the exact failing scenario first.
2. Determine whether the bug belongs to runtime-to-solver adaptation in the `factory.ts` region or the pure `solver.ts` region.
3. Preserve exact arithmetic, productivity eligibility, catalysts, probabilities, cycles, priorities, fuel edges, and output/surplus behavior.
4. Run `pnpm test:core`, `pnpm bench:check`, `pnpm validate:runtime`, and `pnpm verify`.

## Change URL persistence

1. Keep pure encoding/decoding in the `url/codec.ts` region and browser history in `url/history.ts`.
2. Preserve existing parameters, empty module slots, deterministic set ordering, compression heuristics, and old uncompressed links.
3. Add round-trip, malformed-input, deterministic-order, and backwards-compatibility tests.
4. Verify browser reload behavior with `pnpm test:e2e` for player-facing changes.

## Decide between `updateSolution()` and `display()`

Use `updateSolution()` when a change can alter recipe rates, selected recipes, ingredients, outputs, target transformations, or the solved graph.

Use `display()` when solution ratios remain valid and only presentation or derived building counts change.

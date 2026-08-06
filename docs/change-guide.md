# Change Guide

## Add or change calculator behavior

1. Add the smallest behavioral characterization or named scenario.
2. Put exact equations in `math.ts` / `solver.ts`; planning reports in `planning.ts`; recipe policy in `recipes.ts`; machine/location policy in `factory.ts` or `models.ts`.
3. Expose state to React through a snapshot field and typed value command rather than DOM reads or event forwarding.
4. Keep dynamic target/result/settings/graph rendering in the current imperative owner unless a separate migration has tests and measurable value.
5. Run the focused test, `pnpm check:quick`, and the relevant validation lane.

## Add a new dataset field

1. Update contracts and runtime narrowing in `src/data.ts`.
2. Update `scripts/build_factorio_dataset.py` when the field comes from Factorio prototypes.
3. Consume the validated field in the narrowest runtime or deterministic owner.
4. Add parser rejection/default tests and a named mechanic scenario if behavior changes.
5. Regenerate outputs and run `pnpm validate:runtime` plus `pnpm verify`.

## Fix a Factorio-version or recipe issue

1. Search `factorio-wiki.md` and inspect the official prototype export represented by the generator.
2. Change generator/schema logic rather than hand-editing generated JSON.
3. Regenerate dataset and paired sprite assets.
4. Review semantic changes separately from sprite-coordinate churn.
5. Add an exact scenario and run `pnpm test:core`, `pnpm validate:runtime`, and `pnpm verify`.

## Add a React-owned control

1. Determine the state owner and add a typed command/snapshot field in `src/application/contracts.ts` when needed.
2. Implement command delegation in `src/application/store.ts`; keep game policy in its owning module.
3. Add the control to the stable shell without replacing imperative-owned mount points.
4. Use controlled state only when the snapshot owns the value. Leave imperative-owned fields uncontrolled.
5. Add accessible labeling, keyboard behavior, URL persistence, and focused store/UI coverage.
6. Run `pnpm check:quick`, `pnpm test:ui`, and `pnpm test:e2e`.

## Change an imperative renderer

1. Identify the exact mount point and data/view-model source.
2. Extract pure grouping, formatting, or summary policy before growing the renderer.
3. Preserve D3 keys and update behavior; avoid complete table rebuilds.
4. Do not mutate React-owned controls or duplicate application state in DOM properties.
5. Add a pure test where possible and browser coverage only for interaction/layout behavior.

## Change solver behavior

1. Minimize the graph and add an exact failing scenario.
2. Determine whether the fault is runtime-to-solver adaptation (`factory.ts`) or the pure solver.
3. Preserve exact arithmetic, productivity eligibility, catalysts, probabilities, cycles, priorities, fuel edges, and output/surplus behavior.
4. Run `pnpm test:core`, `pnpm bench:check`, `pnpm validate:runtime`, and `pnpm verify`.

## Change URL persistence

1. Keep pure encoding/decoding in `src/url/codec.ts` and browser history in `src/url/history.ts`.
2. Preserve old parameters and semantics unless migration is explicitly approved.
3. Add round-trip, malformed-input, deterministic-order, compression, and old-link tests.
4. Verify the browser reload workflow with `pnpm test:e2e`.

## Decide between `updateSolution()` and `display()`

Use `updateSolution()` when a change can alter recipe rates, selected recipes, ingredients, outputs, target transformations, or the solved graph.

Use `display()` when solution ratios remain valid and only presentation or derived building counts change.

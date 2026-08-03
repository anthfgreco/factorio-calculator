# AI Development Guide

This repository is organized to make automated changes predictable, reviewable, and safe.
Preserve the existing calculator UI unless a task explicitly requests visual changes.

## Before editing

1. Read `docs/architecture.md` and `src/README.md`.
2. Identify the owning module before searching broadly.
3. Reproduce behavior with an existing validation command or add a focused characterization test.
4. Keep generated Factorio data out of hand-written source changes.

## Factorio sources

- Treat `factorio-wiki.md` as one of the project's Factorio sources of truth. It is very long, so search for the relevant page or mechanic instead of reading it from beginning to end.
- Prioritize Space Age mechanics, data, and player workflows when behavior differs between Factorio editions.

## Required commands

```bash
pnpm check:architecture
pnpm typecheck:core
pnpm typecheck
pnpm test
pnpm validate:runtime
pnpm verify
```

Use `pnpm format` before committing. `pnpm verify` is the release gate and builds the GitHub Pages output.

## Module rules

- `src/data.ts`: validated dataset contracts, parser, search normalization, location-display queries, and shared sorting.
- `src/math.ts`: pure exact arithmetic and formatting calculations.
- `src/solver.ts`: pure solver contracts, cycle handling, totals, and simplex orchestration.
- `src/factory.ts`: browser-independent calculator state facade and factory policies.
- `src/models.ts`: runtime dataset models other than items and recipes.
- `src/recipes.ts`: item/recipe runtime models and recipe policy/query logic.
- `src/priorities.ts`: resource-priority model, policy, and its tightly coupled editor.
- `src/state.ts`: small mutable browser/application settings and event actions.
- `src/presentation.ts`: neutral icon, tooltip, and dropdown primitives.
- `src/settings.ts`, `src/results.ts`, and `src/ui.ts`: DOM rendering for settings, result tables, and targets.
- `src/graph.ts` and `src/visualization.ts`: D3/SVG graph implementation and render orchestration.
- `src/url-state.ts`: URL history and calculator-fragment serialization.
- `src/app.ts`: composition root and browser adapters. `src/main.ts` only exposes handlers and starts the app.

`scripts/check-architecture.mjs` enforces the important dependency directions and rejects import cycles.

## Change routing

- Solver/productivity graph bug → `src/solver.ts`; numeric primitive bug → `src/math.ts`
- Recipe probability or fuel-ingredient bug → `src/recipes.ts` (and the dataset builder when export normalization changes)
- Dataset schema/validation/search normalization → `src/data.ts`
- Recipe/item model or recipe policy → `src/recipes.ts`
- Location/building/factory-state policy → `src/factory.ts`
- Other runtime dataset objects → `src/models.ts`
- Resource-priority behavior → `src/priorities.ts`
- Targets, settings, tables, or popups → `src/ui.ts`, `src/settings.ts`, or `src/results.ts`
- Graph/Sankey/boxline rendering → `src/graph.ts` or `src/visualization.ts`
- URL/history persistence → `src/url-state.ts`
- Factorio prototype schema/export → `scripts/build_factorio_dataset.py` and `src/data.ts`

## Invariants

- `data.ts`, `math.ts`, and `solver.ts` must remain framework-independent and runnable in Node.
- `factory.ts` must remain browser-independent; rendering is delegated through `FactoryViewPort`.
- All external JSON enters through `parseCalculatorData()`.
- Do not add new mutable globals. Existing `spec` is a compatibility facade; prefer methods and policies over direct property mutation.
- Keep URL fragments backward-compatible unless the task explicitly permits a migration.
- Preserve every bundled dataset and run `pnpm validate:runtime` after model or solver changes.
- Never manually edit generated sprite coordinates or generated 2.1.12 game values. Fix the exporter and regenerate the bundled output from the official export; keep extractor changes and generated output together.
- Add the smallest high-signal test that would have caught a bug before fixing it.

## Working style for agents

- Prefer cohesive feature modules, usually a few hundred lines, over both one-function files and giant monoliths.
- Split a module only when the extracted concept has an independent responsibility, stable interface, or separate test surface; do not split solely because of line count.
- Use explicit interfaces at deterministic module boundaries.
- Keep compatibility casts localized and documented.
- Avoid broad formatting mixed with functional changes.
- Explain assumptions in code only when the reason is not recoverable from types or names.
- Do not introduce React or another UI framework solely for code organization.

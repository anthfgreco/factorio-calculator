# AI Development Guide

This repository is organized to make automated changes predictable, reviewable, and safe.
Preserve the existing calculator UI unless a task explicitly requests visual changes.

## Before editing

1. Read `docs/architecture.md` and the README for the layer you will change.
2. Identify the owning layer before searching broadly.
3. Reproduce behavior with an existing validation command or add a focused characterization test.
4. Keep generated Factorio data out of hand-written source changes.

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

## Layer rules

- `src/core/`: pure deterministic logic. No DOM, D3, browser globals, application globals, or runtime models.
- `src/application/`: calculator use cases, policies, and state orchestration. It may depend on core and runtime compatibility models, but never UI or visualization modules. `application/bootstrap.ts` is the only composition-root exception.
- `src/runtime/`: browser-facing data models produced from calculator datasets. This is a compatibility layer; new business rules belong in core/application.
- `src/presentation/`: neutral DOM primitives shared by runtime, UI, and visualizations.
- `src/infrastructure/`: browser or external-system adapters with no application/UI imports.
- `src/ui/`: DOM rendering and interaction adapters. Keep calculations out of this layer.
- `src/visualization/`: D3/SVG rendering only.
- `src/shared/`: tiny dependency-free helpers with no feature ownership.

`scripts/check-architecture.mjs` enforces the important dependency directions.

## Change routing

- Solver/math/probability bug → `src/core/`
- Recipe/location/priority policy → `src/application/`
- Dataset object construction → `src/runtime/`
- HTML interaction, table, popup, settings → `src/ui/`
- Graph/Sankey/boxline rendering → `src/visualization/`
- URL/history/browser integration → `src/infrastructure/` or `src/ui/persistence/`
- Factorio prototype schema/export → `scripts/build_factorio_dataset.py` and `src/core/data/`

## Invariants

- The solver must remain framework-independent and runnable in Node.
- All external JSON enters through `parseCalculatorData()`.
- Do not import UI modules into core or application code.
- Do not add new mutable globals. Existing `spec` is a compatibility facade; prefer methods/policies over direct property mutation.
- Keep URL fragments backward-compatible unless the task explicitly permits a migration.
- Preserve every bundled dataset and run `pnpm validate:runtime` after model or solver changes.
- Never manually edit generated sprite coordinates or generated 2.1.12 recipe values. Regenerate them from the official export.
- Add the smallest high-signal test that would have caught a bug before fixing it.

## Working style for agents

- Prefer small named modules over adding another section to a file above roughly 400 lines.
- Use explicit interfaces at layer boundaries.
- Keep compatibility casts localized and documented.
- Avoid broad formatting mixed with functional changes.
- Explain assumptions in code only when the reason is not recoverable from types or names.
- Do not introduce React or another UI framework solely for code organization; the architecture already separates UI from the core.

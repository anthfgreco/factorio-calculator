# Factorio Calculator Agent Guide

Use this file as the default operating contract for repository changes. More specific `AGENTS.md` files override it inside their directories.

## Start here

Before editing:

1. Read `docs/architecture.md` and the closest relevant section of `docs/change-guide.md`.
2. Locate the owning module from the map below; avoid repository-wide searching when a focused symbol search is enough.
3. Reproduce the behavior with an existing check or add the smallest characterization test that would catch the regression.
4. For work spanning multiple responsibilities, write and maintain an execution plan using `PLANS.md`.

For every task, establish four facts before coding: the goal, the relevant files or evidence, hard constraints, and the observable “done when” conditions. Make reasonable assumptions explicit in the final summary.

## Commands

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check:architecture
corepack pnpm typecheck:core
corepack pnpm typecheck
corepack pnpm test
corepack pnpm validate:runtime
corepack pnpm verify
```

Use `corepack pnpm format` before final verification. `corepack pnpm verify` is the release gate and builds the GitHub Pages output.

When a command fails, fix the cause rather than weakening the check. Report commands that could not run and why.

## Architecture map

### React shell

- `src/main.tsx`: React 19 root only.
- `src/react/CalculatorApp.tsx`: one-way bridge from React to the existing calculator runtime.
- `src/react/CalculatorShell.tsx`: page shell, tabs, toolbar, and stable mount points.
- `src/react/SettingsPanel.tsx`: static settings structure and typed event forwarding.
- `src/react/HelpPanel.tsx`: static help and changelog content.
- `src/react/types.ts`: React-shell action contracts and native-event adapter.

React owns static page structure and event wiring. Existing imperative renderers own the children of their documented mount points. Do not let React rerender or control values that the calculator runtime mutates directly; use uncontrolled inputs (`defaultValue` / `defaultChecked`) at this boundary.

### Deterministic core

- `src/data.ts`: validated external-data contracts, parsing, search normalization, and shared sorting.
- `src/math.ts`: exact arithmetic and numeric formatting.
- `src/solver.ts`: pure solving, cycle handling, productivity, totals, and typed failures.
- `src/factory.ts`: browser-independent calculator facade, factory policy, and `FactoryViewPort` boundary.
- `src/planning.ts`: pure post-solve planning calculations.

These modules must remain independent of React, the DOM, D3, storage, and browser globals.

### Runtime and browser rendering

- `src/models.ts`: buildings, modules, belts, fuels, planets, and item groups.
- `src/recipes.ts`: item/recipe runtime models and recipe policy.
- `src/priorities.ts`: resource-priority model and its tightly coupled editor.
- `src/state.ts`: small mutable application settings and user actions.
- `src/presentation.ts`: icons, tooltips, popovers, and dropdown primitives.
- `src/settings.ts`, `src/results.ts`, `src/ui.ts`: imperative rendering into React-provided mount points.
- `src/graph.ts`, `src/visualization.ts`: D3/SVG graph implementation and orchestration.
- `src/url-state.ts`: URL history and fragment serialization.
- `src/app.ts`: runtime composition, dataset bootstrap, and browser adapter.

`scripts/check-architecture.mjs` enforces dependency directions and import-cycle freedom. Update the checker with every intentional module addition or dependency change.

## Change routing

- Solver/productivity graph bug → `src/solver.ts`; numeric primitive → `src/math.ts`.
- Dataset schema/validation/search → `src/data.ts`.
- Recipe probability, fuel ingredient, or recipe policy → `src/recipes.ts` and, when generated data changes, `scripts/build_factorio_dataset.py`.
- Location/building/factory-state policy → `src/factory.ts` or `src/planning.ts`.
- React-owned shell/control structure → `src/react/`.
- Dynamic targets, settings options, result rows, or popovers → existing imperative renderer in `src/ui.ts`, `src/settings.ts`, `src/results.ts`, or `src/presentation.ts`.
- Graph/Sankey/boxline → `src/graph.ts` or `src/visualization.ts`.
- URL/history persistence → `src/url-state.ts`.

## Factorio sources

- Treat `factorio-wiki.md` as a project source of truth. Search the relevant mechanic; do not read the entire file by default.
- Prefer Space Age behavior when editions differ.
- Never manually patch generated sprite coordinates or generated 2.1.12 prototype values. Fix the exporter and regenerate the data; keep generator and output changes together.

## Invariants

- All external JSON enters through `parseCalculatorData()`.
- Preserve exact `Rational` arithmetic in solver paths.
- Preserve bundled datasets and run `corepack pnpm validate:runtime` after model, parser, recipe, or solver changes.
- Preserve URL fragments unless a task explicitly approves a migration.
- Do not add mutable globals. `window.spec` is a compatibility surface, not a pattern to extend.
- Keep the default totals view on the critical path; graph/layout modules stay dynamically loaded.
- Keep item/recipe/resource selectors deferred until first use.
- Keep player-facing copy about game behavior, not implementation details.

## Working method

- Make the smallest cohesive change that fully solves the task.
- Prefer direct imports; do not add barrel files.
- Add explicit interfaces at module boundaries.
- Keep compatibility casts localized and explain only non-obvious reasons.
- Avoid broad formatting mixed with behavior changes.
- Add a focused test before or with the fix.
- After implementation, review the diff for accidental scope growth, stale comments, missing URL persistence, accessibility regressions, and startup regressions.

## Done means

A change is complete when the requested behavior is present, relevant tests cover it, architecture/type/runtime checks pass, generated outputs are consistent, and the final response lists changed behavior plus the exact validation performed.

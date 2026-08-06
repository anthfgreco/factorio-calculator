# Factorio Calculator Agent Guide

Use this file as the default operating contract for repository changes. A closer `AGENTS.md` overrides this guide for files below its directory.

## Start here

Before editing:

1. Read `docs/architecture.md`, `docs/testing.md`, and the relevant section of `docs/change-guide.md`.
2. Read the closest nested `AGENTS.md` for the files you will change.
3. Locate the owning module before searching broadly. Prefer symbol searches over loading large files wholesale.
4. Reproduce the behavior with an existing check or add the smallest behavioral test that would catch the regression.
5. For multi-module or persisted-state changes, maintain the active execution plan in `PLANS.md`.

For every task, establish the goal, relevant evidence, hard constraints, and observable completion criteria before coding. Preserve unrelated working-tree changes.

## Validation lanes

Use the smallest meaningful lane while iterating, then the release gate before delivery.

```text
check:quick  ~5 seconds   architecture, type-debt, and full strict TypeScript
test:core    ~3 seconds   exact solver, scenarios, and deterministic behavior
test:e2e    ~20 seconds   critical Chromium workflows
verify        release gate
```

Commands:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run doctor
corepack pnpm check:quick
corepack pnpm test:core
corepack pnpm test:ui
corepack pnpm test:e2e
corepack pnpm bench:check
corepack pnpm validate:runtime
corepack pnpm verify
```

`verify` is authoritative. It validates the environment, architecture, strict types, core/UI behavior, solver performance, the production build, runtime datasets, and build budgets. Run `corepack pnpm format` before final verification. Never weaken a check to make a change pass. Report any command that the environment prevented from running.

## Architecture map

### React shell

- `src/main.tsx`: React 19 root only.
- `src/react/CalculatorApp.tsx`: starts/disposes the runtime and subscribes to the application store.
- `src/react/useCalculatorStore.ts`: `useSyncExternalStore` adapter.
- `src/react/CalculatorShell.tsx`: page shell, tabs, toolbar, controlled shell state, and stable mount points.
- `src/react/SettingsPanel.tsx`: React-owned settings structure and value commands.
- `src/react/HelpPanel.tsx`: static help and changelog content.

React reads `CalculatorSnapshot` and invokes `CalculatorCommands`. It does not import calculator policy directly. Imperative renderers own the children of their documented mount points; React must preserve those containers across rerenders.

### Typed application boundary

- `src/application/contracts.ts`: snapshot, command, tab, preset, and browser-port contracts.
- `src/application/store.ts`: authoritative external-store adapter over `FactorySpecification` and value-based state commands.
- `src/state.ts`: browser action implementations and legacy event adapters for controls not yet migrated.
- `src/url/codec.ts`: pure URL-fragment encoding and decoding.
- `src/url/history.ts`: injected browser-history controller.
- `src/url-state.ts`: compatibility facade and runtime serialization orchestration.

Do not add a second application-state source. DOM values are not authoritative state. New React controls call value commands, not generic `Event` forwarding.

### Deterministic calculation and planning

- `src/data.ts`: validated external-data contracts, parsing, search normalization, and shared sorting.
- `src/math.ts`: exact rational arithmetic, matrices, simplex primitives, and numeric formatting.
- `src/solver/contracts.ts`: solver-only structural contracts.
- `src/solver/errors.ts`: typed solver failure.
- `src/solver.ts`: cycle handling, productivity, totals, and exact solving.
- `src/planning/contracts.ts`: planning inputs and report contracts.
- `src/planning.ts`: pure quality, location, transport, freshness, capacity, pollution, rocket, heat, and logistics calculations.
- `src/factory.ts`: browser-independent calculator facade and runtime-to-solver adapter.

These modules must remain independent of React, the DOM, D3, storage, and browser globals. Preserve exact `Rational` values until presentation.

### Runtime domain and renderers

- `src/models.ts` plus `src/models/`: buildings, modules, belts, fuels, planets, item groups, and research data factories.
- `src/recipes.ts`: item/recipe runtime models and recipe policy.
- `src/priorities.ts`: resource-priority model and editor.
- `src/presentation.ts`: icons, tooltips, popovers, and dropdown primitives.
- `src/settings.ts` plus `src/settings/`: dynamic settings rendering and focused setting policy.
- `src/results.ts` plus `src/results/`: high-volume result rendering, grouping, and pure summary calculations.
- `src/ui.ts`: production-target view implementation.
- `src/graph/types.ts`, `src/graph.ts`, `src/visualization.ts`: deferred D3/SVG visualization.
- `src/app.ts`: browser composition, dataset loading, renderer ports, and dynamic visualization import.

`scripts/check-architecture.mjs` enforces the approved dependency map, deterministic-module restrictions, and import-cycle freedom. Add every intentional source module and dependency to the checker.

## Change routing

- Exact arithmetic or simplex behavior → `src/math.ts` / `src/solver.ts`.
- Solver boundary contract → `src/solver/contracts.ts`.
- Planning report or quality/location mechanic → `src/planning.ts`; contract → `src/planning/contracts.ts`.
- Dataset schema/validation/search → `src/data.ts`.
- Recipe probability, fuel ingredient, or recipe policy → `src/recipes.ts` and, for generated data, `scripts/build_factorio_dataset.py`.
- Machine/module/planet runtime model → `src/models.ts` or focused `src/models/` module.
- Factory selection/state policy → `src/factory.ts`.
- Snapshot or command shape → `src/application/contracts.ts`; store adaptation → `src/application/store.ts`.
- React-owned shell/control → `src/react/`.
- Dynamic targets, settings options, result rows, or popovers → `src/ui.ts`, `src/settings.ts`, `src/results.ts`, or `src/presentation.ts`.
- Graph/Sankey/boxline → `src/graph.ts` or `src/visualization.ts`.
- Pure fragment format → `src/url/codec.ts`; browser history → `src/url/history.ts`; runtime persistence → `src/url-state.ts`.

## Factorio sources and generated data

- Treat `factorio-wiki.md` as a project source. Search the relevant mechanic rather than reading the entire file.
- Prefer Space Age behavior when editions differ.
- Never manually patch generated prototype values or sprite coordinates. Fix the exporter/schema and regenerate outputs together.
- Keep each generated sprite hash's PNG and WebP pair together. Remove old assets only after confirming no bundled dataset references them.
- For version bumps, update the builder target, default dataset, preloads/validators, player copy, and previous-key URL migration. Review semantic changes with sprite-coordinate churn filtered out.

## Invariants

- All external JSON enters through `parseCalculatorData()`.
- Full strict TypeScript stays enabled globally. Do not add `any`, suppression comments, unsafe double assertions, or unjustified non-null assertions.
- URL fragments remain backward-compatible unless the task explicitly approves a migration.
- `CalculatorStore` is the application-state subscription and command boundary.
- Do not add mutable globals. `window.spec` is a compatibility surface, not a pattern.
- The totals view is the startup path. Visualization/layout code loads only when visualization is opened.
- Keep large selectors and option lists deferred until first use.
- React never owns children inside imperative renderer mount points.
- Player-facing text describes game behavior, not implementation details.

## Working method

- Make the smallest cohesive change that fully solves the task.
- Prefer direct imports. Compatibility facades may preserve existing imports during a bounded decomposition, but do not create broad barrel APIs.
- Split modules by ownership, not line count.
- Add named contracts at module boundaries and validate untrusted values immediately.
- Avoid broad formatting mixed with behavior changes.
- Add or update behavioral coverage with the change.
- Review the final diff for accidental scope, stale comments, URL persistence, accessibility, startup loading, generated data, and user changes from the starting tree.

# Code Review Rules

## Calculation correctness

- Flag any calculation path that converts exact rational values to floating point before presentation.
- Flag productivity applied to returned catalysts, ignored-by-productivity outputs, coolant returns, containers, or other ineligible outputs.
- Flag incorrect handling of probabilistic products, independent probabilities, or fractional recycling outputs.
- Flag machine speed, energy, productivity, quality, location, or launch behavior that contradicts Factorio 2.1 mechanics.
- Flag generated prototype values edited without the generator or source-data change.
- Flag calculation behavior changes without a focused exact regression test.

## State and compatibility

- Flag URL-format changes without backward-compatibility tests.
- Flag competing sources of truth between the store, `FactorySpecification`, React, and DOM state.
- Flag direct DOM reads used as authoritative calculator state.
- Flag changes that silently discard imported or serialized settings.
- Flag asynchronous dataset changes that can commit stale objects from an older load.

## React and renderer ownership

- Flag React children rendered inside imperative-owned mount points.
- Flag imperative renderers mutating React-owned nodes.
- Flag generic event forwarding where a typed value command should be used.
- Flag React dependencies introduced into deterministic calculation modules.
- Flag conversion of high-volume D3/table rendering into React without behavioral and performance evidence.

## Performance

- Flag visualization dependencies added to the startup path.
- Flag eager construction of large selectors, tooltips, graphs, tables, or datasets.
- Flag repeated whole-dataset scans on interactive paths when an existing index or derived cache applies.
- Flag avoidable cloning of complete graphs or generated datasets.
- Flag performance-sensitive changes without benchmark or bundle-budget validation.

## Type safety

- Flag newly introduced `any`, TypeScript suppression comments, unsafe double assertions, or unjustified non-null assertions.
- Flag optional or nullable states represented inaccurately.
- Flag broad public object/callback types where a named contract would expose the invariant.
- Flag unvalidated data crossing JSON, DOM, URL, or solver adaptation boundaries.

## Tests

- Flag tests that assert source strings when behavior can be exercised through a public contract.
- Flag tests coupled to internal component structure rather than user-visible outcomes.
- Flag Factorio mechanic changes without a named scenario test.
- Flag broad snapshots that obscure the actual regression.

## Done means

A change is complete when the requested behavior exists, strict types and relevant tests cover it, architecture/runtime/build budgets pass, generated outputs are consistent, unrelated user changes are preserved, and the final response states exactly what was validated.

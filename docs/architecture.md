# Architecture

## Goal

The project combines a React 19.2.8 application shell with a deterministic Factorio calculation engine and focused imperative renderers. The boundaries are explicit so changes are easy to locate, agents can gather only relevant context, and calculation correctness is not coupled to UI framework behavior.

The architecture favors direct imports, acyclic dependencies, typed ports, stable ownership, and executable validation.

## Module map

```text
main.tsx
  └─ react/CalculatorApp.tsx        React/runtime bridge
       ├─ react/CalculatorShell.tsx page shell and mount points
       │    ├─ react/SettingsPanel.tsx
       │    └─ react/HelpPanel.tsx
       ├─ app.ts                    runtime composition and bootstrap
       └─ state.ts                  user actions and UI settings

app.ts
  ├─ data.ts                        validated dataset boundary
  ├─ math.ts                        exact arithmetic
  ├─ solver.ts                      pure factory solving
  ├─ planning.ts                    pure planning calculations
  ├─ models.ts                      runtime dataset models
  ├─ recipes.ts                     item/recipe models and policies
  ├─ priorities.ts                  resource-priority feature
  ├─ factory.ts                     calculator facade and rendering port
  ├─ presentation.ts                DOM primitives
  ├─ settings.ts                    dynamic settings renderer
  ├─ results.ts                     results renderer
  ├─ ui.ts                          dynamic target renderer
  ├─ graph.ts / visualization.ts    deferred visualization runtime
  └─ url-state.ts                   history and fragment persistence
```

`main.tsx` mounts React. `CalculatorApp.tsx` is the only React module that imports the legacy runtime/actions. Lower React components receive the typed `CalculatorActions` interface.

## React and imperative rendering boundary

React owns static structure, accessibility relationships, direct event wiring, and stable containers. Existing renderers own dynamic children inside containers such as `#targets`, `#totals`, `#recipe_toggles`, `#resource_settings`, and `#graph`.

The shell intentionally renders once. Runtime-mutated form fields are uncontrolled with `defaultValue` and `defaultChecked`; converting them to controlled inputs would let React overwrite URL-loaded or preset-loaded values.

New static controls should normally be placed in `src/react/`. Dynamic, high-volume result and graph rendering may remain imperative unless a dedicated migration has characterization tests and measurable value. Business rules never belong in React callbacks.

## Deterministic boundary

### Data

`src/data.ts` owns the normalized `CalculatorData` contract, runtime validation of untrusted JSON, normalized item search, location queries, and shared sorting. Raw JSON remains `unknown` until `parseCalculatorData()` validates it.

### Math, solver, and planning

`src/math.ts` owns exact arithmetic, matrices, simplex primitives, display formatting, and power formatting.

`src/solver.ts` owns solver contracts, cycle detection, fuel-consumer edges, per-product productivity, typed `SolverFailure` diagnostics, totals, and the pure `solve()` operation. It depends only on `math.ts`.

`src/planning.ts` owns pure post-solve and target-transformation calculations for exact quality targets, recipe location assignment, transport flows, freshness, resource capacity, logistics, emissions, rocket launches, and Aquilo heat.

These modules must not access React, the DOM, D3, storage, or browser globals. `data.ts`, `math.ts`, and `solver.ts` receive stricter TypeScript checks through `tsconfig.core.json`.

### Factory

`src/factory.ts` owns the browser-independent `FactorySpecification` facade and closely related building, location, and recipe-selection policy. It converts runtime objects to explicit solver contracts and delegates rendering through `FactoryViewPort`.

## Runtime and policy modules

`src/models.ts` constructs buildings, modules, belts, fuels, planets, and item groups from validated data.

`src/recipes.ts` contains item and recipe runtime models together with recipe classification, search, grouping, and enablement policy.

`src/priorities.ts` contains the priority model, its application policy, and its tightly coupled editor.

`src/state.ts` contains the small mutable application settings and user actions. React calls these operations; it does not duplicate their state.

## Browser modules

`src/presentation.ts` contains generic icons, tooltips, popovers, and dropdowns.

`src/settings.ts`, `src/results.ts`, and `src/ui.ts` populate React-provided mount points. Calculation policy must be called through `factory.ts`, `recipes.ts`, or `priorities.ts`, not implemented in event handlers.

`src/graph.ts` contains Sankey and graph primitives. `src/visualization.ts` contains viewport behavior, box-line rendering, and visualization orchestration.

`src/url-state.ts` owns browser history and the calculator fragment format. Module slots use explicit empty placeholders, set-like values serialize deterministically, and fragments remain backward-compatible unless a deliberate migration is approved.

## Startup boundary

The default totals view is the critical path. Keep graph/layout modules behind the dynamic visualization import, leave closed selectors unrendered until first use, and avoid eager tooltip or dropdown instances. The React shell adds structure and event wiring only; it must not pull deferred runtime modules into startup.

## Import rules

Use direct imports from the owning module. Do not add barrel exports.

`scripts/check-architecture.mjs` recursively checks TypeScript and TSX modules, enforces the approved dependency map, rejects browser dependencies in deterministic modules, and rejects first-party import cycles. Add every new source module and intended dependency to the map.

## Player-model boundaries

The simplex solves a shared scalar item graph. `planning.ts` deterministically assigns active recipes to pinned or compatible locations and derives transport edges from solved material links. This gives accurate accounting for a chosen assignment, but route capacities do not yet participate in recipe optimization.

Quality-module compatibility belongs to `models.ts`. Exact quality targets are transformed into expected total production before solving and reported with combined non-target-quality byproducts afterward. Automatic recycler-loop optimization still requires a future quality-qualified solver graph.

Freshness, asteroid capacity, surface-aware emissions, rocket launch reporting, and Aquilo heat are planning layers over solved rates. Version-specific mechanics belong in validated dataset contracts; keep layout assumptions visible rather than inserting them into exact recipe equations.

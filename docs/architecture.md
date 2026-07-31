# Architecture

## Goal

The project keeps the original calculator behavior while making repository-level changes easy to locate, understand, and validate. The source is consolidated into cohesive feature modules—large enough to preserve local context, but small enough to retain explicit ownership.

The architecture optimizes for deterministic boundaries, direct imports, an acyclic dependency graph, and executable validation. It does not depend on a UI framework.

## Module map

```text
main.ts
  └─ app.ts                    composition root
       ├─ data.ts              dataset boundary and shared pure queries
       ├─ math.ts              exact arithmetic and formatting
       ├─ solver.ts            pure factory solving
       ├─ models.ts            runtime dataset models
       ├─ recipes.ts           item/recipe models and policies
       ├─ priorities.ts        resource-priority feature
       ├─ factory.ts           calculator state facade
       ├─ state.ts             browser/application settings and actions
       ├─ presentation.ts      reusable DOM primitives
       ├─ settings.ts          settings DOM
       ├─ results.ts           results DOM
       ├─ ui.ts                target DOM
       ├─ graph.ts             graph and Sankey implementation
       ├─ visualization.ts     visualization orchestration
       └─ url-state.ts         URL and fragment persistence
```

`app.ts` is the composition root and intentionally connects the browser-facing modules. `main.ts` only loads styles, exposes legacy HTML handlers, and starts the app.

## Deterministic boundary

### Data

`src/data.ts` owns:

- the normalized `CalculatorData` contract
- runtime validation of untrusted JSON
- normalized item search
- location-list and unavailable-location queries
- the small shared sorting helper

Raw JSON remains `unknown` until `parseCalculatorData()` validates it.

### Math and solver

`src/math.ts` owns exact arithmetic, matrices, the simplex primitive, display formatting, and power formatting.

`src/solver.ts` owns solver contracts, cycle detection, totals, and the pure `solve()` operation. It depends only on `math.ts`.

### Factory

`src/factory.ts` owns the browser-independent `FactorySpecification` compatibility facade and closely related building, location, and recipe-selection policy. It converts runtime objects to the explicit solver contracts and delegates rendering through `FactoryViewPort`.

These modules must not access the DOM, D3, storage, or browser globals. `data.ts`, `math.ts`, and `solver.ts` receive stricter TypeScript checks through `tsconfig.core.json`.

## Runtime and policy modules

`src/models.ts` constructs buildings, modules, belts, fuels, planets, and item groups from validated data.

`src/recipes.ts` contains the item/recipe runtime models together with recipe classification, search, grouping, and enable/disable policy. Keeping these together makes recipe changes discoverable without crossing many files.

`src/priorities.ts` contains the priority model, its application policy, and its tightly coupled editor. The editor remains in the same module because it directly manipulates that model and has no independent use.

`src/state.ts` contains the small mutable browser/application settings: active tab, selected dataset, visualizer options, legacy-calculation mode, document title, and HTML event actions.

## Browser modules

`src/presentation.ts` contains generic icons, tooltips, and dropdown primitives.

`src/settings.ts`, `src/results.ts`, and `src/ui.ts` own settings, result tables, and target-row DOM respectively. Calculation policy should be called through `factory.ts`, `recipes.ts`, or `priorities.ts` rather than implemented in event handlers.

`src/graph.ts` contains Sankey and shared graph primitives. `src/visualization.ts` contains viewport behavior, box-line rendering, and visualization selection/orchestration.

`src/url-state.ts` owns both browser history updates and the calculator-specific fragment format. URL fragments remain backward-compatible unless a deliberate migration is approved.

## Import rules

Use direct imports from the module that owns a symbol. Do not add barrel exports.

`scripts/check-architecture.mjs` enforces the approved module dependency map, rejects browser dependencies in deterministic modules, and rejects first-party import cycles.

The module map is deliberately explicit. Update the checker alongside any intentional architectural change.

## Module size and cohesion

The preferred module is usually a few hundred lines and owns one recognizable feature or deterministic boundary. A module may exceed that range when splitting it would separate tightly coupled behavior.

Do not create tiny forwarding files solely to reduce line counts. Split only when the extracted code has an independent responsibility, stable interface, or separate test surface.

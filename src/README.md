# Source Modules

The calculator intentionally uses a small number of cohesive TypeScript modules. Section headers inside each file preserve the origin and responsibility of consolidated code, making symbol search and local reading straightforward.

## Deterministic foundation

- `data.ts`: dataset interfaces, validation, normalized search, location-display queries, and sorting.
- `math.ts`: BigInteger adapter, exact rational arithmetic, matrices, simplex primitive, and number formatting.
- `solver.ts`: solver contracts, cycle detection, fuel edges, per-product productivity, typed failures, totals, and solution construction.
- `factory.ts`: calculator state facade, location/building policy, recipe enable/disable commands, and the rendering port.

These modules are browser-independent. `data.ts`, `math.ts`, and `solver.ts` are checked with the stricter `tsconfig.core.json` configuration.

## Runtime and policies

- `models.ts`: runtime objects for buildings, modules, belts, fuels, planets, and item groups.
- `recipes.ts`: item and recipe objects plus recipe search/grouping and enablement policy.
- `priorities.ts`: the resource-priority data model, serialization policy, and its tightly coupled DOM editor.
- `state.ts`: mutable UI/application settings, dataset selection, visualizer selection, table density, sharing, and event actions.
- `color-schemes.ts`: lightweight theme definitions shared by settings without importing graph rendering.

## Browser interface

- `presentation.ts`: shared icon, tooltip, and dropdown primitives.
- `settings.ts`: settings DOM and recipe browser.
- `results.ts`: factory summary, diagnostics, directly labeled totals table, production locations, recipe selector, and result grouping.
- `ui.ts`: target rows and target-specific interaction.
- `graph.ts`: Sankey implementation and shared graph primitives.
- `visualization.ts`: graph viewport, box-line renderer, and visualization orchestration.
- `url-state.ts`: browser history plus deterministic, slot-safe calculator fragment parsing/formatting.
- `app.ts`: composition root, browser view adapter, and dataset bootstrap.
- `main.ts`: CSS entry, global HTML handlers, and startup.

The initial totals view intentionally excludes graph/layout code and defers closed selector DOM, dropdown positioning, and rich tooltip construction until first use. Preserve that boundary when adding browser features.
- `styles/calc.css`, `styles/dropdown.css`, and `styles/player-ui.css`: legacy component rules, dropdown behavior, and the modern player-facing visual layer.

## Dependency direction

The intended flow is roughly:

```text
data / math → solver
                 ↓
models / priorities / recipes → factory → state
          ↓                    ↓
presentation → UI modules → app → main
          ↓
      graph → visualization
```

Use direct imports from the owning module. Do not add barrel files or one-function forwarding modules.

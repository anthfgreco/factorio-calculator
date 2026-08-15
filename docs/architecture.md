# Architecture

## Monolithic runtime

The calculator has one authored runtime module: `src/main.tsx`. `src/vendor-sankey.js` is the only source-code exception because it is a locally patched third-party implementation.

This layout deliberately removes first-party import traversal. Architectural boundaries still exist as ordered `// region …` sections, named after the former modules:

```text
data and exact math
  ↓
solver and Factorio domain models
  ↓
quality and deterministic planning
  ↓
FactorySpecification, state, and calculatorStore
  ↓
settings, URL compatibility, results, and target UI
  ↓
optional HiGHS / graph layout adapters
  ↓
browser composition, React shell, and mount
```

`scripts/check-architecture.mjs` prevents new runtime source files, nested agent guides, internal dynamic imports, and eager Dagre/HiGHS imports.

## Boundaries inside the file

### Validated data and exact calculation

The `data.ts` region owns external dataset contracts, runtime validation, normalized search, location helpers, and shared sorting. Raw JSON remains `unknown` until `parseCalculatorData()` validates it.

The `math.ts`, `solver/contracts.ts`, `solver/errors.ts`, and `solver.ts` regions own exact `Rational` arithmetic, matrix/simplex primitives, cycle handling, fuel-consumer edges, per-product productivity, totals, and typed failures. These paths stay independent of React and the DOM even though they share a physical file.

### Domain and planning

The models, recipes, priorities, factory, planning, and quality regions own Factorio runtime objects, recipe policy, solver adaptation, quality transitions, selected-planet expansion, recycler disposal, logistics, capacity, pollution, rockets, heat, and optional certified HiGHS optimization.

HiGHS proposes a candidate basis only. The original rational coefficients certify primal feasibility, dual feasibility, reduced costs, and objective before accepting it; invalid candidates fall back to the exact solver.

### One application-state boundary

`FactorySpecification` remains the calculation authority. `BrowserCalculatorStore` adapts it into stable immutable `CalculatorSnapshot` values and typed `CalculatorCommands`. DOM values and React local state are not competing calculator state.

The URL codec/history regions preserve deterministic fragments, legacy links, slot placeholders, compression behavior, and safe malformed-input handling.

### Renderer ownership

React owns the stable page shell and creates imperative mount-point containers. Settings, targets, results, tooltips, and graph renderers own the children inside those containers. Neither side mutates the other's owned children.

High-volume result and D3/SVG rendering remains imperative. Stable keys and incremental updates avoid rebuilding large tables or graphs on every state change.

### Startup and optional engines

`calc.html` loads only `src/main.tsx`. The calculator CSS is embedded in that file. Dagre and HiGHS remain behind dynamic imports and are omitted from the initial dependency closure; opening Visualize or invoking the quality optimizer loads them on demand.

## Generated data and assets

`scripts/build_factorio_dataset.py` is the source for generated prototype data and sprite coordinates. Runtime JSON lives under `public/data`; sprites live under `public/images`. Generated values are never hand-edited, and every referenced sprite hash retains both PNG and WebP copies.

## Why regions instead of modules

This repository optimizes for agentic changes: one search target, one public export surface, no barrel graph, no duplicated local types, and no ambiguity about which source file should change. Region markers retain ownership and navigation while avoiding the context and coordination overhead of many tiny files.

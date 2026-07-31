# Architecture

## Goal

The project keeps the original calculator behavior while making domain changes safe for humans and coding agents. The architecture optimizes for explicit ownership, deterministic logic, narrow dependencies, and executable validation—not for a UI framework.

## Dependency flow

```text
main.ts
  └─ application/bootstrap.ts        composition root
       ├─ application/               state and use cases
       │    ├─ core/                 pure math, solver, validated data contracts
       │    └─ runtime/              browser dataset models
       ├─ infrastructure/            URL/browser adapters
       ├─ presentation/              shared DOM primitives
       ├─ ui/                        feature DOM adapters
       └─ visualization/             D3/SVG adapters
```

The intended direction is:

```text
core ← application ← ui
core ← runtime ← application
presentation ← runtime / ui / visualization
infrastructure → browser APIs
visualization → application read state + presentation assets
```

`application/bootstrap.ts` is the composition root and is intentionally allowed to connect every layer.

## Layers

### Core

`src/core/` contains deterministic code that runs without a browser:

- exact rational and matrix arithmetic
- simplex and factory solving
- totals and solver contracts
- dataset contracts and runtime validation
- formatting calculations

Core is compiled separately with stricter TypeScript options through `tsconfig.core.json`.

### Application

`src/application/` owns calculator behavior:

- `calculator/`: factory state facade, recipe/location/priority policies, view port
- `recipes/`: recipe selection and settings queries
- `search/`: normalized application search
- `bootstrap.ts`: dataset loading and dependency wiring

`FactorySpecification` remains the compatibility facade used by the existing UI. It delegates solver work to core and rendering to `FactoryViewPort`.

### Runtime

`src/runtime/` converts validated dataset records into the browser objects used by the legacy UI. Runtime classes reference neutral presentation primitives but do not import feature UI modules. Treat this as an adapter layer, not the home for new domain rules.

`runtime-context.ts` injects the small amount of calculator context required by legacy models and avoids model-to-bootstrap circular imports.

### Presentation

`src/presentation/` contains reusable DOM primitives with no calculator feature ownership: icons, tooltips, and dropdown helpers. Runtime models, UI features, and visualizations may depend on presentation without depending on each other.

### UI

`src/ui/` owns DOM behavior only:

- targets
- settings and resource-priority editor
- results and recipe selector
- feature events and browser interaction
- URL-fragment serialization tied to current UI settings

UI mutation should call calculator methods/application policies and then request either `updateSolution()` or `display()`.

### Visualization

`src/visualization/` contains Sankey and box-line rendering. D3 remains appropriate here. Do not move solver or selection rules into visualizations.

### Infrastructure

`src/infrastructure/` contains browser adapters that do not know about application features. URL-history synchronization belongs here; calculator-fragment serialization remains in UI persistence because it encodes UI-owned settings.

## Important boundaries

### Dataset boundary

Raw JSON is `unknown` until `parseCalculatorData()` validates it. Domain construction must only receive `CalculatorData`.

### Solver boundary

`core/solver/solve.ts` accepts the explicit contracts in `core/solver/contracts.ts`. The compatibility conversion from `FactorySpecification` is localized at the call site.

### Rendering boundary

`FactorySpecification` calls `FactoryViewPort`; it does not import D3, HTML, display modules, URL serialization, or visualizations.

### Priority boundary

Resource priorities are represented by the pure `PriorityList` model. `ui/settings/resource-priority-editor.ts` renders and manipulates that model.

## Enforcement

`scripts/check-architecture.mjs` resolves relative imports and rejects forbidden layer dependencies. It also rejects browser dependencies inside core.

The architecture checker is intentionally simple and readable so future agents can update it alongside deliberate architectural changes. It also rejects import cycles across first-party TypeScript modules.

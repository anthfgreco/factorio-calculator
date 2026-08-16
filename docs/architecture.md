# Architecture

## One runtime file

`src/main.tsx` is the calculator's only authored runtime source. Ordered `// region …` sections preserve the former domain boundaries while removing first-party import traversal:

```text
validated data and exact arithmetic
  ↓
solver and Factorio domain models
  ↓
quality and deterministic planning
  ↓
FactorySpecification and BuildTarget
  ↓
application state, settings, and URL persistence
  ↓
plain result summaries
  ↓
React controls, compact result rows, and declarative SVG
  ↓
data loading, lifecycle, and mount
```

Tests, scripts, generated datasets, docs, and assets stay separate because they are not runtime modules. `AGENTS.md` is the only agent instruction file.

## State ownership

`FactorySpecification` is authoritative. It owns selected data, targets, recipes, equipment, planning settings, totals, and calculation errors. Each `BuildTarget` is permanently bound to the specification that created it.

`BrowserCalculatorStore` exposes one `CalculatorSnapshot` per revision. The snapshot carries the actual specification and totals plus small browser view state such as the active tab, density, colour scheme, and graph options. React does not maintain a synchronized copy of calculator data.

Mutations explicitly name the specification and call existing model methods. React local state is limited to drafts, filters, and hover state. Meaningful calculator state round-trips through the URL.

## React ownership

React owns every node below `#root`, including production targets, settings, the integrated factory table and inline equipment pickers, help, errors, and the SVG graph. There are no imperative renderers or DOM adapters.

The graph boundary is plain data: `buildDeclarativeGraph()` derives nodes and links from `Totals`; JSX renders `<svg>`, `<path>`, `<g>`, and sprite `<image>` elements. No layout or visualization dependency is required.

## Styling

Most styling is co-located in the `UI` inline-style map or a small nearby style object. Colour schemes are CSS-variable maps applied by the React root.

`BASE_CSS` remains limited to behavior inline styles cannot express cleanly: reset rules, focus/hover/disabled pseudo states, density variables, responsive picker positioning, and media queries. The source tree contains no stylesheet files.

## Optional engine

HiGHS and `highs/runtime?url` are the only dynamic imports. They load only when a quality optimization needs the LP engine. The ordinary calculator and Visualize tab do not load an optional layout package.

## Enforced boundaries

`scripts/check-architecture.mjs` rejects:

- another runtime source file or source stylesheet;
- first-party imports hidden behind static or dynamic loading;
- D3, Tippy, Dagre, vendored Sankey code, or manual DOM/SVG construction;
- unsupported `document` APIs;
- eager HiGHS imports;
- runtime dependency drift;
- nested `AGENTS.md` or `SKILL.md` files.

Strict TypeScript, public behavior tests, runtime validation, URL compatibility tests, performance budgets, and production build checks protect the rest of the architecture.

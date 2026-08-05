# React 19 Migration Boundary

The application shell runs on React and React DOM 19.2.8. The migration deliberately preserves the calculator's exact, battle-tested runtime rather than rewriting solver or D3 behavior during a framework change.

## Ownership

React owns:

- the root mount
- static page structure
- tabs, toolbars, settings markup, help content, and direct user-event wiring
- stable DOM mount points used by existing renderers

The existing runtime owns:

- target-row construction
- dynamic settings and recipe controls
- result-table rows and summaries
- resource-priority editing
- tooltips, popovers, and dropdowns
- D3/SVG visualizations

`CalculatorApp.tsx` is the only React module that imports the runtime composition/actions. Lower React components receive a typed `CalculatorActions` contract.

## Imperative mount-point rule

A React component may create a container such as `#targets`, `#totals`, or `#recipe_toggles`. After `init()` runs, imperative modules may mutate children of that container. React components must stay render-stable and must not conditionally replace those nodes.

Form elements changed by runtime code are intentionally uncontrolled. Replacing `defaultValue` with `value`, or `defaultChecked` with `checked`, would make React overwrite calculator state.

## Adding new UI

Prefer React for new static shell structure and simple controls. Keep calculations and policy in their owning modules. Dynamic high-volume table/graph rendering may remain imperative until a separate migration has measurable value and dedicated performance coverage.

A future renderer migration should proceed feature by feature through explicit ports, with characterization tests and no simultaneous solver changes.

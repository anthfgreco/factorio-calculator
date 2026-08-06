# React 19.2.8 Boundary

The shell runs on React and React DOM 19.2.8. The migration preserves the mature solver and high-volume D3 renderers while replacing global event wiring with a typed external store.

## Ownership

React owns:

- root mounting and lifecycle bridge
- static page structure and accessibility relationships
- tabs, toolbars, settings markup, and snapshot-owned controls
- stable containers used by imperative renderers

The application boundary owns:

- immutable `CalculatorSnapshot` values
- typed `CalculatorCommands`
- subscription lifecycle through `CalculatorStore`
- adaptation between React and existing runtime policy

Imperative runtime modules own:

- production-target row construction
- dynamic recipe/settings/resource option trees
- result-table rows and module/machine controls
- tooltips, popovers, and dropdown internals
- D3/SVG visualization

## External-store rule

`CalculatorApp` starts the runtime and subscribes with `useSyncExternalStore`. Store snapshots must remain referentially stable until the revision changes. Commands accept typed values rather than React or browser events.

The store adapts `FactorySpecification`; it does not duplicate calculation policy. New React state that affects the plan belongs in the specification/state layer and is exposed through the snapshot.

## Imperative mount-point rule

React may create `#targets`, `#totals`, `#recipe_toggles`, `#resource_settings`, or `#graph`. After startup, imperative modules may manage their children. React must not conditionally replace those containers or render children inside them.

Inputs controlled by snapshots may use `value`/`checked`. Inputs whose values are still created or updated by imperative modules remain uncontrolled. Ownership—not a blanket rule—determines the input mode.

## Further migration

Prefer React for new stable shell structure and simple state-backed controls. Keep calculations in owning modules. Migrate a dynamic renderer only when it improves correctness, accessibility, or maintainability and includes characterization tests plus performance evidence. Do not migrate D3 or large result tables merely for framework consistency.

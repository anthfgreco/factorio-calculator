# Change Guide

## Start at the owner

Search `src/main.tsx` for the relevant public symbol or `// region …` marker. Trace the complete path before editing: external input, validation, model mutation, calculation, URL serialization, store notification, and React output.

Prefer the first shared fix. Reuse an existing method or pattern. Do not create a helper file, hook file, component file, stylesheet, or second state model.

## Add or change a calculator setting

1. Put the durable value on `FactorySpecification` or the established settings owner.
2. Validate at the external boundary.
3. Add URL parse/format support when the value should persist.
4. Expose the value through the existing snapshot rather than copying it.
5. Render a native, labelled React control in `react-ui.tsx`.
6. Mutate through `runMutation(specification, …)` or an existing command.
7. Add a URL round-trip test and one public UI/store test.

## Change targets or results

Keep `BuildTarget` DOM-free and bound to its owning specification. Put derived calculations in models or plain summary functions, then render those values directly in JSX. Do not read control values from the DOM or maintain a synchronized React copy.

## Change the graph

Change `buildDeclarativeGraph()` when node/link derivation is wrong. Change `GraphPanel` when presentation is wrong. Keep the boundary plain and deterministic; render SVG elements declaratively. Do not add chained DOM mutation or a layout dependency unless profiling proves the simple layout insufficient.

## Change styling

Use an existing `UI` entry first. Use a nearby one-off style object for truly local differences. Add a React-root CSS variable for a theme value. Touch `BASE_CSS` only for reset, pseudo-state, density, or responsive behavior that cannot be expressed inline.

Do not add a stylesheet, CSS framework, CSS-in-JS dependency, or generic styling abstraction.

## Change Factorio mechanics

Confirm the mechanic in `factorio-wiki.md` and the validated dataset. Add the smallest exact scenario, then change the first owning calculation region. Preserve exact `Rational` values and avoid multiplying catalysts or returned containers with productivity.

## Validate

Run the narrowest test while iterating, then:

```bash
pnpm check:quick
pnpm test:core
pnpm test:ui
pnpm test:e2e       # browser-facing changes
pnpm verify         # release gate
```

Report exactly what ran and what the environment prevented.

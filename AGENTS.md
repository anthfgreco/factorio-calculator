# Factorio Calculator Agent Guide

This repository is intentionally monolithic. Keep it simple, explicit, and easy for an agent to trace end to end.

## Source of truth

- `src/main.tsx` is the one runtime source file and the only authored runtime source.
- It contains validated data contracts, exact math, solvers, Factorio models, planning, state, URL persistence, React UI, SVG visualization, startup, and mount.
- Tests live under `tests/`; deterministic scripts under `scripts/`; generated datasets and static assets under `public/`.
- This root file is the only `AGENTS.md`. Do not add nested agent guides, skills, or instruction directories.

Do not create another runtime module, component file, hook file, utility file, type file, barrel, facade, or source stylesheet. Put code in the owning `// region …` in `src/main.tsx`. Add a well-named region only when no current region is the right owner.

## Working method

Before editing, search for the public symbol or region and trace its callers. For nontrivial work:

1. Follow the real flow: input → validation → state → calculation → persistence → React render.
2. Find the first shared owner of the behavior.
3. Reuse an existing model method, formatter, command, or React pattern.
4. Make the smallest complete change; do not add speculative layers or compatibility paths.
5. Preserve unrelated edits and backwards-compatible URLs.
6. Run focused checks while iterating, then the release gate when the environment supports it.

Useful commands:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check:quick
corepack pnpm test:core
corepack pnpm test:ui
corepack pnpm test:e2e
corepack pnpm bench:check
corepack pnpm validate:runtime
corepack pnpm verify
```

State exactly which checks ran and which the environment prevented. Never weaken a check merely to pass it.

## File navigation

`src/main.tsx` is ordered from foundations to browser entry:

```text
data → exact math → solver → models/recipes → quality/planning
→ factory → state/store → settings/URL → result summaries/targets
→ deferred HiGHS → React UI/SVG → app → mount
```

Search region markers such as:

- `data.ts`, `math.ts`, `solver/*`: validation, exact arithmetic, simplex, cycles, totals.
- `models.ts`, `recipes.ts`, `factory.ts`: Factorio runtime policy and calculation adaptation.
- `quality/*`, `planning.ts`: quality transitions, recycling, planets, transport, freshness, capacity, pollution, heat, and LP optimization.
- `application/*`, `state.ts`: the authoritative application state and external-store boundary.
- `settings.ts`, `url/*`, `url-state.ts`: settings, fragment codec, history, and legacy links.
- `results/*`, `target-model.ts`: plain result summaries and DOM-free production targets.
- `react-ui.tsx`: every rendered control, table, card, tooltip replacement, and SVG node.
- `app.ts`, `main.tsx`: data loading, persistence, deferred engines, lifecycle, and mount.

Move a whole region when dependency order requires it. Do not duplicate a definition to avoid moving it.

## Runtime invariants

- Preserve exact `Rational` values through calculation. Convert to floating point only for presentation or an explicitly approximate external-solver boundary.
- `FactorySpecification` is the calculator source of truth. `CalculatorSnapshot` exposes that specification, its totals, and small view state.
- Every `BuildTarget` is permanently bound to its owning `FactorySpecification`.
- React mutations explicitly name the specification they change and use existing model methods.
- React local state is only for drafts, search/filter text, hover, or similarly disposable view state.
- Do not derive authoritative calculator state from rendered DOM values.
- `window.spec` is legacy compatibility, not permission to add mutable globals.
- All external calculator JSON enters through `parseCalculatorData()`.
- Preserve URL parameter names, deterministic ordering, empty module-slot placeholders, compressed and legacy fragments, and safe failure on malformed input.
- Generated Factorio values and sprite coordinates are not hand-edited. Change the generator/source and regenerate outputs together.
- Keep each sprite hash's PNG/WebP pair together.

## React and styling invariants

- React owns every application DOM and SVG node below `#root`.
- Do not add manual renderers, `document.createElement`, selectors that read UI state, `innerHTML`, D3 chains, Tippy, Dagre, or another visualization ownership model.
- Component layout and control styling belong in the `UI` inline-style map or a nearby one-off style object.
- Theme values are CSS variables applied by the React root.
- `BASE_CSS` is limited to reset rules, pseudo states, density variables, and responsive media queries that inline styles cannot express cleanly.
- Do not create `.css`, `.scss`, CSS-module, CSS-in-JS framework, or styling helper files.
- Use semantic elements, native controls, accessible labels, keyboard behavior, and stable React keys.
- Prefer plain JSX loops and named conditions over generic renderer abstractions or chained mutations.
- Keep the SVG graph declarative: derive plain nodes/links, then render `<svg>`, `<path>`, `<g>`, and `<image>` in JSX.

## Optional work and performance

- HiGHS and `highs/runtime?url` stay behind dynamic imports. They are the only deferred runtime engine.
- Do not add a layout library for the graph without measured need.
- Keep planning and graph construction framework-free and deterministic.
- Avoid whole-dataset scans or large graph reconstruction on interactive paths when an existing index or cache covers the need.
- Do not add memoization, workers, virtualization, or caching without profiling evidence.

## Factorio and solver changes

Search `factorio-wiki.md` for the exact mechanic and edition when behavior is uncertain. Inspect the validated dataset contract before choosing the owning region.

For regressions, reduce the report to the smallest graph and add the failing exact test first. Check graph construction, cycles, priorities, fuel edges, output/surplus recipes, probabilities, catalysts, and per-product productivity eligibility. Productivity must not multiply returned catalysts, containers, coolant returns, or explicitly excluded outputs.

Add named scenarios under `tests/scenarios/` for game-mechanic changes. Prefer exact `Rational` assertions.

## Review rules

Flag changes that introduce:

- another authored runtime source file, stylesheet, `AGENTS.md`, or skill;
- duplicate state, mutable globals, DOM-owned state, or silent loss of serialized values;
- imperative DOM/SVG rendering or a second UI ownership model;
- floating-point conversion before presentation;
- incorrect productivity, catalyst, probability, quality, or recycling behavior;
- URL changes without round-trip and legacy-link coverage;
- eager HiGHS loading or a new startup dependency;
- `any`, TypeScript suppression, unsafe double assertions, or unvalidated external input;
- a calculation change without the smallest focused regression test.

A change is done when the behavior works, strict types and relevant tests cover it, monolith/runtime/build guards remain valid, generated outputs are consistent, and the final report accurately states validation and limitations.

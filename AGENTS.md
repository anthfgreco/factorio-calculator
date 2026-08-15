# Factorio Calculator Agent Guide

This repository is intentionally monolithic. Keep it that way.

## Source of truth

- `src/main.tsx` is the one authoritative runtime file. It contains data contracts, exact math, solver logic, Factorio models, planning, URL state, DOM renderers, React, and browser composition.
- `src/vendor-sankey.js` is the only source-code exception. It is a locally patched third-party implementation kept separate for licensing and provenance.
- Tests live under `tests/`; scripts under `scripts/`; generated datasets and static assets stay under `public/`. Do not inline large JSON datasets or binary assets into `main.tsx`.
- This root file is the only `AGENTS.md`. Do not add nested `AGENTS.md`, `.agents/`, or `SKILL.md` files.

Do not create another runtime source module, barrel, facade, helper file, hook file, component file, type file, or stylesheet. Add code to the correct `// region …` in `src/main.tsx`. A new region is cheaper than a new file. Extend `src/vendor-sankey.js` only for changes to that vendored implementation.

## Start here

Before editing, search `src/main.tsx` for the relevant region or exported symbol. Read only the surrounding region and its callers first; the region names preserve the former architecture without forcing agents to traverse a module graph.

For a nontrivial change:

1. Trace the user-visible flow end to end: input, normalization, state, calculation, persistence, and rendering.
2. Reproduce the behavior with the smallest public test or named Factorio scenario.
3. Fix the first shared owner of the problem, not each symptom or caller.
4. Preserve unrelated working-tree changes and backwards-compatible URL behavior.
5. Run the smallest relevant checks while iterating, then `pnpm verify` before delivery when the environment permits it.

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

`verify` is the release gate. Never weaken a check merely to make a change pass. State exactly which commands ran and which the environment prevented.

## Navigation inside `src/main.tsx`

The file is ordered from foundations to browser entry point:

```text
data → exact math → solver → presentation/models/recipes
→ quality/planning → factory/state/store → settings/URL
→ results/UI → optional HiGHS and graph layout → app → React → mount
```

Search region markers such as:

- `// region data.ts`, `math.ts`, `solver.ts`: validated inputs, exact arithmetic, simplex, cycles, productivity, totals.
- `// region models.ts`, `recipes.ts`, `factory.ts`: Factorio runtime policy and solver adaptation.
- `// region planning.ts` and `quality/*`: quality, location, transport, freshness, capacity, pollution, rockets, heat, and LP optimization.
- `// region application/store.ts`, `state.ts`: the one application-state boundary and typed commands.
- `// region url/*`, `url-state.ts`: pure fragment codec, history, and compatibility orchestration.
- `// region settings.ts`, `results.ts`, `ui.ts`, `visualization.ts`: imperative renderers and high-volume D3/SVG work.
- `// region react/*`: React shell and stable imperative mount points.
- `// region app.ts`, `main.tsx`: composition, deferred dependencies, startup, and disposal.

Keep this order unless a dependency genuinely requires moving a whole region. Do not duplicate definitions merely to avoid moving code.

## Architectural invariants

- Preserve exact `Rational` values through calculation; convert to floating point only for presentation or an explicitly approximate external solver boundary.
- Keep one authoritative state path: `FactorySpecification` adapted by `calculatorStore`. DOM values and React local state are not competing calculator state.
- Commands accept typed values, not forwarded browser `Event` objects.
- React owns the shell. Imperative renderers own the children of their stable mount-point elements. Neither side mutates the other side’s owned children.
- Startup must not load Dagre or HiGHS. Keep `@dagrejs/dagre`, `highs`, and `highs/runtime?url` behind dynamic imports.
- `window.spec` is a compatibility surface, not permission to add mutable globals.
- All external calculator JSON enters through `parseCalculatorData()`.
- Preserve URL parameter names, empty module-slot placeholders, deterministic ordering, compressed and legacy uncompressed fragments, and safe failure on malformed input.
- Generated Factorio values and sprite coordinates are not hand-edited. Change the generator/source and regenerate outputs together.
- Keep each generated sprite hash’s PNG/WebP pair together.
- Player-facing copy explains game behavior, not implementation details.

## Factorio and solver changes

Search `factorio-wiki.md` for the exact mechanic and edition; prefer Space Age behavior when editions differ. Inspect the validated dataset contract and generated prototype data before choosing the owning region.

For solver regressions, reduce the report to the smallest graph, add the failing exact test first, then inspect graph construction, cycles, priorities, fuel edges, output/surplus recipes, probabilities, catalysts, and per-product productivity eligibility. Productivity must not multiply returned catalysts, containers, coolant returns, or outputs explicitly excluded from productivity.

Planning is deterministic and must not touch the DOM. Keep location assignment, quality transitions, freshness, capacity, pollution, logistics, rockets, and heat reports explicit and independently testable. Do not accidentally force quality-qualified or route-capacity problems into the scalar solver.

Add named scenarios under `tests/scenarios/` for game-mechanic changes and use exact `Rational` assertions wherever the expected value is exact.

## UI, state, and persistence changes

Identify ownership of every affected node before editing. Preserve imperative mount-point IDs unless every consumer and behavioral test changes together. React components remain functional, strictly typed, named-exported, and driven by `CalculatorSnapshot` plus `CalculatorCommands`.

Use accessible labels and keyboard behavior. Persist controls through the existing URL/state path when similar settings persist. Keep large selectors, graph layout, tooltips, and other expensive work lazy. Preserve stable result-row keys and D3 update behavior; do not rebuild entire tables or migrate high-volume rendering to React without measured evidence.

The store must expose one stable snapshot object per revision. Startup and disposal stay idempotent, and asynchronous dataset loads must not commit stale objects from an older request.

## Scripts and tests

Scripts are deterministic, non-interactive in CI, and use the Node standard library before adding a dependency. Temporary files belong under `.tmp/` and are removed in `finally` paths. Validation failures should print both measured and allowed values.

Test public behavior and exact game invariants. Source inspection is reserved for true static constraints such as the monolithic source layout, forbidden eager imports, inline handlers, or instruction-file proliferation. Prefer tiny fixture graphs over full datasets when they express the invariant.

# Code Review Rules

Flag changes that introduce any of the following:

- A new authored runtime source file, nested `AGENTS.md`, `.agents/`, or `SKILL.md`.
- A duplicate source of truth, mutable global, authoritative DOM read, or silent loss of imported/serialized state.
- Floating-point conversion before presentation, incorrect productivity/catalyst/probability behavior, or generated data edited without its generator.
- URL-format changes without round-trip, malformed-input, and backwards-compatibility coverage.
- React children inside imperative-owned mounts, imperative mutation of React-owned nodes, or generic event forwarding instead of a typed command.
- Dagre, HiGHS, large selectors, graph construction, or other optional work moved onto startup.
- Newly introduced `any`, TypeScript suppression, unsafe double assertion, unjustified non-null assertion, or unvalidated JSON/DOM/URL input.
- Whole-dataset scans or graph/table rebuilds on interactive paths when an existing index, cache, or incremental update already covers the need.
- A calculation or Factorio mechanic change without the smallest focused regression scenario.
- Tests coupled to private implementation shape when a public behavior assertion is possible.

A change is done when the requested behavior works, strict types and relevant tests cover it, architecture/runtime/build budgets remain valid, generated outputs are consistent, and the final report states exactly what was validated.

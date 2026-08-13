# Architecture

## Goal

The project combines a React 19.2.8 shell, one typed application-state boundary, exact Factorio calculation modules, and focused imperative renderers. The boundaries let humans and agents load only relevant context, rely on strict TypeScript, and change UI without coupling the solver to React or the DOM.

## Dependency shape

```text
main.tsx
  └─ react/CalculatorApp.tsx
       ├─ react/CalculatorShell.tsx
       │    ├─ react/SettingsPanel.tsx
       │    └─ react/HelpPanel.tsx
       ├─ react/useCalculatorStore.ts
       ├─ application/store.ts
       │    ├─ application/contracts.ts
       │    ├─ factory.ts
       │    └─ state.ts
       └─ app.ts
            ├─ validated data/runtime models
            ├─ imperative renderers
            ├─ URL compatibility facade
            └─ dynamic visualization import
```

The exact dependency allowlist and cycle check live in `scripts/check-architecture.mjs`.

## React and application-state boundary

React owns stable page structure, accessible relationships, snapshot-owned controls, and mount-point containers. `CalculatorApp` starts and disposes the browser runtime. `useCalculatorStore` connects React to the framework-independent external store using `useSyncExternalStore`.

`src/application/contracts.ts` defines:

- `CalculatorSnapshot`
- `CalculatorCommands`
- lifecycle and browser ports
- typed tabs, presets, density, settings, and target snapshots

`src/application/store.ts` adapts `FactorySpecification` plus value-based actions into immutable snapshots. It is not a second calculator model: equations and policy remain in their owning runtime modules. DOM values are not authoritative application state.

Imperative renderers own children inside containers such as `#targets`, `#totals`, `#recipe_toggles`, `#resource_settings`, and `#graph`. React must preserve those container nodes across snapshot rerenders. React-controlled inputs are used only for snapshot-owned values; controls still owned by imperative modules remain uncontrolled.

## Exact calculation boundary

### Data

`src/data.ts` owns `CalculatorData`, runtime validation of untrusted JSON, normalized search, location queries, and shared sorting. Raw JSON stays `unknown` until `parseCalculatorData()` validates it.

### Math and solver

`src/math.ts` owns exact `Rational` arithmetic, matrix/simplex primitives, display formatting, and power formatting.

`src/solver/contracts.ts` owns the small structural contract consumed by the pure solver. `src/solver/errors.ts` owns typed failure diagnostics. `src/solver.ts` owns cycle detection, fuel-consumer edges, per-product productivity, totals, and `solve()`.

The solver depends only on exact math and its own contracts. It has no knowledge of Factorio runtime classes, React, D3, or browser APIs.

### Planning

`src/planning/contracts.ts` defines planning targets, specification capabilities, and report rows. `src/planning.ts` owns one-pass quality reporting, compatible locations, transport flows, freshness, resource/asteroid capacity, pollution/spores, rocket launches, beacon power, Aquilo heat, logistics, and planning summaries.

`src/quality/math.ts` owns exact quality-transition probabilities and Rational plus fraction-free linear-system helpers. `src/quality/graph.ts` adapts quality-qualified commodities to either the existing exact simplex or an injected, certified optimizer. `src/quality/highs-solver.ts` builds the sparse quality LP, uses HiGHS only to find a candidate basis, reconstructs that basis from the original Rational coefficients, and accepts it only after exact primal, dual, reduced-cost, and objective checks. A rejected candidate falls back to the exact simplex. `src/quality/operations.ts` owns shared quality operation construction, equipment configuration, recycler closures, and capacity accounting. `src/quality/disposal.ts` recursively balances generated recycler routes for surplus without inventing a destruction sink. `src/quality/practical.ts` owns recursive selected-planet quality graphs, local-resource boundaries, qualified intermediates, module policy, imports, and real recycling. `src/quality/vulcanus.ts` supplies the curated lava-to-molten route policy to that shared graph.

Planning remains deterministic over targets and solved totals. Ordinary Normal and legacy one-pass targets stay on the scalar solver. New non-Normal targets enter automatic planet-aware planning at the factory boundary, so the player chooses target, quality, rate, planet availability, and shared gear rather than an implementation strategy. No quality graph cost is paid by ordinary plans.

### Factory facade

`src/factory.ts` owns `FactorySpecification`, machine/module/location policy, runtime-to-solver adaptation, subscriptions, URL persistence hooks, and the `FactoryViewPort`. The public calculation contract is DOM-free even though the current browser `BuildTarget` view still implements the target port.

## Runtime domain

`src/models.ts` owns runtime classes for belts, fuels, buildings, modules, and planets. Focused data factories live under `src/models/`:

- `item-groups.ts`
- `productivity-research.ts`

`src/recipes.ts` owns item/recipe runtime models and recipe classification, search, grouping, enablement, and probability policy.

`src/priorities.ts` owns resource-priority state and its tightly coupled editor.

## Browser rendering

`src/presentation.ts` provides icons, tooltips, popovers, and dropdown primitives.

`src/settings.ts`, `src/results.ts`, and `src/ui.ts` render dynamic controls and high-volume tables into React-provided mount points. Pure helpers are extracted where they have independent meaning:

- `src/settings/productivity-research.ts`
- `src/results/grouping.ts`
- `src/results/summary.ts`

`src/graph/types.ts` defines graph view models. `src/graph.ts` implements graph/Sankey primitives. `src/visualization.ts` implements viewport and visualization orchestration.

## URL boundary

`src/url/codec.ts` is pure fragment encoding/decoding with injected compression/base64 operations. `src/url/history.ts` is an injected history/location controller. `src/url-state.ts` preserves the existing public fragment format and adapts runtime models.

Existing parameter names, explicit empty module slots, deterministic set ordering, compression behavior, and legacy uncompressed links are compatibility requirements.

## Startup and performance boundary

The totals view is the critical path. `visualization.ts`, `graph.ts`, and Dagre load only when the user opens Visualize; there is no idle-time preload. The HiGHS JavaScript and WASM assets load only for an automatic non-Normal quality target. Certified quality solutions use a bounded structural/unit-rate cache, while Normal plans keep the existing synchronous scalar solver and initial bundle. Item/recipe/resource option trees remain deferred until first use.

`config/build-budgets.json` and `scripts/check-build-budgets.mjs` enforce initial bundle, request, chunk, and deferred-module budgets. `scripts/bench-solver.mjs --check` enforces conservative exact-solver ceilings.

## Type and import enforcement

The root `tsconfig.json` enables full strictness globally, including exact optional properties and unchecked indexed access. `scripts/check-type-debt.mjs` rejects explicit `any`, TypeScript suppression comments, and unsafe double assertions.

Use direct imports from owning modules. Compatibility re-exports in `solver.ts`, `planning.ts`, `models.ts`, and `results.ts` preserve existing call sites during bounded decomposition; do not grow them into broad barrel APIs.

## Player-model boundaries

The simplex solves a shared scalar item graph. Planning assigns active recipes to pinned or compatible locations and derives transfers from solved material links. This is exact accounting for the selected assignment, not a route-capacity optimization solver.

Quality-module compatibility and the shared direct-plus-beacon quality effect belong to runtime models. New non-Normal targets use the selected planet profile automatically. Ordinary planet profiles recursively balance `(item, quality)` commodities through local resources and intermediates; eligible operations below the requested tier use quality modules and requested-tier operations use productivity modules. The Vulcanus policy adds curated lava and calcite routes, prefers foundries and electromagnetic plants where applicable, and retains its established locally-required-tier module policy. All practical profiles use generated recycler recipes, keep fluids qualityless, and begin fluid-only solid recipes at Normal. Legacy one-pass targets retain the reciprocal probability transformation.

Freshness, asteroid capacity, surface-aware emissions, rocket launch reporting, and Aquilo heat are deterministic planning layers over solved rates. Version-specific mechanics belong in validated dataset contracts; layout assumptions remain visible rather than hidden in recipe equations.

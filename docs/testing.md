# Testing and Verification

The repository uses strict TypeScript, Node's test runner, purpose-built validation scripts, and a dependency-free Chromium DevTools harness.

## Validation lanes

```text
check:quick  ~5 seconds   architecture + type debt + strict TypeScript
test:core    ~3 seconds   exact solver and named Factorio scenarios
test:e2e    ~20 seconds   critical browser workflows
verify        release gate
```

Durations are targets, not contracts; update them if measured CI times materially change.

## Environment preflight

```bash
pnpm run doctor
```

Checks the supported Node/pnpm environment, lockfile, required sources, datasets, and local tools. Failures should explain the corrective action.

## Fast static lane

```bash
pnpm check:quick
```

Runs:

- architecture allowlist and import-cycle validation
- explicit type-debt rejection
- full globally strict TypeScript

## Core behavior

```bash
pnpm test:core
```

Compiles TypeScript into `.tmp/tests` and runs exact math/solver tests plus focused scenarios under `tests/scenarios/`.

Use named scenarios for game mechanics such as productivity, catalysts, quality, recycling, Gleba freshness/spores, Aquilo heat, asteroid limits, belt stacking, and rocket launch limits. Prefer minimal fixture graphs and exact `Rational` assertions.

## UI and state behavior

```bash
pnpm test:ui
```

Covers application-store lifecycle and commands, URL codec/history behavior, runtime state, interface invariants, and focused UI contracts. Source inspection is reserved for true static constraints such as forbidden inline handlers or imports; user behavior should be exercised through public contracts.

## Browser workflows

```bash
pnpm test:e2e
```

Starts Vite and drives Chromium through the DevTools protocol without an additional browser-test dependency. It verifies:

- default dataset and successful calculation
- target addition
- title/URL persistence through reload
- progression preset effects
- opening Visualize renders a graph summary without browser errors
- critical controls render at a mobile viewport
- uncaught browser errors fail the test

Set `CHROME_PATH` when Chromium is not in a standard location.

## Dataset validation

```bash
pnpm validate:runtime
```

Loads every bundled dataset through emitted TypeScript and checks parser, model, recipe, and application invariants.

## Solver performance

```bash
pnpm bench
pnpm bench:check
```

`bench` reports median exact-solver times for 500- and 1,000-step production chains. `bench:check` compares them with conservative ceilings in `config/performance-budgets.json` and fails on a substantial regression. Compare local numbers only on the same machine/runtime.

## Build budgets

```bash
pnpm build:site
pnpm validate:build
```

The Vite manifest and emitted Rollup module graph are checked for initial JavaScript/CSS/request budgets, maximum chunk size, and deferred visualization modules. Required deferred modules must be present, reachable through the calculator's dynamic import graph, and absent from its static import closure.

## Release gate

```bash
pnpm verify
```

The release gate runs environment preflight, fast static checks, core/UI tests, solver performance budgets, production build, runtime validation, and build budgets. Run `pnpm test:e2e` for browser-facing changes and before release when Chromium is available.

## Test quality rules

Prefer:

- exact public outcomes
- small scenario builders
- malformed-boundary cases
- URL round trips and old-link fixtures
- store lifecycle/command behavior
- a small number of critical browser workflows

Avoid:

- assertions that merely search source text for implementation strings
- whole-DOM or whole-dataset snapshots
- fixtures larger than the invariant requires
- timing thresholds tight enough to be CI-flaky

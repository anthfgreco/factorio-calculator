# Execution Plans

Use an execution plan for changes that span multiple modules, alter architecture or persisted behavior, or require more than one validation loop. Keep it current while work is active.

## Active plan: strict typed application architecture

### Goal

Enable full repository-wide strict TypeScript, establish one typed calculator state boundary shared by React and imperative renderers, replace brittle implementation tests with behavioral coverage, and add fast validation and agent guardrails without changing Factorio calculations, URL compatibility, generated data, or user-visible behavior.

### Context and constraints

- Work from the uploaded 2.1.13 tree and preserve all existing unrelated changes.
- Exact `Rational` arithmetic remains authoritative until presentation.
- React owns the stable shell; imperative renderers continue to own large dynamic tables and visualizations.
- Existing URL fragments must remain readable and produce equivalent settings.
- Do not add a pull-request workflow.
- Do not edit generated dataset values directly.

### Done when

- Global strict TypeScript passes with no repository `any` or suppression debt.
- A typed store exposes snapshots, value commands, subscriptions, startup, and disposal.
- React uses `useSyncExternalStore`; generic native-event forwarding is gone.
- URL encoding/decoding has pure, directly tested contracts.
- Core mechanics and critical browser workflows have behavioral tests.
- `check:quick`, `test:core`, `test:e2e`, and `verify` exist with documented roles.
- Architecture, build topology, and performance budgets are enforced.
- Root review rules, nested guidance, ADRs, and local skills are present.

### Steps

1. [x] Align Node/tooling and add validation command skeleton.
2. [x] Enable global strictness and define domain/runtime contracts.
3. [x] Separate production target data from DOM target views.
4. [x] Introduce the typed store and browser ports.
5. [x] Connect React through snapshots and value commands.
6. [x] Extract the pure URL codec and history controller.
7. [x] Type and decompose calculation and renderer ownership modules.
8. [x] Replace source-string behavior checks with focused unit, scenario, UI, and browser tests.
9. [x] Add architecture layers, bundle/performance budgets, review rules, ADRs, and skills.
10. [ ] Run the dependency-backed release gate on Node 22.22.3 after installing the frozen lockfile. Dependency-independent architecture, type-debt, syntax, and strict TypeScript checks pass in the implementation environment.

### Decision log

- Strictness is enabled globally in one pass rather than staged tsconfigs.
- No pull-request CI workflow will be added.
- React will not absorb D3 or high-volume result rendering solely for framework consistency.
- The uploaded repository is the sole implementation base; older migration artifacts are reference material only.
- The exact module allowlist remains the narrow dependency contract; six architectural layers additionally reject upward dependencies and make ownership visible in diagnostics.
- `test:e2e` remains separate from `verify`; install Playwright's pinned Chromium browser before running browser-facing changes and release candidates.
- The release gate uses the pinned Node 22.22.3 and pnpm dependency installation, so rerun it after `pnpm install --frozen-lockfile`.

## Template

### Goal

State the user-visible outcome in one or two sentences.

### Context and constraints

List the owning modules, relevant evidence, compatibility requirements, and explicit non-goals.

### Done when

List observable completion criteria, including tests and release checks.

### Steps

1. Reproduce or characterize current behavior.
2. Make the smallest architectural change that supports the goal.
3. Implement the behavior and focused tests.
4. Run targeted checks, then `corepack pnpm verify`.
5. Review the diff for regressions and update documentation only where behavior or ownership changed.

### Decision log

Record only decisions that a later agent would otherwise have to rediscover: alternatives rejected, compatibility tradeoffs, and unresolved follow-ups.

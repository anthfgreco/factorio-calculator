# Execution Plans

Use an execution plan for changes that span multiple modules, alter architecture or persisted behavior, or require more than one validation loop. Keep it current while work is active.

## Completed plan: belt-based production targets

### Goal

Let players target a fraction or multiple of the selected belt's full two-lane throughput alongside machine-count and rate targets, and let Enter activate any displayed target value even when it was not edited.

### Context and constraints

- `BuildTarget` and `#targets` remain imperatively owned by `src/ui.ts`; React owns only the stable header and mount point.
- Belt targets use exact `Rational` arithmetic and the existing selected belt plus global belt-stack height.
- Belt and stack changes must recalculate belt-based targets; display-rate changes must not change their physical throughput.
- Fluids cannot use belt targets, existing `f` and `r` URL targets must remain compatible, and unrelated working-tree changes must be preserved.
- Desktop and mobile target layouts must remain accessible and usable without moving target state into React or eagerly loading visualization code.

### Done when

- Solid targets expose Machines, Rate, and Belts values with one authoritative basis.
- Pressing Enter on a derived Machines, Rate, or Belts field makes it authoritative and visibly selected.
- Belt targets persist through shared links, react to Belt and Belt stacking settings, and safely fall back to rate semantics for fluids.
- Exact mechanic, UI/state, URL compatibility, and browser behavior are covered.
- Formatting, focused checks, E2E, runtime validation, and the release gate pass.

### Steps

1. [x] Characterize exact belt capacity, target activation, URL persistence, and responsive layout.
2. [x] Add an exact target-basis model and belt-rate conversion at the factory boundary.
3. [x] Implement the third imperative target input, Enter activation, fluid handling, settings reactions, and responsive shell layout.
4. [x] Add backward-compatible URL persistence and typed URL-boundary coverage.
5. [x] Add exact scenario, UI/state, URL, and E2E regression coverage.
6. [x] Format, run focused validation and the release gate, then review the final diff.

### Decision log

- A belt target stores belt count as intent rather than performing a one-time conversion to rate, so changing the selected belt or stack height intentionally changes target throughput.
- One belt means the selected belt's full two-lane throughput; belt stack height multiplies items per moving stack and inventory stack size is unrelated.
- Use a three-value target basis rather than multiple booleans so Machines, Rate, and Belts cannot simultaneously be authoritative.
- Enter activates a field even when its displayed value has not changed; ordinary focus or blur alone does not.

## Completed plan: Factorio 2.1.14 compatibility label

### Goal

Present the calculator as compatible with Factorio Space Age 2.1.14 without claiming that a new prototype export was generated.

### Context and constraints

- Factorio 2.1.14 is a bugfix-only release with no calculator-relevant prototype changes.
- Keep the 2.1.13 generated dataset, sprite assets, exporter target, dataset filename, and URL key unchanged.
- Preserve existing 2.1.13 shared links and calculations.

### Done when

- Player-facing version labels and app metadata say 2.1.14.
- The changelog explains compatibility without implying recipe changes.
- UI behavior, old links, runtime datasets, and the release gate pass.

### Steps

1. [x] Update app metadata and player-facing compatibility labels.
2. [x] Add matching Help and public changelog entries.
3. [x] Add focused rendered-UI coverage.
4. [x] Run UI/E2E checks and the release gate.

### Decision log

- Reuse the 2.1.13 dataset because 2.1.14 does not change inputs consumed by the calculator.
- Keep the internal `space-age-2-1-13` key so existing URLs remain canonical and no false dataset version is introduced.

## Previous plan: strict typed application architecture

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

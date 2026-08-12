# Execution Plans

Use an execution plan for changes that span multiple modules, alter architecture or persisted behavior, or require more than one validation loop. Keep it current while work is active.

## Completed plan: Canadian number and tooltip polish

### Goal

Apply Canadian comma grouping to player-visible numbers and make every multi-entry tooltip scan vertically without duplicate nested tooltips.

### Constraints

- Preserve exact `Rational` values and URL serialization; grouping is presentation-only.
- Keep grouped editable text values parseable and leave native numeric inputs valid.
- Fix tooltip behavior in the shared presentation/dropdown primitives.

### Steps

1. [x] Add exact string-based Canadian grouping to the shared formatter with parsing coverage.
2. [x] Route remaining player-visible decimal values through the shared grouping helper.
3. [x] Normalize multi-entry tooltips to line breaks and suppress nested empty-slot tooltips.
4. [x] Add focused UI/browser regression coverage and run the release gate.

## Completed plan: equipment quality review cleanup

### Goal

Finish the equipment-quality feature for min-max players by preserving explicit overrides, removing dead controls, keeping empty-slot workflows uninterrupted, and exposing the effective values that quality changes.

### Constraints

- Preserve existing quality URLs and Normal-quality behavior for legacy datasets.
- Keep Factory rows compact; effective statistics belong in existing tooltips rather than new columns.
- Keep React-owned Settings visibility snapshot-driven and dynamic equipment controls imperatively owned.
- Preserve first-slot propagation without overwriting independently configured later slots.

### Steps

1. [x] Track inherited versus explicit module and beacon quality state and round-trip it through URLs.
2. [x] Keep empty module/beacon pickers open and hide quality controls when the dataset has no quality tiers.
3. [x] Add effective machine, module, beacon, and mining-drain statistics to existing tooltips.
4. [x] Correct stale player documentation and generator report cleanup.
5. [x] Add focused state/browser coverage and run formatting, E2E, and the release gate.

## Completed plan: native quality sprites and module-row quality

### Goal

Use Factorio's exported quality sprites throughout the compact equipment controls and restore the first-slot convenience for setting a complete module row's quality.

### Constraints

- Keep the generated sprite sheet as the sole source of quality artwork.
- Preserve independently customized module slots and existing quality URLs.
- Match the established first-slot module-fill behavior instead of adding another permanent Factory-table control.

### Steps

1. [x] Trace the quality sprite export and existing first-slot module propagation.
2. [x] Replace letter/text quality markers with native sprite-sheet icons.
3. [x] Propagate first-slot quality across matching, untouched row slots.
4. [x] Add browser coverage and run focused plus release validation.

## Completed plan: equipment quality

### Goal

Support Factorio 2.1 quality for crafting machines, mining drills, modules, and beacons, while keeping the Factory table compact and making every quality choice shareable.

### Context and constraints

- Generated Factorio data remains authoritative for quality tiers and prototype-specific behavior; generated values are never patched by hand.
- Equipment quality is recipe configuration, not a second item-quality dimension in the scalar production solver.
- Machine quality affects crafting speed, mining-drill quality affects resource drain rather than yield, module quality scales only beneficial effects, and beacon quality affects distribution efficiency and power use.
- Existing URLs and datasets without equipment-quality fields must continue to load as Normal quality.
- React retains the shell, while Factory rows and their compact quality controls remain imperatively owned.

### Done when

- Machine, module, and beacon quality can be selected per recipe without adding a wide Factory-table column or duplicating every module option five times.
- Default equipment qualities are available in Settings, and recipe-specific choices override those defaults.
- Exact rate, module-effect, beacon-effect, power, pollution, mining-drain, and rocket-launch calculations use the selected qualities.
- Quality state round-trips through URLs, and legacy URLs produce the same Normal-quality calculations as before.
- Generated data, exact scenarios, state/UI behavior, runtime datasets, browser coverage, build budgets, and the release gate pass.

### Steps

1. [x] Extend the generated data contract with quality tiers and prototype quality modifiers.
2. [x] Add qualified machine, module, and beacon configuration at the factory boundary with exact calculations.
3. [x] Add compact Factory-row controls, Settings defaults, and backward-compatible URL persistence.
4. [x] Add exact mechanic, state, URL, UI, and browser regression coverage.
5. [x] Regenerate outputs, format, run focused validation and the release gate, then review the final diff.

### Decision log

- Keep product-quality targets unchanged; equipment quality feeds their existing module-quality probability calculation.
- Use one quality strip inside each existing equipment picker and a small tier badge on its trigger, avoiding a new Factory-table column and five copies of each module icon.
- Persist only non-Normal defaults and sparse recipe overrides; missing quality state always decodes as Normal.
- Quality levels use the prototype level values, including Legendary level 5, rather than assuming sequential arithmetic levels.
- Use a bounded quality-enrichment generator mode because the available official export predates the repository's corrected 2.1.13 recycling times; it preserves every existing recipe value while regenerating quality fields and the sprite sheet.
- Hide Normal badges and inactive beacon-quality controls. Higher tiers appear as compact colored badges, while open equipment pickers show the full tier strip.

## Completed plan: item-aware belt stacking

### Goal

Separate the researched maximum belt-stack height from the per-item logistics assumption, so players can stack only selected items while direct-stack producers such as big mining drills remain clear and useful.

### Context and constraints

- Factorio belt-stack research sets a global maximum height, but only stack inserters, big mining drills, and recyclers create belt stacks; the calculator must not imply that research stacks every solid item automatically.
- `FactorySpecification` remains the exact policy owner. React owns the stable Settings structure, while target rows and result rows remain imperatively rendered.
- Belt targets preserve belt count as intent and must use the target item's effective stack height.
- Existing URLs containing only `bstack` must retain their historical all-solid stacking result; new item policy state must round-trip deterministically and fail safely.
- Direct-stack producer capability must come from the generated Factorio data boundary rather than hard-coded entity names.
- Per-item policy is a logistics assumption over scalar item totals; route-level mixtures of stacked and unstacked belts remain outside the current solver model.

### Done when

- Settings distinguish maximum researched stack height from the default `Auto`, `Stacked`, or `Unstacked` item treatment; each Factory item row exposes its own override.
- Results and belt targets visibly show the effective `×1` to `×4` treatment, with precise player-facing explanations and unambiguous inventory-stack terminology.
- Auto uses direct-stack-capable selected producers conservatively; explicit item overrides take precedence.
- Totals, targets, visualization, presets, and URLs use one item-aware exact capacity policy.
- Generated data, exact scenarios, UI/state, URL compatibility, E2E behavior, runtime datasets, build budgets, and the release gate pass.

### Steps

1. [x] Characterize current global behavior and add the data-backed direct-stack capability.
2. [x] Add item policy state and exact item-aware belt conversion at the factory boundary.
3. [x] Implement typed settings, URL persistence, target/result indicators, and consistent visualization behavior.
4. [x] Add exact mechanic, state, URL, UI, and critical browser coverage.
5. [x] Regenerate affected outputs, format, run focused validation and the release gate, then review the final diff.

### Decision log

- Keep one researched maximum height; per-item settings choose whether that maximum is used rather than inventing per-item research levels.
- Use `Auto`, `Stacked`, and `Unstacked`. Auto assumes direct belt output only when the active production source is unambiguously capable of dropping full belt stacks; ambiguous or mixed sources fall back to unstacked.
- Put item overrides beside belt results in the Factory table, where their effect is visible, rather than behind a separate Settings editor.
- New plans use Auto by default. Legacy URLs with `bstack` but no policy parameter decode as Stacked to preserve their previous calculations.
- Explicit per-item overrides are sparse, deterministic URL state. A compact Factory-row selector sits beside the visible effective height without making DOM state authoritative.

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

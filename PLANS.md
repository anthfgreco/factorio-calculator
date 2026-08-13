# Execution Plans

## Completed plan: preset productivity and settings cleanup

### Goal

Make every progression preset set a complete, stage-appropriate productivity profile, and remove the broken Recipe Settings jump navigation plus the entire Debug UI/runtime feature.

### Constraints

- Base preset productivity on Factorio Space Age research progression; recipe productivity remains exact +10% research levels.
- Keep Full Legendary quality-only and preserve player-selected locations and explicit equipment choices.
- Keep preset-applied productivity visible immediately and persisted through the existing URL fields.
- Remove debug-only tableau retention without changing simplex behavior or calculation results.

### Steps

1. [x] Trace preset, productivity, Recipe Settings, and Debug ownership and research current Space Age values.
2. [x] Add complete productivity profiles and immediate control synchronization for every progression preset.
3. [x] Remove Recipe Settings jump navigation and its unused styles.
4. [x] Remove the Debug tab, command/state, URL output, renderer, and solver-only tableau snapshots.
5. [x] Update focused browser/UI/core coverage and the 2026-08-13 changelog.
6. [x] Format, run focused validation and the release gate, then review the final diff.

## Completed plan: remove undeployed quality modes

### Goal

Remove the undeployed target-loop and Full Fulgora modes, their URL state, and code made unreachable by their removal while preserving automatic planet quality planning and legacy direct quality links.

### Constraints

- Preserve exact `Rational` automatic Nauvis/Vulcanus flows, generated recycler recipes, and qualityless-fluid boundaries.
- Preserve old direct quality links; reject the undeployed target-loop, Full Fulgora, objective, and excess-policy suffixes.
- Keep the global Quality factory objective and gear settings used by automatic planet plans.
- Preserve unrelated working-tree changes and the React/store/imperative-renderer ownership boundaries.

### Done when

- Target-loop and Full Fulgora can no longer be selected, decoded, or executed.
- Legacy-only target state, planners, result fields, labels, graph kinds, math helpers, and tests are removed.
- Automatic Nauvis/Vulcanus plans and legacy direct quality links retain focused behavioral coverage.
- Formatting, focused checks, browser workflows, and the release gate pass.

### Steps

1. [x] Inventory target-loop and Full Fulgora state, execution, presentation, tests, and documentation.
2. [x] Remove the legacy modes and simplify target/URL contracts.
3. [x] Prune newly unreachable quality helpers, fields, labels, tests, and architecture entries.
4. [x] Update documentation and changelog copy.
5. [x] Run focused validation, browser workflows, and the release gate; review the final diff.

## Completed plan: recursive Nauvis quality factories

### Goal

Make automatic Nauvis quality targets recursively produce quality-qualified intermediates with the configured quality-factory gear, and omit the ordinary Factory table and header when the quality plan is the complete result.

### Constraints

- Preserve exact `Rational` quality flows, generated recycler recipes, and Factorio quality/fluid boundaries.
- Preserve the curated Vulcanus route and legacy direct quality URL behavior.
- Keep Normal targets on the fast scalar solver and retain the ordinary table for mixed Normal and quality targets.
- Keep result visibility in the imperative renderer; do not add a second React/store state source.

### Done when

- Nauvis → Late Space Age → 60 Legendary Advanced circuits/min expands copper cable, plastic, and electronic circuits into quality-planned operations instead of listing them as external Normal feed.
- Pre-Legendary eligible stages use the configured quality module profile, while guaranteed Legendary crafting uses the configured productivity profile.
- A quality-only calculation shows its complete quality card without an empty ordinary table or table header; mixed calculations retain the table.
- Exact scenarios, UI/E2E behavior, runtime datasets, solver benchmarks, build budgets, and the release gate pass.

### Steps

1. [x] Add the reported Nauvis quality regression and conditional table/header behavior coverage.
2. [x] Generalize the recursive practical quality graph from the curated Vulcanus implementation to selected planets.
3. [x] Route new automatic Nauvis targets through the recursive graph while preserving legacy direct quality behavior.
4. [x] Hide the ordinary Factory table and its header only when no scalar rows remain.
5. [x] Update architecture and player documentation, format, run focused checks and the release gate, then review the final diff.

## Completed plan: progression and Full Legendary presets

### Goal

Keep progression presets focused on research-era factory defaults, preserve the player's location, and provide a separate Full Legendary action for intentionally upgrading all target and equipment quality.

### Constraints

- Fresh plans default to Nauvis, while presets preserve explicit single- and multi-location selections.
- Progression presets may set the available quality ceiling but do not upgrade target or equipment quality.
- Full Legendary changes quality only; it preserves progression, location, machine/module types, and beacon layout.
- Existing shared links remain backward-compatible and serialize the resulting state through established URL fields.

### Steps

1. [x] Slim progression presets to Early game, Pre-rocket, Early Space Age, and Late Space Age.
2. [x] Remove preset-owned locations and make Late Space Age use express belts.
3. [x] Add the Full Legendary quality action at the factory boundary and expose it through the typed UI command.
4. [x] Add focused mechanic, rendered UI, URL, and browser coverage.
5. [x] Format, run focused validation and the release gate, then review the final diff.

## Completed plan: Vulcanus-first practical quality planning

### Goal

Turn quality planning into a planet-aware Factorio build workflow: a player chooses Vulcanus, a quality target, and available quality gear; the calculator selects the practical lava-to-solid quality chain, recycles failures, and reports what to build.

### Constraints

- Preserve the exact `Rational` quality-flow engine and legacy direct quality URL semantics.
- Model Vulcanus from local source boundaries (`lava`, `calcite`, and other native resources), not synthetic external Normal plates.
- Apply quality at the first solid-producing stage, productivity to qualityless-fluid production and guaranteed Legendary crafting where legal, and quality to recyclers.
- Keep Factory rows compact and move Markov/LP diagnostics behind collapsed details.

### Steps

1. [x] Add a persisted global practical-quality profile and automatic quality-target strategy while retaining direct quality links.
2. [x] Implement a curated Vulcanus quality graph from lava/molten metal through quality solids, downstream crafting, and real recycler disposal.
3. [x] Replace per-target strategy/objective/excess controls with the single quality choice and global quality-gear settings.
4. [x] Reframe quality results as grouped build/feed/keep/recycle stages with collapsed calculation details.
5. [x] Update help, architecture, URL/state, and regression coverage for the Vulcanus workflow and direct-link compatibility.
6. [x] Run available validation, review the diff, and produce updated repository, patch, checksums, and handoff artifacts.

### Decision log

- New non-Normal targets use an explicit persisted `auto` strategy; old URLs without a strategy remain direct and byte-compatible.
- Vulcanus automatic planning uses curated local casting routes before generic producers, so iron/copper/steel/gears/cable start at molten-metal casting with quality modules.
- Practical mode configures quality below Legendary, quality in recyclers, productivity for fluid-output and guaranteed Legendary stages, and reports unavoidable imports rather than hiding them.
- Target rows expose player intent only; automatic planning policy remains in the shared Quality factory settings.
- A single explicitly selected planet overrides a target recipe’s historical location pin in automatic mode, so a Vulcanus plan can replace ordinary iron smelting with casting iron.
- Quality stages and recyclers use the global quality-factory module profile; guaranteed-quality stages prefer configured productivity defaults or the best compatible productivity module, using the existing default module quality rather than assuming equally upgraded productivity gear.
- Automatic quality targets hide the manual recipe selector because the planet profile owns route selection; direct quality targets keep the existing selector.
- Primary results group local sources, fluid production, quality production, guaranteed-quality crafting, and recycling; exact tier rates remain available in collapsed details.

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

## Completed plan: explicit quality-factory productivity modules

### Goal

Let players independently choose the productivity module and module quality used by automatic quality factories, with Productivity Module 3 at Legendary quality as the fresh default.

### Context and constraints

- Keep quality-producing modules and guaranteed-quality productivity modules as separate persisted settings.
- Preserve the imperative Settings mount-point ownership and automatic best-compatible option.
- Do not couple automatic quality factories back to the ordinary factory's default and secondary module settings.
- Leave the existing interactive and read-only icon renderers separate.

### Done when

- Settings exposes explicit quality and productivity module/quality pairs.
- Quality plans use the selected productivity module where compatible and fall back predictably when automatic selection is chosen.
- The new choices survive shared URLs and reloads.
- Focused planner, URL, and browser tests plus the release gate pass.

### Steps

1. [x] Trace existing module selection, settings rendering, URL persistence, and quality-plan rendering.
2. [x] Add dedicated productivity module state, defaults, and planner policy.
3. [x] Add persisted Settings controls and clarify player-facing labels.
4. [x] Add focused planner, URL, and browser coverage.
5. [x] Format, run focused validation and the release gate, then review the final diff.

### Decision log

- Keep `Best compatible productivity module` as the null/automatic choice, but use Productivity Module 3 at Legendary quality for fresh state.
- Do not extract a shared equipment-icon component yet: the basic calculator owns an interactive D3 data join while the quality plan renders static evidence, and their shared sprite/badge primitives already prevent visual drift.

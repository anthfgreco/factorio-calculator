# Factorio Calculator

A browser calculator for Factorio.

This fork includes experimental **Factorio Space Age 2.1.12** data.

## Player-facing behavior

- Exact rational production-chain solving with multiple simultaneous outputs and alternate recipes.
- Factorio 2.1 recipe categories, combined result probabilities, recycling, surface conditions, machines, modules, beacons, and per-product productivity eligibility.
- Gleba growth-time and agricultural-tower sizing, seed flows, spoilage/freshness reporting, effective agricultural-science throughput, and exact harvest-plus-tower spores.
- Exact target-quality selection using direct quality probabilities and explicit non-target-quality byproduct reporting.
- Recipe assignment to Nauvis, Vulcanus, Fulgora, Gleba, Aquilo, or Space platforms, with row-level locations and compact cross-location flow accounting.
- Configurable pumpjack/resource yield and asteroid-chunk collection capacities.
- Surface-aware pollution, configured beacon-equivalent electricity, and Aquilo production heat.
- Space Age rocket-silo throughput with 50-part rockets, buffered launch overlap, launches per selected interval, and visible launch-animation bottlenecks.
- Belt stacking, stack throughput, configurable buffers, and cargo-wagon loads.
- Progression presets that set the quality ceiling and belt-stacking research.
- Directly labeled Factory rows, in-row recipe/building/location selection, searchable settings, persistent URL state, and a one-click plan link.

## Current model boundaries

The exact simplex solver still balances scalar item rates. Quality targets use Factorio's direct expected-value probability chain, but automatic recycler-loop optimization and a fully generalized `(item, quality, location)` simplex are not included. Location assignments and transport are explicit accounting after solving rather than route-capacity constraints inside the LP.

Agricultural tower electricity remains a conservative active-load value because planting/harvesting duty timing is absent from the export. Spore totals are exact for the planned harvest rate and placed tower count. Rocket launch timing currently assumes normal-quality silos; quality-specific animation timing is labeled as future work. Asteroid caps identify infeasible collection demand without re-optimizing recipe choices. Aquilo heating covers production machines and configured beacon equivalents; layout-dependent logistics entities remain outside the graph.

See [Advanced Space Age planning](docs/advanced-planning.md) for calculation details and limitations.

## Live site

https://anthfgreco.github.io/factorio-calculator/

## Development

Requirements:

- Node.js 22.13 or newer
- pnpm 11
- Python 3 and Pillow only when rebuilding Factorio datasets

```bash
pnpm install
pnpm dev
```

## Commands

```bash
pnpm dev                 # Start Vite
pnpm bench               # Benchmark exact 500- and 1,000-step solver chains
pnpm check               # Architecture, types, tests, and dataset runtime checks
pnpm check:architecture  # Enforce module dependency rules
pnpm typecheck:core      # Strictly type-check data, math, and solver modules
pnpm typecheck           # Type-check the complete browser application
pnpm test                # Run focused Node characterization tests
pnpm validate:runtime    # Load and verify every bundled dataset
pnpm format              # Format supported files with Oxfmt
pnpm format:check        # Check formatting without modifying files
pnpm verify              # Complete release and GitHub Pages build gate
pnpm preview             # Preview dist/
pnpm zip                 # Package current working-tree files on Windows
```

## Architecture

The TypeScript source is intentionally consolidated into cohesive feature modules rather than many small files:

- `src/data.ts` — dataset contracts, validation, search, and location helpers
- `src/math.ts` — exact rational/matrix arithmetic and numeric formatting
- `src/solver.ts` — solver contracts, cycles, totals, and simplex orchestration
- `src/factory.ts` — calculator state facade and factory policies
- `src/planning.ts` — quality, freshness, transport, capacity, pollution, power, and heat calculations
- `src/models.ts` — runtime buildings, modules, belts, fuel, planets, and groups
- `src/recipes.ts` — item/recipe models and recipe policy/query logic
- `src/priorities.ts` — resource-priority model, policy, and editor
- `src/state.ts` — browser/application settings and event actions
- `src/presentation.ts` — icons, tooltips, and dropdown primitives
- `src/settings.ts`, `src/results.ts`, `src/ui.ts` — settings, results, and target DOM
- `src/graph.ts`, `src/visualization.ts` — Sankey/graph implementation and rendering
- `src/url-state.ts` — URL history and fragment serialization
- `src/app.ts`, `src/main.ts` — composition root and browser entry point

Start with [AGENTS.md](AGENTS.md), [src/README.md](src/README.md), [docs/architecture.md](docs/architecture.md), and the [player-focused roadmap](docs/player-roadmap.md).

## GitHub Pages

`.github/workflows/pages.yml` installs the frozen pnpm dependency graph, runs `pnpm verify`, and deploys the generated `dist/` directory when `master` changes.

Vite uses relative production paths, so the output works at the GitHub project URL and in local previews.

## Updating the Factorio dataset

`scripts/build_factorio_dataset.py` generates the Space Age calculator dataset and sprite sheet from Factorio's official exports.

Create an isolated Factorio export with only these official mods enabled:

- Base
- Elevated Rails
- Quality
- Recycler
- Space Age

Run:

```text
--dump-data
--dump-prototype-locale
--dump-icon-sprites
```

Then:

```bash
python -m pip install Pillow
python scripts/build_factorio_dataset.py /path/to/factorio-export
```

The builder writes:

- `public/data/space-age-2.1.12.json`
- `public/images/sprite-sheet-<hash>.png`
- `build-reports/space-age-2.1.12.json`

Raw JSON is validated by `parseCalculatorData()` in `src/data.ts` before runtime objects are created. Do not manually treat generated JSON as the source of truth.

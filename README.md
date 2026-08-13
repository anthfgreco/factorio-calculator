# Factorio Calculator

A browser calculator for Factorio.

This fork supports experimental **Factorio Space Age 2.1.14** using the unchanged 2.1.13 prototype data.

## Player-facing behavior

- Exact rational production-chain solving with multiple simultaneous outputs and alternate recipes.
- Factorio 2.1 recipe categories, combined result probabilities, recycling, surface conditions, machines, modules, beacons, and per-product productivity eligibility.
- Gleba growth-time and agricultural-tower sizing, seed flows, spoilage/freshness reporting, effective agricultural-science throughput, and exact harvest-plus-tower spores.
- Planet-aware quality planning with recursive local intermediates on Nauvis and a curated Vulcanus workflow from lava and calcite through molten-metal casting, tiered crafting, real recycler loops, imports, machinery, power, and unavoidable outputs.
- Recipe assignment to Nauvis, Vulcanus, Fulgora, Gleba, Aquilo, or Space platforms, with row-level locations and compact cross-location flow accounting.
- Configurable pumpjack/resource yield and asteroid-chunk collection capacities.
- Surface-aware pollution, configured beacon-equivalent electricity, and Aquilo production heat.
- Space Age rocket-silo throughput with 50-part rockets, buffered launch overlap, launches per selected interval, and visible launch-animation bottlenecks.
- Item-aware belt stacking with automatic big-drill detection, stack throughput, buffers, and cargo-wagon loads.
- Progression presets that set the quality ceiling and belt-stacking research.
- Directly labeled Factory rows, in-row recipe/building/location selection, searchable settings, persistent URL state, and a one-click plan link.

## Current model boundaries

The ordinary factory solver still balances scalar item rates. A newly selected non-Normal target automatically uses the active planet and the shared Quality factory gear profile. Nauvis and other ordinary planet plans recursively expand local recipes and quality-qualified intermediates down to resources and qualityless fluids; eligible crafts below the requested tier use the configured quality modules, while requested-tier crafts use the configured productivity modules. Vulcanus uses the same exact graph with curated lava, calcite, molten-metal casting, downstream crafting, and generated recycler routes. Non-local materials remain explicit imports. Legacy one-pass quality links retain their direct probability calculation. Quality targets are currently solved independently, so separate targets do not share higher-quality intermediate pools. Location assignments and transport remain explicit accounting rather than route-capacity constraints inside the LP.

Agricultural tower electricity remains a conservative active-load value because planting/harvesting duty timing is absent from the export. Spore totals are exact for the planned harvest rate and placed tower count. Rocket launch timing uses the selected silo quality from Normal through Legendary. Asteroid caps identify infeasible collection demand without re-optimizing recipe choices. Aquilo heating covers production machines and configured beacon equivalents; layout-dependent logistics entities remain outside the graph.

See [Advanced Space Age planning](docs/advanced-planning.md) for calculation details and limitations.

## Live site

https://anthfgreco.github.io/factorio-calculator/

## Development

Requirements:

- Node.js 22.22.3
- pnpm 11
- Python 3 and Pillow only when rebuilding Factorio datasets

```bash
pnpm install
pnpm dev
```

## Commands

```bash
pnpm dev                 # Start Vite
pnpm run doctor          # Validate Node, pnpm, lockfile, datasets, and required tools
pnpm check:quick         # ~5s architecture, type-debt, and global strict TypeScript lane
pnpm test:core           # ~3s exact solver and named Factorio scenarios
pnpm test:ui             # Store, URL, state, and interface behavior
pnpm test:e2e            # ~20s Playwright Chromium workflows
pnpm test:e2e:ui         # Interactive Playwright runner
pnpm bench               # Report exact 500- and 1,000-step solver medians
pnpm bench:check         # Enforce conservative solver performance budgets
pnpm validate:runtime    # Load and verify every bundled dataset
pnpm build:site          # Build the Vite site
pnpm validate:build      # Validate dist/ and bundle budgets
pnpm format              # Format supported files with Oxfmt
pnpm format:check        # Check formatting without modifying files
pnpm verify              # Complete release gate
pnpm preview             # Preview dist/
pnpm zip                 # Package current working-tree files on Windows
```

## Architecture

The codebase is organized around strict ownership boundaries rather than a framework-wide rewrite:

- `src/application/` — typed snapshots, value commands, store lifecycle, and browser ports
- `src/data.ts` — external dataset contracts, runtime validation, search, and location helpers
- `src/math.ts` — exact rational/matrix arithmetic and formatting
- `src/solver.ts`, `src/solver/` — exact solver implementation, structural contracts, and typed failures
- `src/planning.ts`, `src/planning/` — deterministic Space Age planning reports and contracts
- `src/quality/` — exact quality transitions, automatic selected-planet planning, real recycler disposal, and quality-qualified flow graphs
- `src/factory.ts` — calculator facade, machine/location policy, solver adaptation, and renderer port
- `src/models.ts`, `src/models/` — buildings, modules, belts, fuel, planets, item groups, and research factories
- `src/recipes.ts` — item/recipe models and recipe policy
- `src/state.ts` — value operations plus compatibility adapters for remaining imperative controls
- `src/url/`, `src/url-state.ts` — pure fragment codec, injected history, and compatibility serialization
- `src/results.ts`, `src/results/` — high-volume results renderer plus pure grouping/summary logic
- `src/settings.ts`, `src/settings/`, `src/ui.ts` — dynamic settings and target rendering
- `src/graph.ts`, `src/graph/`, `src/visualization.ts` — deferred graph/Sankey runtime
- `src/main.tsx`, `src/react/` — React 19.2.8 shell subscribed through `useSyncExternalStore`
- `src/app.ts` — browser composition and dataset bootstrap

Start with [AGENTS.md](AGENTS.md), [docs/architecture.md](docs/architecture.md), [docs/testing.md](docs/testing.md), and [docs/change-guide.md](docs/change-guide.md). Complex work is tracked in [PLANS.md](PLANS.md).

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

On Windows, the tracked helper performs the isolated export, preserves the existing `script-output` directory, and
creates `factorio-2.1.13-space-age-dump.zip`. Extract it and pass the resulting directory to the builder:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\dump-factorio-space-age.ps1
Expand-Archive -LiteralPath factorio-2.1.13-space-age-dump.zip -DestinationPath .tmp\factorio-2.1.13-export -Force
python scripts\build_factorio_dataset.py .tmp\factorio-2.1.13-export
```

For a manual export, run Factorio once for each command:

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

- `public/data/space-age-2.1.13.json`
- `public/images/sprite-sheet-<hash>.png` and lossless `.webp` runtime copies
- `build-reports/space-age-2.1.13.json`

Raw JSON is validated by `parseCalculatorData()` in `src/data.ts` before runtime objects are created. Do not manually treat generated JSON as the source of truth.

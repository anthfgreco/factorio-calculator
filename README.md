# Factorio Calculator

A browser calculator for Factorio.

This fork includes experimental **Factorio Space Age 2.1.12** data.

## Player-facing behavior

- Exact rational production-chain solving with multiple simultaneous outputs and alternate recipes.
- Factorio 2.1 recipe categories, result probabilities, recycling recipes, surface conditions, machines, modules, beacons, and built-in productivity bonuses.
- Production-location filtering for Nauvis, Vulcanus, Fulgora, Gleba, Aquilo, and Space platforms.
- A compact factory summary with machines to place, machine power, active recipes, imports, and modeling notes.
- Directly labeled Factory rows, visible target/import state, in-row recipe selection, searchable recipe settings, URL-persistent state, and a one-click plan link.
- Relaxed and compact Factory row densities, stored as a local display preference.
- Progression presets for early game through megabase planning, plus a consolidated Help tab.
- Actionable calculation errors when a production path is unavailable or the selected recipe system is infeasible.

## Current model boundaries

The calculator deliberately keeps one shared material pool when multiple locations are selected. It reports where each active recipe can run, but it does not yet assign every recipe to a specific planet or calculate rocket capacity, platform cargo throughput, travel time, or spoilage in transit.

Quality modules are validated against recipe and machine capabilities, their quality probabilities and electricity modifiers are preserved, and they are excluded from beacons. Speed modules also retain their negative quality modifiers. The solver does not yet split outputs into normal/uncommon/rare/epic/legendary item tiers or optimize recycling-based upcycling loops. Machine power reports production-machine electricity only.

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

# Factorio Calculator

A browser-based production planner for **Factorio: Space Age 2.1.14**. Build a factory plan, choose recipes and machines, compare item flows, and share the complete setup in a URL.

## Live site

https://anthfgreco.github.io/factorio-calculator/

## Features

- Exact production rates across multiple outputs, byproducts, probabilities, catalysts, and recycling loops.
- Machines, modules, beacons, productivity research, fuel, power, pollution, heat, belts, buffers, and cargo wagons.
- Per-recipe assignment to Nauvis, Vulcanus, Fulgora, Gleba, Aquilo, or a space platform, with visible transport flows between locations.
- Planet-aware quality planning, including Fulgora scrap recycling and Vulcanus lava-to-molten-metal production.
- Gleba agriculture, seeds, spoilage, freshness, spores, and agricultural-tower sizing.
- Rocket-silo throughput, asteroid collection limits, resource yield, and belt stacking.
- Flow and recipe visualizations with labeled rates, cycle-aware Sankey layout, and Dagre-routed recipe graphs.
- Searchable settings, progression presets, persistent browser state, and shareable plan links.

## Model limits

- Quality targets are optimized independently and do not share higher-quality intermediate pools.
- Location assignments record transport demand but do not optimize route capacity.
- Agricultural-tower power uses active load because the game export does not include planting and harvesting duty timing.
- Asteroid limits report infeasible demand without selecting a different recipe automatically.
- Aquilo heat covers production machines and configured beacon equivalents, not layout-dependent logistics entities.

See [Advanced Space Age planning](docs/advanced-planning.md) for the detailed model and its assumptions.

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
pnpm check:quick         # Architecture, type-debt, and strict TypeScript checks
pnpm test:core           # Exact solver and named Factorio scenarios
pnpm test:ui             # Store, URL, state, and interface behavior
pnpm test:e2e            # Playwright Chromium workflows
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

`src/main.tsx` is the calculator and React application runtime. Ordered `// region …` markers keep its data contracts, exact math, solver, models, state, URL persistence, and interface traceable from input to render.

The visualization is the one runtime island: React owns its controls and empty SVG mount, while deferred `src/visualization.ts` owns the SVG children with D3 and Dagre. `src/vendor-sankey.js` contains the retained cycle-aware Sankey layout. HiGHS, D3, and Dagre load only when their features are opened.

Component layout stays in the inline `UI` style map. Theme values are CSS variables, and `BASE_CSS` is limited to resets, pseudo states, density variables, and responsive rules. Domain models remain framework-free and expose plain data with explicit mutations.

Tests, scripts, generated datasets, documentation, and assets remain separate. Architecture guards enforce the runtime file boundary and keep HiGHS, D3, and Dagre out of the initial bundle. See [Architecture](docs/architecture.md) and [Change guide](docs/change-guide.md).

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

Raw JSON is validated by `parseCalculatorData()` in the `data.ts` region of `src/main.tsx` before runtime objects are created. Do not manually treat generated JSON as the source of truth.

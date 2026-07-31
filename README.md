# Factorio Calculator

A browser calculator for Factorio.

This fork includes experimental **Factorio Space Age 2.1.12** data.

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
pnpm check:architecture  # Enforce layer dependency rules
pnpm typecheck:core      # Strictly type-check the pure core
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

- `src/core/` — pure exact math, solver, data contracts, and validation
- `src/application/` — calculator state, policies, queries, and bootstrap wiring
- `src/runtime/` — browser-facing models built from validated dataset records
- `src/presentation/` — shared icon, tooltip, and dropdown primitives
- `src/infrastructure/` — isolated browser adapters
- `src/ui/` — DOM interaction and rendering
- `src/visualization/` — Sankey and box-line D3/SVG rendering
- `src/shared/` — tiny cross-layer helpers

Start with [AGENTS.md](AGENTS.md) for repository-specific coding rules and [docs/architecture.md](docs/architecture.md) for the full design.

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

Raw JSON is validated by `src/core/data/parse-calculator-data.ts` before runtime objects are created. Do not manually treat generated JSON as the source of truth.

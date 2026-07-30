# Factorio Calculator

A browser calculator for Factorio.

This fork includes experimental **Factorio Space Age 2.1.12** data.

## Live site

The calculator is deployed to GitHub Pages:

https://anthfgreco.github.io/factorio-calculator/

## Development

Requirements:

- Node.js 22.13 or newer
- pnpm 11
- Python 3 with Pillow only when rebuilding Factorio datasets

Install the development dependencies and start Vite:

```bash
pnpm install
pnpm dev
```

## Commands

```bash
pnpm dev           # Start the Vite development server
pnpm typecheck     # Type-check first-party TypeScript
pnpm format        # Format supported source files with Oxfmt
pnpm format:check  # Check formatting without modifying files
pnpm build         # Type-check, build the static site, and validate the output
pnpm preview       # Preview the generated dist/ site
pnpm verify        # Run the complete build verification
```

The browser application is written in TypeScript under `src/`. 

## GitHub Pages

`.github/workflows/pages.yml` installs pnpm, builds the Vite site, validates the generated files, and deploys `dist/` whenever `master` is updated.

In the repository settings, select **Settings → Pages → Build and deployment → Source → GitHub Actions** once.

Vite uses relative production paths, so the build works both at the GitHub project URL and when previewed locally.

## Updating the Factorio dataset

`scripts/build_factorio_dataset.py` generates the Space Age calculator dataset and sprite sheet from Factorio's official exports.

Create an isolated Factorio export with only these official mods enabled:

- Base
- Elevated Rails
- Quality
- Recycler
- Space Age

Run Factorio's built-in exporters:

```text
--dump-data
--dump-prototype-locale
--dump-icon-sprites
```

Install Pillow and run the builder against the extracted export directory:

```bash
python -m pip install Pillow
python scripts/build_factorio_dataset.py /path/to/factorio-export
```

The builder validates the game version, enabled mods, recipe references, crafting categories, and generated outputs. It writes:

- `public/data/space-age-2.1.12.json`
- `public/images/sprite-sheet-<hash>.png`
- `build-reports/space-age-2.1.12.json`

Files under `public/` are copied unchanged into the Vite production build. The build report is retained in the repository but is not published with the site.

## Repository layout

- `src/` — first-party TypeScript, CSS, and the vendored Sankey implementation
- `public/data/` — browser-ready Factorio datasets
- `public/images/` — generated sprite sheets and interface images
- `public/third_party/` — pinned browser runtime dependencies retained for compatibility
- `public/docs/` and `public/posts/` — calculator documentation and technical background
- `scripts/build_factorio_dataset.py` — reproducible Factorio 2.1.12 dataset builder
- `scripts/validate-build.mjs` — production-build integrity checks
- `calc.html` — Vite calculator entry page
- `index.html` — redirect to the calculator entry page

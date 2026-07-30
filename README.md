# Factorio Calculator

A browser-based calculator for Factorio production ratios and resource requirements. This repository is a maintained fork of Kirk McDonald's original calculator and currently includes experimental **Factorio Space Age 2.1.12** data.

## Live site

The calculator is hosted on GitHub Pages:

https://anthfgreco.github.io/factorio-calculator/


## Running locally

The application consists entirely of static HTML, JavaScript, CSS, JSON, and image files. 
Run any local HTTP server from the repository root.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Updating the Factorio dataset

`build_factorio_dataset.py` generates the Space Age calculator dataset and sprite sheet from Factorio's official exports.

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
python build_factorio_dataset.py /path/to/factorio-export
```

The builder validates the game version, enabled mods, recipe references, crafting categories, and generated outputs. It writes:

- `data/space-age-2.1.12.json`
- `data/space-age-2.1.12-build-report.json`
- `images/sprite-sheet-<hash>.png`

## Repository layout

- `calc.html` — calculator application
- `data/` — browser-ready Factorio datasets
- `images/` — sprite sheets and interface images
- `build_factorio_dataset.py` — reproducible 2.1.12 dataset builder
- `docs/` and `posts/` — calculator documentation and technical background

# Factorio Calculator

This is the repostory for the [Factorio Calculator](https://kirkmcdonald.github.io/calc.html), a tool for calculating resource requirements and production ratios in the game [Factorio](https://factorio.com/).

## Running locally

The calculator consists entirely of static files (HTML, JS, CSS), and may be run locally using any HTTP server. If you have Python 3 installed, you can start a simple development server on port 8000 with:

```text
$ python3 -m http.server 8000
```

An experimental standalone version of the calculator named `factoriocalc`, which will automatically obtain the game data from your locally installed mods, is also available from the [factorio-tools](https://github.com/KirkMcDonald/factorio-tools) repository. A Windows build is available from [the project's releases page](https://github.com/KirkMcDonald/factorio-tools/releases).

## Dumping new datasets

The utility for dumping datasets from the game, as well as assembling the sprite sheets, is called `factoriodump`, and may be found in the [factorio-tools](https://github.com/KirkMcDonald/factorio-tools) repository.

The repository also includes a reproducible builder for the experimental
Factorio 2.1.12 Space Age dataset. It consumes the files created by Factorio's
built-in `--dump-data`, `--dump-prototype-locale`, and `--dump-icon-sprites`
commands:

Install the one Python dependency, then run the builder:

```text
$ python3 -m pip install Pillow
$ python3 build_factorio_dataset.py /path/to/extracted/factorio-export
```

The export must contain only Base, Elevated Rails, Quality, Recycler, and Space
Age. The builder validates the loaded game version, enabled mods, recipe
references, and machine categories, then writes `data/space-age-2.1.12.json`,
its sprite sheet, and a build report.

## Support the calculator

Please consider donating to [my Patreon campaign](https://www.patreon.com/kirkmcdonald). Any amount helps. And thank you!

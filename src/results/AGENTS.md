# Result Rendering Rules

- Pure grouping and summary calculations belong in focused modules under this directory.
- `results.ts` owns high-volume DOM rendering and may consume pure view models, but must not become the source of calculation truth.
- Preserve stable row keys, D3 update behavior, exact formatting, machine/module controls, and launch-limited indicators.
- Avoid full-table rebuilds, repeated graph scans, and React migration without measured benefit.

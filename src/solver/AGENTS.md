# Solver Rules

- Keep contracts structural and browser-independent.
- Preserve exact `Rational` arithmetic and sparse/cycle behavior.
- Productivity applies only to eligible product amounts; returned catalysts and containers are not multiplied.
- Fuel-consumer edges, disable recipes, priorities, and surplus/output recipes are part of the graph invariant.
- Add the smallest named scenario before changing equations or graph construction.
- Run `pnpm test:core`, `pnpm bench:check`, `pnpm validate:runtime`, and `pnpm verify`.

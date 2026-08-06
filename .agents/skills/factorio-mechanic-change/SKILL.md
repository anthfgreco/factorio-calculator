---
name: factorio-mechanic-change
description: Change or add a Factorio 2.1 or Space Age mechanic using project sources, generated data, exact scenarios, and full validation.
---

# Factorio mechanic change

1. Search `factorio-wiki.md` for the exact mechanic and edition.
2. Inspect the validated dataset contract and relevant generated prototype data.
3. Decide whether ownership is data schema, generator, runtime model, solver, planning, or presentation.
4. Change the narrowest owning layer. Never patch generated values as the source of truth.
5. Add a named scenario under `tests/scenarios/` using exact `Rational` expectations.
6. Regenerate data/assets when the source schema or exporter changes.
7. Run `pnpm check:quick`, the focused scenario, `pnpm test:core`, `pnpm validate:runtime`, and `pnpm verify`.
8. Report the source evidence, equation or policy changed, generated outputs, and exact validation.

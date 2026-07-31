# Change Guide

## Add or change calculator behavior

1. Write a failing characterization test or runtime assertion.
2. Put deterministic calculations in `src/core/`.
3. Put selection, location, priority, or state policy in `src/application/`.
4. Keep rendering changes in `src/ui/` or `src/visualization/`.
5. Run `pnpm check`.

## Add a new dataset field

1. Update `src/core/data/types.ts`.
2. Validate and normalize it in `src/core/data/parse-calculator-data.ts`.
3. Consume it in `src/runtime/` or `src/core/` as appropriate.
4. Update `scripts/build_factorio_dataset.py` when the field comes from Factorio prototypes.
5. Add a parser test and run every bundled dataset through `pnpm validate:runtime`.

## Fix a recipe or Factorio-version issue

Do not patch `public/data/space-age-2.1.12.json` as the source of truth.

1. Verify the official prototype export.
2. Update `scripts/build_factorio_dataset.py` or the schema handling.
3. Regenerate the dataset and sprite sheet.
4. Review the build report.
5. Run `pnpm verify`.

## Add a UI control

1. Reuse an application method/policy; do not place business rules in the event handler.
2. Keep DOM creation in a focused `src/ui/<feature>/` module.
3. Persist through existing state/fragment mechanisms where applicable.
4. Add a runtime test for the underlying behavior; add a browser smoke test only when layout or browser interaction is central.

## Change solver behavior

1. Add a small exact test under `tests/`.
2. Change only `src/core/solver/` or `src/core/math/` unless model conversion is required.
3. Preserve exact `Rational` arithmetic.
4. Run strict core type checking and all dataset validation.

## Decide between `updateSolution()` and `display()`

Use `updateSolution()` when a change can alter recipe rates, selected recipes, ingredients, outputs, or the solution graph.

Use `display()` when the solution ratios remain valid and only presentation/building counts change.

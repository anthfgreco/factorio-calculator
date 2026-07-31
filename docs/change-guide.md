# Change Guide

## Add or change calculator behavior

1. Write a failing characterization test or runtime assertion.
2. Put exact calculations in `src/math.ts` or `src/solver.ts`.
3. Put recipe/item policy in `src/recipes.ts`; put factory/location/building policy in `src/factory.ts`.
4. Keep DOM changes in `src/settings.ts`, `src/results.ts`, `src/ui.ts`, `src/graph.ts`, or `src/visualization.ts`.
5. Run `pnpm check`.

## Add a new dataset field

1. Update the dataset interfaces in `src/data.ts`.
2. Validate and normalize the field in `parseCalculatorData()`.
3. Consume it in `src/models.ts`, `src/recipes.ts`, or a deterministic module as appropriate.
4. Update `scripts/build_factorio_dataset.py` when the field comes from Factorio prototypes.
5. Add a parser test and run every bundled dataset through `pnpm validate:runtime`.

## Fix a recipe or Factorio-version issue

Do not patch `public/data/space-age-2.1.12.json` as the source of truth.

1. Verify the official prototype export.
2. Update `scripts/build_factorio_dataset.py` or schema handling in `src/data.ts`.
3. Regenerate the dataset and sprite sheet.
4. Review the build report.
5. Run `pnpm verify`.

## Add a UI control

1. Reuse a factory, recipe, or priority operation; do not place business rules in the event handler.
2. Put settings controls in `settings.ts`, result controls in `results.ts`, and target controls in `ui.ts`.
3. Persist through `state.ts` and `url-state.ts` where applicable.
4. Add a runtime test for the underlying behavior; add a browser smoke test only when layout or browser interaction is central.

## Change solver behavior

1. Add a small exact test under `tests/`.
2. Change `src/solver.ts` or `src/math.ts` unless runtime-to-solver conversion in `src/factory.ts` is required.
3. Preserve exact `Rational` arithmetic.
4. Run strict deterministic-module type checking and all-dataset validation.

## Decide between `updateSolution()` and `display()`

Use `updateSolution()` when a change can alter recipe rates, selected recipes, ingredients, outputs, or the solution graph.

Use `display()` when the solution ratios remain valid and only presentation or building counts change.

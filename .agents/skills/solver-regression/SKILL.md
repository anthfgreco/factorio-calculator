---
name: solver-regression
description: Reproduce and fix an exact solver regression while preserving productivity, catalyst, probability, cycle, priority, and fuel invariants.
---

# Solver regression

1. Reduce the report to the smallest item/recipe graph that still fails.
2. Add the failing exact test before changing implementation.
3. Inspect graph construction, cycle handling, output/surplus recipes, priorities, fuel edges, and per-product productivity eligibility.
4. Confirm whether the bug is in runtime-to-solver adaptation (`factory.ts`) or the pure solver.
5. Fix the narrowest owning layer without converting rational values to floating point.
6. Run the focused test, `pnpm test:core`, `pnpm bench:check`, `pnpm validate:runtime`, and `pnpm verify`.
7. Report the minimized graph, broken invariant, equation change, and benchmark result.

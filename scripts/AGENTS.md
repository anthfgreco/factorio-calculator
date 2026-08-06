# Script Rules

- Scripts must be deterministic, non-interactive in CI, and emit actionable failures.
- Prefer Node standard-library implementations over new dependencies.
- Temporary files belong under `.tmp/` and must be removed in `finally` blocks.
- Generated-data scripts update sources and generated outputs together; never normalize away meaningful Factorio differences.
- Validation scripts should print measured values and limits.
- Do not add pull-request CI; the existing deployment workflow remains the automation entry point.

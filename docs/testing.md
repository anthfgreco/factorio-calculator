# Testing and Verification

The repository uses Node's built-in test runner and purpose-built validation scripts. This keeps tests fast, transparent, and easy to execute in minimal agent environments.

## Test levels

### Unit and characterization tests

```bash
pnpm test
```

`scripts/run-tests.mjs` emits TypeScript into `.tmp/tests` and runs `tests/*.test.mjs`.

### Strict deterministic-module type checking

```bash
pnpm typecheck:core
```

This checks `data.ts`, `math.ts`, and `solver.ts` with stricter null, property, `this`, and implicit-any settings than the browser-facing modules.

### Full source type checking

```bash
pnpm typecheck
```

### Architecture checking

```bash
pnpm check:architecture
```

### Dataset/runtime validation

```bash
pnpm validate:runtime
```

This loads all bundled datasets through emitted TypeScript and checks important application invariants.

### Release verification

```bash
pnpm verify
```

This runs all checks, builds the Vite site, and validates `dist/`.

## What to test

Prefer a few high-signal tests:

- exact solver/math results
- dataset rejection paths
- recipe/location/machine/module/beacon eligibility
- typed solver failures and impossible-plan diagnostics
- state serialization round trips
- regressions reported by users

Avoid snapshotting large generated datasets or entire DOM trees.

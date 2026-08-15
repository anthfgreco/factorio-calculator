# ADR 0005: Deferred optional visualization engines

## Context

The default workflow is the Factory totals view. Dagre layout and HiGHS WASM add startup work but are unnecessary until a user opens Visualize or runs a quality optimization that needs them. The runtime itself is now one authored source file, so first-party graph functions cannot be split without reintroducing modules.

## Decision

Keep `@dagrejs/dagre`, `highs`, and `highs/runtime?url` behind dynamic imports. Do not preload them on idle timers. Graph and visualization code may remain as regions of `src/main.tsx`; the expensive external engines must stay outside the initial static dependency closure.

## Consequences

The emitted Rollup module graph and build-budget validator enforce dependency chunk separation, while Playwright verifies graph rendering. New optional native or layout engines must follow the same pattern.

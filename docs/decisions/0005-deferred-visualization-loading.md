# ADR 0005: Deferred visualization loading

## Context

The default workflow is the factory totals view. D3 graph layout and Dagre increase startup work but are unnecessary until the user opens Visualize.

## Decision

Load `visualization.ts`, `graph.ts`, and layout dependencies only in response to opening the visualization tab. Do not preload them on idle timers.

## Consequences

The emitted Rollup module graph enforces chunk separation, while the Playwright Chromium workflow verifies graph rendering. New graph dependencies must remain behind the dynamic import.

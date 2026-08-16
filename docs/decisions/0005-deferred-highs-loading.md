# ADR 0005: Defer the HiGHS optimizer

## Context

Ordinary factory calculations and the React SVG graph do not need the HiGHS WASM optimizer. Loading it on startup would add cost to every visit.

## Decision

Keep `highs` and `highs/runtime?url` behind dynamic imports and load them only when quality optimization requires the LP engine. Do not preload them on idle timers.

## Consequences

The build-budget validator requires HiGHS in a reachable deferred chunk and rejects it from the initial calculator closure. New optional native engines must follow the same rule.

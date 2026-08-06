# ADR 0006: Single typed application-state boundary

## Context

The pre-migration UI mixed mutable runtime state, DOM values, global objects, and React event forwarding. This made ownership and subscriptions unclear.

## Decision

Expose calculator state to React through `CalculatorStore`, immutable `CalculatorSnapshot` values, and typed value commands. `FactorySpecification` remains the calculation/runtime authority; the store adapts it rather than duplicating policy.

## Consequences

React uses `useSyncExternalStore`. New shell controls call commands instead of passing events. DOM reads are compatibility adapters only, not authoritative state. Lifecycle and stale asynchronous loads are testable.

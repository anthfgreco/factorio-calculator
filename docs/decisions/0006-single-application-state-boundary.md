# ADR 0006: Single typed application-state boundary

## Context

The pre-migration UI mixed mutable runtime state, DOM values, global objects, and React event forwarding. This made ownership and subscriptions unclear.

## Decision

Expose calculator state to React through `CalculatorStore`, immutable `CalculatorSnapshot` values, and typed value commands. `FactorySpecification` remains the calculation/runtime authority; the store adapts it rather than duplicating policy.

## Consequences

React uses `useSyncExternalStore`. UI controls pass typed values or call explicit model mutations rather than forwarding browser events. React local state is disposable view state, and rendered DOM is never authoritative. Lifecycle and stale asynchronous loads are testable.

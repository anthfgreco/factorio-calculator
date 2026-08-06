# Application Boundary Rules

- `contracts.ts` contains framework-independent snapshots, commands, discriminated states, and ports only.
- `store.ts` adapts existing runtime state into immutable snapshots and value commands. It must not render DOM.
- Keep one stable snapshot object per revision so `useSyncExternalStore` semantics remain correct.
- Subscribe and unsubscribe deterministically; startup and disposal must be idempotent.
- Commands accept validated values, not browser `Event` objects.
- Do not duplicate calculator policy in the store. Delegate to `FactorySpecification` or value operations in `state.ts`.
- Add direct store tests for revision, lifecycle, command delegation, stale loads, and errors.

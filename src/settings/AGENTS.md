# Settings Rules

- Extract pure parsing/conversion policy into focused modules; keep DOM construction in `settings.ts`.
- Settings mutate calculator state through explicit `FactorySpecification` or state operations and must trigger the correct `updateSolution()` versus `display()` path.
- Preserve fragment compatibility and deferred recipe/resource rendering.
- Do not make DOM values authoritative when the store/specification already owns the value.

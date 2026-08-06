# React Shell Rules

Read the root `AGENTS.md` first.

- Keep components functional, strictly typed, named-exported, and driven by `CalculatorSnapshot` plus `CalculatorCommands`.
- Application policy stays outside JSX. Add a typed command or snapshot field instead of importing `state.ts`, `factory.ts`, or runtime models into lower components.
- `CalculatorApp.tsx` is the runtime bridge. Lower components must not call `init()`, `dispose()`, or browser composition directly.
- Preserve imperative mount-point IDs unless every consumer and behavioral test migrates in the same change.
- Treat imperative-owned mount points as opaque. React may create the container but must not manage its children.
- Controlled inputs are appropriate for snapshot-owned values. Inputs still owned by imperative modules remain uncontrolled and must not be overwritten on React rerender.
- New controls use value commands; do not reintroduce synthetic-to-native event forwarding.
- Include accessible labels, keyboard behavior, URL/state persistence, and focused UI or E2E coverage.
- Do not add global handlers, inline HTML events, a state library, or one-off abstraction layers.
- Run `pnpm check:quick`, `pnpm test:ui`, `pnpm test:e2e`, and `pnpm verify` for shell changes.

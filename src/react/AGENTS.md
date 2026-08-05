# React Shell Rules

This directory is the React 19.2.8 application shell. Read the root `AGENTS.md` first.

- Keep components functional, typed, and named-exported.
- Keep application policy out of JSX. React callbacks call operations from `state.ts`; policy remains in deterministic/runtime modules.
- Preserve every legacy mount-point `id` unless all consumers and tests are migrated together.
- Treat nodes populated by D3 or imperative modules as opaque. React may create the container but must not manage its children after startup.
- Use uncontrolled form elements when runtime code reads or writes their DOM value.
- Forward React synthetic events through `forwardNativeEvent()` when calling legacy handlers.
- Do not add global handlers, inline HTML event attributes, context, state libraries, or a component abstraction for one-off markup.
- Split components by stable responsibility, not line count.
- For a new React-owned control, include its accessibility label, runtime persistence path, and a focused interface/runtime test.
- Run `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm verify` after shell changes.

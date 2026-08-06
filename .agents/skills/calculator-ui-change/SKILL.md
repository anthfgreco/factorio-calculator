---
name: calculator-ui-change
description: Modify calculator UI while preserving the React/store/imperative-renderer boundary, URL state, accessibility, mobile behavior, and startup performance.
---

# Calculator UI change

1. Identify whether React or an imperative renderer owns every affected node.
2. Preserve stable mount-point IDs and avoid React children inside imperative-owned containers.
3. Put policy in the owning runtime module and expose a typed value command/snapshot field when React needs it.
4. Add accessible labels, keyboard behavior, and persistence where applicable.
5. Add focused store/UI behavior coverage; add or extend E2E only for critical browser interaction or layout.
6. Confirm graph/layout code remains deferred and selectors remain lazy.
7. Run `pnpm check:quick`, `pnpm test:ui`, `pnpm test:e2e`, build budgets, and `pnpm verify`.
8. Report ownership decisions, user-visible behavior, persistence, accessibility, and performance validation.

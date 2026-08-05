# Execution Plans

Use an execution plan for changes that span multiple modules, alter architecture or persisted behavior, or require more than one validation loop. Keep the plan in the task description or a temporary working note; do not create permanent per-task files unless requested.

## Template

### Goal

State the user-visible outcome in one or two sentences.

### Context and constraints

List the owning modules, relevant evidence, compatibility requirements, and explicit non-goals.

### Done when

List observable completion criteria, including tests and release checks.

### Steps

1. Reproduce or characterize current behavior.
2. Make the smallest architectural change that supports the goal.
3. Implement the behavior and focused tests.
4. Run targeted checks, then `corepack pnpm verify`.
5. Review the diff for regressions and update documentation only where behavior or ownership changed.

### Decision log

Record only decisions that a later agent would otherwise have to rediscover: alternatives rejected, compatibility tradeoffs, and unresolved follow-ups.

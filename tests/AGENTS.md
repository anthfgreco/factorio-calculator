# Test Rules

- Test public behavior and exact Factorio invariants, not source-code strings or private implementation layout.
- Put solver mechanics in `tests/scenarios/` with descriptive names and exact `Rational` assertions.
- Put application/store behavior in `tests/ui/`; URL codec/history behavior in `tests/url-state.test.mjs` or focused URL files.
- Keep source inspection only for true static constraints such as forbidden imports, inline handlers, and eager visualization loading.
- Use minimal fixture builders; do not load full datasets when a tiny graph expresses the invariant.
- Browser tests cover only critical workflows and must report the state they timed out on.

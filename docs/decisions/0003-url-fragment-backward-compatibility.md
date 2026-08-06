# ADR 0003: URL fragment backward compatibility

## Context

Shared calculator links are persisted user data. Existing fragments include legacy parameter names, deterministic set-like values, explicit empty module slots, and optional compression.

## Decision

Keep the existing fragment format readable and semantically equivalent. Isolate pure codec behavior from browser history and runtime model adaptation.

## Consequences

Format changes require explicit approval, old-link fixtures, round-trip tests, malformed-input behavior, and a migration path. Refactors may move code but may not silently rewrite meaning.

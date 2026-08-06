# ADR 0004: Generated Factorio data

## Context

Prototype values, recipes, technologies, sprite coordinates, and hashes are generated from Factorio exports. Manual output edits are difficult to reproduce and can desynchronize datasets and sprite assets.

## Decision

Treat generator/schema code as the source of truth. Commit generator and generated-output changes together and validate every bundled dataset through `parseCalculatorData()`.

## Consequences

Do not hand-edit generated values. Version updates must include semantic review, runtime validation, and paired PNG/WebP sprite handling.

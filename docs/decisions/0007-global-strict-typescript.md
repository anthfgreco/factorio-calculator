# ADR 0007: Global strict TypeScript

## Context

Partial strictness left nullable runtime paths, graph data, and application boundaries implicit. Agents could not rely on the compiler to expose incorrect assumptions.

## Decision

Enable strict TypeScript globally, including unchecked-index and exact-optional-property checks. Keep a structural type-debt check that rejects explicit `any`, suppression comments, and unsafe double assertions.

## Consequences

Unsafe external values are narrowed at JSON, URL, browser, and solver boundaries. New code must model absence explicitly rather than suppressing errors. The release gate includes full strict type checking.

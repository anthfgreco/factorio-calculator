# ADR 0001: Exact rational arithmetic

## Context

Factory rates, probabilities, productivity, matrix operations, and URL-visible values can accumulate error when represented as floating point.

## Decision

Use `Rational` values throughout calculation, solving, planning, and state persistence. Convert to decimal text only at presentation or validated external-data boundaries.

## Consequences

Solver and planning changes must preserve exact operations. Performance work should optimize rational fast paths rather than replacing equations with floating point. Tests assert exact values whenever possible.

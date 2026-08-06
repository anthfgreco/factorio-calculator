# ADR 0002: React and imperative renderer boundary

## Context

The calculator has mature D3 renderers for dynamic targets, large tables, selectors, tooltips, and graphs. Rewriting them during the React migration would combine framework, behavior, and performance risk.

## Decision

React owns the stable page shell, accessible relationships, snapshot-owned controls, and mount-point containers. Imperative modules own children inside their documented mount points.

## Consequences

React must preserve mount-point identity across rerenders. Imperative modules must not mutate React-owned siblings or controlled inputs. Renderer migration is feature-specific and requires behavioral and performance evidence.

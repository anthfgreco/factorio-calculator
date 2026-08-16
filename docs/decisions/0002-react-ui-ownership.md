# ADR 0002: React owns the application UI

## Context

Split ownership between React and imperative DOM renderers made behavior difficult to trace, duplicated state boundaries, and required selector-driven integration.

## Decision

React owns every application DOM and SVG node below `#root`. Domain models expose plain data and explicit mutations. The graph derives plain nodes and links, then renders them in JSX.

## Consequences

Manual DOM construction, D3 chains, Tippy, mount-point adapters, and authoritative DOM reads are forbidden. React local state remains disposable view state; `FactorySpecification` remains authoritative.

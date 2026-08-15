# Monolithic Source

`src/main.tsx` is the calculator's one authoritative runtime file. The old module names survive only as `// region …` markers, so symbol search still exposes clear ownership without forcing agents to traverse dozens of imports.

The file is ordered from the most deterministic foundation to the browser entry point:

```text
data → exact math → solver → models/recipes → quality/planning
→ factory/state/store → settings/URL → results/UI
→ optional graph and HiGHS adapters → app → React → mount
```

Add behavior to the owning region. Do not create another TypeScript, TSX, JavaScript, JSX, or CSS source file. A new region inside `main.tsx` is the approved escape hatch when an existing region is genuinely the wrong owner.

`vendor-sankey.js` is the sole exception. It contains the locally patched Sankey implementation and remains separate for third-party provenance. Generated datasets and static assets remain under `public/`; tests and scripts remain in their own directories.

Dagre and HiGHS are dynamically imported. Keep those dependencies off the startup path. The calculator stylesheet is embedded in `main.tsx`, while Tippy's package stylesheet is loaded when the browser app mounts.

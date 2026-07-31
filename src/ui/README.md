# UI

DOM interaction and rendering adapters. UI modules may read application state and issue application operations, but must not implement calculator mathematics or dataset rules.

Split features into focused folders and keep D3 use limited to DOM/SVG work.

Shared icons, tooltips, and dropdown primitives belong in `src/presentation/`, not in a feature UI folder.

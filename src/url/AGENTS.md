# URL State Rules

- `codec.ts` is pure and receives compression/base64 capabilities through explicit inputs.
- `history.ts` receives location/history ports; it must be directly testable without browser globals.
- `url-state.ts` owns compatibility with the existing fragment format and bridges runtime models.
- Preserve parameter names, empty module-slot placeholders, deterministic set ordering, compression heuristics, and old uncompressed fragments.
- Malformed input must fail safely without partially applying stale state.
- Every format change requires round-trip, malformed-input, and backward-compatibility tests.

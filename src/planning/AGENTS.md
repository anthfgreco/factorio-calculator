# Planning Rules

- Planning is a deterministic layer over targets and solved totals; it does not mutate DOM or runtime models.
- Keep location assignment, quality multipliers, freshness, capacity, pollution, logistics, rocket, and heat reports explicit and independently testable.
- Do not move route capacity or quality-qualified optimization into the scalar solver accidentally; those require deliberate graph-model changes.
- Add a named scenario for every Factorio mechanic change.

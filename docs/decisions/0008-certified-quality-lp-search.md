# ADR 0008: Certified quality LP search

## Context

Recursive quality plans create a sparse material-balance graph but the shared exact simplex expands it into a dense Rational tableau. The Vulcanus Legendary Mech-armor fixture spends almost all of its calculation time pivoting and normalizing that tableau, while graph construction and result reporting are small.

## Decision

Keep Rational graph coefficients and the existing weighted objective as the canonical problem. For automatic quality plans only, lazily load HiGHS in WebAssembly and use a Float64 LP to search for an optimal basis. Reconstruct the candidate basis from the original Rational coefficients with fraction-free elimination, then require exact primal feasibility, dual feasibility, nonnegative reduced costs, and equal primal/dual objective values. Reject any candidate that fails and run the existing exact simplex.

Cache at most eight certified unit-rate solutions by their complete mathematical model signature. Scale only the certified operation rates; capacity, power, disposal, and reporting are recalculated for the requested rate.

## Consequences

Normal plans retain the existing synchronous solver and do not download the HiGHS JavaScript or WASM assets. A first automatic quality calculation pays the deferred WASM load; repeated compatible rate changes avoid another optimization. Numerical behavior can affect which candidate basis is proposed but cannot make an approximate result authoritative. Degenerate exact optima can select a different cost-equivalent operation split, while imports, material balance, and the exact objective remain unchanged.

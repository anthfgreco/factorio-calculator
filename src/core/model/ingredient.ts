/**
 * A normalized item amount used by recipes and solver graph edges.
 *
 * The core intentionally keeps `item` generic: the solver only relies on
 * stable item identity, while the browser domain layer supplies the concrete
 * item model.
 */
export class Ingredient<TItem = unknown, TAmount = unknown> {
  constructor(
    public readonly item: TItem,
    public readonly amount: TAmount,
    public readonly productivityAmount: TAmount | null = null,
  ) {}
}

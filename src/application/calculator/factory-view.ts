/**
 * Browser-facing operations required by the calculator application model.
 *
 * The application layer depends on this port, not on D3 or concrete DOM
 * renderers. Headless tests omit the port entirely.
 */
export interface FactoryViewPort {
  createBuildTarget(index: number, itemKey: string, item: unknown, itemGroups: unknown): any
  mountBuildTarget(target: any): void
  removeBuildTarget(target: any): void
  renderSolution(specification: unknown, totals: unknown): void
  persistUrlState(): void
  renderDebug(): void
}

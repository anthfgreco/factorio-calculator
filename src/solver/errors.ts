import type { SolverItem } from "./contracts.js"

export class SolverFailure extends Error {
  readonly code: "missing-recipe" | "infeasible"
  readonly item: SolverItem | null

  constructor(code: "missing-recipe" | "infeasible", message: string, item: SolverItem | null = null) {
    super(message)
    this.name = "SolverFailure"
    this.code = code
    this.item = item
  }
}

export interface ModelRuntimeContext {
  getSpecification(): any
  useLegacyCalculation(): boolean
}

let context: ModelRuntimeContext | null = null

export function configureModelRuntime(nextContext: ModelRuntimeContext): void {
  context = nextContext
}

export function currentSpecification(): any {
  if (context === null) {
    throw new Error("Model runtime has not been configured")
  }
  return context.getSpecification()
}

export function usesLegacyCalculation(): boolean {
  return context?.useLegacyCalculation() ?? false
}

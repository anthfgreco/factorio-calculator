import { FactorySpecification } from "./factory-specification.js"
import type { FactoryViewPort } from "./factory-view.js"

let configuredView: FactoryViewPort | null = null

export let spec = new FactorySpecification()

export function configureFactoryView(view: FactoryViewPort) {
  configuredView = view
  spec.view = view
}

export function resetSpec() {
  spec = new FactorySpecification(configuredView)
  return spec
}

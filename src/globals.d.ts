import type { FactorySpecification } from "./factory.js"

declare global {
  const spec: FactorySpecification

  interface Window {
    spec: FactorySpecification
  }
}

export {}

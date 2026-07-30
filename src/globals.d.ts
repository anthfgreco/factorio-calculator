declare global {
  const BigInteger: any
  const bigInt: any
  const d3: any
  const dagre: any
  const pako: any
  const Popper: any
  const spec: any

  interface CalculatorHandlers {
    plusHandler: () => void
    clickTab: (tabName: string) => void
    clickVisualize: () => void
    changeTitle: (event: Event) => void
    changeRatePrecision: (event: Event) => void
    changeCountPrecision: (event: Event) => void
    changeFormat: (event: Event) => void
    changeMprod: (event: Event) => void
    changeVisType: (event: Event) => void
    changeVisRender: (event: Event) => void
    changeVisDir: (event: Event) => void
    toggleDebug: (event: Event) => void
    init: () => void
  }

  interface Window {
    handlers: CalculatorHandlers
    spec: any
  }

  const handlers: CalculatorHandlers
}

export {}

declare global {
  const spec: any

  interface CalculatorHandlers {
    plusHandler: () => void
    clickTab: (tabName: string) => void
    clickVisualize: () => void
    copyShareLink: () => Promise<void>
    changeFactoryDensity: (event: Event) => void
    applyProgressionPreset: (event: Event) => void
    changeTitle: (event: Event) => void
    changeRatePrecision: (event: Event) => void
    changeCountPrecision: (event: Event) => void
    changeFormat: (event: Event) => void
    changeMprod: (event: Event) => void
    changePlanningSetting: (event: Event) => void
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

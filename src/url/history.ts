export interface UrlHistoryPort {
  readonly hash: string
  readonly pathname: string
  readonly search: string
  replace(url: string): void
}

export class CalculatorUrlHistory {
  private suppressWrites = false

  constructor(private readonly port: UrlHistoryPort) {}

  initialize(): void {
    this.suppressWrites = this.port.hash === ""
  }

  finishInitialization(): void {
    this.suppressWrites = false
  }

  clearHash(): void {
    this.port.replace(`${this.port.pathname}${this.port.search}`)
  }

  sync(settings: string): void {
    if (this.suppressWrites) return
    const nextHash = `#${settings}`
    if (this.port.hash !== nextHash) this.port.replace(nextHash)
  }
}

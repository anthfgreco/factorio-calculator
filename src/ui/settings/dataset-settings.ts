class Modification {
  constructor(
    readonly name: string,
    readonly filename: string,
    readonly legacy: boolean,
  ) {}
}

export const MODIFICATIONS = new Map([
  ["space-age-2-1-12", new Modification("Space Age 2.1.12 (EXPERIMENTAL)", "space-age-2.1.12.json", false)],
  ["2-0-55", new Modification("Vanilla 2.0.55", "vanilla-2.0.55.json", false)],
  ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
  ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
  ["space-age-2-0-55", new Modification("Space Age 2.0.55", "space-age-2.0.55.json", false)],
])

const DEFAULT_MODIFICATION = "space-age-2-1-12"
const modificationUpdates = new Map([
  ["2-0-6", "2-0-55"],
  ["2-0-7", "2-0-55"],
  ["2-0-10", "2-0-55"],
  ["1-1-19", "1-1-110"],
  ["1-1-19x", "1-1-110x"],
  ["space-age-2-0-10", "space-age-2-0-55"],
  ["space-age-2-0-11", "space-age-2-0-55"],
])

let onModificationChanged: () => void = () => {
  throw new Error("Dataset change handler has not been configured")
}

export function configureDatasetChangeHandler(handler: () => void) {
  onModificationChanged = handler
}

function normalizeDataSetName(name: string | undefined) {
  const updatedName = name === undefined ? undefined : modificationUpdates.get(name) ?? name
  return updatedName !== undefined && MODIFICATIONS.has(updatedName) ? updatedName : DEFAULT_MODIFICATION
}

export function renderDataSetOptions(settings: Map<string, string>) {
  const selector = document.getElementById("data_set") as HTMLSelectElement
  d3.select(selector).on("change", () => onModificationChanged())
  const configuredModification = normalizeDataSetName(settings.get("data"))
  selector.replaceChildren()
  for (const [key, modification] of MODIFICATIONS) {
    const option = document.createElement("option")
    option.textContent = modification.name
    option.value = key
    option.selected = key === configuredModification
    selector.appendChild(option)
  }
}

export function currentMod() {
  return (document.getElementById("data_set") as HTMLSelectElement).value
}

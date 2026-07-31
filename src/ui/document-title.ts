export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(title: string) {
  document.title = title === "" ? DEFAULT_TITLE : title
}

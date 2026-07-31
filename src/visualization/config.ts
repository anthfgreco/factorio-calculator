export const DEFAULT_VISUALIZER = "sankey"
export const DEFAULT_RENDER = "zoom"

export let visualizerType = DEFAULT_VISUALIZER
export let visualizerRender = DEFAULT_RENDER
export let visualizerDirection = getDefaultVisualizerDirection()

export function setVisualizerType(value: string) {
  visualizerType = value
}

export function setVisualizerRender(value: string) {
  visualizerRender = value
}

export function setVisualizerDirection(value: string) {
  visualizerDirection = value
}

export function getDefaultVisualizerDirection() {
  return visualizerType === "sankey" ? "right" : "down"
}

export function isDefaultVisualizerDirection() {
  return visualizerDirection === getDefaultVisualizerDirection()
}

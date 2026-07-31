const ZOOM_SCALE = 100
const MAX_SCALE = 10
const ASPECT_RATIO = 16 / 9

export function installSVGEvents(svg: any) {
  const node = svg.node()
  const tab = d3.select("#graph_tab")
  const style = tab.style("display")
  tab.style("display", "block")
  svg.selectAll("image").style("display", "none")
  let { x, y, width, height } = node.getBBox()
  svg.selectAll("image").style("display", null)
  tab.style("display", style)

  const [diagramX, diagramY, diagramWidth, diagramHeight] = [x, y, width, height]
  if (width / height < ASPECT_RATIO) {
    const newWidth = height * ASPECT_RATIO
    x -= (newWidth - width) / 2
    width = newWidth
  } else if (width / height > ASPECT_RATIO) {
    const newHeight = width / ASPECT_RATIO
    y -= (newHeight - height) / 2
    height = newHeight
  }

  const [origWidth, origHeight] = [width, height]
  y = diagramY
  let scale = MAX_SCALE
  let clickPoint: DOMPoint | null = null

  function clamp() {
    const midX = x + width / 2
    const midY = y + height / 2
    if (diagramX > midX) {
      x = diagramX - width / 2
    } else if (diagramX + diagramWidth < midX) {
      x = diagramX + diagramWidth - width / 2
    }
    if (diagramY > midY) {
      y = diagramY - height / 2
    } else if (diagramY + diagramHeight < midY) {
      y = diagramY + diagramHeight - height / 2
    }
  }

  function setViewBox() {
    clamp()
    svg.attr("viewBox", `${x} ${y} ${width} ${height}`)
  }

  function point(event: MouseEvent) {
    const clientPoint = new DOMPointReadOnly(event.clientX, event.clientY)
    return clientPoint.matrixTransform(node.getScreenCTM().inverse())
  }

  function zoom(event: WheelEvent) {
    event.preventDefault()
    const originalScale = scale
    if (event.deltaY < 0) {
      if (scale === 1) return
      scale--
    } else if (event.deltaY > 0) {
      if (scale === MAX_SCALE + 2) return
      scale++
    }
    const cursor = point(event)
    const dx = cursor.x - x
    const dy = cursor.y - y
    x = cursor.x - (dx / originalScale) * scale
    y = cursor.y - (dy / originalScale) * scale
    width = origWidth * (scale / MAX_SCALE)
    height = origHeight * (scale / MAX_SCALE)
    setViewBox()
  }

  function mouseDown(event: MouseEvent) {
    clickPoint = point(event)
    event.preventDefault()
  }

  function mouseMove(event: MouseEvent) {
    if (clickPoint === null) return
    const cursor = point(event)
    x -= cursor.x - clickPoint.x
    y -= cursor.y - clickPoint.y
    setViewBox()
    event.preventDefault()
  }

  function mouseUp(event: MouseEvent) {
    clickPoint = null
    event.preventDefault()
  }

  setViewBox()
  svg.on("wheel", zoom)
  svg.on("mousedown", mouseDown)
  svg.on("mousemove", mouseMove)
  svg.on("mouseup", mouseUp)
}

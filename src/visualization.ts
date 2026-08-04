import { color, curveBasis, line, select } from "d3"
const d3: any = { color, curveBasis, line, select }
import dagre from "@dagrejs/dagre"
import { spec } from "./factory.js"
import {
  colonWidth,
  colorList,
  getColorMaps,
  graphClickHandler,
  graphMouseLeaveHandler,
  graphMouseOverHandler,
  iconSize,
  imageViewBox,
  renderNode,
  renderSankey,
} from "./graph.js"
import { one, zero } from "./math.js"
import { sheetHash, sheetHeight, sheetWidth } from "./presentation.js"
import { visualizerDirection, visualizerRender, visualizerType } from "./state.js"

// -----------------------------------------------------------------------------
// Graph viewport
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Box-line graph
// -----------------------------------------------------------------------------

const boxlineNodeMargin = 10

function edgePath(edge) {
  let line = d3
    .line()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(d3.curveBasis)
  return line(edge.points)
}

function edgeName(link) {
  return `link-${link.index}`
}

export function renderBoxGraph({ nodes, links }, direction, ignore, callback) {
  let [itemColors, recipeColors] = getColorMaps(nodes, links)
  if (direction === "down") {
    direction = "TB"
  } else {
    direction = "LR"
  }
  let g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: direction })
  g.setDefaultEdgeLabel(() => {})

  let testSVG = d3.select("body").append("svg").classed("test", true)
  let text = testSVG.append("text")
  for (let node of nodes) {
    let width = node.labelWidth(text, boxlineNodeMargin)
    let height = 52
    let label = { node, width, height }
    g.setNode(node.name, label)
    node.linkObjs = []
    node.links = function () {
      return this.linkObjs
    }
  }

  for (let [i, link] of links.entries()) {
    link.index = i
    let s = `\u00a0\u00d7 ${spec.format.rate(link.rate)}/${spec.format.rateName}`
    text.text(s)
    let textWidth = text.node().getBBox().width
    let width = 32 + 10 + textWidth
    let height = 32 + 10
    let label = {
      link: link,
      labelpos: "c",
      width: width,
      height: height,
      text: s,
    }
    link.label = label
    g.setEdge(link.source.name, link.target.name, label, edgeName(link))
    link.source.linkObjs.push(link)
    link.target.linkObjs.push(link)
  }
  text.remove()
  testSVG.remove()

  dagre.layout(g)
  for (let nodeName of g.nodes()) {
    let dagreNode = g.node(nodeName)
    let node = dagreNode.node
    node.x0 = dagreNode.x - dagreNode.width / 2
    node.y0 = dagreNode.y - dagreNode.height / 2
    node.x1 = node.x0 + dagreNode.width
    node.y1 = node.y0 + dagreNode.height
  }
  for (let edgeName of g.edges()) {
    let dagreEdge = g.edge(edgeName)
    let link = dagreEdge.link
    link.points = dagreEdge.points
  }

  let { width, height } = g.graph()
  let svg = d3.select("svg#graph").classed("sankey", false)
  //.attr("viewBox", `-25,-25,${width+50},${height+50}`)
  //.style("width", width+50)
  //.style("height", height+50)
  svg.selectAll("g").remove()

  let edges = svg
    .append("g")
    .classed("edges", true)
    .selectAll("g")
    .data(links)
    .join("g")
    .classed("edge", true)
    .classed("fuel", (d) => d.fuel)
    .each(function (this: SVGGElement, d) {
      d.elements.push(this)
    })
  edges
    .append("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("stroke", (d) => colorList[itemColors.get(d.item) % 10])
    .attr("stroke-width", 3)
    .attr("d", edgePath)
    .attr("marker-end", (d) => `url(#arrowhead-${edgeName(d)})`)
  edges
    .append("defs")
    .append("marker")
    .attr("id", (d) => "arrowhead-" + edgeName(d))
    .attr("viewBox", "0 0 10 10")
    .attr("refX", "9")
    .attr("refY", "5")
    .attr("markerWidth", "16")
    .attr("markerHeight", "12")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("orient", "auto")
    .append("path")
    .classed("highlighter", true)
    .attr("d", "M 0,0 L 10,5 L 0,10 z")
    .attr("stroke-width", 1)
    .attr("stroke", (d) => colorList[itemColors.get(d.item) % 10])
    .attr("fill", (d) => d3.color(colorList[itemColors.get(d.item) % 10]).darker())

  let edgeLabels = svg
    .append("g")
    .classed("edgeLabels", true)
    .selectAll("g")
    .data(links)
    .join("g")
    .classed("edgeLabel", true)
    .each(function (this: SVGGElement, d) {
      d.elements.push(this)
    })
  edgeLabels
    .append("rect")
    .classed("highlighter", true)
    .attr("x", (d) => {
      let edge = d.label
      return edge.x - edge.width / 2
    })
    .attr("y", (d) => {
      let edge = d.label
      return edge.y - edge.height / 2
    })
    .attr("width", (d) => d.label.width)
    .attr("height", (d) => d.label.height)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", (d) => d3.color(colorList[itemColors.get(d.item) % 10]).darker())
    .attr("fill-opacity", 0)
    .attr("stroke", "none")
  edgeLabels
    .append("svg")
    .attr("viewBox", (d) => imageViewBox(d.item))
    .attr("x", (d) => {
      let edge = d.label
      return edge.x - edge.width / 2 + 5 + 0.5
    })
    .attr("y", (d) => {
      let edge = d.label
      return edge.y - iconSize / 2 + 0.5
    })
    .attr("width", iconSize)
    .attr("height", iconSize)
    .append("image")
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
  edgeLabels
    .append("text")
    .attr("x", (d) => {
      let edge = d.label
      return edge.x - edge.width / 2 + 5 + iconSize
    })
    .attr("y", (d) => d.label.y)
    .attr("dy", "0.35em")
    .text((d) => d.label.text)

  let rects = svg.append("g").classed("nodes", true).selectAll("g").data(nodes).join("g").classed("node", true)
  renderNode(rects, boxlineNodeMargin, "left", recipeColors, ignore)

  svg
    .append("g")
    .classed("overlay", true)
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .on("mouseover", graphMouseOverHandler)
    .on("mouseout", graphMouseLeaveHandler)
    .on("click", graphClickHandler)
    .append("title")
    .text((d) => d.name)
  callback()
}

// -----------------------------------------------------------------------------
// Visualization orchestration
// -----------------------------------------------------------------------------

class GraphEdge {
  [key: string]: any
  constructor(source, target, value, item, rate, fuel, beltCount, extra) {
    this.source = source
    this.target = target
    this.value = value
    this.item = item
    this.rate = rate
    this.fuel = fuel
    this.beltCount = beltCount
    this.extra = extra
    this.elements = []
    this.nodeHighlighters = new Set()

    source.linkObjects.push(this)
    target.linkObjects.push(this)
  }
  hasHighlighters() {
    return this.nodeHighlighters.size > 0
  }
  highlight(node) {
    if (!this.hasHighlighters()) {
      for (let element of this.elements) {
        element.classList.add("edgePathHighlight")
      }
    }
    this.nodeHighlighters.add(node)
  }
  unhighlight(node) {
    this.nodeHighlighters.delete(node)
    if (!this.hasHighlighters()) {
      for (let element of this.elements) {
        element.classList.remove("edgePathHighlight")
      }
    }
  }
}

class GraphNode {
  [key: string]: any
  constructor(name, recipe, building, count, rate) {
    this.name = name
    this.ingredients = recipe.getIngredients()
    this.recipe = recipe
    this.building = building || null
    this.count = count
    this.rate = rate
    this.linkObjects = []
  }
  links() {
    return this.linkObjects
  }
  text() {
    if (this.rate === null) {
      return this.name
    } else if (this.count.isZero()) {
      return `\u00a0\u00d7 ${spec.format.rate(this.rate)}/${spec.format.rateName}`
    } else {
      return `\u00a0\u00d7 ${spec.format.count(this.count)}`
    }
  }
  // There are three types of nodes, each of which calculate their width
  // differently:
  //
  // 1) Plain text nodes, used for the "output" and "surplus" nodes. These
  //    are simply the width of the rendered text string, plus a margin on
  //    either side.
  //      [margin] [text] [margin]
  // 2) Rate nodes, which represent the production of an item in lieu of a
  //    building. These consist of:
  //      [margin] [item icon] [text label] [margin]
  // 3) Recipe nodes, which contain a recipe icon, a representation of a
  //    colon (as two circles), a building icon, and a text label:
  //      [margin] [recipe icon] [colon] [building icon] [text] [margin]
  //
  // The constant `iconSize` is the width and height, in SVG coordinate
  // units, of all icons.
  //
  // The constant `colonWidth` is the distance, in SVG coordinate units,
  // between the recipe and building icons; the colon symbol is then centered
  // in this gap.
  //
  // `nodeMargin` is 2 for the Sankey visualization: 1 pixel for the rect
  // border, and one pixel for separation from the border. It is 10 for the
  // boxline visualziation, which looks nicer.
  //
  // These calculations hold for both the Sankey and boxline visualizations,
  // with the slight caveat that this is the exact width of each node in the
  // boxline mode, while nodes are of a uniform width in the Sankey diagram,
  // chosen from the maximum node width calculated here.
  labelWidth(text, nodeMargin) {
    text.text(this.text())
    let textWidth = text.node().getBBox().width
    let nodeWidth = textWidth + nodeMargin * 2
    if (this.building !== null) {
      nodeWidth += iconSize * 2 + colonWidth // + 3
    } else if (this.rate !== null) {
      nodeWidth += iconSize // + 3
    }
    return nodeWidth
  }
  highlight() {
    this.element.classList.add("nodeHighlight")
    for (let edge of this.links()) {
      edge.highlight(this)
    }
  }
  unhighlight() {
    this.element.classList.remove("nodeHighlight")
    for (let edge of this.links()) {
      edge.unhighlight(this)
    }
  }
}

function makeGraph(totals, ignore) {
  let outputs = []
  let rates = new Map()

  let nodes = []
  let nodeMap = new Map()

  for (let [recipe, rate] of totals.rates) {
    let node = null
    if (recipe.isReal()) {
      let building = spec.getBuilding(recipe)
      let count = spec.getCount(recipe, rate)
      node = new GraphNode(recipe.name, recipe, building, count, rate)
    } else {
      node = new GraphNode(recipe.name, recipe, null, zero, null)
    }
    nodes.push(node)
    nodeMap.set(recipe, node)
  }

  let links = []
  for (let { item, from, to, rate, fuel } of totals.proportionate) {
    let value = rate.toFloat()
    if (item.phase === "fluid") {
      // Fluids operate on a different scale.
      value /= 10
    }
    let beltCount = null
    if (item.phase === "solid") {
      beltCount = rate.div(spec.belt.rate)
    }
    let extra = from.products.length > 1
    links.push(new GraphEdge(nodeMap.get(from), nodeMap.get(to), value, item, rate, fuel, beltCount, extra))
  }
  return { nodes: nodes, links: links }
}

export function renderTotals(totals, ignore) {
  let data = makeGraph(totals, ignore)
  let processCount = data.nodes.filter((node) => node.recipe?.isReal?.()).length
  let summary = document.getElementById("visualization_summary")
  if (summary !== null) {
    summary.textContent = `${processCount} processes · ${data.links.length} flows`
  }

  let callback = function () {
    let svg = d3.select("svg#graph")
    let tab = d3.select("#graph_tab")
    if (visualizerRender === "zoom") {
      tab.style("min-width", 0)
      svg.attr("width", null)
      svg.attr("height", null)
      svg.style("border", null)
      installSVGEvents(svg)
    } else {
      tab.style("min-width", "max-content")
      let style = tab.style("display")
      tab.style("display", "block")
      // Hide images so the sprite sheet doesn't throw off the bounding
      // box.
      svg.selectAll("image").style("display", "none")
      let { x, y, width, height } = svg.node().getBBox()
      svg.selectAll("image").style("display", null)
      tab.style("display", style)
      svg
        .attr("viewBox", `${x} ${y} ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .style("border", null)
      svg.on("wheel", null)
      svg.on("mousedown", null)
      svg.on("mousemove", null)
      svg.on("mouseup", null)
    }
  }

  if (visualizerType === "sankey") {
    renderSankey(data, visualizerDirection, ignore)
    callback()
  } else {
    renderBoxGraph(data, visualizerDirection, ignore, callback)
  }
}

import { color, curveBasis, line, select, type BaseType, type Selection } from "d3"
import dagre from "@dagrejs/dagre"
import { spec } from "./factory.js"
import {
  CirclePath,
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
import { one, zero, Rational } from "./math.js"
import type { Building } from "./models.js"
import { Item, Recipe } from "./recipes.js"
import type { SolverRecipe, Totals } from "./solver.js"
import { sheetHash, sheetHeight, sheetWidth } from "./presentation.js"
import { visualizerDirection, visualizerRender, visualizerType } from "./state.js"
import type {
  BoxGraphLabel,
  GraphCurve,
  GraphData,
  GraphDirection,
  GraphLayoutDirection,
  GraphLink,
  GraphNode as GraphNodeContract,
  GraphPoint,
  LinkDirection,
} from "./graph/types.js"

// -----------------------------------------------------------------------------
// Graph viewport
// -----------------------------------------------------------------------------

const ZOOM_SCALE = 100
const MAX_SCALE = 10
const ASPECT_RATIO = 16 / 9

export function installSVGEvents<PElement extends BaseType, PDatum>(
  svg: Selection<SVGSVGElement, unknown, PElement, PDatum>,
): void {
  const selectedNode = svg.node()
  if (!(selectedNode instanceof SVGSVGElement)) throw new Error("Graph SVG is unavailable")
  const node: SVGSVGElement = selectedNode
  const tab = select("#graph_tab")
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

  function clamp(): void {
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

  function setViewBox(): void {
    clamp()
    svg.attr("viewBox", `${x} ${y} ${width} ${height}`)
  }

  function point(event: MouseEvent): DOMPoint {
    const clientPoint = new DOMPointReadOnly(event.clientX, event.clientY)
    const matrix = node.getScreenCTM()
    if (matrix === null) throw new Error("Graph SVG has no screen transform")
    return clientPoint.matrixTransform(matrix.inverse())
  }

  function zoom(event: WheelEvent): void {
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

  function mouseDown(event: MouseEvent): void {
    clickPoint = point(event)
    event.preventDefault()
  }

  function mouseMove(event: MouseEvent): void {
    if (clickPoint === null) return
    const cursor = point(event)
    x -= cursor.x - clickPoint.x
    y -= cursor.y - clickPoint.y
    setViewBox()
    event.preventDefault()
  }

  function mouseUp(event: MouseEvent): void {
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

function edgePath(edge: GraphLink): string | null {
  const path = line<GraphPoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curveBasis)
  return path(edge.points)
}

function edgeName(link: GraphLink): string {
  return `link-${link.index}`
}

function itemColor(itemColors: ReadonlyMap<Item, number>, item: Item): string {
  return colorList[(itemColors.get(item) ?? 0) % colorList.length] ?? "#000"
}

function darkenedItemColor(itemColors: ReadonlyMap<Item, number>, item: Item): string {
  const value = itemColor(itemColors, item)
  return color(value)?.darker().toString() ?? value
}

export function renderBoxGraph(
  { nodes, links }: GraphData,
  direction: GraphDirection,
  ignore: ReadonlySet<unknown>,
  callback: () => void,
): void {
  let [itemColors, recipeColors] = getColorMaps(nodes, links)
  const layoutDirection: GraphLayoutDirection = direction === "down" ? "TB" : "LR"
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: layoutDirection })
  g.setDefaultEdgeLabel(() => {})

  let testSVG = select("body").append("svg").classed("test", true)
  const text = testSVG.append("text")
  const textNode = text.node()
  if (!(textNode instanceof SVGTextElement)) throw new Error("Unable to create graph measurement text")
  for (const node of nodes) {
    const width = node.labelWidth(textNode, boxlineNodeMargin)
    let height = 52
    let label = { node, width, height }
    g.setNode(node.name, label)
  }

  for (let [i, link] of links.entries()) {
    link.index = i
    let s = `\u00a0\u00d7 ${spec.format.rate(link.rate)}/${spec.format.rateName}`
    text.text(s)
    const textWidth = textNode.getBBox().width
    let width = 32 + 10 + textWidth
    let height = 32 + 10
    let label = {
      link: link,
      labelpos: "c",
      width: width,
      height: height,
      text: s,
      x: 0,
      y: 0,
    } satisfies BoxGraphLabel
    link.label = label
    g.setEdge(link.source.name, link.target.name, label, edgeName(link))
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
  let svg = select("svg#graph").classed("sankey", false)
  //.attr("viewBox", `-25,-25,${width+50},${height+50}`)
  //.style("width", width+50)
  //.style("height", height+50)
  svg.selectAll("g").remove()

  let edges = svg
    .append("g")
    .classed("edges", true)
    .selectAll<SVGGElement, GraphLink>("g")
    .data(links)
    .join("g")
    .classed("edge", true)
    .classed("fuel", (d: GraphLink) => d.fuel)
    .each(function (d: GraphLink) {
      d.elements.push(this)
    })
  edges
    .append("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("stroke", (d: GraphLink) => itemColor(itemColors, d.item))
    .attr("stroke-width", 3)
    .attr("d", edgePath)
    .attr("marker-end", (d: GraphLink) => `url(#arrowhead-${edgeName(d)})`)
  edges
    .append("defs")
    .append("marker")
    .attr("id", (d: GraphLink) => "arrowhead-" + edgeName(d))
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
    .attr("stroke", (d: GraphLink) => itemColor(itemColors, d.item))
    .attr("fill", (d: GraphLink) => darkenedItemColor(itemColors, d.item))

  let edgeLabels = svg
    .append("g")
    .classed("edgeLabels", true)
    .selectAll<SVGGElement, GraphLink>("g")
    .data(links)
    .join("g")
    .classed("edgeLabel", true)
    .each(function (d: GraphLink) {
      d.elements.push(this)
    })
  edgeLabels
    .append("rect")
    .classed("highlighter", true)
    .attr("x", (d: GraphLink) => {
      let edge = d.label
      return edge.x - edge.width / 2
    })
    .attr("y", (d: GraphLink) => {
      let edge = d.label
      return edge.y - edge.height / 2
    })
    .attr("width", (d: GraphLink) => d.label.width)
    .attr("height", (d: GraphLink) => d.label.height)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", (d: GraphLink) => darkenedItemColor(itemColors, d.item))
    .attr("fill-opacity", 0)
    .attr("stroke", "none")
  edgeLabels
    .append("svg")
    .attr("viewBox", (d: GraphLink) => imageViewBox(d.item))
    .attr("x", (d: GraphLink) => {
      let edge = d.label
      return edge.x - edge.width / 2 + 5 + 0.5
    })
    .attr("y", (d: GraphLink) => {
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
    .attr("x", (d: GraphLink) => {
      let edge = d.label
      return edge.x - edge.width / 2 + 5 + iconSize
    })
    .attr("y", (d: GraphLink) => d.label.y)
    .attr("dy", "0.35em")
    .text((d: GraphLink) => d.label.text)

  let rects = svg
    .append("g")
    .classed("nodes", true)
    .selectAll<SVGGElement, GraphNodeContract>("g")
    .data(nodes)
    .join("g")
    .classed("node", true)
  renderNode(rects, boxlineNodeMargin, "left", recipeColors, ignore)

  svg
    .append("g")
    .classed("overlay", true)
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (d: GraphNodeContract) => d.x0)
    .attr("y", (d: GraphNodeContract) => d.y0)
    .attr("width", (d: GraphNodeContract) => d.x1 - d.x0)
    .attr("height", (d: GraphNodeContract) => d.y1 - d.y0)
    .on("mouseover", (event: Event, node: GraphNodeContract) => graphMouseOverHandler(event, node))
    .on("mouseout", (event: Event, node: GraphNodeContract) => graphMouseLeaveHandler(event, node))
    .on("click", (event: Event, node: GraphNodeContract) => graphClickHandler(event, node))
    .append("title")
    .text((d: GraphNodeContract) => d.name)
  callback()
}

// -----------------------------------------------------------------------------
// Visualization orchestration
// -----------------------------------------------------------------------------

class GraphEdge implements GraphLink {
  readonly elements: Element[] = []
  readonly nodeHighlighters = new Set<GraphNodeContract>()
  index = 0
  label: BoxGraphLabel
  points: GraphPoint[] = []
  width = 0
  y0 = 0
  y1 = 0
  direction: LinkDirection = "forward"
  curve: GraphCurve = new CirclePath(1, 0, [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ])
  belts: GraphLink["belts"] = []

  constructor(
    readonly source: GraphNode,
    readonly target: GraphNode,
    readonly value: number,
    readonly item: Item,
    readonly rate: Rational,
    readonly fuel: boolean,
    readonly beltCount: Rational | null,
    readonly extra: boolean,
  ) {
    this.label = { link: this, labelpos: "c", width: 0, height: 0, text: "", x: 0, y: 0 }
    source.linkObjects.push(this)
    target.linkObjects.push(this)
  }

  hasHighlighters(): boolean {
    return this.nodeHighlighters.size > 0
  }

  highlight(node: GraphNodeContract): void {
    if (!this.hasHighlighters()) {
      for (const element of this.elements) element.classList.add("edgePathHighlight")
    }
    this.nodeHighlighters.add(node)
  }

  unhighlight(node: GraphNodeContract): void {
    this.nodeHighlighters.delete(node)
    if (!this.hasHighlighters()) {
      for (const element of this.elements) element.classList.remove("edgePathHighlight")
    }
  }
}

class GraphNode implements GraphNodeContract {
  readonly ingredients
  readonly linkObjects: GraphLink[] = []
  element: SVGElement | null = null
  x0 = 0
  y0 = 0
  x1 = 0
  y1 = 0
  width = 0
  labelX = 0

  constructor(
    readonly name: string,
    readonly recipe: SolverRecipe,
    readonly building: Building | null,
    readonly count: Rational,
    readonly rate: Rational | null,
  ) {
    this.ingredients = recipe.getIngredients()
  }

  links(): readonly GraphLink[] {
    return this.linkObjects
  }

  text(): string {
    if (this.rate === null) return this.name
    return this.count.isZero()
      ? ` × ${spec.format.rate(this.rate)}/${spec.format.rateName}`
      : ` × ${spec.format.count(this.count)}`
  }

  labelWidth(text: SVGTextElement, nodeMargin: number): number {
    text.textContent = this.text()
    const textWidth = text.getBBox().width
    let nodeWidth = textWidth + nodeMargin * 2
    if (this.building !== null) {
      nodeWidth += iconSize * 2 + colonWidth
    } else if (this.rate !== null) {
      nodeWidth += iconSize
    }
    return nodeWidth
  }

  highlight(): void {
    this.element?.classList.add("nodeHighlight")
    for (const edge of this.links()) edge.highlight(this)
  }

  unhighlight(): void {
    this.element?.classList.remove("nodeHighlight")
    for (const edge of this.links()) edge.unhighlight(this)
  }
}

function makeGraph(totals: Totals): GraphData {
  const nodes: GraphNode[] = []
  const nodeMap = new Map<SolverRecipe, GraphNode>()

  for (let [recipe, rate] of totals.rates) {
    let node: GraphNode
    if (recipe.isReal()) {
      if (!(recipe instanceof Recipe)) throw new Error(`Unsupported real graph recipe: ${recipe.name}`)
      const building = spec.getBuilding(recipe)
      const count = spec.getCount(recipe, rate)
      node = new GraphNode(recipe.name, recipe, building, count, rate)
    } else {
      node = new GraphNode(recipe.name, recipe, null, zero, null)
    }
    nodes.push(node)
    nodeMap.set(recipe, node)
  }

  const links: GraphEdge[] = []
  for (const { item, from, to, rate, fuel } of totals.proportionate) {
    if (!(item instanceof Item)) throw new Error("Graph flow contains an unsupported item")
    const source = nodeMap.get(from)
    const target = nodeMap.get(to)
    if (source === undefined || target === undefined) throw new Error("Graph flow references a missing process node")
    let value = rate.toFloat()
    if (item.phase === "fluid") {
      // Fluids operate on a different scale.
      value /= 10
    }
    let beltCount = null
    if (item.phase === "solid" && spec.belt !== null) {
      beltCount = rate.div(spec.belt.rate)
    }
    const extra = from.products.length > 1
    links.push(new GraphEdge(source, target, value, item, rate, fuel, beltCount, extra))
  }
  return { nodes, links }
}

export function renderTotals(totals: Totals, ignore: ReadonlySet<Item>): void {
  const data = makeGraph(totals)
  let processCount = data.nodes.filter((node) => node.recipe?.isReal?.()).length
  let summary = document.getElementById("visualization_summary")
  if (summary !== null) {
    summary.textContent = `${processCount} processes · ${data.links.length} flows`
  }

  const callback = (): void => {
    const svg = select<SVGSVGElement, unknown>("svg#graph")
    let tab = select("#graph_tab")
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
      const svgNode = svg.node()
      if (!(svgNode instanceof SVGSVGElement)) throw new Error("Graph SVG is unavailable")
      const { x, y, width, height } = svgNode.getBBox()
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
    const direction: GraphDirection = visualizerDirection === "down" ? "down" : "right"
    renderSankey(data, direction, ignore)
    callback()
  } else {
    const direction: GraphDirection = visualizerDirection === "down" ? "down" : "right"
    renderBoxGraph(data, direction, ignore, callback)
  }
}

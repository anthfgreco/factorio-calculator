import dagre from "@dagrejs/dagre"
import { color, curveBasis, line, select, type Selection } from "d3"
import * as d3sankey from "./vendor-sankey.js"
import type { Building, FactorySpecification, Item, Rational, Recipe, SolverItem, SolverRecipe, Totals } from "./main"

export interface VisualizationOptions {
  readonly svg: SVGSVGElement
  readonly specification: FactorySpecification
  readonly totals: Totals
  readonly ignore: ReadonlySet<Item>
  readonly visualizerType: "sankey" | "boxline"
  readonly visualizerRender: "zoom" | "fix"
  readonly visualizerDirection: "right" | "down"
  readonly zero: Rational
  readonly isItem: (value: SolverItem) => value is Item
  readonly isRecipe: (value: SolverRecipe) => value is Recipe
  readonly spriteSheet: {
    readonly hash: string
    readonly width: number
    readonly height: number
    readonly cellWidth: number
    readonly cellHeight: number
  }
}

type GraphDirection = "down" | "right"
type GraphLayoutDirection = "TB" | "LR"
type GraphJustification = "left" | "center"
type LinkDirection = "forward" | "backward" | "self"

interface GraphPoint {
  readonly x: number
  readonly y: number
}

interface GraphCurve {
  readonly points: readonly GraphPoint[]
  path(): string
  offset(offset: number): GraphCurve
  transpose(): GraphCurve
}

interface IconCoordinates {
  readonly icon_col: number
  readonly icon_row: number
}

interface BoxGraphLabel {
  readonly link: GraphEdge
  readonly labelpos: "c"
  width: number
  height: number
  text: string
  x: number
  y: number
}

interface GraphBeltLine {
  readonly item: Item
  readonly curve: GraphCurve
}

class GraphLayoutNode {
  readonly linkObjects: GraphEdge[] = []
  element: SVGElement | null = null
  x0 = 0
  y0 = 0
  x1 = 0
  y1 = 0
  width = 0
  labelX = 0

  // The vendored Sankey mutates these layout fields.
  index = 0
  sourceLinks: GraphEdge[] = []
  targetLinks: GraphEdge[] = []
  value = 0
  depth = 0
  height = 0
  layer = 0

  constructor(
    private readonly specification: FactorySpecification,
    readonly id: string,
    readonly name: string,
    readonly recipe: SolverRecipe,
    readonly building: Building | null,
    readonly count: Rational,
    readonly rate: Rational | null,
  ) {}

  links(): readonly GraphEdge[] {
    return this.linkObjects
  }

  text(): string {
    if (this.rate === null) return this.name
    return this.count.isZero()
      ? `\u00a0\u00d7 ${this.specification.format.rate(this.rate)}/${this.specification.format.rateName}`
      : `\u00a0\u00d7 ${this.specification.format.count(this.count)}`
  }

  labelWidth(text: SVGTextElement, nodeMargin: number): number {
    text.textContent = this.text()
    const textWidth = text.getBBox().width
    let nodeWidth = textWidth + nodeMargin * 2
    if (this.building !== null) nodeWidth += ICON_SIZE * 2 + COLON_WIDTH
    else if (this.rate !== null) nodeWidth += ICON_SIZE
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

class GraphEdge {
  readonly elements: Element[] = []
  readonly nodeHighlighters = new Set<GraphLayoutNode>()
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
  belts: GraphBeltLine[] = []

  constructor(
    readonly source: GraphLayoutNode,
    readonly target: GraphLayoutNode,
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

  private hasHighlighters(): boolean {
    return this.nodeHighlighters.size > 0
  }

  highlight(node: GraphLayoutNode): void {
    if (!this.hasHighlighters()) {
      for (const element of this.elements) element.classList.add("edgePathHighlight")
    }
    this.nodeHighlighters.add(node)
  }

  unhighlight(node: GraphLayoutNode): void {
    this.nodeHighlighters.delete(node)
    if (!this.hasHighlighters()) {
      for (const element of this.elements) element.classList.remove("edgePathHighlight")
    }
  }
}

interface GraphData {
  readonly nodes: GraphLayoutNode[]
  readonly links: GraphEdge[]
}

interface SankeyGraph {
  readonly nodes: GraphLayoutNode[]
  readonly links: GraphEdge[]
}

const COLOR_LIST = [
  "#1f77b4",
  "#8c564b",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#e377c2",
  "#17becf",
  "#7f7f7f",
  "#bcbd22",
  "#ff7f0e",
] as const

const ICON_SIZE = 32
const COLON_WIDTH = 12
const BOXLINE_NODE_MARGIN = 10
const SANKEY_NODE_PADDING = 36
const SANKEY_NODE_MARGIN = 2
const SANKEY_COLUMN_WIDTH = 200
const SANKEY_MAX_NODE_HEIGHT = 175

function makeGraph(options: VisualizationOptions): GraphData {
  const { specification, totals, zero, isItem, isRecipe } = options
  const nodes: GraphLayoutNode[] = []
  const nodeMap = new Map<SolverRecipe, GraphLayoutNode>()

  for (const [recipe, rate] of totals.rates) {
    let node: GraphLayoutNode
    if (recipe.isReal()) {
      if (!isRecipe(recipe)) throw new Error(`Unsupported real graph recipe: ${recipe.name}`)
      const building = specification.getBuilding(recipe)
      const count = specification.getCount(recipe, rate)
      node = new GraphLayoutNode(specification, recipe.key ?? recipe.name, recipe.name, recipe, building, count, rate)
    } else {
      node = new GraphLayoutNode(
        specification,
        recipe.key ?? `${recipe.name}-${nodes.length}`,
        recipe.name,
        recipe,
        null,
        zero,
        null,
      )
    }
    nodes.push(node)
    nodeMap.set(recipe, node)
  }

  const links: GraphEdge[] = []
  for (const { item, from, to, rate, fuel } of totals.proportionate) {
    if (!isItem(item)) throw new Error("Graph flow contains an unsupported item")
    const source = nodeMap.get(from)
    const target = nodeMap.get(to)
    if (source === undefined || target === undefined) throw new Error("Graph flow references a missing process node")

    let value = rate.toFloat()
    if (item.phase === "fluid") value /= 10

    const beltCount =
      item.phase === "solid" && specification.belt !== null ? specification.getBeltCount(item, rate) : null
    links.push(new GraphEdge(source, target, value, item, rate, fuel, beltCount, from.products.length > 1))
  }

  return { nodes, links }
}

function graphClickHandler(_event: Event, node: GraphLayoutNode): void {
  if (clickedNode === node) {
    node.unhighlight()
    clickedNode = null
    return
  }
  clickedNode?.unhighlight()
  clickedNode = node
  node.highlight()
}

function graphMouseOverHandler(_event: Event, node: GraphLayoutNode): void {
  node.highlight()
}

function graphMouseLeaveHandler(_event: Event, node: GraphLayoutNode): void {
  if (node !== clickedNode) node.unhighlight()
}

let clickedNode: GraphLayoutNode | null = null

function itemNeighbors(options: VisualizationOptions, item: Item): Set<Item> {
  const touching = new Set<Item>()
  const recipes = item.recipes.concat(item.uses)
  for (const recipe of recipes) {
    for (const ingredient of recipe.getIngredients().concat(recipe.products)) {
      if (options.isItem(ingredient.item)) touching.add(ingredient.item)
    }
  }
  return touching
}

function itemDegree(options: VisualizationOptions, item: Item): number {
  return itemNeighbors(options, item).size
}

function getColorMaps(
  options: VisualizationOptions,
  nodes: readonly GraphLayoutNode[],
  links: readonly GraphEdge[],
): readonly [Map<Item, number>, Map<SolverRecipe, number>] {
  const itemColors = new Map<Item, number>()
  const recipeColors = new Map<SolverRecipe, number>()
  const remainingItems = new Set(
    [...links].sort((a, b) => itemDegree(options, b.item) - itemDegree(options, a.item)).map((link) => link.item),
  )

  while (remainingItems.size > 0) {
    let chosenItem: Item | null = null
    let chosenUsedColors = new Set<number>()
    let mostUsedColors = -1

    for (const item of remainingItems) {
      const usedColors = new Set<number>()
      for (const neighbor of itemNeighbors(options, item)) {
        const neighborColor = itemColors.get(neighbor)
        if (neighborColor !== undefined) usedColors.add(neighborColor)
      }
      if (usedColors.size > mostUsedColors) {
        mostUsedColors = usedColors.size
        chosenItem = item
        chosenUsedColors = usedColors
      }
    }

    if (chosenItem === null) break
    remainingItems.delete(chosenItem)
    let colorIndex = 0
    while (chosenUsedColors.has(colorIndex)) colorIndex++
    itemColors.set(chosenItem, colorIndex)
  }

  let fallbackColor = 0
  for (const node of nodes) {
    const onlyProduct = node.recipe.products.length === 1 ? node.recipe.products[0] : undefined
    const productColor =
      onlyProduct !== undefined && options.isItem(onlyProduct.item) ? itemColors.get(onlyProduct.item) : undefined
    recipeColors.set(node.recipe, productColor ?? fallbackColor++)
  }

  return [itemColors, recipeColors]
}

function itemColor(itemColors: ReadonlyMap<Item, number>, item: Item): string {
  return COLOR_LIST[(itemColors.get(item) ?? 0) % COLOR_LIST.length] ?? "#000"
}

function darkenedColor(value: string): string {
  return color(value)?.darker().toString() ?? value
}

function imageViewBox(options: VisualizationOptions, obj: IconCoordinates): string {
  const { cellWidth, cellHeight } = options.spriteSheet
  const x = obj.icon_col * cellWidth + 0.5
  const y = obj.icon_row * cellHeight + 0.5
  return `${x} ${y} ${cellWidth - 1} ${cellHeight - 1}`
}

function appendSprite(
  options: VisualizationOptions,
  selection: Selection<SVGGElement, GraphLayoutNode, SVGGElement, unknown>,
  icon: (node: GraphLayoutNode) => IconCoordinates,
  x: (node: GraphLayoutNode) => number,
): void {
  const { hash, width, height } = options.spriteSheet
  selection
    .append("svg")
    .attr("viewBox", (node) => imageViewBox(options, icon(node)))
    .attr("x", x)
    .attr("y", (node) => (node.y0 + node.y1) / 2 - ICON_SIZE / 2 + 0.5)
    .attr("width", ICON_SIZE)
    .attr("height", ICON_SIZE)
    .append("image")
    .attr("href", `images/sprite-sheet-${hash}.webp`)
    .attr("width", width)
    .attr("height", height)
}

function renderNode(
  options: VisualizationOptions,
  rects: Selection<SVGGElement, GraphLayoutNode, SVGGElement, unknown>,
  nodeMargin: number,
  justification: GraphJustification,
  recipeColors: ReadonlyMap<SolverRecipe, number>,
): void {
  rects.each((node) => {
    node.labelX = justification === "left" ? node.x0 : (node.x0 + node.x1) / 2 - node.width / 2
  })

  rects
    .append("rect")
    .attr("x", (node) => node.x0)
    .attr("y", (node) => node.y0)
    .attr("height", (node) => node.y1 - node.y0)
    .attr("width", (node) => node.x1 - node.x0)
    .attr("fill", (node) =>
      darkenedColor(COLOR_LIST[(recipeColors.get(node.recipe) ?? 0) % COLOR_LIST.length] ?? "#000"),
    )
    .attr("stroke", (node) => COLOR_LIST[(recipeColors.get(node.recipe) ?? 0) % COLOR_LIST.length] ?? "#000")
    .each(function (node) {
      if (this instanceof SVGElement) node.element = this
    })

  rects
    .filter((node) => node.rate === null)
    .append("text")
    .attr("x", (node) => (node.x0 + node.x1) / 2)
    .attr("y", (node) => (node.y0 + node.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((node) => node.text())

  const labeledNodes = rects.filter((node) => node.rate !== null && options.isRecipe(node.recipe))
  appendSprite(
    options,
    labeledNodes,
    (node) => {
      if (!options.isRecipe(node.recipe)) throw new Error(`Graph node ${node.name} has no recipe icon`)
      return node.recipe.icon.obj
    },
    (node) => node.labelX + nodeMargin + 0.5,
  )

  labeledNodes
    .append("text")
    .attr("x", (node) => node.labelX + nodeMargin + ICON_SIZE + (node.building === null ? 0 : COLON_WIDTH + ICON_SIZE))
    .attr("y", (node) => (node.y0 + node.y1) / 2)
    .attr("dy", "0.35em")
    .text((node) => node.text())

  const buildingNodes = labeledNodes.filter((node) => node.building !== null)
  buildingNodes
    .append("circle")
    .classed("colon", true)
    .attr("cx", (node) => node.labelX + nodeMargin + ICON_SIZE + COLON_WIDTH / 2)
    .attr("cy", (node) => (node.y0 + node.y1) / 2 - 4)
    .attr("r", 1)
  buildingNodes
    .append("circle")
    .classed("colon", true)
    .attr("cx", (node) => node.labelX + nodeMargin + ICON_SIZE + COLON_WIDTH / 2)
    .attr("cy", (node) => (node.y0 + node.y1) / 2 + 4)
    .attr("r", 1)
  appendSprite(
    options,
    buildingNodes,
    (node) => {
      if (node.building === null) throw new Error(`Graph node ${node.name} has no building icon`)
      return node.building.icon.obj
    },
    (node) => node.labelX + ICON_SIZE + COLON_WIDTH + nodeMargin + 0.5,
  )
}

function edgePath(edge: GraphEdge): string | null {
  return line<GraphPoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curveBasis)(edge.points)
}

function edgeName(link: GraphEdge): string {
  return `link-${link.index}`
}

function renderBoxGraph(options: VisualizationOptions, data: GraphData, direction: GraphDirection): void {
  const { specification, svg: svgElement } = options
  const [itemColors, recipeColors] = getColorMaps(options, data.nodes, data.links)
  const layoutDirection: GraphLayoutDirection = direction === "down" ? "TB" : "LR"
  const graph = new dagre.graphlib.Graph({ multigraph: true })
  graph.setGraph({ rankdir: layoutDirection })
  graph.setDefaultEdgeLabel(() => ({}))

  const testSvg = select(document.body).append("svg").classed("graph-measurement", true)
  const text = testSvg.append("text")
  const textNode = text.node()
  if (!(textNode instanceof SVGTextElement)) throw new Error("Unable to create graph measurement text")

  for (const node of data.nodes) {
    graph.setNode(node.id, {
      node,
      width: node.labelWidth(textNode, BOXLINE_NODE_MARGIN),
      height: 52,
    })
  }

  for (const [index, link] of data.links.entries()) {
    link.index = index
    const labelText = `\u00a0\u00d7 ${specification.format.rate(link.rate)}/${specification.format.rateName}`
    text.text(labelText)
    const label = {
      link,
      labelpos: "c" as const,
      width: ICON_SIZE + 10 + textNode.getBBox().width,
      height: ICON_SIZE + 10,
      text: labelText,
      x: 0,
      y: 0,
    }
    link.label = label
    graph.setEdge(link.source.id, link.target.id, label, edgeName(link))
  }
  testSvg.remove()

  dagre.layout(graph)
  for (const nodeId of graph.nodes()) {
    const dagreNode = graph.node(nodeId)
    const node: GraphLayoutNode = dagreNode.node
    node.x0 = dagreNode.x - dagreNode.width / 2
    node.y0 = dagreNode.y - dagreNode.height / 2
    node.x1 = node.x0 + dagreNode.width
    node.y1 = node.y0 + dagreNode.height
  }
  for (const edgeRef of graph.edges()) {
    const dagreEdge = graph.edge(edgeRef)
    const link: GraphEdge = dagreEdge.link
    link.points = dagreEdge.points
  }

  const svg = select(svgElement).classed("sankey", false)
  const edges = svg
    .append("g")
    .classed("edges", true)
    .selectAll<SVGGElement, GraphEdge>("g")
    .data(data.links)
    .join("g")
    .classed("edge", true)
    .classed("fuel", (link) => link.fuel)
    .each(function (link) {
      link.elements.push(this)
    })

  edges
    .append("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("stroke", (link) => itemColor(itemColors, link.item))
    .attr("stroke-width", 3)
    .attr("d", edgePath)
    .attr("marker-end", (link) => `url(#arrowhead-${edgeName(link)})`)

  edges
    .append("defs")
    .append("marker")
    .attr("id", (link) => `arrowhead-${edgeName(link)}`)
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
    .attr("stroke", (link) => itemColor(itemColors, link.item))
    .attr("fill", (link) => darkenedColor(itemColor(itemColors, link.item)))

  const edgeLabels = svg
    .append("g")
    .classed("edgeLabels", true)
    .selectAll<SVGGElement, GraphEdge>("g")
    .data(data.links)
    .join("g")
    .classed("edgeLabel", true)
    .each(function (link) {
      link.elements.push(this)
    })

  edgeLabels
    .append("rect")
    .classed("highlighter", true)
    .attr("x", (link) => link.label.x - link.label.width / 2)
    .attr("y", (link) => link.label.y - link.label.height / 2)
    .attr("width", (link) => link.label.width)
    .attr("height", (link) => link.label.height)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", (link) => darkenedColor(itemColor(itemColors, link.item)))
    .attr("fill-opacity", 0)
    .attr("stroke", "none")

  const { hash, width, height } = options.spriteSheet
  edgeLabels
    .append("svg")
    .attr("viewBox", (link) => imageViewBox(options, link.item.icon.obj))
    .attr("x", (link) => link.label.x - link.label.width / 2 + 5.5)
    .attr("y", (link) => link.label.y - ICON_SIZE / 2 + 0.5)
    .attr("width", ICON_SIZE)
    .attr("height", ICON_SIZE)
    .append("image")
    .attr("href", `images/sprite-sheet-${hash}.webp`)
    .attr("width", width)
    .attr("height", height)

  edgeLabels
    .append("text")
    .attr("x", (link) => link.label.x - link.label.width / 2 + 5 + ICON_SIZE)
    .attr("y", (link) => link.label.y)
    .attr("dy", "0.35em")
    .text((link) => link.label.text)

  const nodes = svg
    .append("g")
    .classed("nodes", true)
    .selectAll<SVGGElement, GraphLayoutNode>("g")
    .data(data.nodes)
    .join("g")
    .classed("node", true)
  renderNode(options, nodes, BOXLINE_NODE_MARGIN, "left", recipeColors)

  svg
    .append("g")
    .classed("overlay", true)
    .selectAll<SVGRectElement, GraphLayoutNode>("rect")
    .data(data.nodes)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (node) => node.x0)
    .attr("y", (node) => node.y0)
    .attr("width", (node) => node.x1 - node.x0)
    .attr("height", (node) => node.y1 - node.y0)
    .on("mouseover", graphMouseOverHandler)
    .on("mouseout", graphMouseLeaveHandler)
    .on("click", graphClickHandler)
    .append("title")
    .text((node) => node.name)
}

interface CirclePoint extends GraphPoint {
  readonly nx: number
  readonly ny: number
  readonly r: number | null
  readonly sweep: 0 | 1 | null
}

class CirclePath implements GraphCurve {
  points: CirclePoint[]

  constructor(nx: number, ny: number, pairs: readonly GraphPoint[]) {
    const first = pairs[0]
    if (first === undefined) throw new Error("A graph curve requires at least one point")
    let { x, y } = first
    const points: CirclePoint[] = [{ x, y, nx, ny, r: null, sweep: null }]
    let previousX = x
    let previousY = y

    for (const pair of pairs.slice(1)) {
      ;({ x, y } = pair)
      const dx = (x - previousX) / 2
      const dy = (y - previousY) / 2
      const tangentProjection = nx * dx + ny * dy
      let normalProjection = -ny * dx + nx * dy
      if (-0.5 < normalProjection && normalProjection < 0.5) {
        const [normalX, normalY] = norm([dx, dy])
        const dot = nx * normalX + ny * normalY
        nx = 2 * dot * normalX - nx
        ny = 2 * dot * normalY - ny
        points.push({ x, y, nx, ny, r: null, sweep: null })
        previousX = x
        previousY = y
        continue
      }
      let sweep: 0 | 1 = 1
      let normalX = -ny
      let normalY = nx
      if (normalProjection < 0) {
        sweep = 0
        normalProjection = -normalProjection
        normalX = -normalX
        normalY = -normalY
      }
      const radius = normalProjection + tangentProjection ** 2 / normalProjection
      const centerX = normalX * radius
      const centerY = normalY * radius
      normalX = (centerX - 2 * dx) / radius
      normalY = (centerY - 2 * dy) / radius
      nx = normalY
      ny = -normalX
      if (sweep === 0) {
        nx = -nx
        ny = -ny
      }
      points.push({ x, y, nx, ny, r: radius, sweep })
      previousX = x
      previousY = y
    }
    this.points = points
  }

  path(): string {
    const first = this.points[0]
    if (first === undefined) return ""
    const parts = [`M ${first.x},${first.y}`]
    for (const { x, y, r, sweep } of this.points.slice(1)) {
      parts.push(r === null || Number.isNaN(r) ? `L ${x},${y}` : `A ${r} ${r} 0 0 ${sweep ?? 0} ${x} ${y}`)
    }
    return parts.join(" ")
  }

  offset(offset: number): CirclePath {
    const first = this.points[0]
    if (first === undefined) throw new Error("Cannot offset an empty graph curve")
    const points = this.points.map(({ x, y, nx, ny }) => ({ x: x - ny * offset, y: y + nx * offset }))
    return new CirclePath(first.nx, first.ny, points)
  }

  transpose(): CirclePath {
    const first = this.points[0]
    if (first === undefined) throw new Error("Cannot transpose an empty graph curve")
    const points: CirclePoint[] = this.points.map(({ x, y, nx, ny, r, sweep }) => ({
      x: y,
      y: x,
      nx: ny,
      ny: nx,
      r,
      sweep: sweep === 0 ? 1 : sweep === 1 ? 0 : null,
    }))
    const transposed = new CirclePath(first.ny, first.nx, points)
    transposed.points = points
    return transposed
  }
}

type Vector2 = readonly [number, number]

function norm([x, y]: Vector2): Vector2 {
  const distance = Math.sqrt(x ** 2 + y ** 2)
  return distance === 0 ? [1, 0] : [x / distance, y / distance]
}

function toFrame(tx: number, ty: number, x: number, y: number): Vector2 {
  return [tx * x + ty * y, -ty * x + tx * y]
}

function fromFrame(tx: number, ty: number, x: number, y: number): Vector2 {
  return toFrame(tx, -ty, x, y)
}

function rotateRight(x: number, y: number): Vector2 {
  return [-y, x]
}

function rotateLeft(x: number, y: number): Vector2 {
  return [y, -x]
}

function doubleArcAdjustPath(
  tx: number,
  ty: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): CirclePath {
  const [fx, fy] = toFrame(tx, ty, x2 - x1, y2 - y1)
  const rotate = fy > 0 ? rotateRight : rotateLeft
  const [nx, ny] = rotate(tx, ty)
  const radius = width / 2 + 10
  const centerX = x1 + nx * radius
  const centerY = y1 + ny * radius
  const middleX = (x1 + x2) / 2
  const middleY = (y1 + y2) / 2
  const [centerTangentX, centerTangentY] = fromFrame(tx, ty, fx / 2, fy)
  const [centerNormalX, centerNormalY] = norm(rotate(centerTangentX, centerTangentY))
  const candidateX = middleX + centerNormalX * radius
  const candidateY = middleY + centerNormalY * radius
  const crossX = candidateX - centerX
  const crossY = candidateY - centerY
  const [mirrorX, mirrorY] = norm(rotate(crossX, crossY))
  const dot = centerNormalX * mirrorX + centerNormalY * mirrorY
  const offsetX = 2 * dot * mirrorX - centerNormalX
  const offsetY = 2 * dot * mirrorY - centerNormalY
  const secondX = centerX - offsetX * radius
  const secondY = centerY - offsetY * radius
  const fourthX = x2 - (secondX - x1)
  const fourthY = y2 - (secondY - y1)
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: secondX, y: secondY },
    { x: middleX, y: middleY },
    { x: fourthX, y: fourthY },
    { x: x2, y: y2 },
  ])
}

function makeCurve(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number, width = 0): CirclePath {
  const [fx, fy] = toFrame(tx, ty, x2 - x1, y2 - y1)
  if (fy === 0) {
    return new CirclePath(tx, ty, [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ])
  }
  const slope = fy / fx
  if (-0.75 <= slope && slope <= 0.75) {
    return new CirclePath(tx, ty, [
      { x: x1, y: y1 },
      { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
      { x: x2, y: y2 },
    ])
  }
  return doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width)
}

function selfPath(link: GraphEdge): CirclePath {
  const startX = link.source.x1
  const startY = link.y0
  const outsideStartY = link.source.y1 + link.width / 2 + 10
  const outsideEndY = link.target.y1 + link.width / 2 + 10
  return new CirclePath(1, 0, [
    { x: startX, y: startY },
    { x: startX, y: outsideStartY },
    { x: link.target.x0, y: outsideEndY },
    { x: link.target.x0, y: link.y1 },
  ])
}

function backwardPath(link: GraphEdge): CirclePath {
  const startX = link.source.x1
  const endX = link.target.x0
  const sourceAbove = link.source.y0 - link.width / 2 - 10
  const sourceBelow = link.source.y1 + link.width / 2 + 10
  const targetAbove = link.target.y0 - link.width / 2 - 10
  const targetBelow = link.target.y1 + link.width / 2 + 10
  let startY: number
  let endY: number
  if (sourceBelow < targetAbove) {
    startY = sourceBelow
    endY = targetAbove
  } else if (sourceAbove > targetBelow) {
    startY = sourceAbove
    endY = targetBelow
  } else {
    startY = sourceBelow
    endY = targetBelow
  }
  const points: GraphPoint[] = [{ x: startX, y: link.y0 }]
  points.push(...makeCurve(-1, 0, startX, startY, endX, endY).points.map(({ x, y }) => ({ x, y })))
  points.push({ x: endX, y: link.y1 })
  return new CirclePath(1, 0, points)
}

function linkPath(link: GraphEdge): CirclePath {
  if (link.direction === "self") return selfPath(link)
  if (link.direction === "backward") return backwardPath(link)
  return makeCurve(1, 0, link.source.x1, link.y0, link.target.x0, link.y1, link.width)
}

function renderSankey(options: VisualizationOptions, data: GraphData, direction: GraphDirection): void {
  const { specification, svg: svgElement } = options
  let maxNodeWidth = 0
  const testSvg = select(document.body).append("svg").classed("sankey graph-measurement", true)
  const text = testSvg.append("text")
  const textNode = text.node()
  if (!(textNode instanceof SVGTextElement)) throw new Error("Unable to create graph measurement text")
  for (const node of data.nodes) {
    const width = node.labelWidth(textNode, SANKEY_NODE_MARGIN)
    maxNodeWidth = Math.max(maxNodeWidth, width)
    node.width = width
  }
  testSvg.remove()

  const [nodeWidth, nodePadding] =
    direction === "down" ? [SANKEY_NODE_PADDING, maxNodeWidth] : [maxNodeWidth, SANKEY_NODE_PADDING]
  const sankey = d3sankey.sankey()
  const sankeyRight: (node: GraphLayoutNode, columns: number) => number = d3sankey.sankeyRight
  sankey.nodeWidth(nodeWidth)
  sankey.nodePadding(nodePadding)
  sankey.nodeAlign(sankeyRight)
  sankey.maxNodeHeight(SANKEY_MAX_NODE_HEIGHT)
  sankey.linkLength(SANKEY_COLUMN_WIDTH)
  const graph: SankeyGraph = sankey(data)

  const [itemColors, recipeColors] = getColorMaps(options, graph.nodes, graph.links)
  for (const link of graph.links) {
    link.curve = linkPath(link)
    if (direction === "down") link.curve = link.curve.transpose()
    link.belts = []
    if (link.beltCount !== null) {
      const beltCount = link.beltCount.toFloat()
      const beltWidth = beltCount === 0 ? 0 : link.width / beltCount
      if (beltWidth > 3) {
        for (let index = 1; index < beltCount; index++) {
          link.belts.push({ item: link.item, curve: link.curve.offset(index * beltWidth - link.width / 2) })
        }
      }
    }
  }

  if (direction === "down") {
    for (const node of graph.nodes) {
      ;[node.x0, node.y0] = [node.y0, node.x0]
      ;[node.x1, node.y1] = [node.y1, node.x1]
    }
  }

  const svg = select(svgElement).classed("sankey", true)
  const nodes = svg
    .append("g")
    .classed("nodes", true)
    .selectAll<SVGGElement, GraphLayoutNode>("g")
    .data(graph.nodes)
    .join("g")
    .classed("node", true)
  renderNode(options, nodes, SANKEY_NODE_MARGIN, direction === "down" ? "center" : "left", recipeColors)

  const links = svg
    .append("g")
    .classed("links", true)
    .selectAll<SVGGElement, GraphEdge>("g")
    .data(graph.links)
    .join("g")
    .classed("link", true)
    .classed("fuel", (link) => link.fuel)
    .each(function (link) {
      link.elements.push(this)
    })

  links
    .append("path")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .attr("d", (link) => link.curve.path())
    .attr("stroke", (link) => itemColor(itemColors, link.item))
    .attr("stroke-width", (link) => Math.max(1, link.width))

  links
    .append("g")
    .selectAll("path")
    .data((link) => [link.curve.offset(-link.width / 2), link.curve.offset(link.width / 2)])
    .join("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("d", (curve) => curve.path())
    .attr("stroke", "none")
    .attr("stroke-width", 1)

  links
    .append("g")
    .classed("belts", true)
    .selectAll("path")
    .data((link) => link.belts)
    .join("path")
    .classed("belt", true)
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .attr("d", (belt) => belt.curve.path())
    .attr("stroke", (belt) => itemColor(itemColors, belt.item))
    .attr("stroke-width", 1)

  links
    .append("title")
    .text((link) => `${link.source.name} \u2192 ${link.target.name}\n${specification.format.rate(link.rate)}`)

  const { hash, width, height } = options.spriteSheet
  const extraIcons = links
    .filter((link) => link.extra)
    .append("svg")
    .attr("viewBox", (link) => imageViewBox(options, link.item.icon.obj))
    .attr("x", (link) => link.source.x1 + 2.25)
    .attr("y", (link) => link.y0 - ICON_SIZE / 4 + 0.25)
    .attr("width", ICON_SIZE / 2)
    .attr("height", ICON_SIZE / 2)
  extraIcons
    .append("image")
    .attr("href", `images/sprite-sheet-${hash}.webp`)
    .attr("width", width)
    .attr("height", height)
  if (direction === "down") {
    extraIcons.attr("x", (link) => link.y0 - ICON_SIZE / 4 + 0.25).attr("y", (link) => link.source.y1 + 2.25)
  }

  const labels = links
    .append("text")
    .attr("x", (link) => link.source.x1 + 2 + (link.extra ? ICON_SIZE / 2 : 0))
    .attr("y", (link) => link.y0)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(
      (link) =>
        `${link.extra ? "\u00d7 " : ""}${specification.format.rate(link.rate)}/${specification.format.rateName}`,
    )
  if (direction === "down") {
    labels
      .attr("x", null)
      .attr("y", null)
      .attr("transform", (link) => {
        const x = link.y0
        const y = link.source.y1 + 2 + (link.extra ? 16 : 0)
        return `translate(${x},${y}) rotate(90)`
      })
  }

  svg
    .append("g")
    .classed("overlay", true)
    .selectAll<SVGRectElement, GraphLayoutNode>("rect")
    .data(graph.nodes)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (node) => node.x0)
    .attr("y", (node) => node.y0)
    .attr("width", (node) => node.x1 - node.x0)
    .attr("height", (node) => node.y1 - node.y0)
    .on("mouseover", graphMouseOverHandler)
    .on("mouseleave", graphMouseLeaveHandler)
    .on("click", graphClickHandler)
    .append("title")
    .text((node) =>
      node.count.isZero() || node.building === null
        ? node.name
        : `${node.name}\n${node.building.name} \u00d7 ${specification.format.count(node.count)}`,
    )
}

const MAX_ZOOM_SCALE = 10
const ASPECT_RATIO = 16 / 9

function measureGraph(svgElement: SVGSVGElement): DOMRect {
  const svg = select(svgElement)
  svg.selectAll("image").style("display", "none")
  const bounds = svgElement.getBBox()
  svg.selectAll("image").style("display", null)
  return bounds
}

function installSvgEvents(svgElement: SVGSVGElement): void {
  const svg = select(svgElement)
  let { x, y, width, height } = measureGraph(svgElement)
  if (width <= 0 || height <= 0) return

  const diagramX = x
  const diagramY = y
  const diagramWidth = width
  const diagramHeight = height
  if (width / height < ASPECT_RATIO) {
    const newWidth = height * ASPECT_RATIO
    x -= (newWidth - width) / 2
    width = newWidth
  } else if (width / height > ASPECT_RATIO) {
    const newHeight = width / ASPECT_RATIO
    y -= (newHeight - height) / 2
    height = newHeight
  }
  const originalWidth = width
  const originalHeight = height
  y = diagramY
  let scale = MAX_ZOOM_SCALE
  let clickPoint: DOMPoint | null = null

  const clamp = (): void => {
    const middleX = x + width / 2
    const middleY = y + height / 2
    if (diagramX > middleX) x = diagramX - width / 2
    else if (diagramX + diagramWidth < middleX) x = diagramX + diagramWidth - width / 2
    if (diagramY > middleY) y = diagramY - height / 2
    else if (diagramY + diagramHeight < middleY) y = diagramY + diagramHeight - height / 2
  }

  const setViewBox = (): void => {
    clamp()
    svg.attr("viewBox", `${x} ${y} ${width} ${height}`)
  }

  const point = (event: MouseEvent): DOMPoint => {
    const matrix = svgElement.getScreenCTM()
    if (matrix === null) throw new Error("Graph SVG has no screen transform")
    return new DOMPointReadOnly(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }

  const zoom = (event: WheelEvent): void => {
    event.preventDefault()
    const previousScale = scale
    if (event.deltaY < 0) {
      if (scale === 1) return
      scale--
    } else if (event.deltaY > 0) {
      if (scale === MAX_ZOOM_SCALE + 2) return
      scale++
    }
    const cursor = point(event)
    const dx = cursor.x - x
    const dy = cursor.y - y
    x = cursor.x - (dx / previousScale) * scale
    y = cursor.y - (dy / previousScale) * scale
    width = originalWidth * (scale / MAX_ZOOM_SCALE)
    height = originalHeight * (scale / MAX_ZOOM_SCALE)
    setViewBox()
  }

  const mouseDown = (event: MouseEvent): void => {
    clickPoint = point(event)
    event.preventDefault()
  }
  const mouseMove = (event: MouseEvent): void => {
    if (clickPoint === null) return
    const cursor = point(event)
    x -= cursor.x - clickPoint.x
    y -= cursor.y - clickPoint.y
    setViewBox()
    event.preventDefault()
  }
  const mouseUp = (event: MouseEvent): void => {
    clickPoint = null
    event.preventDefault()
  }

  setViewBox()
  svg
    .on("wheel.visualization", zoom)
    .on("mousedown.visualization", mouseDown)
    .on("mousemove.visualization", mouseMove)
    .on("mouseup.visualization", mouseUp)
}

function finishViewport(options: VisualizationOptions): void {
  const { svg: svgElement, visualizerRender } = options
  const svg = select(svgElement)
  svg.on(".visualization", null)

  if (visualizerRender === "zoom") {
    svg
      .attr("width", null)
      .attr("height", null)
      .style("width", "100%")
      .style("height", "70vh")
      .style("min-height", "500px")
      .style("max-height", "780px")
    installSvgEvents(svgElement)
    return
  }

  const { x, y, width, height } = measureGraph(svgElement)
  svg
    .attr("viewBox", `${x} ${y} ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .style("width", null)
    .style("height", null)
    .style("min-height", null)
    .style("max-height", null)
}

export function renderVisualization(options: VisualizationOptions): void {
  clickedNode = null
  const svg = select(options.svg)
  svg.on(".visualization", null).selectAll("*").remove()
  svg.append("title").text("Factory recipe flow graph")

  const data = makeGraph(options)
  const direction: GraphDirection = options.visualizerDirection === "down" ? "down" : "right"
  if (options.visualizerType === "sankey") renderSankey(options, data, direction)
  else renderBoxGraph(options, data, direction)
  finishViewport(options)
}

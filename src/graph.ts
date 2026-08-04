import { color, select, style } from "d3"
const d3: any = { color, select, style }
import * as d3sankey from "./vendor/d3-sankey/index.js"
import { spec } from "./factory.js"
import { one } from "./math.js"
import { PX_HEIGHT, PX_WIDTH, sheetHash, sheetHeight, sheetWidth } from "./presentation.js"

// -----------------------------------------------------------------------------
// Graph interactions
// -----------------------------------------------------------------------------

let clickedNode: any = null

export function graphClickHandler(_event: Event, node: any) {
  if (node === clickedNode) {
    node.unhighlight()
    clickedNode = null
  } else {
    clickedNode?.unhighlight()
    clickedNode = node
  }
}

export function graphMouseOverHandler(_event: Event, node: any) {
  node.highlight()
}

export function graphMouseLeaveHandler(_event: Event, node: any) {
  if (node !== clickedNode) {
    node.unhighlight()
  }
}

// -----------------------------------------------------------------------------
// Circular graph paths
// -----------------------------------------------------------------------------

export class CirclePath {
  [key: string]: any
  constructor(nx, ny, pairs) {
    let { x, y } = pairs[0]
    let r = null
    let sweep = null
    // (x, y): The coordinate.
    // (nx, ny): The unit vector tangent to the curve at this point.
    // r: The radius of the circle leading to this point.
    // sweep: 1 = clockwise, 0 = counter-clockwise
    // r and sweep are null for the first point, as there is no circle
    // leading to it.
    let points = [{ x, y, nx, ny, r, sweep }]
    let prevX = x
    let prevY = y
    for (let { x, y } of pairs.slice(1)) {
      let dx = (x - prevX) / 2
      let dy = (y - prevY) / 2
      let t = nx * dx + ny * dy
      let r1 = -ny * dx + nx * dy
      // If deflection is less than one pixel, draw a straight line.
      if (-0.5 < r1 && r1 < 0.5) {
        let r = null
        let sweep = null
        // Still update n vector.
        let [normdx, normdy] = norm([dx, dy])
        let dot = nx * normdx + ny * normdy
        nx = 2 * dot * normdx - nx
        ny = 2 * dot * normdy - ny
        points.push({ x, y, nx, ny, r, sweep })
        prevX = x
        prevY = y
        continue
      }
      let sweep = 1
      let npx = -ny
      let npy = nx
      if (r1 < 0) {
        sweep = 0
        r1 = -r1
        npx = -npx
        npy = -npy
      }
      let r = r1 + t ** 2 / r1
      let cx = npx * r
      let cy = npy * r
      // compute new tangent
      npx = (cx - 2 * dx) / r
      npy = (cy - 2 * dy) / r
      nx = npy
      ny = -npx
      if (sweep === 0) {
        nx = -nx
        ny = -ny
      }
      points.push({ x, y, nx, ny, r, sweep })
      prevX = x
      prevY = y
    }
    this.points = points
  }

  path() {
    let { x, y } = this.points[0]
    let parts = [`M ${x},${y}`]
    for (let { x, y, r, sweep } of this.points.slice(1)) {
      if (r === null || Number.isNaN(r)) {
        parts.push(`L ${x},${y}`)
        continue
      }
      parts.push(`A ${r} ${r} 0 0 ${sweep} ${x} ${y}`)
    }
    return parts.join(" ")
  }

  offset(offset) {
    let tx = this.points[0].nx
    let ty = this.points[0].ny
    let points = []
    for (let { x, y, nx, ny } of this.points) {
      points.push({ x: x + -ny * offset, y: y + nx * offset })
    }
    return new CirclePath(tx, ty, points)
  }

  transpose() {
    let points = []
    for (let { x, y, nx, ny, r, sweep } of this.points) {
      if (sweep === 0) {
        sweep = 1
      } else if (sweep === 1) {
        sweep = 0
      }
      points.push({
        x: y,
        y: x,
        nx: ny,
        ny: nx,
        r: r,
        sweep: sweep,
      })
    }
    let obj = Object.create(CirclePath.prototype)
    obj.points = points
    return obj
  }
}

function norm([x, y]) {
  let d = Math.sqrt(x ** 2 + y ** 2)
  return [x / d, y / d]
}

const MIN_RADIUS = 10

// Paths come in four kinds. All mentioned slopes are within the frame of
// reference of the initial tangent vector.
// (E.g. when t is <1, 0>, slopes have the usual meaning.)
// 1) Straight line
//      Used when slope == 0.
// 2) Double arcs
//      Used when slope of overall line is in the range [-0.75, 0.75],
//      excluding 0.
//
//      Consists of two circular arcs, one beginning at the start point and
//      terminating at the middle, the other beginning at the middle and
//      terminating at the end point.
// 3) Initial adjustment w/ double arcs
//      Used with steeper slopes than the previous, so long as the first
//      critical point is located before the line crossing through the center
//      with double the slope.
//
//      Similar to the double arcs, but with a short initial curve on either
//      end to permit the slope at the middle point to equal double the
//      overall slope (similar to a cubic Bezier curve).
// 4) Initial adjustment w/ straight line
//      Used as final fallback in all other cases.
//
//      Generally only needed when the overall slope is too steep for other
//      approaches to be feasible.

// Vector from start point to end point in reference frame of tangent vector.
function toFrame(tx, ty, x, y) {
  let dotx = tx * x + ty * y
  let doty = -ty * x + tx * y
  return [dotx, doty]
}

function fromFrame(tx, ty, x, y) {
  return toFrame(tx, -ty, x, y)
}

function frameSlope(tx, ty, x1, y1, x2, y2) {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  if (fx === 0) {
    return null
  }
  return fy / fx
}

function linePath(tx, ty, x1, y1, x2, y2) {
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ])
}

function doubleArcPath(tx, ty, x1, y1, x2, y2) {
  let midx = (x1 + x2) / 2
  let midy = (y1 + y2) / 2
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: midx, y: midy },
    { x: x2, y: y2 },
  ])
}

// Vector transpose functions in SVG coord space (i.e. inverted y axis).
function R(x, y) {
  return [-y, x]
}
function L(x, y) {
  return [y, -x]
}

function doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width) {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  let T
  if (fy > 0) {
    // Curving to right.
    T = R
  } else {
    // Curving to left.
    T = L
  }
  let [nx, ny] = T(tx, ty)
  // radius of first circle
  let r = width / 2 + MIN_RADIUS
  // center point of first circle
  let cx = x1 + nx * r
  let cy = y1 + ny * r
  // center point of whole curve
  let p3x = (x1 + x2) / 2
  let p3y = (y1 + y2) / 2
  // desired tangent vector at center point
  let [ctx, cty] = fromFrame(tx, ty, fx / 2, fy)
  // unit vector normal to tangent at center point
  // (points at center of second circle)
  let [cnx, cny] = norm(T(ctx, cty))
  // proceed from p3, r units towards center of circle 2
  let midx = p3x + cnx * r
  let midy = p3y + cny * r
  // vector pointing from center of circle 1, to that point
  let crossx = midx - cx
  let crossy = midy - cy
  // unit vector pointing from midpoint of that cross-vector, to center of
  // circle 2
  let [mx, my] = norm(T(crossx, crossy))
  // reflect cn over m; gives unit vector pointing from center of circle 1
  // to center of circle 2
  let dot = cnx * mx + cny * my
  let ox = 2 * dot * mx - cnx
  let oy = 2 * dot * my - cny
  // calculate points 2 and 4
  let p2x = cx + -ox * r
  let p2y = cy + -oy * r
  let p4x = x2 - (p2x - x1)
  let p4y = y2 - (p2y - y1)
  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: p2x, y: p2y },
    { x: p3x, y: p3y },
    { x: p4x, y: p4y },
    { x: x2, y: y2 },
  ])
}

function lineAdjustPath(tx, ty, x1, y1, x2, y2, width) {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  let T
  if (fy > 0) {
    // Curving to right.
    T = R
  } else {
    // Curving to left.
    T = L
  }
  let [nx, ny] = T(tx, ty)
  // radius of both circles
  let r = width / 2 + MIN_RADIUS
  // center points of both circles
  let r1x = x1 + nx * r
  let r1y = y1 + ny * r
  let r2x = x2 - nx * r
  let r2y = y2 - ny * r
  // center point of whole curve
  let cx = (x1 + x2) / 2
  let cy = (y1 + y2) / 2
  // distance between circle center and curve center
  let d = Math.sqrt((cx - r1x) ** 2 + (cy - r1y) ** 2)
  // unit vector from circle center to curve center
  let ax = (cx - r1x) / d
  let ay = (cy - r1y) / d
  // normal pointing towards inflection point
  let [bx, by] = T(-ax, -ay)
  // A wee spot o' trig.
  let d1 = r ** 2 / d
  let h = r ** 2 - Math.sqrt(r ** 2 - r ** 4 / d ** 2)
  let px = ax * d1 + bx * h
  let py = ay * d1 + by * h

  return new CirclePath(tx, ty, [
    { x: x1, y: y1 },
    { x: r1x + px, y: r1y + py },
    { x: r2x - px, y: r2y - py },
    { x: x2, y: y2 },
  ])
}

export function makeCurve(tx, ty, x1, y1, x2, y2, width = 0) {
  let dx = x2 - x1
  let dy = y2 - y1
  let [fx, fy] = toFrame(tx, ty, dx, dy)
  if (fy === 0) {
    return linePath(tx, ty, x1, y1, x2, y2)
  }
  let slope = fy / fx
  if (-0.75 <= slope && slope <= 0.75) {
    return doubleArcPath(tx, ty, x1, y1, x2, y2)
  }
  return doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width)
}

// -----------------------------------------------------------------------------
// Shared graph primitives
// -----------------------------------------------------------------------------

// Code common between the Sankey and boxline visualizations.

export const colorList = [
  "#1f77b4", // blue
  "#8c564b", // brown
  "#2ca02c", // green
  "#d62728", // red
  "#9467bd", // purple
  "#e377c2", // pink
  "#17becf", // cyan
  "#7f7f7f", // gray
  "#bcbd22", // yellow
  "#ff7f0e", // orange
]

export const iconSize = 32
export const colonWidth = 12

function itemNeighbors(item) {
  let touching = new Set()
  let recipes = item.recipes.concat(item.uses)
  for (let recipe of recipes) {
    let ingredients = recipe.getIngredients().concat(recipe.products)
    for (let ing of ingredients) {
      touching.add(ing.item)
    }
  }
  return touching
}

function itemDegree(item) {
  return itemNeighbors(item).size
}

export function getColorMaps(nodes, links) {
  let itemColors = new Map()
  let recipeColors = new Map()
  let items = []
  for (let link of links) {
    items.push(link.item)
  }
  items.sort(function (a, b) {
    return itemDegree(b) - itemDegree(a)
  })
  let remainingItems = new Set<any>(items)
  while (remainingItems.size > 0) {
    let chosenItem = null
    let usedColors = null
    let max = -1
    for (let item of remainingItems) {
      let neighbors = itemNeighbors(item)
      let colors = new Set()
      for (let neighbor of neighbors) {
        if (itemColors.has(neighbor)) {
          colors.add(itemColors.get(neighbor))
        }
      }
      if (colors.size > max) {
        max = colors.size
        usedColors = colors
        chosenItem = item
      }
    }
    remainingItems.delete(chosenItem)
    let color = 0
    while (usedColors.has(color)) {
      color++
    }
    itemColors.set(chosenItem, color)
  }
  // This is intended to be taken modulo the number of colors when it is
  // actually used.
  let recipeColor = 0
  for (let node of nodes) {
    let recipe = node.recipe
    if (recipe.products.length === 1 && itemColors.has(recipe.products[0].item)) {
      recipeColors.set(recipe, itemColors.get(recipe.products[0].item))
    } else {
      recipeColors.set(recipe, recipeColor++)
    }
  }
  return [itemColors, recipeColors]
}

export function imageViewBox(obj) {
  var x1 = obj.icon_col * PX_WIDTH + 0.5
  var y1 = obj.icon_row * PX_HEIGHT + 0.5
  return `${x1} ${y1} ${PX_WIDTH - 1} ${PX_HEIGHT - 1}`
}

export function renderNode(rects, nodeMargin, justification, recipeColors, ignore) {
  rects.each((d) => {
    if (justification === "left") {
      d.labelX = d.x0
    } else {
      d.labelX = (d.x0 + d.x1) / 2 - d.width / 2
    }
  })
  // main rect
  rects
    .append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => d3.color(colorList[recipeColors.get(d.recipe) % colorList.length]).darker())
    .attr("stroke", (d) => colorList[recipeColors.get(d.recipe) % colorList.length])
    .each(function (this: SVGElement, d) {
      d.element = this
    })
  // plain text node (output, surplus)
  rects
    .filter((d) => d.rate === null)
    .append("text")
    .attr("x", (d) => (d.x0 + d.x1) / 2)
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => d.text())
  let labeledNode = rects.filter((d) => d.rate !== null)
  // recipe icon
  labeledNode
    .append("svg")
    .attr("viewBox", (d) => imageViewBox(d.recipe))
    .attr("x", (d) => d.labelX + nodeMargin + 0.5)
    .attr("y", (d) => (d.y0 + d.y1) / 2 - iconSize / 2 + 0.5)
    .attr("width", iconSize)
    .attr("height", iconSize)
    .append("image")
    .classed("ignore", (d) => ignore.has(d.recipe))
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
  // node text (building count, or plain rate if no building)
  labeledNode
    .append("text")
    .attr("x", (d) => d.labelX + nodeMargin + iconSize + (d.building === null ? 0 : colonWidth + iconSize) /*+ 5*/)
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .text((d) => d.text())
  let buildingNode = rects.filter((d) => d.building !== null)
  // colon
  buildingNode
    .append("circle")
    .classed("colon", true)
    .attr("cx", (d) => d.labelX + nodeMargin + iconSize + colonWidth / 2)
    .attr("cy", (d) => (d.y0 + d.y1) / 2 - 4)
    .attr("r", 1)
  buildingNode
    .append("circle")
    .classed("colon", true)
    .attr("cx", (d) => d.labelX + nodeMargin + iconSize + colonWidth / 2)
    .attr("cy", (d) => (d.y0 + d.y1) / 2 + 4)
    .attr("r", 1)
  // building icon
  buildingNode
    .append("svg")
    .attr("viewBox", (d) => imageViewBox(d.building))
    .attr("x", (d) => d.labelX + iconSize + colonWidth + nodeMargin + 0.5)
    .attr("y", (d) => (d.y0 + d.y1) / 2 - iconSize / 2 + 0.5)
    .attr("width", iconSize)
    .attr("height", iconSize)
    .append("image")
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
}

// -----------------------------------------------------------------------------
// Sankey graph
// -----------------------------------------------------------------------------

const nodePadding = 36
const sankeyNodeMargin = 2

const columnWidth = 200
const maxNodeHeight = 175

function selfPath(d) {
  let x0 = d.source.x1
  let y0 = d.y0
  let x1 = d.source.x1
  let y1 = d.source.y1 + d.width / 2 + 10
  let r1 = (y1 - y0) / 2
  let x2 = d.target.x0
  let y2 = d.target.y1 + d.width / 2 + 10
  let x3 = d.target.x0
  let y3 = d.y1
  let r2 = (y3 - y2) / 2
  return new CirclePath(1, 0, [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
  ])
}

function backwardPath(d) {
  // start point
  let x0 = d.source.x1
  let y0 = d.y0
  // end point
  let x3 = d.target.x0
  let y3 = d.y1
  let y2a = d.source.y0 - d.width / 2 - 10
  let y2b = d.source.y1 + d.width / 2 + 10
  let y3a = d.target.y0 - d.width / 2 - 10
  let y3b = d.target.y1 + d.width / 2 + 10
  let points = [{ x: x0, y: y0 }]
  let starty
  let endy
  if (y2b < y3a) {
    // draw start arc down, end arc up
    starty = y2b
    endy = y3a
  } else if (y2a > y3b) {
    // draw start arc up, end arc down
    starty = y2a
    endy = y3b
  } else {
    // draw both arcs down
    starty = y2b
    endy = y3b
  }
  let curve = makeCurve(-1, 0, x0, starty, x3, endy)
  for (let { x, y } of curve.points) {
    points.push({ x, y })
  }
  points.push({ x: x3, y: y3 })
  return new CirclePath(1, 0, points)
}

function linkPath(d) {
  if (d.direction === "self") {
    return selfPath(d)
  } else if (d.direction === "backward") {
    return backwardPath(d)
  }
  let x0 = d.source.x1
  let y0 = d.y0
  let x1 = d.target.x0
  let y1 = d.y1
  return makeCurve(1, 0, x0, y0, x1, y1, d.width)
}

export function renderSankey(data, direction, ignore) {
  let maxNodeWidth = 0
  let testSVG = d3.select("body").append("svg").classed("sankey test", true)
  let text = testSVG.append("text")
  for (let node of data.nodes) {
    let nodeWidth = node.labelWidth(text, sankeyNodeMargin)
    if (nodeWidth > maxNodeWidth) {
      maxNodeWidth = nodeWidth
    }
    node.width = nodeWidth
  }
  text.remove()
  testSVG.remove()

  let nw, np
  if (direction === "down") {
    nw = nodePadding
    np = maxNodeWidth
  } else if (direction === "right") {
    nw = maxNodeWidth
    np = nodePadding
  }
  let sankey: any = d3sankey.sankey()
  sankey = sankey
    .nodeWidth(nw)
    .nodePadding(np)
    .nodeAlign(d3sankey.sankeyRight)
    .maxNodeHeight(maxNodeHeight)
    .linkLength(columnWidth)
  let { nodes, links } = sankey(data)
  let [itemColors, recipeColors] = getColorMaps(nodes, links)

  for (let link of links) {
    link.curve = linkPath(link)
    if (direction === "down") {
      link.curve = link.curve.transpose()
    }
    let belts = []
    if (link.beltCount !== null) {
      let dy = link.width / link.beltCount.toFloat()
      // Only render belts if there are at least three pixels per belt.
      if (dy > 3) {
        for (let i = one; i.less(link.beltCount); i = i.add(one)) {
          let offset = i.toFloat() * dy - link.width / 2
          let beltCurve = link.curve.offset(offset)
          belts.push({ item: link.item, curve: beltCurve })
        }
      }
    }
    link.belts = belts
  }

  if (direction === "down") {
    for (let node of nodes) {
      ;[node.x0, node.y0] = [node.y0, node.x0]
      ;[node.x1, node.y1] = [node.y1, node.x1]
    }
  }

  let svg = d3.select("svg#graph").classed("sankey", true)
  svg.selectAll("g").remove()

  // Node rects
  let rects = svg.append("g").classed("nodes", true).selectAll("g").data(nodes).join("g").classed("node", true)

  let nodeJust = "left"
  if (direction === "down") {
    nodeJust = "center"
  }
  renderNode(rects, sankeyNodeMargin, nodeJust, recipeColors, ignore)

  // Link paths
  let link = svg
    .append("g")
    .classed("links", true)
    .selectAll("g")
    .data(links)
    .join("g")
    .classed("link", true)
    .each(function (this: SVGGElement, d) {
      d.elements.push(this)
    })
  //.style("mix-blend-mode", "multiply")
  link
    .append("path")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .attr("d", (d) => d.curve.path())
    .attr("stroke", (d) => colorList[itemColors.get(d.item) % colorList.length])
    .attr("stroke-width", (d) => Math.max(1, d.width))
  link
    .append("g")
    .selectAll("path")
    .data((d) => [d.curve.offset(-d.width / 2), d.curve.offset(d.width / 2)])
    .join("path")
    .classed("highlighter", true)
    .attr("fill", "none")
    .attr("d", (d) => d.path())
    .attr("stroke", "none")
    .attr("stroke-width", 1)
  link
    .append("g")
    .classed("belts", true)
    .selectAll("path")
    .data((d) => d.belts)
    .join("path")
    .classed("belt", true)
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .attr("d", (d) => d.curve.path())
    .attr("stroke", (d) => colorList[itemColors.get(d.item) % colorList.length])
    .attr("stroke-width", 1)
  link.append("title").text((d) => `${d.source.name} \u2192 ${d.target.name}\n${spec.format.rate(d.rate)}`)
  let linkIcon = link
    .filter((d) => d.extra)
    .append("svg")
    .attr("viewBox", (d) => imageViewBox(d.item))
    .attr("x", (d) => d.source.x1 + 2.25)
    .attr("y", (d) => d.y0 - iconSize / 4 + 0.25)
    .attr("width", iconSize / 2)
    .attr("height", iconSize / 2)
  linkIcon
    .append("image")
    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".webp")
    .attr("width", sheetWidth)
    .attr("height", sheetHeight)
  if (direction === "down") {
    linkIcon.attr("x", (d) => d.y0 - iconSize / 4 + 0.25).attr("y", (d) => d.source.y1 + 2.25)
  }
  let linkLabel = link
    .append("text")
    .attr("x", (d) => d.source.x1 + 2 + (d.extra ? iconSize / 2 : 0))
    .attr("y", (d) => d.y0)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text((d) => (d.extra ? "\u00d7 " : "") + spec.format.rate(d.rate) + "/" + spec.format.rateName)
  if (direction === "down") {
    linkLabel
      .attr("x", null)
      .attr("y", null)
      .attr("transform", (d) => {
        let x = d.y0
        let y = d.source.y1 + 2 + (d.extra ? 16 : 0)
        return `translate(${x},${y}) rotate(90)`
      })
  }

  // Overlay transparent rect on top of each node, for click events.
  let rectElements = svg.selectAll("g.node rect").nodes()
  let overlayData = []
  // Flash the graph tab to be visible, so that the graph is laid out and
  // the BBox is not empty.
  let graphTab = d3.select("#graph_tab")
  let origDisplay = d3.style(graphTab.node(), "display")
  graphTab.style("display", "block")
  for (let i = 0; i < nodes.length; i++) {
    let rect = rectElements[i].getBBox()
    let node = nodes[i]
    let recipe = node.recipe
    overlayData.push({ rect, node, recipe })
  }
  graphTab.style("display", origDisplay)
  svg
    .append("g")
    .classed("overlay", true)
    .selectAll("rect")
    .data(overlayData)
    .join("rect")
    .attr("stroke", "none")
    .attr("fill", "transparent")
    .attr("x", (d) => d.rect.x)
    .attr("y", (d) => d.rect.y)
    .attr("width", (d) => d.rect.width)
    .attr("height", (d) => d.rect.height)
    .on("mouseover", (event, d) => graphMouseOverHandler(event, d.node))
    .on("mouseleave", (event, d) => graphMouseLeaveHandler(event, d.node))
    .on("click", (event, d) => graphClickHandler(event, d.node))
    .append("title")
    .text(
      (d) =>
        d.node.name +
        (d.node.count.isZero() ? "" : `\n${d.node.building.name} \u00d7 ${spec.format.count(d.node.count)}`),
    )
}

import { linkHorizontal, max, min, sum } from "d3"

function targetDepth(d) {
  return d.target.depth
}

function sankeyLeft(node) {
  return node.depth
}

function sankeyRight(node, n) {
  return n - 1 - node.height
}

function sankeyJustify(node, n) {
  return node.sourceLinks.length ? node.depth : n - 1
}

function sankeyCenter(node) {
  return node.targetLinks.length ? node.depth : node.sourceLinks.length ? min(node.sourceLinks, targetDepth) - 1 : 0
}

function constant(x) {
  return function () {
    return x
  }
}

// Determine a set of links which need to be reversed to render the graph
// acyclic.
//
// https://pdfs.semanticscholar.org/c7ed/d9acce96ca357876540e19664eb9d976637f.pdf
// https://en.wikipedia.org/wiki/Feedback_arc_set

function minFAS(graph) {
  let nodes = new Set()
  let indegrees = new Map()
  let outdegrees = new Map()
  for (let node of graph.nodes) {
    nodes.add(node)
    let incount = 0
    let outcount = 0
    for (let link of node.targetLinks) {
      if (link.source !== node) {
        incount++
      }
    }
    for (let link of node.sourceLinks) {
      if (link.target !== node) {
        outcount++
      }
    }
    indegrees.set(node, incount)
    outdegrees.set(node, outcount)
  }
  function remove(node) {
    nodes.delete(node)
    for (let link of node.targetLinks) {
      if (nodes.has(link.source)) {
        let subdegree = outdegrees.get(link.source)
        outdegrees.set(link.source, subdegree - 1)
      }
    }
    for (let link of node.sourceLinks) {
      if (nodes.has(link.target)) {
        let subdegree = indegrees.get(link.target)
        indegrees.set(link.target, subdegree - 1)
      }
    }
  }
  let s1 = []
  let s2 = []
  while (nodes.size > 0) {
    // Remove sink nodes until none are found.
    while (true) {
      let found = false
      for (let node of nodes) {
        let outdegree = outdegrees.get(node)
        if (outdegree === 0) {
          found = true
          s2.push(node)
          remove(node)
        }
      }
      if (!found) {
        break
      }
    }
    // Remove source nodes until none are found.
    while (true) {
      let found = false
      for (let node of nodes) {
        let indegree = indegrees.get(node)
        if (indegree === 0) {
          found = true
          s1.push(node)
          remove(node)
        }
      }
      if (!found) {
        break
      }
    }
    if (nodes.size === 0) {
      break
    }
    let maxDelta = null
    let maxNode = null
    for (let node of nodes) {
      let delta = outdegrees.get(node) - indegrees.get(node)
      if (maxDelta === null || delta > maxDelta) {
        maxDelta = delta
        maxNode = node
      }
    }
    s1.push(maxNode)
    remove(maxNode)
  }
  s2.reverse()
  let order = s1.concat(s2)
  let orderMap = new Map()
  for (let [i, node] of order.entries()) {
    orderMap.set(node, i)
  }
  for (let link of graph.links) {
    let i = orderMap.get(link.source)
    let j = orderMap.get(link.target)
    if (i === j) {
      link.direction = "self"
    } else if (i < j) {
      link.direction = "forward"
    } else {
      link.direction = "backward"
    }
  }
}

function ascendingSourceBreadth(a, b) {
  return ascendingBreadth(a.source, b.source) || a.index - b.index
}

function ascendingTargetBreadth(a, b) {
  return ascendingBreadth(a.target, b.target) || a.index - b.index
}

function ascendingBreadth(a, b) {
  return a.y0 - b.y0
}

function value(d) {
  return d.value
}

function defaultId(d) {
  return d.index
}

function defaultNodes(graph) {
  return graph.nodes
}

function defaultLinks(graph) {
  return graph.links
}

function find(nodeById, id) {
  const node = nodeById.get(id)
  if (!node) throw new Error("missing: " + id)
  return node
}

function computeLinkBreadths({ nodes }) {
  for (const node of nodes) {
    let y0 = node.y0
    let y1 = y0
    for (const link of node.sourceLinks) {
      link.y0 = y0 + link.width / 2
      y0 += link.width
    }
    for (const link of node.targetLinks) {
      link.y1 = y1 + link.width / 2
      y1 += link.width
    }
  }
}

export function sankey() {
  let x0 = 0,
    y0 = 0 // origin , x1 = 1, y1 = 1; // extent
  let dx = 24 // nodeWidth
  let linkLength = 100 // linkLength
  let maxHeight = 100 // maxNodeHeight
  let py = 8 // nodePadding
  let id = defaultId
  let align = sankeyJustify
  let sort
  let linkSort
  let nodes = defaultNodes
  let links = defaultLinks
  let iterations = 6

  function sankey() {
    const graph = { nodes: nodes.apply(null, arguments), links: links.apply(null, arguments) }
    computeNodeLinks(graph)
    computeNodeValues(graph)
    computeReversedLinks(graph)
    computeNodeDepths(graph)
    computeNodeHeights(graph)
    computeNodeBreadths(graph)
    computeLinkBreadths(graph)
    return graph
  }

  sankey.update = function (graph) {
    computeLinkBreadths(graph)
    return graph
  }

  sankey.nodeId = function (_) {
    return arguments.length ? ((id = typeof _ === "function" ? _ : constant(_)), sankey) : id
  }

  sankey.nodeAlign = function (_) {
    return arguments.length ? ((align = typeof _ === "function" ? _ : constant(_)), sankey) : align
  }

  sankey.nodeSort = function (_) {
    return arguments.length ? ((sort = _), sankey) : sort
  }

  sankey.nodeWidth = function (_) {
    return arguments.length ? ((dx = +_), sankey) : dx
  }

  sankey.linkLength = function (_) {
    return arguments.length ? ((linkLength = +_), sankey) : linkLength
  }

  sankey.maxNodeHeight = function (_) {
    return arguments.length ? ((maxHeight = +_), sankey) : maxHeight
  }

  sankey.nodePadding = function (_) {
    return arguments.length ? ((py = +_), sankey) : py
  }

  sankey.nodes = function (_) {
    return arguments.length ? ((nodes = typeof _ === "function" ? _ : constant(_)), sankey) : nodes
  }

  sankey.links = function (_) {
    return arguments.length ? ((links = typeof _ === "function" ? _ : constant(_)), sankey) : links
  }

  sankey.linkSort = function (_) {
    return arguments.length ? ((linkSort = _), sankey) : linkSort
  }

  sankey.origin = function (_) {
    return arguments.length ? ((x0 = +_[0]), (y0 = +_[1]), sankey) : [x0, y0]
  }

  sankey.iterations = function (_) {
    return arguments.length ? ((iterations = +_), sankey) : iterations
  }

  function computeNodeLinks({ nodes, links }) {
    for (const [i, node] of nodes.entries()) {
      node.index = i
      node.sourceLinks = []
      node.targetLinks = []
    }
    const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]))
    for (const [i, link] of links.entries()) {
      link.index = i
      let { source, target } = link
      if (typeof source !== "object") source = link.source = find(nodeById, source)
      if (typeof target !== "object") target = link.target = find(nodeById, target)
      source.sourceLinks.push(link)
      target.targetLinks.push(link)
    }
  }

  function computeNodeValues({ nodes }) {
    for (const node of nodes) {
      node.value = Math.max(sum(node.sourceLinks, value), sum(node.targetLinks, value))
    }
  }

  function computeReversedLinks(graph) {
    minFAS(graph)
  }

  function computeNodeDepths({ nodes }) {
    const n = nodes.length
    let current = new Set(nodes)
    let next = new Set()
    let x = 0
    while (current.size) {
      for (const node of current) {
        node.depth = x
        for (const { target, direction } of node.sourceLinks) {
          if (direction === "forward") {
            next.add(target)
          }
        }
        for (const { source, direction } of node.targetLinks) {
          if (direction === "backward") {
            next.add(source)
          }
        }
      }
      if (++x > n) throw new Error("circular link")
      current = next
      next = new Set()
    }
  }

  function computeNodeHeights({ nodes }) {
    const n = nodes.length
    let current = new Set(nodes)
    let next = new Set()
    let x = 0
    while (current.size) {
      for (const node of current) {
        node.height = x
        for (const { source, direction } of node.targetLinks) {
          if (direction === "forward") {
            next.add(source)
          }
        }
        for (const { target, direction } of node.sourceLinks) {
          if (direction === "backward") {
            next.add(target)
          }
        }
      }
      if (++x > n) throw new Error("circular link")
      current = next
      next = new Set()
    }
  }

  function computeNodeLayers({ nodes }) {
    const x = max(nodes, (d) => d.depth) + 1
    const kx = dx + linkLength
    const columns = new Array(x)
    for (const node of nodes) {
      const i = Math.max(0, Math.min(x - 1, Math.floor(align.call(null, node, x))))
      node.layer = i
      node.x0 = x0 + i * kx
      node.x1 = node.x0 + dx
      if (columns[i]) columns[i].push(node)
      else columns[i] = [node]
    }
    if (sort)
      for (const column of columns) {
        column.sort(sort)
      }
    return columns
  }

  function initializeNodeBreadths(columns) {
    const maxValue = max(columns, (c) => max(c, value))
    const ky = maxHeight / maxValue
    const y1 = max(columns, (c) => (c.length - 1) * py + sum(c, value) * ky)
    for (const nodes of columns) {
      let y = y0
      for (const node of nodes) {
        node.y0 = y
        node.y1 = y + node.value * ky
        y = node.y1 + py
        for (const link of node.sourceLinks) {
          link.width = link.value * ky
        }
      }
      y = (y1 - y + py) / (nodes.length + 1)
      for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i]
        node.y0 += y * (i + 1)
        node.y1 += y * (i + 1)
      }
      reorderLinks(nodes)
    }
    return y1
  }

  function computeNodeBreadths(graph) {
    const columns = computeNodeLayers(graph)
    const y1 = initializeNodeBreadths(columns)
    for (let i = 0; i < iterations; ++i) {
      const alpha = Math.pow(0.99, i)
      const beta = Math.max(1 - alpha, (i + 1) / iterations)
      relaxRightToLeft(columns, alpha, beta, y1)
      relaxLeftToRight(columns, alpha, beta, y1)
    }
  }

  // Reposition each node based on its incoming (target) links.
  function relaxLeftToRight(columns, alpha, beta, y1) {
    for (let i = 1, n = columns.length; i < n; ++i) {
      const column = columns[i]
      for (const target of column) {
        let y = 0
        let w = 0
        for (const { source, value } of target.targetLinks) {
          let v = value * (target.layer - source.layer)
          y += targetTop(source, target) * v
          w += v
        }
        if (!(w > 0)) continue
        let dy = (y / w - target.y0) * alpha
        target.y0 += dy
        target.y1 += dy
        reorderNodeLinks(target)
      }
      if (sort === undefined) column.sort(ascendingBreadth)
      resolveCollisions(column, beta, y1)
    }
  }

  // Reposition each node based on its outgoing (source) links.
  function relaxRightToLeft(columns, alpha, beta, y1) {
    for (let n = columns.length, i = n - 2; i >= 0; --i) {
      const column = columns[i]
      for (const source of column) {
        let y = 0
        let w = 0
        for (const { target, value } of source.sourceLinks) {
          let v = value * (target.layer - source.layer)
          y += sourceTop(source, target) * v
          w += v
        }
        if (!(w > 0)) continue
        let dy = (y / w - source.y0) * alpha
        source.y0 += dy
        source.y1 += dy
        reorderNodeLinks(source)
      }
      if (sort === undefined) column.sort(ascendingBreadth)
      resolveCollisions(column, beta, y1)
    }
  }

  function resolveCollisions(nodes, alpha, y1) {
    const i = nodes.length >> 1
    const subject = nodes[i]
    resolveCollisionsBottomToTop(nodes, subject.y0 - py, i - 1, alpha)
    resolveCollisionsTopToBottom(nodes, subject.y1 + py, i + 1, alpha)
    resolveCollisionsBottomToTop(nodes, y1, nodes.length - 1, alpha)
    resolveCollisionsTopToBottom(nodes, y0, 0, alpha)
  }

  // Push any overlapping nodes down.
  function resolveCollisionsTopToBottom(nodes, y, i, alpha) {
    for (; i < nodes.length; ++i) {
      const node = nodes[i]
      const dy = (y - node.y0) * alpha
      if (dy > 1e-6) ((node.y0 += dy), (node.y1 += dy))
      y = node.y1 + py
    }
  }

  // Push any overlapping nodes up.
  function resolveCollisionsBottomToTop(nodes, y, i, alpha) {
    for (; i >= 0; --i) {
      const node = nodes[i]
      const dy = (node.y1 - y) * alpha
      if (dy > 1e-6) ((node.y0 -= dy), (node.y1 -= dy))
      y = node.y0 - py
    }
  }

  function reorderNodeLinks({ sourceLinks, targetLinks }) {
    if (linkSort === undefined) {
      for (const {
        source: { sourceLinks },
      } of targetLinks) {
        sourceLinks.sort(ascendingTargetBreadth)
      }
      for (const {
        target: { targetLinks },
      } of sourceLinks) {
        targetLinks.sort(ascendingSourceBreadth)
      }
    }
  }

  function reorderLinks(nodes) {
    if (linkSort === undefined) {
      for (const { sourceLinks, targetLinks } of nodes) {
        sourceLinks.sort(ascendingTargetBreadth)
        targetLinks.sort(ascendingSourceBreadth)
      }
    }
  }

  // Returns the target.y0 that would produce an ideal link from source to target.
  function targetTop(source, target) {
    let y = source.y0 - ((source.sourceLinks.length - 1) * py) / 2
    for (const { target: node, width } of source.sourceLinks) {
      if (node === target) break
      y += width + py
    }
    for (const { source: node, width } of target.targetLinks) {
      if (node === source) break
      y -= width
    }
    return y
  }

  // Returns the source.y0 that would produce an ideal link from source to target.
  function sourceTop(source, target) {
    let y = target.y0 - ((target.targetLinks.length - 1) * py) / 2
    for (const { source: node, width } of target.targetLinks) {
      if (node === source) break
      y += width + py
    }
    for (const { target: node, width } of source.sourceLinks) {
      if (node === target) break
      y -= width
    }
    return y
  }

  return sankey
}

function horizontalSource(d) {
  return [d.source.x1, d.y0]
}

function horizontalTarget(d) {
  return [d.target.x0, d.y1]
}

export function sankeyLinkHorizontal() {
  return linkHorizontal().source(horizontalSource).target(horizontalTarget)
}

export { sankeyCenter, sankeyJustify, sankeyLeft, sankeyRight }

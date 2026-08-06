export interface SankeyGraph<Node, Link> {
  nodes: Node[]
  links: Link[]
}

export interface SankeyGenerator<Node, Link> {
  (graph: SankeyGraph<Node, Link>): SankeyGraph<Node, Link>
  update(graph: SankeyGraph<Node, Link>): SankeyGraph<Node, Link>
  nodeWidth(value: number): SankeyGenerator<Node, Link>
  nodePadding(value: number): SankeyGenerator<Node, Link>
  nodeAlign(value: (node: Node, columns: number) => number): SankeyGenerator<Node, Link>
  maxNodeHeight(value: number): SankeyGenerator<Node, Link>
  linkLength(value: number): SankeyGenerator<Node, Link>
}

export function sankey<Node, Link>(): SankeyGenerator<Node, Link>
export function sankeyRight<Node>(node: Node, columns: number): number
export function sankeyLeft<Node>(node: Node, columns: number): number
export function sankeyCenter<Node>(node: Node, columns: number): number
export function sankeyJustify<Node>(node: Node, columns: number): number

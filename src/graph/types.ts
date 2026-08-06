import type { Rational } from "../math.js"
import type { Building } from "../models.js"
import type { Item } from "../recipes.js"
import type { SolverIngredient, SolverRecipe } from "../solver.js"

export type GraphDirection = "down" | "right"
export type GraphLayoutDirection = "TB" | "LR"
export type GraphJustification = "left" | "center"
export type LinkDirection = "forward" | "backward" | "self"

export interface GraphPoint {
  readonly x: number
  readonly y: number
}

export interface GraphCurve {
  readonly points: readonly GraphPoint[]
  path(): string
  offset(offset: number): GraphCurve
  transpose(): GraphCurve
}

export interface GraphNode {
  readonly name: string
  readonly recipe: SolverRecipe
  readonly building: Building | null
  readonly count: Rational
  readonly rate: Rational | null
  readonly ingredients: readonly SolverIngredient[]
  readonly linkObjects: GraphLink[]
  element: SVGElement | null
  x0: number
  y0: number
  x1: number
  y1: number
  width: number
  labelX: number
  links(): readonly GraphLink[]
  text(): string
  labelWidth(text: SVGTextElement, nodeMargin: number): number
  highlight(): void
  unhighlight(): void
}

export interface BoxGraphLabel {
  link: GraphLink
  labelpos: "c"
  width: number
  height: number
  text: string
  x: number
  y: number
}

export interface GraphBeltLine {
  readonly item: Item
  readonly curve: GraphCurve
}

export interface GraphLink {
  readonly source: GraphNode
  readonly target: GraphNode
  readonly value: number
  readonly item: Item
  readonly rate: Rational
  readonly fuel: boolean
  readonly beltCount: Rational | null
  readonly extra: boolean
  readonly elements: Element[]
  readonly nodeHighlighters: Set<GraphNode>
  index: number
  label: BoxGraphLabel
  points: GraphPoint[]
  width: number
  y0: number
  y1: number
  direction: LinkDirection
  curve: GraphCurve
  belts: GraphBeltLine[]
  highlight(node: GraphNode): void
  unhighlight(node: GraphNode): void
}

export interface GraphData {
  readonly nodes: GraphNode[]
  readonly links: GraphLink[]
}

export interface IconCoordinates {
  readonly icon_col: number
  readonly icon_row: number
}

export type ItemColorMap = Map<Item, number>
export type RecipeColorMap = Map<SolverRecipe, number>

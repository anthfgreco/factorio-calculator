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

import { sorted, type CalculatorData } from "../data.js"
import type { Item } from "../recipes.js"

// Sorts items into their groups and subgroups. Used chiefly by the target
// dropdown.
export type ItemGroups = Item[][][]

export function getItemGroups(items: ReadonlyMap<string, Item>, data: CalculatorData): ItemGroups {
  // {groupName: {subgroupName: [item]}}
  const itemGroupMap = new Map<string, Map<string, Item[]>>()
  for (let [itemKey, item] of items) {
    let group = itemGroupMap.get(item.group)
    if (group === undefined) {
      group = new Map()
      itemGroupMap.set(item.group, group)
    }
    let subgroup = group.get(item.subgroup)
    if (subgroup === undefined) {
      subgroup = []
      group.set(item.subgroup, subgroup)
    }
    subgroup.push(item)
  }
  const itemGroups: ItemGroups = []
  let groupNames = sorted(itemGroupMap.keys(), function (k) {
    return data.groups[k]?.order ?? k
  })
  for (let groupName of groupNames) {
    const groupMap = itemGroupMap.get(groupName)
    if (groupMap === undefined) continue
    const subgroupNames = sorted(groupMap.keys(), (key) => data.groups[groupName]?.subgroups[key] ?? key)
    const group: Item[][] = []
    itemGroups.push(group)
    for (let subgroupName of subgroupNames) {
      const subgroupItems = groupMap.get(subgroupName) ?? []
      const items = sorted(subgroupItems, function (item) {
        return item.order
      })
      group.push(items)
    }
  }
  return itemGroups
}

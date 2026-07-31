export function sorted(collection, key) {
  if (!Array.isArray(collection)) {
    collection = Array.from(collection)
  }
  let indexes = []
  let keyvals = []
  for (let i = 0; i < collection.length; i++) {
    indexes.push(i)
    if (key) {
      keyvals.push(key(collection[i]))
    }
  }
  if (!key) {
    keyvals = collection
  }
  indexes.sort(function (a, b) {
    let x = keyvals[a]
    let y = keyvals[b]
    if (x < y) {
      return -1
    } else if (x > y) {
      return 1
    }
    return 0
  })
  let result = []
  for (let i = 0; i < indexes.length; i++) {
    result.push(collection[indexes[i]])
  }
  return result
}

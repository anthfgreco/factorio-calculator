const ITEM_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "automation-science-pack": ["red"],
  "logistic-science-pack": ["green"],
  "military-science-pack": ["grey", "gray", "black"],
  "chemical-science-pack": ["blue"],
  "production-science-pack": ["purple"],
  "utility-science-pack": ["yellow"],
  "space-science-pack": ["white"],
  "metallurgic-science-pack": ["orange"],
  "electromagnetic-science-pack": ["pink", "magenta"],
  "agricultural-science-pack": ["lime", "light green"],
  "cryogenic-science-pack": ["cyan", "light blue", "blue"],
  "promethium-science-pack": ["black", "dark blue", "dark purple"],
}

interface SearchableItem {
  key: string
  name: string
}

/**
 * Normalize punctuation and whitespace consistently for both queries and item
 * names. Keeping word boundaries supports token searches such as "fast belt",
 * while compact matching supports both "underground belt" and
 * "undergroundbelt".
 */
export function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/ /g, "")
}

export function itemMatchesSearch(item: SearchableItem, query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === "") {
    return true
  }

  const terms = [item.name, ...(ITEM_SEARCH_ALIASES[item.key] ?? [])]
  const normalizedTerms = terms.map(normalizeSearchText)
  const compactQuery = compactSearchText(normalizedQuery)

  // Preserve the original substring-search behavior after applying identical
  // normalization to the query and candidate text.
  if (normalizedTerms.some((term) => compactSearchText(term).includes(compactQuery))) {
    return true
  }

  // Also allow words to be separated by other words or span the official name
  // and an alias, e.g. "fast belt" or "red science".
  const queryTokens = normalizedQuery.split(" ")
  return queryTokens.every((token) => normalizedTerms.some((term) => term.includes(token)))
}

let suppressInitialHashWrites = false

/**
 * Preserve a clean URL throughout a fresh calculator startup.
 *
 * Shared links already containing a fragment are never suppressed. A hashless
 * visit suppresses every URL write caused by initial rendering; later user
 * changes are still serialized into a shareable URL.
 */
export function initializeUrlState() {
  suppressInitialHashWrites = window.location.hash === ""
}

export function finishUrlInitialization() {
  suppressInitialHashWrites = false
}

export function clearUrlHash() {
  const cleanUrl = `${window.location.pathname}${window.location.search}`
  window.history.replaceState(null, "", cleanUrl)
}

export function syncUrlHash(settings: string) {
  if (suppressInitialHashWrites) {
    return
  }

  const nextHash = `#${settings}`
  if (window.location.hash === nextHash) {
    return
  }

  window.history.replaceState(null, "", nextHash)
}

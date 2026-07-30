let suppressInitialHashWrite = false

/**
 * Preserve a clean URL for a fresh calculator visit.
 *
 * Shared links already containing a fragment are never suppressed. The first
 * render of a hashless visit is the only write skipped; later user changes are
 * still serialized into a shareable URL.
 */
export function initializeUrlState() {
  suppressInitialHashWrite = window.location.hash === ""
}

export function clearUrlHash() {
  const cleanUrl = `${window.location.pathname}${window.location.search}`
  window.history.replaceState(null, "", cleanUrl)
}

export function syncUrlHash(settings: string) {
  if (suppressInitialHashWrite) {
    suppressInitialHashWrite = false
    return
  }

  const nextHash = `#${settings}`
  if (window.location.hash === nextHash) {
    return
  }

  window.history.replaceState(null, "", nextHash)
}

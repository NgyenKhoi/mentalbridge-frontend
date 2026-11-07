// A renderer failure (a load error, a contract mismatch or a lost context)
// leaves Mầm dizzy until the page reloads (MB-814 design §E). The latch lives
// in module memory, not in the route-mounted host and not in storage, so
// leaving the Mầm routes and coming back cannot clear it, and no excluded
// route has to load the renderer to know it.
let failed = false

export const hasMamRendererFailed = () => failed

export function markMamRendererFailed() {
  failed = true
}

/** Tests only: a real page reload is the one thing that clears it. */
export function resetMamRendererFailure() {
  failed = false
}

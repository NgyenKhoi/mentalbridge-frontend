// Route surface matrix V2 (docs/ADR_MAM_RIVE_V2_CONTRACT.md, "Route surface
// matrix V2"; MB-895). One mode per route: FULL lives and celebrates (and may
// play the welcome), QUIET is docked with slow idle life and no travel scenes,
// bubbles or welcome, HIDDEN is not rendered. A route not listed is HIDDEN, so
// a new route never shows Mầm by accident. `/support-plan` is exact: its
// subpaths stay hidden (MB-772).
export type MamRouteMode = 'full' | 'quiet' | 'hidden'

const FULL_ROUTES = [
  /^\/dashboard$/,
  /^\/achievements$/,
  /^\/resources$/,
  /^\/nhin-lai$/,
]

// Private chat, video, screening and its results, plus the owner's scope cut
// (MB-895): Mầm stays on the support journey, not in the community or in plans
// and payment. Listed even though unknown routes are HIDDEN, so the cut is explicit.
const HIDDEN_ROUTES = [
  /^\/community(\/.*)?$/,
  /^\/subscription(\/.*)?$/,
  /^\/appointments\/[^/]+\/(chat|video)(\/.*)?$/,
  /^\/call(\/.*)?$/,
  /^\/assessments(\/.*)?$/,
  /^\/assessment(\/.*)?$/,
  /^\/initial-check(\/.*)?$/,
  /^\/safety-directory(\/.*)?$/,
]

const QUIET_ROUTES = [
  /^\/journal$/,
  /^\/ai-companion$/,
  /^\/support-plan$/,
  /^\/support-guides(\/[^/]+)?$/,
  /^\/appointments(\/[^/]+)?$/,
  /^\/messages$/,
  /^\/notifications$/,
  /^\/profile$/,
  /^\/specialists$/,
  /^\/resources\/[^/]+$/,
]

const matches = (routes: RegExp[], path: string) =>
  routes.some((route) => route.test(path))

export function mamRouteMode(pathname: string | null): MamRouteMode {
  if (!pathname) return 'hidden'
  const path =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  if (matches(HIDDEN_ROUTES, path)) return 'hidden'
  if (matches(FULL_ROUTES, path)) return 'full'
  return matches(QUIET_ROUTES, path) ? 'quiet' : 'hidden'
}

export const isMamDockRoute = (pathname: string | null) =>
  mamRouteMode(pathname) !== 'hidden'

// Surface matrix "Automatic" column: celebrations play on FULL routes only.
// Queued awards wait on QUIET ones (journal, support guides, SupportPlan).
export const isMamCelebrationRoute = (pathname: string | null) =>
  mamRouteMode(pathname) === 'full'

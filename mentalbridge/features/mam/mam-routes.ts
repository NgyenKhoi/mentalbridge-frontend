// Dock surfaces from the ADR surface matrix (docs/ADR_MAM_RIVE_V1_CONTRACT.md,
// "Surface matrix"). Everything else is hidden, so a new route never shows Mầm
// by accident. `/support-plan` stays hidden until MB-772 merges the
// SupportPlan companion with Mầm (owner decision, 2026-10-27).
const MAM_DOCK_ROUTES = [
  /^\/dashboard$/,
  /^\/achievements$/,
  /^\/support-guides(\/[^/]+)?$/,
  /^\/journal$/,
  /^\/resources(\/[^/]+)?$/,
]

// "Static dock" rows of the matrix: Mầm shows but never animates.
const MAM_STATIC_DOCK_ROUTES = [/^\/journal$/]

const matches = (routes: RegExp[], pathname: string | null) => {
  if (!pathname) return false
  const path =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return routes.some((route) => route.test(path))
}

export const isMamDockRoute = (pathname: string | null) =>
  matches(MAM_DOCK_ROUTES, pathname)

export const isMamStaticDockRoute = (pathname: string | null) =>
  matches(MAM_STATIC_DOCK_ROUTES, pathname)

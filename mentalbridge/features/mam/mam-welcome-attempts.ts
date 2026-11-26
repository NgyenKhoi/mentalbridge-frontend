// MB-895: accounts whose welcome wait already ended without playing (the 4 s cap, a failed start check or
// the user's first input) during this page load. Kept in memory only, so a missed scene still does not
// mark the session (MB-894), but a later FULL route, or a return from a HIDDEN one (the host remounts),
// never holds Mầm back again. `?mamWelcome=1` ignores it.
const attempted = new Set<string>()

export const welcomeAttempted = (accountId: string) => attempted.has(accountId)

export const markWelcomeAttempted = (accountId: string | null) => {
  if (accountId) attempted.add(accountId)
}

/** For tests: each one starts a fresh page load. */
export const resetMamWelcomeAttempts = () => attempted.clear()

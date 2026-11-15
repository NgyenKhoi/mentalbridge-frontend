import { ONBOARDING_VERSION } from './tour-steps'
import { SPECIALIST_ONBOARDING_VERSION } from './specialist-tour-steps'
import type { OnboardingAudience } from './tour-definitions'

export type TourOutcome = 'completed' | 'skipped'

const seenInSession = new Set<string>()

export function onboardingStorageKey(
  accountId: string,
  audience: OnboardingAudience = 'user',
) {
  return audience === 'specialist'
    ? `mentalbridge:onboarding:specialist:v${SPECIALIST_ONBOARDING_VERSION}:${accountId}`
    : `mentalbridge:onboarding:v${ONBOARDING_VERSION}:${accountId}`
}

export function hasSeenOnboarding(
  accountId: string,
  audience: OnboardingAudience = 'user',
) {
  const key = onboardingStorageKey(accountId, audience)
  if (seenInSession.has(key)) return true
  try {
    const outcome = window.localStorage.getItem(key)
    return outcome === 'completed' || outcome === 'skipped'
  } catch {
    return seenInSession.has(key)
  }
}

export function rememberOnboarding(
  accountId: string,
  outcome: TourOutcome,
  audience: OnboardingAudience = 'user',
) {
  const key = onboardingStorageKey(accountId, audience)
  seenInSession.add(key)
  try {
    window.localStorage.setItem(key, outcome)
    return 'local' as const
  } catch {
    return 'session' as const
  }
}

'use client'

import { useEffect, useState } from 'react'

import { ONBOARDING_TOURS } from './tour-definitions'
import { hasSeenOnboarding } from './tour-storage'

/** Fired when the automatic first-run tour ends (completed or skipped) or decides not to start. */
export const ONBOARDING_SETTLED_EVENT = 'mb:onboarding-settled'

export const settleOnboarding = () =>
  window.dispatchEvent(new Event(ONBOARDING_SETTLED_EVENT))

/** The USER first-run tour is running, or is due to auto-start on this page. */
export function onboardingHolds(accountId: string, pathname: string) {
  if (document.body.classList.contains('mb-onboarding-active')) return true
  return (
    ONBOARDING_TOURS.user.autoStartPaths.some((path) => path === pathname) &&
    !hasSeenOnboarding(accountId, 'user')
  )
}

/** True while the first-run tour owns the screen, so an entrance scene waits for it instead of overlapping. */
export function useOnboardingHold(accountId: string | null, pathname: string) {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const settle = () => setSettled(true)
    window.addEventListener(ONBOARDING_SETTLED_EVENT, settle)
    return () => window.removeEventListener(ONBOARDING_SETTLED_EVENT, settle)
  }, [])
  return (
    !settled &&
    accountId !== null &&
    typeof document !== 'undefined' &&
    onboardingHolds(accountId, pathname)
  )
}

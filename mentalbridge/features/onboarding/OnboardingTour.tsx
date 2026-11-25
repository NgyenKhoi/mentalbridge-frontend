'use client'

import { useEffect, useRef, useState } from 'react'

import { createOnboardingTour } from './tour-runtime'
import { ONBOARDING_TOURS, type OnboardingAudience } from './tour-definitions'
import { hasSeenOnboarding, rememberOnboarding } from './tour-storage'
import { settleOnboarding } from './onboarding-hold'
import { getGuidedJourney } from '@/features/support-guide/api/browser-support-guide'

import 'driver.js/dist/driver.css'
import './onboarding-tour.css'

// A failed lookup keeps the first-run tour: showing it twice beats hiding it from a new account.
const hasScreened = () =>
  getGuidedJourney()
    .then((journey) => Boolean(journey?.episodeId))
    .catch(() => false)

type Props = Readonly<{
  accountId: string
  pathname: string
  prepareStep: (inSidebar: boolean) => void
  onEnd: () => void
  audience?: OnboardingAudience
}>

export default function OnboardingTour({
  accountId,
  pathname,
  prepareStep,
  onEnd,
  audience = 'user',
}: Props) {
  const definition = ONBOARDING_TOURS[audience]
  const currentPath = useRef(pathname)
  useEffect(() => {
    currentPath.current = pathname
  }, [pathname])
  const startRef = useRef<(automatic?: boolean) => Promise<void>>(undefined)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let disposed = false
    let loading = false
    let controller: ReturnType<typeof createOnboardingTour> | undefined
    const start = async (automatic = false) => {
      if (loading || controller?.isActive()) return
      if (
        automatic &&
        (!definition.autoStartPaths.some(
          (path) => path === currentPath.current,
        ) ||
          hasSeenOnboarding(accountId, audience))
      )
        return
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return
      loading = true
      setUnavailable(false)
      try {
        // The seen flag lives in this browser only; an account that already screened is not new on another device.
        if (automatic && audience === 'user' && (await hasScreened())) {
          rememberOnboarding(accountId, 'skipped', audience)
          return
        }
        const { driver } = await import('driver.js')
        if (
          disposed ||
          document.querySelector('dialog[open], [aria-modal="true"]') ||
          (automatic &&
            !definition.autoStartPaths.some(
              (path) => path === currentPath.current,
            ))
        )
          return
        controller = createOnboardingTour(driver, {
          prepareStep,
          onEnd: () => {
            onEnd()
            settleOnboarding()
          },
          steps: definition.steps,
          focusFallbackSelectors: definition.focusFallbackSelectors,
          popoverClass: definition.popoverClass,
          onResult: (outcome) =>
            rememberOnboarding(accountId, outcome, audience),
        })
        await controller.start()
      } catch {
        controller?.destroy()
        if (!disposed) setUnavailable(true)
      } finally {
        loading = false
      }
    }
    const replay = () => void start()
    startRef.current = start
    window.addEventListener(definition.replayEvent, replay)
    return () => {
      disposed = true
      startRef.current = undefined
      window.removeEventListener(definition.replayEvent, replay)
      controller?.destroy()
    }
  }, [accountId, audience, definition, prepareStep, onEnd])

  useEffect(() => {
    if (
      !definition.autoStartPaths.some((path) => path === pathname) ||
      hasSeenOnboarding(accountId, audience)
    )
      return
    // A tour that decided not to start (a dialog is open, the page changed, it failed to load) releases what waits on it.
    const timer = window.setTimeout(
      () =>
        void startRef.current?.(true).finally(() => {
          if (!document.body.classList.contains('mb-onboarding-active'))
            settleOnboarding()
        }),
      1500,
    )
    return () => window.clearTimeout(timer)
  }, [accountId, audience, definition, pathname])

  if (!unavailable) return null

  return (
    <aside className="mb-onboarding-unavailable" role="status">
      <p>Chưa mở được hướng dẫn. Bạn có thể thử lại khi sẵn sàng.</p>
      <button type="button" onClick={() => void startRef.current?.()}>
        Thử lại
      </button>
      <button type="button" onClick={() => setUnavailable(false)}>
        Đóng
      </button>
    </aside>
  )
}

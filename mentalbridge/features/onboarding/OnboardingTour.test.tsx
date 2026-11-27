import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import OnboardingTour from './OnboardingTour'

const mocks = vi.hoisted(() => ({
  journey: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/features/support-guide/api/browser-support-guide', () => ({
  getGuidedJourney: mocks.journey,
}))
vi.mock('./tour-runtime', () => ({ createOnboardingTour: mocks.create }))
vi.mock('driver.js', () => ({ driver: vi.fn() }))

const renderTour = (accountId: string) =>
  render(
    <OnboardingTour
      accountId={accountId}
      pathname="/dashboard"
      prepareStep={vi.fn()}
      onEnd={vi.fn()}
    />,
  )

describe('OnboardingTour auto-start', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    mocks.journey.mockResolvedValue({ episodeId: null })
    mocks.create.mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      isActive: () => false,
      destroy: vi.fn(),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // mam-guide design §5: Mầm leads a new USER; the tour stays available from "Xem lại hướng dẫn".
  it('no longer opens by itself for a new USER account', async () => {
    renderTour('new-account')
    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

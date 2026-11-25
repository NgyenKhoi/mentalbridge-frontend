import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import OnboardingTour from './OnboardingTour'
import { hasSeenOnboarding } from './tour-storage'

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
    window.localStorage.clear()
    mocks.create.mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      isActive: () => false,
      destroy: vi.fn(),
    })
  })
  afterEach(() => vi.clearAllMocks())

  it('stays closed for an account that already screened on another device', async () => {
    mocks.journey.mockResolvedValue({
      episodeId: '10000000-0000-4000-8000-000000000001',
    })
    renderTour('returning-account')

    await waitFor(
      () => expect(hasSeenOnboarding('returning-account')).toBe(true),
      { timeout: 3000 },
    )
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('opens for a new account, and when the journey cannot be read', async () => {
    mocks.journey
      .mockResolvedValueOnce({ episodeId: null })
      .mockRejectedValueOnce(new Error('offline'))
    renderTour('new-account')
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce(), {
      timeout: 3000,
    })

    renderTour('unknown-account')
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    })
  })
})

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getAchievements: vi.fn(),
  hidden: false,
}))
vi.mock('@/features/achievements/api/browser-achievements', () => ({
  getAchievements: api.getAchievements,
}))
vi.mock('./mam-preferences', () => ({
  useMamPreferences: () => ({
    hidden: api.hidden,
    muted: false,
    motionOff: false,
  }),
}))
import { useMamAwardReads } from './use-mam-award-reads'

const MIN = 60_000
const NOW = new Date(2026, 9, 27, 10, 0, 0).getTime()
// The spacing is module level: each test uses its own account.
let accounts = 0
const render = (
  pathname = '/achievements',
  accountId: string | null = `u${++accounts}`,
) =>
  renderHook((props) => useMamAwardReads(props), {
    initialProps: { accountId, pathname },
  })
const focus = () => act(() => void window.dispatchEvent(new Event('focus')))

describe('useMamAwardReads', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    api.hidden = false
    api.getAchievements.mockReset().mockResolvedValue({})
  })
  afterEach(() => vi.useRealTimers())

  it('reads Achievements once on entering a celebration route', () => {
    render('/resources')
    expect(api.getAchievements).toHaveBeenCalledTimes(1)
    expect(api.getAchievements).toHaveBeenCalledWith(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
  })

  it.each(['/journal', '/support-guides', '/settings'])(
    'does not read on %s',
    (pathname) => {
      render(pathname)
      expect(api.getAchievements).not.toHaveBeenCalled()
    },
  )

  it('does not read without an account or while Mầm is hidden', () => {
    render('/achievements', null)
    api.hidden = true
    render()
    expect(api.getAchievements).not.toHaveBeenCalled()
  })

  it('reads again on focus only after 5 minutes, never twice inside them', () => {
    render()
    vi.setSystemTime(NOW + 4 * MIN)
    focus()
    focus()
    expect(api.getAchievements).toHaveBeenCalledTimes(1)
    vi.setSystemTime(NOW + 5 * MIN)
    focus()
    focus()
    expect(api.getAchievements).toHaveBeenCalledTimes(2)
  })

  it('shares the spacing across route changes and stops on unmount', () => {
    const { rerender, unmount } = render('/dashboard', 'shared')
    rerender({ accountId: 'shared', pathname: '/resources' })
    expect(api.getAchievements).toHaveBeenCalledTimes(1)
    unmount()
    vi.setSystemTime(NOW + 6 * MIN)
    focus()
    expect(api.getAchievements).toHaveBeenCalledTimes(1)
  })

  it('a new account reads at once; a failed read is silent and not retried inside 5 minutes', async () => {
    api.getAchievements.mockRejectedValue(new Error('503'))
    const { rerender } = render('/achievements', 'first')
    await act(() => vi.advanceTimersByTimeAsync(0))
    focus()
    expect(api.getAchievements).toHaveBeenCalledTimes(1)
    rerender({ accountId: 'second', pathname: '/achievements' })
    expect(api.getAchievements).toHaveBeenCalledTimes(2)
  })
})

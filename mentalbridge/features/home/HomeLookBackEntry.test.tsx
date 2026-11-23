import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getAnalyticsEvents: vi.fn() }))
vi.mock('@/features/analytics/api/browser-analytics', () => api)

import { makeDashboard } from '@/tests/fixtures/look-back'
import { HomeLookBackEntry } from './HomeLookBackEntry'

const moods = (...levels: Array<number | null>) =>
  Array.from({ length: 14 }, (_, index) => levels[index] ?? null)
const both = moods(3, 3, 3, null, null, null, null, 3, 3, 3, null, null, null)

describe('HomeLookBackEntry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links to the journey once the page has a mood in both weeks and five record days', async () => {
    api.getAnalyticsEvents.mockResolvedValue(makeDashboard(both))
    render(<HomeLookBackEntry />)
    const link = await screen.findByRole('link', { name: 'Hành trình 14 ngày' })
    expect(link).toHaveAttribute('href', '/nhin-lai')
    expect(link).toHaveAccessibleDescription(/đặt cạnh nhau/)
  })

  it.each([
    ['four record days', moods(3, 3, null, null, null, null, null, 3, 3)],
    [
      'a mood in one week only',
      moods(null, null, null, null, null, null, null, 3, 3, 3, 3, 3),
    ],
  ])(
    'stays hidden with %s, where the page would be SPARSE',
    async (_name, levels) => {
      api.getAnalyticsEvents.mockResolvedValue(makeDashboard(levels))
      const { container } = render(<HomeLookBackEntry />)
      await vi.waitFor(() => expect(api.getAnalyticsEvents).toHaveBeenCalled())
      expect(container).toBeEmptyDOMElement()
    },
  )

  it('stays hidden when the mood source is unavailable', async () => {
    const dashboard = makeDashboard(both)
    api.getAnalyticsEvents.mockResolvedValue({
      ...dashboard,
      sources: { ...dashboard.sources, emotions: 'unavailable' },
    })
    const { container } = render(<HomeLookBackEntry />)
    await vi.waitFor(() => expect(api.getAnalyticsEvents).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden when the activity cannot be read', async () => {
    api.getAnalyticsEvents.mockRejectedValue(new Error('down'))
    const { container } = render(<HomeLookBackEntry />)
    await vi.waitFor(() => expect(api.getAnalyticsEvents).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

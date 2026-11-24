import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ listReassessmentSummaries: vi.fn() }))
vi.mock('@/features/assessment/api/browser-care', () => api)

import { makeSummary } from '@/tests/fixtures/reassessment-review'
import { HomeReviewEntry } from './HomeReviewEntry'

describe('HomeReviewEntry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links to the review when the owner has a saved one', async () => {
    api.listReassessmentSummaries.mockResolvedValue({
      items: [makeSummary()],
      nextCursor: null,
      hasMore: false,
    })
    render(<HomeReviewEntry />)
    const link = await screen.findByRole('link', {
      name: 'Nhìn lại 14 ngày vừa qua',
    })
    expect(link).toHaveAttribute('href', '/nhin-lai')
    // The arrow is decoration; the description carries the one line.
    expect(link).toHaveAccessibleDescription(/hai kỳ gần nhất/)
    expect(api.listReassessmentSummaries).toHaveBeenCalledWith(1)
  })

  it('stays hidden when there is no saved review, even after a reassessment', async () => {
    api.listReassessmentSummaries.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    const { container } = render(<HomeReviewEntry />)
    await vi.waitFor(() =>
      expect(api.listReassessmentSummaries).toHaveBeenCalled(),
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden when the saved reviews cannot be read', async () => {
    api.listReassessmentSummaries.mockRejectedValue(new Error('down'))
    const { container } = render(<HomeReviewEntry />)
    await vi.waitFor(() =>
      expect(api.listReassessmentSummaries).toHaveBeenCalled(),
    )
    expect(container).toBeEmptyDOMElement()
  })
})

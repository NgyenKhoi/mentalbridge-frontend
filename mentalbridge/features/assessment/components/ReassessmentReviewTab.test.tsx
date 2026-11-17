import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ listReassessmentSummaries: vi.fn() }))
vi.mock('../api/browser-care', () => api)
vi.mock('./ReassessmentReview', () => ({
  ReassessmentReview: ({ summary }: { summary?: { summaryId: string } }) => (
    <section>
      <header className="rr-header">
        <h2 tabIndex={-1}>
          Nhìn lại 14 ngày {summary?.summaryId ?? 'mới nhất'}
        </h2>
      </header>
    </section>
  ),
}))

import { makeSummary } from '@/tests/fixtures/reassessment-review'
import { ReassessmentReviewTab } from './ReassessmentReviewTab'

const earlier = makeSummary({
  summaryId: '40000000-0000-4000-8000-000000000099',
  composedAt: '2026-01-10T08:00:00Z',
})

function reducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

describe('ReassessmentReviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    reducedMotion(false)
  })

  it('says the earlier reviews could not load and retries', async () => {
    api.listReassessmentSummaries
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({
        items: [earlier],
        nextCursor: null,
        hasMore: false,
      })
    render(<ReassessmentReviewTab />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được các lần nhìn lại trước.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('heading', { name: 'Các lần nhìn lại trước' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('loads the next page of earlier reviews with the returned cursor', async () => {
    const second = makeSummary({
      summaryId: '40000000-0000-4000-8000-000000000098',
      composedAt: '2025-12-01T08:00:00Z',
    })
    api.listReassessmentSummaries
      .mockResolvedValueOnce({
        items: [earlier],
        nextCursor: 'cursor-2',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [second],
        nextCursor: null,
        hasMore: false,
      })
    render(<ReassessmentReviewTab />)
    expect(
      await screen.findAllByRole('button', { name: /Tạo ngày/ }),
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }))
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Tạo ngày/ })).toHaveLength(
        2,
      ),
    )
    expect(api.listReassessmentSummaries).toHaveBeenLastCalledWith(
      10,
      'cursor-2',
    )
    // No cursor left: the control is gone.
    expect(
      screen.queryByRole('button', { name: 'Xem thêm' }),
    ).not.toBeInTheDocument()
  })

  it('opens an earlier review with focus on its heading and no smooth scroll under reduced motion', async () => {
    reducedMotion(true)
    api.listReassessmentSummaries.mockResolvedValue({
      items: [earlier],
      nextCursor: null,
      hasMore: false,
    })
    render(<ReassessmentReviewTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Tạo ngày/ }))
    const heading = await screen.findByRole('heading', {
      name: /Nhìn lại 14 ngày 40000000/,
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })
})

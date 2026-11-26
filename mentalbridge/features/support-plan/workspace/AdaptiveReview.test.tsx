import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { adaptiveReviewFixture } from '../testing/adaptive-review-fixture'
import { nativeSupportPlanFixture } from '../testing/native-support-plan-fixture'
import AdaptiveReview from './AdaptiveReview'

const api = vi.hoisted(() => ({
  getAdaptiveSupportPlanReview: vi.fn(),
  confirmAdaptiveReviewOption: vi.fn(),
}))
vi.mock('../api/browser-support-plan-actions', () => api)
vi.mock('@/features/emotion-check-in/api/browser-emotion-check-in', () => ({
  getEmotionCheckInProgress: vi.fn().mockRejectedValue(new Error('none')),
}))

const label = 'Lập kế hoạch mới từ kết quả đánh giá'

function renderReview(
  props: Partial<Parameters<typeof AdaptiveReview>[0]> = {},
) {
  return render(
    <AdaptiveReview
      plan={nativeSupportPlanFixture()}
      locked={false}
      onApplied={vi.fn()}
      onDiscardDraft={vi.fn()}
      onRefreshPlan={vi.fn()}
      {...props}
    />,
  )
}

describe('AdaptiveReview new plan from the reassessment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAdaptiveSupportPlanReview.mockResolvedValue(adaptiveReviewFixture())
  })

  it('offers a new plan from the reassessment result when one is ready', async () => {
    const onProposeReplacement = vi.fn()
    renderReview({ onProposeReplacement })
    fireEvent.click(
      await screen.findByRole('radio', { name: /Lập kế hoạch mới/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onProposeReplacement).toHaveBeenCalledTimes(1)
    // Keeping the rhythm stays one of the options.
    expect(
      screen.getByText('Giữ nhịp này thêm 14 ngày', { exact: false }),
    ).toBeInTheDocument()
  })

  it('hides it without a completed reassessment', async () => {
    api.getAdaptiveSupportPlanReview.mockResolvedValue({
      ...adaptiveReviewFixture(),
      reassessment: { state: 'NOT_STARTED', reasonCode: null, summary: null },
    })
    renderReview({ onProposeReplacement: vi.fn() })
    await screen.findByText(/Bạn chưa làm bài đánh giá lại/)
    expect(screen.queryByRole('radio', { name: /Lập kế hoạch mới/ })).toBeNull()
  })

  it('hides it when the host does not offer a replacement', async () => {
    renderReview()
    await screen.findByText('Giữ nhịp này thêm 14 ngày', { exact: false })
    expect(screen.queryByRole('radio', { name: /Lập kế hoạch mới/ })).toBeNull()
  })

  it('is disabled while a change is unsaved or running', async () => {
    renderReview({ onProposeReplacement: vi.fn(), locked: true })
    fireEvent.click(
      await screen.findByRole('radio', { name: /Lập kế hoạch mới/ }),
    )
    expect(screen.getByRole('button', { name: label })).toBeDisabled()
  })

  it('opens the prepared plan instead of preparing a second one', async () => {
    const onProposeReplacement = vi.fn()
    const onOpenAlternatives = vi.fn()
    renderReview({
      onProposeReplacement,
      onOpenAlternatives,
      pendingDraft: nativeSupportPlanFixture(),
    })
    fireEvent.click(
      await screen.findByRole('radio', { name: /Lập kế hoạch mới/ }),
    )
    expect(screen.getByText(/giữ nguyên \d+ hoạt động đang dùng/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Xem phương án mới' }))
    expect(onOpenAlternatives).toHaveBeenCalledOnce()
    expect(onProposeReplacement).not.toHaveBeenCalled()
  })
})

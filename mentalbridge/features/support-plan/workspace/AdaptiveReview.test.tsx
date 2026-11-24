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
    fireEvent.click(await screen.findByRole('button', { name: label }))
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
    await screen.findByText(/Bạn chưa làm bài kiểm tra lại/)
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  })

  it('hides it when the host does not offer a replacement', async () => {
    renderReview()
    await screen.findByText('Giữ nhịp này thêm 14 ngày', { exact: false })
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  })

  it('is disabled while a change is unsaved or running', async () => {
    renderReview({ onProposeReplacement: vi.fn(), locked: true })
    expect(await screen.findByRole('button', { name: label })).toBeDisabled()
  })
})

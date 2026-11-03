import { fireEvent, render } from '@testing-library/react-native'

import { makeMobileReassessmentSummary } from '@/reassessment/reassessment-test-fixtures'

import { AdaptiveReviewPanel } from './AdaptiveReviewPanel'
import { nativeIds, nativePlan } from './native-plan-test-fixtures'
import type { SupportPlanActionApi } from './support-plan-action-api'

function review() {
  return {
    schemaVersion: 'adaptive-support-plan-review-v1' as const,
    policyVersion: 'support-plan-review-v1' as const,
    supportPlanId: nativeIds.plan,
    planVersion: 1,
    planStatus: 'ACTIVE' as const,
    reviewedAt: '2026-10-17T06:00:00Z',
    programPeriod: {
      startedOn: '2026-10-03',
      asOf: '2026-10-17',
      timezone: 'Asia/Ho_Chi_Minh',
      elapsedDays: 15,
      pausedDays: 0,
      fullCycleElapsed: true,
      scheduledCount: 14,
      completedCount: 9,
      skippedCount: 3,
      openCount: 2,
    },
    reviewState: 'REVIEW_DUE' as const,
    reassessment: {
      state: 'AVAILABLE' as const,
      reasonCode: null,
      summary: makeMobileReassessmentSummary(),
    },
    currentAdmission: 'ADMISSIBLE' as const,
    outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE' as const,
    patterns: [],
    contradictions: [],
    options: [
      {
        optionId: 'keep-current-1',
        kind: 'KEEP_CURRENT' as const,
        executionKind: 'CONTINUE_CYCLE' as const,
        actionId: null,
        focusId: null,
        rationaleCodes: ['CURRENT_PLAN_STILL_ADMISSIBLE'],
        evidenceRefs: [],
        conflictingEvidenceRefs: [],
        changes: [],
      },
    ],
    unavailableOptions: [],
    reviewFingerprint: '3f2a9c4d7e1b6a5f8c0d2e4f6a8b0c1d',
  }
}

describe('adaptive SupportPlan review panel', () => {
  it('shows factual progress and requires explicit keep confirmation', async () => {
    const current = nativePlan()
    const getAdaptiveReview = jest.fn().mockResolvedValue(review())
    const confirmAdaptiveReview = jest.fn().mockResolvedValue({
      result: 'CYCLE_CONTINUED',
      optionId: 'keep-current-1',
      plan: { ...current, version: 2 },
      draft: null,
    })
    const onChanged = jest.fn().mockResolvedValue(undefined)
    const view = await render(
      <AdaptiveReviewPanel
        api={
          {
            getAdaptiveReview,
            confirmAdaptiveReview,
          } as unknown as SupportPlanActionApi
        }
        current={current}
        draft={null}
        disabled={false}
        onChanged={onChanged}
        onReassessment={jest.fn()}
        onProfessionalSupport={jest.fn()}
      />,
    )
    await fireEvent.press(view.getByTestId('adaptive-review-open'))
    expect(
      await view.findByText('Đã đến lúc xem lại chu kỳ hiện tại.'),
    ).toBeTruthy()
    expect(view.getByText(/9 hoàn thành · 3 bỏ qua · 2/)).toBeTruthy()
    await fireEvent.press(view.getByText('Giữ nhịp này thêm 14 ngày'))
    await fireEvent.press(view.getByTestId('adaptive-review-confirm'))
    expect(confirmAdaptiveReview).toHaveBeenCalledWith(
      nativeIds.plan,
      1,
      review().reviewFingerprint,
      expect.objectContaining({ kind: 'KEEP_CURRENT' }),
      expect.any(String),
      undefined,
    )
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(
      await view.findByText(
        'Bạn đã chọn giữ kế hoạch. Không có thay đổi nào ngoài chu kỳ bạn đã xác nhận.',
      ),
    ).toBeTruthy()
  })
})

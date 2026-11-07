import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { makeMobileReassessmentSummary } from '@/reassessment/reassessment-test-fixtures'

import { AdaptiveReviewPanel } from './AdaptiveReviewPanel'
import type { AdaptiveReviewOption } from './adaptive-review-contract'
import { nativeIds, nativePlan } from './native-plan-test-fixtures'
import type { SupportPlanActionApi } from './support-plan-action-api'
import type { CanonicalSupportPlan } from './support-plan-action-contract'

const keepOption = {
  optionId: 'keep-current-1',
  kind: 'KEEP_CURRENT' as const,
  executionKind: 'CONTINUE_CYCLE' as const,
  actionId: null,
  focusId: null,
  rationaleCodes: ['CURRENT_PLAN_STILL_ADMISSIBLE'],
  evidenceRefs: [],
  conflictingEvidenceRefs: [],
  changes: [],
}

const replacementOption = {
  optionId: 'alternative-action-1',
  kind: 'ALTERNATIVE_ACTION' as const,
  executionKind: 'PREPARE_REPLACEMENT' as const,
  actionId: nativeIds.action,
  focusId: 'emotion',
  rationaleCodes: ['REPEATED_BARRIER'],
  evidenceRefs: [],
  conflictingEvidenceRefs: [],
  changes: [
    {
      field: 'ACTION' as const,
      before: 'Dành một phút nhìn lại cảm xúc',
      after: 'Viết ba dòng cuối ngày',
    },
  ],
}

function review(options: AdaptiveReviewOption[] = [keepOption]) {
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
    options,
    unavailableOptions: [],
    reviewFingerprint: '3f2a9c4d7e1b6a5f8c0d2e4f6a8b0c1d',
  }
}

function replacementDraft(): CanonicalSupportPlan {
  const base = nativePlan('DRAFT')
  return {
    ...base,
    supportPlanId: '90000000-0000-4000-8000-000000000664',
    version: 0,
    focuses: base.focuses.map((focus) => ({
      ...focus,
      title: 'Thói quen cuối ngày',
      actions: focus.actions.map((action) => ({
        ...action,
        presentation: {
          ...action.presentation,
          title: 'Viết ba dòng cuối ngày',
        },
      })),
    })),
  }
}

function panelApi(
  confirmAdaptiveReview: jest.Mock,
  options: AdaptiveReviewOption[] = [replacementOption],
) {
  return {
    getAdaptiveReview: jest.fn().mockResolvedValue(review(options)),
    confirmAdaptiveReview,
  } as unknown as SupportPlanActionApi
}

describe('adaptive SupportPlan review panel', () => {
  it('shows factual progress and requires explicit keep confirmation', async () => {
    const current = nativePlan()
    const confirmAdaptiveReview = jest.fn().mockResolvedValue({
      result: 'CYCLE_CONTINUED',
      optionId: 'keep-current-1',
      plan: { ...current, version: 2 },
      draft: null,
    })
    const onChanged = jest.fn().mockResolvedValue(undefined)
    const view = await render(
      <AdaptiveReviewPanel
        api={panelApi(confirmAdaptiveReview, [keepOption])}
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
  })

  it('prepares a bound DRAFT, compares material plan details, and requires a second confirmation', async () => {
    const current = nativePlan()
    const candidate = replacementDraft()
    const confirmAdaptiveReview = jest
      .fn()
      .mockResolvedValueOnce({
        result: 'DRAFT_PREPARED',
        optionId: replacementOption.optionId,
        plan: current,
        draft: candidate,
      })
      .mockResolvedValueOnce({
        result: 'REPLACED',
        optionId: replacementOption.optionId,
        plan: { ...candidate, status: 'ACTIVE', version: 1 },
        draft: null,
      })
    const view = await render(
      <AdaptiveReviewPanel
        api={panelApi(confirmAdaptiveReview)}
        current={current}
        draft={null}
        disabled={false}
        onChanged={jest.fn().mockResolvedValue(undefined)}
        onReassessment={jest.fn()}
        onProfessionalSupport={jest.fn()}
      />,
    )
    await fireEvent.press(view.getByTestId('adaptive-review-open'))
    await fireEvent.press(await view.findByText('Thay bằng hoạt động khác'))
    await fireEvent.press(view.getByTestId('adaptive-review-confirm'))

    expect(await view.findByText('So sánh trước khi thay thế')).toBeTruthy()
    expect(view.getByText('Hiện tại')).toBeTruthy()
    expect(view.getByText('Phương án mới')).toBeTruthy()
    expect(view.getByText('Viết ba dòng cuối ngày')).toBeTruthy()
    expect(view.getByTestId('adaptive-review-replace-confirm')).toBeDisabled()

    await fireEvent.press(view.getByTestId('adaptive-review-acknowledge'))
    await fireEvent.press(view.getByTestId('adaptive-review-replace-confirm'))
    await waitFor(() => expect(confirmAdaptiveReview).toHaveBeenCalledTimes(2))
    expect(confirmAdaptiveReview.mock.calls[1]?.[5]).toEqual(candidate)
  })

  it('cancels comparison without replacement and restores the same bound comparison on reselection/reload', async () => {
    const current = nativePlan()
    const candidate = replacementDraft()
    const confirmAdaptiveReview = jest.fn().mockResolvedValue({
      result: 'DRAFT_PREPARED',
      optionId: replacementOption.optionId,
      plan: current,
      draft: candidate,
    })
    const api = panelApi(confirmAdaptiveReview)
    const view = await render(
      <AdaptiveReviewPanel
        api={api}
        current={current}
        draft={null}
        disabled={false}
        onChanged={jest.fn().mockResolvedValue(undefined)}
        onReassessment={jest.fn()}
        onProfessionalSupport={jest.fn()}
      />,
    )
    await fireEvent.press(view.getByTestId('adaptive-review-open'))
    await fireEvent.press(await view.findByText('Thay bằng hoạt động khác'))
    await fireEvent.press(view.getByTestId('adaptive-review-confirm'))
    await fireEvent.press(
      await view.findByTestId('adaptive-review-cancel-comparison'),
    )
    expect(confirmAdaptiveReview).toHaveBeenCalledTimes(1)
    expect(
      await view.findByText(/Phương án DRAFT chưa được áp dụng/),
    ).toBeTruthy()

    await fireEvent.press(view.getByText('Thay bằng hoạt động khác'))
    expect(await view.findByText('So sánh trước khi thay thế')).toBeTruthy()
    await fireEvent.press(view.getByTestId('adaptive-review-reload'))
    await waitFor(() => expect(api.getAdaptiveReview).toHaveBeenCalledTimes(2))
    await fireEvent.press(view.getByText('Thay bằng hoạt động khác'))
    expect(await view.findByText('So sánh trước khi thay thế')).toBeTruthy()
    expect(confirmAdaptiveReview).toHaveBeenCalledTimes(1)
  })

  it('blocks replacement when the refreshed DRAFT does not match the prepared candidate', async () => {
    const current = nativePlan()
    const candidate = replacementDraft()
    const mismatch = {
      ...candidate,
      supportPlanId: '91000000-0000-4000-8000-000000000664',
    }
    const confirmAdaptiveReview = jest.fn().mockResolvedValue({
      result: 'DRAFT_PREPARED',
      optionId: replacementOption.optionId,
      plan: current,
      draft: candidate,
    })
    const props = {
      api: panelApi(confirmAdaptiveReview),
      current,
      disabled: false,
      onChanged: jest.fn().mockResolvedValue(undefined),
      onReassessment: jest.fn(),
      onProfessionalSupport: jest.fn(),
    }
    const view = await render(<AdaptiveReviewPanel {...props} draft={null} />)
    await fireEvent.press(view.getByTestId('adaptive-review-open'))
    await fireEvent.press(await view.findByText('Thay bằng hoạt động khác'))
    await fireEvent.press(view.getByTestId('adaptive-review-confirm'))
    expect(await view.findByText('So sánh trước khi thay thế')).toBeTruthy()

    await view.rerender(<AdaptiveReviewPanel {...props} draft={mismatch} />)
    expect(
      await view.findByText(/DRAFT hiện có không khớp lựa chọn/),
    ).toBeTruthy()
    expect(view.queryByTestId('adaptive-review-replace-confirm')).toBeNull()
    expect(confirmAdaptiveReview).toHaveBeenCalledTimes(1)
  })
})

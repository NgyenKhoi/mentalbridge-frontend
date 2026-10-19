import { describe, expect, it } from 'vitest'

import { nativeSupportPlanReviewFixture } from '../testing/native-support-plan-review-fixture'
import { explainSupportPlanReview } from './support-plan-review-companion'

describe('SupportPlan review Companion explanation', () => {
  it('keeps contradictory screening instruments and source dimensions separate', () => {
    const explanation = explainSupportPlanReview(
      nativeSupportPlanReviewFixture(),
    )

    expect(explanation.contradictory).toBe(true)
    expect(explanation.dimensions.map((item) => item.id)).toEqual([
      'screening',
      'journal',
      'engagement',
      'self-report',
      'reflection',
    ])
    const screening = explanation.dimensions[0]
    expect(screening.details).toEqual([
      'PHQ-9: thấp hơn giai đoạn trước.',
      'GAD-7: cao hơn giai đoạn trước.',
    ])
    expect(JSON.stringify(explanation)).not.toMatch(
      /wellbeing|recovery|hồi phục|điểm tổng|điểm sức khỏe/i,
    )
  })

  it('explains repeated coded barriers and helpful activity feedback', () => {
    const explanation = explainSupportPlanReview(
      nativeSupportPlanReviewFixture(),
    )

    expect(
      explanation.dimensions.find((item) => item.id === 'engagement')?.details,
    ).toContain('Rào cản lặp lại: không đủ thời gian (2 lần).')
    expect(
      explanation.dimensions.find((item) => item.id === 'reflection')?.summary,
    ).toBe('2 phản hồi cho biết hoạt động đã giúp ích.')
  })

  it('keeps sparse sources visible without inventing missing evidence', () => {
    const review = nativeSupportPlanReviewFixture()
    review.reassessmentSummary.screening = {
      state: 'INSUFFICIENT_DATA',
      trends: [],
    }
    review.reassessmentSummary.selfReportedExperience = {
      state: 'INSUFFICIENT_DATA',
      unavailableReason: 'NOT_PROVIDED',
      source: null,
    }

    const explanation = explainSupportPlanReview(review)
    expect(
      explanation.dimensions.find((item) => item.id === 'screening'),
    ).toMatchObject({
      state: 'limited',
      summary: 'Chưa đủ dữ liệu để so sánh nguồn này.',
      details: [],
    })
    expect(
      explanation.dimensions.find((item) => item.id === 'self-report'),
    ).toMatchObject({
      state: 'limited',
      summary: 'Chưa đủ dữ liệu để so sánh nguồn này.',
    })
  })

  it('makes keeping the current plan the only unchanged option', () => {
    const review = nativeSupportPlanReviewFixture()
    review.outcome = 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'

    expect(explainSupportPlanReview(review).options).toEqual([
      expect.objectContaining({ id: 'keep' }),
    ])
  })

  it('does not offer keeping a current plan that is no longer admitted', () => {
    const review = nativeSupportPlanReviewFixture()
    review.outcome = 'CURRENT_PLAN_NOT_ADMISSIBLE'
    review.proposedPlan.focuses[0].actions[0].actionType =
      'PROFESSIONAL_SUPPORT'

    const explanation = explainSupportPlanReview(review)
    expect(explanation.options).toEqual([
      expect.objectContaining({
        id: 'change',
        summary: expect.stringContaining('hỗ trợ từ chuyên gia'),
      }),
    ])
  })
})

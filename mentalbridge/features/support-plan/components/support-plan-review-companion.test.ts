import { describe, expect, it } from 'vitest'

import { nativeSupportPlanReviewFixture } from '../testing/native-support-plan-review-fixture'
import { explainSupportPlanReview } from './support-plan-review-companion'

function changeDetails() {
  const explanation = explainSupportPlanReview(nativeSupportPlanReviewFixture())
  return explanation.options.find((option) => option.id === 'change')?.details
}

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

  it('explains repeated coded barriers and factual helpfulness distribution', () => {
    const review = nativeSupportPlanReviewFixture()
    const reflection = review.reassessmentSummary.activityReflection
    if (!reflection) throw new Error('Expected reflection fixture')
    reflection.sources[0].helpfulness = 'VERY_HELPFUL'
    reflection.sources[1].helpfulness = 'A_LITTLE_HELPFUL'

    const explanation = explainSupportPlanReview(review)

    expect(
      explanation.dimensions.find((item) => item.id === 'engagement')?.details,
    ).toContain('Rào cản lặp lại: không đủ thời gian (2 lần).')
    expect(
      explanation.dimensions.find((item) => item.id === 'reflection')?.summary,
    ).toBe(
      'Giai đoạn này có 1 phản hồi rất hữu ích và 1 phản hồi hữu ích một chút.',
    )
  })

  it('ignores stale payload arrays when their dimensions are unavailable', () => {
    const review = nativeSupportPlanReviewFixture()
    review.reassessmentSummary.screening.state = 'INSUFFICIENT_DATA'
    review.reassessmentSummary.supportPlanEngagement.state = 'UNAVAILABLE'
    const reflection = review.reassessmentSummary.activityReflection
    if (!reflection) throw new Error('Expected reflection fixture')
    reflection.state = 'UNAVAILABLE'
    review.reassessmentSummary.selfReportedExperience = {
      ...review.reassessmentSummary.selfReportedExperience!,
      state: 'UNAVAILABLE',
    }

    const explanation = explainSupportPlanReview(review)

    expect(explanation.contradictory).toBe(false)
    expect(
      explanation.dimensions.find((item) => item.id === 'screening')?.details,
    ).toEqual([])
    expect(
      explanation.dimensions.find((item) => item.id === 'engagement'),
    ).toMatchObject({ state: 'limited', details: [] })
    expect(
      explanation.dimensions.find((item) => item.id === 'reflection'),
    ).toMatchObject({
      state: 'limited',
      summary: 'Nguồn này hiện không thể dùng cho lần xem lại.',
    })
    expect(
      explanation.dimensions.find((item) => item.id === 'self-report'),
    ).toMatchObject({
      state: 'limited',
      summary: 'Nguồn này hiện không thể dùng cho lần xem lại.',
    })
  })

  it('retains valid available dimensions when availability is mixed', () => {
    const review = nativeSupportPlanReviewFixture()
    review.reassessmentSummary.screening.state = 'UNAVAILABLE'
    review.reassessmentSummary.selfReportedExperience = {
      ...review.reassessmentSummary.selfReportedExperience!,
      state: 'UNAVAILABLE',
    }

    const explanation = explainSupportPlanReview(review)

    expect(explanation.contradictory).toBe(true)
    expect(
      explanation.dimensions.find((item) => item.id === 'engagement')?.details,
    ).toContain('Rào cản lặp lại: không đủ thời gian (2 lần).')
    expect(
      explanation.dimensions.find((item) => item.id === 'reflection')?.summary,
    ).toBe('Giai đoạn này có 2 phản hồi hữu ích.')
  })

  it('shows only allowlisted aggregate Journal patterns and never raw text', () => {
    const review = nativeSupportPlanReviewFixture()
    review.reassessmentSummary.journalContext.state = 'AVAILABLE'
    review.reassessmentSummary.journalContext.helpfulPatterns = [
      'GROUNDING',
      'walk',
      'nội dung riêng tư của người dùng',
    ]
    review.reassessmentSummary.journalContext.barriers = [
      'BREATHING_DISCOMFORT',
    ]

    const journal = explainSupportPlanReview(review).dimensions.find(
      (item) => item.id === 'journal',
    )

    expect(journal).toMatchObject({
      state: 'available',
      summary: 'MentalBridge chỉ diễn đạt các mẫu tổng hợp có nhãn được phép.',
    })
    expect(journal?.details).toContain(
      'Mẫu có ích được tổng hợp: bài grounding và đi bộ nhẹ.',
    )
    expect(journal?.details).toContain(
      'Rào cản được tổng hợp: khó chịu khi tập thở.',
    )
    expect(journal?.details).toContain(
      'Có 1 tín hiệu tổng hợp khác chưa có nhãn an toàn để hiển thị.',
    )
    expect(JSON.stringify(journal)).not.toContain(
      'nội dung riêng tư của người dùng',
    )
  })

  it('does not leak stale Journal patterns when Journal is unavailable', () => {
    const review = nativeSupportPlanReviewFixture()
    review.reassessmentSummary.journalContext.state = 'UNAVAILABLE'
    review.reassessmentSummary.journalContext.helpfulPatterns = ['GROUNDING']
    review.reassessmentSummary.journalContext.barriers = [
      'BREATHING_DISCOMFORT',
    ]

    const journal = explainSupportPlanReview(review).dimensions.find(
      (item) => item.id === 'journal',
    )

    expect(journal).toMatchObject({
      state: 'limited',
      summary: 'Nguồn này hiện không thể dùng cho lần xem lại.',
      details: [
        'Nội dung ghi chép riêng tư không xuất hiện trong giải thích này.',
      ],
    })
    expect(JSON.stringify(journal)).not.toMatch(
      /grounding|khó chịu khi tập thở/i,
    )
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

  it('compares same-title actions by duration, recurrence and time', () => {
    const review = nativeSupportPlanReviewFixture()
    const currentAction = review.currentPlan.focuses[0].actions[0]
    const proposedAction = review.proposedPlan.focuses[0].actions[0]
    proposedAction.presentation.title = currentAction.presentation.title
    const currentSchedule = currentAction.schedules[0]
    currentSchedule.estimatedDurationMinutes = 20
    currentSchedule.recurrenceType = 'DAILY'
    currentSchedule.daysOfWeek = []
    currentSchedule.preferredDaypart = 'MORNING'
    currentSchedule.localTime = '08:00'
    const proposedSchedule = proposedAction.schedules[0]
    proposedSchedule.estimatedDurationMinutes = 10
    proposedSchedule.recurrenceType = 'WEEKLY'
    proposedSchedule.daysOfWeek = [1, 3, 5]
    proposedSchedule.preferredDaypart = 'EVENING'
    proposedSchedule.localTime = '19:00'

    const details = explainSupportPlanReview(review).options.find(
      (option) => option.id === 'change',
    )?.details

    expect(details).toEqual([
      '“Check-in cảm xúc”: thời lượng mỗi lần từ 20 phút thành 10 phút.',
      '“Check-in cảm xúc”: nhịp từ mỗi ngày thành 3 ngày mỗi tuần (Thứ Hai, Thứ Tư và Thứ Sáu).',
      '“Check-in cảm xúc”: thời điểm từ buổi sáng (08:00) sang buổi tối (19:00).',
    ])
  })

  it('explains a Care-approved alternative action', () => {
    const review = nativeSupportPlanReviewFixture()
    const proposedAction = review.proposedPlan.focuses[0].actions[0]
    if (!proposedAction.source)
      throw new Error('Expected action source fixture')
    proposedAction.source.sourceId = 'alternative-check-in'
    proposedAction.presentation.title = 'Một hoạt động thay thế'

    const details = explainSupportPlanReview(review).options.find(
      (option) => option.id === 'change',
    )?.details

    expect(details).toContain(
      'Phương án mới thêm hoạt động “Một hoạt động thay thế”.',
    )
    expect(details).toContain(
      'Phương án mới không còn hoạt động “Check-in cảm xúc”.',
    )
  })

  it('makes keeping the current plan the only unchanged option', () => {
    const review = nativeSupportPlanReviewFixture()
    review.outcome = 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'

    expect(explainSupportPlanReview(review).options).toEqual([
      expect.objectContaining({ id: 'keep', details: [] }),
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
        details: expect.arrayContaining([
          'Phương án mới có một bước hỗ trợ từ chuyên gia.',
        ]),
      }),
    ])
  })

  it('names missing comparison data without inventing a command', () => {
    const review = nativeSupportPlanReviewFixture()
    review.proposedPlan.focuses[0].actions[0].schedules = []

    const details = explainSupportPlanReview(review).options.find(
      (option) => option.id === 'change',
    )?.details

    expect(details).toContain(
      '“Check-in cảm xúc vào buổi sáng”: Care chưa cung cấp một lịch duy nhất để so sánh thời lượng và thời điểm.',
    )
    expect(JSON.stringify(details)).not.toMatch(/hãy|nên|thử|bắt đầu/i)
  })

  it('keeps the fixture alternative factual even when schedules match', () => {
    expect(changeDetails()).toContain(
      'Hoạt động “Check-in cảm xúc” được trình bày trong phương án mới là “Check-in cảm xúc vào buổi sáng”.',
    )
  })
})

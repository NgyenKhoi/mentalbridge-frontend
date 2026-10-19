import type { NativeSupportPlanReplacementReview } from '../api/support-plan-contract'

type ReviewDimensionState = 'available' | 'limited'

export type CompanionReviewDimension = Readonly<{
  id: 'screening' | 'journal' | 'engagement' | 'self-report' | 'reflection'
  label: string
  state: ReviewDimensionState
  summary: string
  details: readonly string[]
}>

export type CompanionReviewOption = Readonly<{
  id: 'keep' | 'change'
  title: string
  summary: string
}>

export type CompanionReviewExplanation = Readonly<{
  outcome: string
  dimensions: readonly CompanionReviewDimension[]
  contradictory: boolean
  options: readonly CompanionReviewOption[]
}>

const instrumentLabel = { PHQ9: 'PHQ-9', GAD7: 'GAD-7' } as const
const trendLabel = {
  INCREASED: 'cao hơn giai đoạn trước',
  DECREASED: 'thấp hơn giai đoạn trước',
  UNCHANGED: 'chưa thay đổi so với giai đoạn trước',
  INSUFFICIENT_DATA: 'chưa đủ dữ liệu để so sánh',
} as const
const experienceLabel = {
  BETTER: 'Bạn cho biết giai đoạn này dễ chịu hơn.',
  ABOUT_THE_SAME: 'Bạn cho biết giai đoạn này gần như không đổi.',
  MORE_DIFFICULT: 'Bạn cho biết giai đoạn này khó khăn hơn.',
  UNSURE: 'Bạn chưa chắc giai đoạn này thay đổi như thế nào.',
} as const
const barrierLabel = {
  LOW_ENERGY: 'năng lượng thấp',
  NOT_ENOUGH_TIME: 'không đủ thời gian',
  DIFFICULT_TO_START: 'khó bắt đầu',
  NOT_A_GOOD_FIT: 'hoạt động chưa phù hợp',
  OTHER: 'một rào cản khác',
} as const

function list(items: readonly string[]) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} và ${items.at(-1)}`
}

function unavailable(state: string) {
  return state === 'UNAVAILABLE'
    ? 'Nguồn này hiện không thể dùng cho lần xem lại.'
    : 'Chưa đủ dữ liệu để so sánh nguồn này.'
}

function screeningDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension {
  const { screening } = review.reassessmentSummary
  const details = screening.trends.map(
    (trend) =>
      `${instrumentLabel[trend.instrument]}: ${trendLabel[trend.direction]}.`,
  )
  return {
    id: 'screening',
    label: 'Bài sàng lọc',
    state:
      screening.state === 'AVAILABLE' && details.length > 0
        ? 'available'
        : 'limited',
    summary:
      screening.state === 'AVAILABLE' && details.length > 0
        ? 'Mỗi bài được xem riêng, không gộp thành một điểm chung.'
        : unavailable(screening.state),
    details,
  }
}

function journalDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension {
  const journal = review.reassessmentSummary.journalContext
  const counts = [
    journal.helpfulPatterns.length > 0
      ? `${journal.helpfulPatterns.length} mẫu có ích`
      : '',
    journal.barriers.length > 0 ? `${journal.barriers.length} rào cản` : '',
    journal.changesComparedWithPreviousPeriod.some(
      (change) => change.direction !== 'INSUFFICIENT_DATA',
    )
      ? 'có thay đổi để so sánh'
      : '',
  ].filter(Boolean)
  return {
    id: 'journal',
    label: 'Ngữ cảnh từ ghi chép',
    state: journal.state === 'AVAILABLE' ? 'available' : 'limited',
    summary:
      journal.state === 'AVAILABLE'
        ? counts.length > 0
          ? `MentalBridge chỉ dùng phần tổng hợp: ${list(counts)}.`
          : 'Nguồn tổng hợp đã sẵn sàng nhưng chưa có mẫu rõ để nêu.'
        : unavailable(journal.state),
    details: [
      'Nội dung ghi chép riêng tư không xuất hiện trong giải thích này.',
    ],
  }
}

function engagementDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension {
  const engagement = review.reassessmentSummary.supportPlanEngagement
  const barriers = new Map<keyof typeof barrierLabel, number>()
  for (const source of engagement.sources) {
    if (!source.barrierCode) continue
    barriers.set(
      source.barrierCode,
      (barriers.get(source.barrierCode) ?? 0) + 1,
    )
  }
  const repeated = [...barriers]
    .filter(([, count]) => count >= 2)
    .map(([code, count]) => `${barrierLabel[code]} (${count} lần)`)
  const { completedCount, skippedCount } = engagement.currentPeriod
  return {
    id: 'engagement',
    label: 'Nhịp thực hiện',
    state: engagement.state === 'AVAILABLE' ? 'available' : 'limited',
    summary:
      engagement.state === 'AVAILABLE'
        ? `Giai đoạn này ghi nhận ${completedCount} hoạt động hoàn thành và ${skippedCount} hoạt động bỏ qua.`
        : unavailable(engagement.state),
    details:
      repeated.length > 0
        ? [`Rào cản lặp lại: ${list(repeated)}.`]
        : ['Chưa có rào cản lặp lại đủ rõ để nêu.'],
  }
}

function selfReportDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension | undefined {
  const selfReport = review.reassessmentSummary.selfReportedExperience
  if (!selfReport) return undefined
  return {
    id: 'self-report',
    label: 'Tự đánh giá',
    state:
      selfReport.state === 'AVAILABLE' && selfReport.source
        ? 'available'
        : 'limited',
    summary:
      selfReport.state === 'AVAILABLE' && selfReport.source
        ? experienceLabel[selfReport.source.currentExperience]
        : unavailable(selfReport.state),
    details: [],
  }
}

function reflectionDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension | undefined {
  const reflection =
    review.reassessmentSummary.activityReflection ??
    review.reassessmentSummary.userReflection
  if (!reflection) return undefined
  const helpful = reflection.sources.filter(
    (source) =>
      source.helpfulness === 'HELPFUL' || source.helpfulness === 'VERY_HELPFUL',
  ).length
  return {
    id: 'reflection',
    label: 'Phản hồi sau hoạt động',
    state: reflection.state === 'AVAILABLE' ? 'available' : 'limited',
    summary:
      reflection.state === 'AVAILABLE'
        ? helpful > 0
          ? `${helpful} phản hồi cho biết hoạt động đã giúp ích.`
          : 'Chưa có phản hồi cho thấy một hoạt động giúp ích rõ ràng.'
        : unavailable(reflection.state),
    details: [],
  }
}

function actions(review: NativeSupportPlanReplacementReview) {
  return review.proposedPlan.focuses
    .flatMap((focus) => focus.actions)
    .filter((action) => action.status !== 'ENDED')
}

function proposedSummary(review: NativeSupportPlanReplacementReview) {
  const proposed = actions(review)
  const titles = [
    ...new Set(proposed.map((action) => action.presentation.title)),
  ]
  const professional = proposed.some(
    (action) => action.actionType === 'PROFESSIONAL_SUPPORT',
  )
  const parts = [
    titles.length > 0 ? `Gồm ${list(titles.slice(0, 3))}.` : '',
    professional ? 'Có một bước hỗ trợ từ chuyên gia.' : '',
  ].filter(Boolean)
  return parts.join(' ')
}

function reviewOptions(
  review: NativeSupportPlanReplacementReview,
): readonly CompanionReviewOption[] {
  const keep: CompanionReviewOption = {
    id: 'keep',
    title: 'Giữ kế hoạch hiện tại',
    summary: 'Tiếp tục nhịp hiện tại; không có thay đổi nào được áp dụng.',
  }
  const change: CompanionReviewOption = {
    id: 'change',
    title: 'Xem phương án khác đã được chuẩn bị',
    summary:
      proposedSummary(review) ||
      'Mở phần so sánh để xem các hoạt động trong phương án mới.',
  }
  if (review.outcome === 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE')
    return [keep]
  if (review.outcome === 'CURRENT_PLAN_NOT_ADMISSIBLE') return [change]
  return [keep, change]
}

function hasContradiction(review: NativeSupportPlanReplacementReview) {
  const summary = review.reassessmentSummary
  const directions = new Set(
    summary.screening.trends
      .map((trend) => trend.direction)
      .filter(
        (direction) => direction === 'INCREASED' || direction === 'DECREASED',
      ),
  )
  const experience = summary.selfReportedExperience?.source?.currentExperience
  const reflection = summary.activityReflection ?? summary.userReflection
  const helpful = reflection?.sources.some(
    (source) =>
      source.helpfulness === 'HELPFUL' || source.helpfulness === 'VERY_HELPFUL',
  )
  const barrierCounts = new Map<string, number>()
  for (const source of summary.supportPlanEngagement.sources) {
    if (source.barrierCode)
      barrierCounts.set(
        source.barrierCode,
        (barrierCounts.get(source.barrierCode) ?? 0) + 1,
      )
  }
  const repeatedBarrier = [...barrierCounts.values()].some(
    (count) => count >= 2,
  )
  return (
    directions.size > 1 ||
    (experience === 'MORE_DIFFICULT' && directions.has('DECREASED')) ||
    (experience === 'BETTER' && directions.has('INCREASED')) ||
    Boolean(helpful && repeatedBarrier)
  )
}

export function explainSupportPlanReview(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewExplanation {
  const dimensions = [
    screeningDimension(review),
    journalDimension(review),
    engagementDimension(review),
    selfReportDimension(review),
    reflectionDimension(review),
  ].filter((item): item is CompanionReviewDimension => item !== undefined)
  const outcome = {
    CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE:
      'Kế hoạch hiện tại vẫn có thể tiếp tục, đồng thời đã có một phương án khác để bạn xem.',
    CURRENT_PLAN_NOT_ADMISSIBLE:
      'Kết quả xem lại cho biết kế hoạch hiện tại không còn nằm trong các phương án phù hợp. Bạn vẫn là người xem và xác nhận bước tiếp theo.',
    CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE:
      'Lần xem lại này chưa cho thấy một phương án phù hợp hơn kế hoạch hiện tại.',
  }[review.outcome]
  return {
    outcome,
    dimensions,
    contradictory: hasContradiction(review),
    options: reviewOptions(review),
  }
}

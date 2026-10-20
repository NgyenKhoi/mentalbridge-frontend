import type {
  ActionSchedule,
  NativeSupportPlanReplacementReview,
  PlanAction,
  SupportPlanV3,
} from '../api/support-plan-contract'

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
  details: readonly string[]
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
const journalHelpfulPatternLabel: Readonly<Record<string, string>> = {
  GROUNDING: 'bài grounding',
  WALK: 'đi bộ nhẹ',
  WALKING: 'đi bộ nhẹ',
  BREATHING: 'bài thở',
  JOURNALING: 'ghi chép ngắn',
  SHORT_GUIDED_ACTIVITY: 'hoạt động có hướng dẫn ngắn',
}
const journalBarrierLabel: Readonly<Record<string, string>> = {
  LOW_ENERGY: 'năng lượng thấp',
  LIMITED_TIME: 'thời gian hạn chế',
  NOT_ENOUGH_TIME: 'không đủ thời gian',
  BREATHING_DISCOMFORT: 'khó chịu khi tập thở',
  DIFFICULT_TO_START: 'khó bắt đầu',
  NOT_A_GOOD_FIT: 'hoạt động chưa phù hợp',
}
const daypartLabel = {
  MORNING: 'buổi sáng',
  AFTERNOON: 'buổi chiều',
  EVENING: 'buổi tối',
  FLEXIBLE: 'thời điểm linh hoạt',
} as const
const helpfulnessLabel = {
  NOT_HELPFUL: 'không hữu ích',
  A_LITTLE_HELPFUL: 'hữu ích một chút',
  HELPFUL: 'hữu ích',
  VERY_HELPFUL: 'rất hữu ích',
} as const
const weekdayLabel: Readonly<Record<number, string>> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ Nhật',
}

function list(items: readonly string[]) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} và ${items.at(-1)}`
}

function unavailable(state: string) {
  return state === 'UNAVAILABLE'
    ? 'Nguồn này hiện không thể dùng cho lần xem lại.'
    : 'Chưa đủ dữ liệu để so sánh nguồn này.'
}

function normalizedSignal(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

function controlledSignals(
  values: readonly string[],
  labels: Readonly<Record<string, string>>,
) {
  const safe = values
    .map((value) => labels[normalizedSignal(value)])
    .filter((value): value is string => Boolean(value))
  return {
    safe: [...new Set(safe)],
    hiddenCount: Math.max(0, values.length - safe.length),
  }
}

function screeningDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension {
  const { screening } = review.reassessmentSummary
  const details =
    screening.state === 'AVAILABLE'
      ? screening.trends.map(
          (trend) =>
            `${instrumentLabel[trend.instrument]}: ${trendLabel[trend.direction]}.`,
        )
      : []
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
  const helpful = controlledSignals(
    journal.state === 'AVAILABLE' ? journal.helpfulPatterns : [],
    journalHelpfulPatternLabel,
  )
  const barriers = controlledSignals(
    journal.state === 'AVAILABLE' ? journal.barriers : [],
    journalBarrierLabel,
  )
  const details = [
    helpful.safe.length > 0
      ? `Mẫu có ích được tổng hợp: ${list(helpful.safe)}.`
      : '',
    barriers.safe.length > 0
      ? `Rào cản được tổng hợp: ${list(barriers.safe)}.`
      : '',
    helpful.hiddenCount + barriers.hiddenCount > 0
      ? `Có ${helpful.hiddenCount + barriers.hiddenCount} tín hiệu tổng hợp khác chưa có nhãn an toàn để hiển thị.`
      : '',
    'Nội dung ghi chép riêng tư không xuất hiện trong giải thích này.',
  ].filter(Boolean)
  return {
    id: 'journal',
    label: 'Ngữ cảnh từ ghi chép',
    state: journal.state === 'AVAILABLE' ? 'available' : 'limited',
    summary:
      journal.state === 'AVAILABLE'
        ? helpful.safe.length > 0 || barriers.safe.length > 0
          ? 'MentalBridge chỉ diễn đạt các mẫu tổng hợp có nhãn được phép.'
          : 'Nguồn tổng hợp đã sẵn sàng nhưng chưa có mẫu an toàn đủ rõ để nêu.'
        : unavailable(journal.state),
    details:
      journal.state === 'AVAILABLE'
        ? details
        : ['Nội dung ghi chép riêng tư không xuất hiện trong giải thích này.'],
  }
}

function engagementDimension(
  review: NativeSupportPlanReplacementReview,
): CompanionReviewDimension {
  const engagement = review.reassessmentSummary.supportPlanEngagement
  const barriers = new Map<keyof typeof barrierLabel, number>()
  for (const source of engagement.state === 'AVAILABLE'
    ? engagement.sources
    : []) {
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
      engagement.state !== 'AVAILABLE'
        ? []
        : repeated.length > 0
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
  const counts = new Map<keyof typeof helpfulnessLabel, number>()
  for (const source of reflection.state === 'AVAILABLE'
    ? reflection.sources.filter((item) => item.period === 'CURRENT')
    : []) {
    if (!source.helpfulness) continue
    counts.set(source.helpfulness, (counts.get(source.helpfulness) ?? 0) + 1)
  }
  const factualHelpfulness = [...counts].map(
    ([helpfulness, count]) =>
      `${count} phản hồi ${helpfulnessLabel[helpfulness]}`,
  )
  return {
    id: 'reflection',
    label: 'Phản hồi sau hoạt động',
    state: reflection.state === 'AVAILABLE' ? 'available' : 'limited',
    summary:
      reflection.state === 'AVAILABLE'
        ? factualHelpfulness.length > 0
          ? `Giai đoạn này có ${list(factualHelpfulness)}.`
          : 'Chưa có mức độ hữu ích được ghi nhận cho giai đoạn này.'
        : unavailable(reflection.state),
    details: [],
  }
}

function actions(plan: SupportPlanV3) {
  return plan.focuses
    .flatMap((focus) => focus.actions)
    .filter((action) => action.status !== 'ENDED')
}

function actionKey(action: PlanAction) {
  if (!action.source) return `action:${action.actionId}`
  return [
    action.actionType,
    action.source.ownerDomain,
    action.source.sourceKind,
    action.source.sourceId,
  ].join(':')
}

function currentSchedule(action: PlanAction): ActionSchedule | undefined {
  const schedules = action.schedules.filter(
    (schedule) => schedule.status !== 'ENDED',
  )
  return schedules.length === 1 ? schedules[0] : undefined
}

function frequency(schedule: ActionSchedule) {
  if (schedule.recurrenceType === 'DAILY') return 'mỗi ngày'
  if (schedule.recurrenceType === 'ONCE') return 'một lần'
  const days =
    schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek
      : schedule.recurrenceDayOfWeek === null
        ? []
        : [schedule.recurrenceDayOfWeek]
  const labels = days.map((day) => weekdayLabel[day]).filter(Boolean)
  return days.length > 0
    ? `${days.length} ngày mỗi tuần${labels.length === days.length ? ` (${list(labels)})` : ''}`
    : 'hàng tuần'
}

function scheduledTime(schedule: ActionSchedule) {
  return schedule.preferredDaypart
    ? `${daypartLabel[schedule.preferredDaypart]} (${schedule.localTime.slice(0, 5)})`
    : `lúc ${schedule.localTime.slice(0, 5)}`
}

function scheduleChanges(
  current: PlanAction,
  proposed: PlanAction,
): readonly string[] {
  const before = currentSchedule(current)
  const after = currentSchedule(proposed)
  const title = proposed.presentation.title
  if (!after)
    return [
      `“${title}”: Care chưa cung cấp một lịch duy nhất để so sánh thời lượng và thời điểm.`,
    ]
  if (!before)
    return [
      `“${title}”: phương án mới có lịch ${frequency(after)}, ${after.estimatedDurationMinutes ?? 'chưa nêu'} phút mỗi lần, ${scheduledTime(after)}.`,
    ]

  const changes = [
    before.estimatedDurationMinutes !== after.estimatedDurationMinutes
      ? `“${title}”: thời lượng mỗi lần từ ${before.estimatedDurationMinutes ?? 'chưa nêu'} phút thành ${after.estimatedDurationMinutes ?? 'chưa nêu'} phút.`
      : '',
    frequency(before) !== frequency(after)
      ? `“${title}”: nhịp từ ${frequency(before)} thành ${frequency(after)}.`
      : '',
    scheduledTime(before) !== scheduledTime(after)
      ? `“${title}”: thời điểm từ ${scheduledTime(before)} sang ${scheduledTime(after)}.`
      : '',
  ].filter(Boolean)
  return changes
}

function planChanges(review: NativeSupportPlanReplacementReview) {
  const current = actions(review.currentPlan)
  const proposed = actions(review.proposedPlan)
  const currentByKey = new Map(
    current.map((action) => [actionKey(action), action]),
  )
  const proposedKeys = new Set(proposed.map(actionKey))
  const details: string[] = []

  for (const next of proposed) {
    const previous = currentByKey.get(actionKey(next))
    if (!previous) {
      details.push(`Phương án mới thêm hoạt động “${next.presentation.title}”.`)
      const schedule = currentSchedule(next)
      if (schedule)
        details.push(
          `“${next.presentation.title}”: ${frequency(schedule)}, ${schedule.estimatedDurationMinutes ?? 'chưa nêu'} phút mỗi lần, ${scheduledTime(schedule)}.`,
        )
      continue
    }
    if (previous.presentation.title !== next.presentation.title)
      details.push(
        `Hoạt động “${previous.presentation.title}” được trình bày trong phương án mới là “${next.presentation.title}”.`,
      )
    details.push(...scheduleChanges(previous, next))
  }

  for (const previous of current) {
    if (!proposedKeys.has(actionKey(previous)))
      details.push(
        `Phương án mới không còn hoạt động “${previous.presentation.title}”.`,
      )
  }

  if (proposed.some((action) => action.actionType === 'PROFESSIONAL_SUPPORT'))
    details.push('Phương án mới có một bước hỗ trợ từ chuyên gia.')

  return details.length > 0
    ? details
    : [
        'Care chưa cung cấp khác biệt cụ thể về hoạt động, thời lượng hoặc thời điểm trong hai phương án này.',
      ]
}

function reviewOptions(
  review: NativeSupportPlanReplacementReview,
): readonly CompanionReviewOption[] {
  const keep: CompanionReviewOption = {
    id: 'keep',
    title: 'Giữ kế hoạch hiện tại',
    summary: 'Tiếp tục nhịp hiện tại; không có thay đổi nào được áp dụng.',
    details: [],
  }
  const change: CompanionReviewOption = {
    id: 'change',
    title: 'Xem phương án khác đã được chuẩn bị',
    summary:
      'Các khác biệt dưới đây chỉ mô tả hai phương án Care đã duyệt; chưa có thay đổi nào được áp dụng.',
    details: planChanges(review),
  }
  if (review.outcome === 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE')
    return [keep]
  if (review.outcome === 'CURRENT_PLAN_NOT_ADMISSIBLE') return [change]
  return [keep, change]
}

function hasContradiction(review: NativeSupportPlanReplacementReview) {
  const summary = review.reassessmentSummary
  const directions = new Set(
    (summary.screening.state === 'AVAILABLE' ? summary.screening.trends : [])
      .map((trend) => trend.direction)
      .filter(
        (direction) => direction === 'INCREASED' || direction === 'DECREASED',
      ),
  )
  const experience =
    summary.selfReportedExperience?.state === 'AVAILABLE'
      ? summary.selfReportedExperience.source?.currentExperience
      : undefined
  const reflection = summary.activityReflection ?? summary.userReflection
  const helpful =
    reflection?.state === 'AVAILABLE' &&
    reflection.sources.some(
      (source) =>
        source.period === 'CURRENT' &&
        (source.helpfulness === 'HELPFUL' ||
          source.helpfulness === 'VERY_HELPFUL'),
    )
  const barrierCounts = new Map<string, number>()
  for (const source of summary.supportPlanEngagement.state === 'AVAILABLE'
    ? summary.supportPlanEngagement.sources
    : []) {
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

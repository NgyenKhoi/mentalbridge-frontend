'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { levelLabels } from '@/features/assessment/components/assessment-meanings'
import { getEmotionCheckInProgress } from '@/features/emotion-check-in/api/browser-emotion-check-in'
import type { EmotionCheckInProgress } from '@/lib/emotion-check-in/contract'
import {
  confirmAdaptiveReviewOption,
  getAdaptiveSupportPlanReview,
} from '../api/browser-support-plan-actions'
import type {
  AdaptiveReviewConfirmation,
  AdaptiveReviewEvidenceRef,
  AdaptiveReviewOption,
  AdaptiveSupportPlanReview,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  REVIEW_REASSESSMENT_HREF,
  type ReviewPreference,
} from './workspace-links'
import { planActions, replacementDiff } from './workspace-model'

type Review = AdaptiveSupportPlanReview
type Summary = NonNullable<Review['reassessment']['summary']>
type SelfReport = Summary['selfReportedExperience']
type Props = Readonly<{
  plan: SupportPlanV3
  locked: boolean
  /** Care options of this kind are listed first and labelled; no match changes nothing. */
  prefer?: ReviewPreference
  /** The plan's current DRAFT, if any; Care allows only one. */
  pendingDraft?: SupportPlanV3
  /** Called after Care applied a change or prepared a draft; the workspace reloads. */
  onApplied: (result: AdaptiveReviewConfirmation) => Promise<void> | void
  /** Explicitly discards the pending draft (the workspace asks first). */
  onDiscardDraft: () => Promise<void> | void
  /** Reloads the authoritative plan after it changed elsewhere. */
  onRefreshPlan: () => Promise<void> | void
  /** Prepares a replacement draft from the reassessment result; the plan changes only after the owner confirms. */
  onProposeReplacement?: () => void
  /** Shows the prepared replacement where it is checked and applied. */
  onOpenAlternatives?: () => void
}>

/** Choices the page adds beside Care's options; they only navigate or prepare a draft, never apply. */
const NEW_PLAN = 'local:new-plan'
const SPECIALIST = 'local:specialist'

const domain = { PHQ9: 'Dấu hiệu trầm cảm', GAD7: 'Dấu hiệu lo âu' } as const
const shortDomain = { PHQ9: 'Trầm cảm', GAD7: 'Lo âu' } as const
const direction = {
  DECREASED: 'ít hơn lần trước một chút',
  INCREASED: 'nhiều hơn lần trước một chút',
  UNCHANGED: 'giống lần trước',
  INSUFFICIENT_DATA: 'chưa đủ để so sánh',
} as const
const experience = {
  BETTER: 'Dễ chịu hơn trước',
  ABOUT_THE_SAME: 'Gần như không thay đổi',
  MORE_DIFFICULT: 'Khó khăn hơn trước',
  UNSURE: 'Bạn chưa chắc',
} as const
const barrier = {
  NOT_ENOUGH_TIME: 'không đủ thời gian',
  LOW_ENERGY: 'thiếu năng lượng',
  NOT_A_GOOD_FIT: 'chưa hợp với bạn',
  HELPFUL: 'thấy có ích',
} as const
const daypart: Record<string, string> = {
  MORNING: 'buổi sáng',
  AFTERNOON: 'buổi chiều',
  EVENING: 'buổi tối',
  FLEXIBLE: 'linh hoạt',
}
const contradiction = {
  INSTRUMENT_DIRECTIONS_DIFFER:
    'Hai bài sàng lọc đang đi theo hai hướng khác nhau.',
  SELF_REPORT_DIFFERS_FROM_SCREENING:
    'Cảm nhận của bạn và bài sàng lọc chưa nói cùng một điều.',
  JOURNAL_DIFFERS_FROM_SCREENING:
    'Nhật ký và bài sàng lọc chưa nói cùng một điều.',
} as const
const unavailableReason = {
  NO_SUPPORTING_PATTERN: 'chưa có đủ ghi nhận lặp lại để gợi ý',
  NO_TIME_PREFERENCE: 'bạn chưa chọn khung giờ mong muốn',
  NO_ADMITTED_CANDIDATE: 'chưa có lựa chọn phù hợp',
  REASSESSMENT_REQUIRED: 'cần bài đánh giá lại của giai đoạn này',
  ADMISSION_UNAVAILABLE: 'chưa kiểm tra được lúc này',
  CURRENT_PLAN_NOT_ADMISSIBLE: 'kế hoạch hiện tại không còn phù hợp',
  PLAN_PAUSED: 'kế hoạch đang tạm dừng',
  ENTITLEMENT_REQUIRED: 'gói hiện tại chưa có thay đổi kế hoạch',
} as const
const kindName = {
  KEEP_CURRENT: 'Giữ kế hoạch như hiện tại',
  LOWER_WORKLOAD: 'Làm nhẹ bớt',
  DIFFERENT_TIME: 'Đổi thời điểm',
  ALTERNATIVE_ACTION: 'Thay bằng hoạt động khác',
  DIFFERENT_FOCUS: 'Đổi thứ tự ưu tiên',
  PROFESSIONAL_SUPPORT_NEXT_STEP: 'Trao đổi với chuyên gia',
} as const

function changeText(change: AdaptiveReviewOption['changes'][number]) {
  const from = change.before ?? '—'
  const to = change.after ?? '—'
  switch (change.field) {
    case 'ESTIMATED_DURATION_MINUTES':
      return `Mỗi lần ${from} phút → ${to} phút`
    case 'DAYS_PER_WEEK':
      return `${from} ngày mỗi tuần → ${to} ngày mỗi tuần`
    case 'PREFERRED_DAYPART':
      return `Làm vào ${daypart[from] ?? from} → ${daypart[to] ?? to}`
    case 'LOCAL_TIME':
      return `Lúc ${from} → ${to}`
    case 'ACTION':
      return `${from} → ${to}`
    case 'FOCUS_ORDER':
      return `Ưu tiên trước: ${to}`
  }
}

function optionTitle(option: AdaptiveReviewOption, review: Review) {
  if (option.kind === 'KEEP_CURRENT')
    return option.executionKind === 'CONTINUE_CYCLE'
      ? 'Giữ kế hoạch này thêm 14 ngày'
      : kindName.KEEP_CURRENT
  const action = review.patterns.find(
    (pattern) => pattern.actionId === option.actionId,
  )?.actionTitle
  return action &&
    ['LOWER_WORKLOAD', 'DIFFERENT_TIME', 'ALTERNATIVE_ACTION'].includes(
      option.kind,
    )
    ? `${kindName[option.kind]}: ${action}`
    : kindName[option.kind]
}

function evidenceText(ref: AdaptiveReviewEvidenceRef, review: Review) {
  switch (ref.source) {
    case 'PATTERN': {
      const pattern = review.patterns.find(
        (item) => item.patternId === ref.refId,
      )
      return pattern
        ? `${pattern.count} lần bạn ghi “${pattern.actionTitle}” là ${barrier[pattern.code]}`
        : 'Điều bạn đã ghi lại khi làm hoạt động'
    }
    case 'SELF_REPORTED_EXPERIENCE':
      return 'Cảm nhận bạn đã chia sẻ'
    case 'SCREENING_PHQ9':
      return `Bài sàng lọc ${domain.PHQ9.toLowerCase()}`
    case 'SCREENING_GAD7':
      return `Bài sàng lọc ${domain.GAD7.toLowerCase()}`
    case 'JOURNAL_CONTEXT':
      return 'Nhật ký của bạn'
    case 'PLAN_ENGAGEMENT':
      return 'Tần suất thực hiện kế hoạch'
    case 'ACTIVITY_REFLECTION':
      return 'Phản hồi sau hoạt động'
    case 'PREFERENCES':
      return 'Điều bạn muốn ưu tiên'
  }
}

function confirmLabel(option: AdaptiveReviewOption) {
  switch (option.executionKind) {
    case 'CONTINUE_CYCLE':
      return 'Giữ kế hoạch này thêm 14 ngày'
    case 'NO_CHANGE':
      return 'Giữ kế hoạch'
    case 'UPDATE_SCHEDULE':
      return 'Áp dụng thay đổi này'
    case 'PREPARE_REPLACEMENT':
      return 'Xem phương án thay thế'
    case 'NAVIGATE_PROFESSIONAL_SUPPORT':
      return 'Tìm chuyên gia'
    default:
      // An option kind this client does not know still reads plainly.
      return 'Xác nhận lựa chọn'
  }
}

/** The current exact-period report Care supplies, even without a composed summary. */
function selfReport(review: Review): SelfReport | undefined {
  return (
    review.evidenceContext?.selfReportedExperience ??
    review.reassessment?.summary?.selfReportedExperience
  )
}

const REASSESSMENT_REQUIRED_COPY =
  'Cần làm bài đánh giá lại trước khi giữ kế hoạch thêm 14 ngày.'

function problem(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
    if (error.code === 'SUPPORT_PLAN_REASSESSMENT_REQUIRED')
      return REASSESSMENT_REQUIRED_COPY
    if (error.status === 409)
      return 'Thông tin vừa thay đổi. Phần xem lại đã được cập nhật, hãy chọn lại.'
    if (error.status === 412)
      return 'Kế hoạch vừa thay đổi ở nơi khác. Phần xem lại đã được cập nhật, hãy chọn lại.'
    if (error.status !== undefined && error.status < 500)
      return 'Chưa thực hiện được. Kế hoạch của bạn chưa thay đổi.'
  }
  // A lost reply may hide an applied change; retrying with the same key is safe.
  return 'Chưa xác nhận được kết quả. Hãy thử lại; nếu thay đổi đã được áp dụng, bạn sẽ thấy kết quả đó.'
}

function ReviewMessage({
  message,
  alert,
}: Readonly<{ message: string; alert?: boolean }>) {
  return (
    <p className="mbw-inline-alert" role={alert ? 'alert' : undefined}>
      {message}
      {message === REASSESSMENT_REQUIRED_COPY && (
        <>
          {' '}
          <Link className="mbw-text-link" href={REVIEW_REASSESSMENT_HREF}>
            Làm bài đánh giá lại
          </Link>
        </>
      )}
    </p>
  )
}

function Screening({ summary }: Readonly<{ summary: Summary }>) {
  const levels = summary.screening.trends.flatMap((trend) =>
    trend.state === 'AVAILABLE' && trend.current
      ? [
          `${shortDomain[trend.instrument]}: ${levelLabels[trend.current.screeningLevel]}`,
        ]
      : [],
  )
  return (
    <>
      {levels.length > 0 && (
        <p className="mbw-evidence-value">{levels.join(' · ')}</p>
      )}
      <ScreeningLines summary={summary} />
    </>
  )
}

function ScreeningLines({ summary }: Readonly<{ summary: Summary }>) {
  return (
    <ul className="mbw-evidence-lines">
      {summary.screening.trends.map((trend) => (
        <li key={trend.instrument}>
          <span>{domain[trend.instrument]}</span>
          {trend.state === 'AVAILABLE' && trend.current ? (
            <strong>
              {!trend.previous
                ? `Mức ${levelLabels[trend.current.screeningLevel].toLowerCase()}`
                : trend.previous.screeningLevel === trend.current.screeningLevel
                  ? `Vẫn ở mức ${levelLabels[trend.current.screeningLevel].toLowerCase()}, dấu hiệu ${direction[trend.direction]}`
                  : `Từ mức ${levelLabels[trend.previous.screeningLevel].toLowerCase()} sang mức ${levelLabels[trend.current.screeningLevel].toLowerCase()}`}
            </strong>
          ) : (
            <strong>Chưa có kết quả trước để so sánh</strong>
          )}
        </li>
      ))}
    </ul>
  )
}

function SelfReportText({ report }: Readonly<{ report?: SelfReport }>) {
  if (report?.source)
    return <p>Cảm nhận: {experience[report.source.currentExperience]}</p>
  if (report?.unavailableReason === 'SOURCE_DELETED')
    return (
      <p className="mbw-quiet">
        Bạn đã xoá câu trả lời cho giai đoạn này, nên nó không được dùng.
      </p>
    )
  if (report?.state === 'UNAVAILABLE')
    return <p className="mbw-quiet">Tạm thời chưa đọc được câu trả lời này.</p>
  return (
    <p className="mbw-quiet">Bạn chưa chia sẻ cảm nhận cho giai đoạn này.</p>
  )
}

/** Display-only self-recorded Emotion coverage with its own dates; never sent to Care. */
function EmotionContext() {
  const [progress, setProgress] = useState<
    EmotionCheckInProgress | null | undefined
  >()
  useEffect(() => {
    let active = true
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    void getEmotionCheckInProgress(timezone)
      .then((value) => active && setProgress(value))
      .catch(() => active && setProgress(null))
    return () => {
      active = false
    }
  }, [])
  const window14 = progress?.windows.find((window) => window.totalDays === 14)
  return (
    <section
      className="mbw-evidence-item"
      aria-labelledby="mbw-ev-emotion"
      aria-busy={progress === undefined}
    >
      <h3 id="mbw-ev-emotion">Check-in cảm xúc</h3>
      {progress === undefined ? (
        <span className="mbw-skeleton mbw-skeleton-line" aria-hidden="true" />
      ) : progress && window14 ? (
        <>
          <p className="mbw-evidence-value">
            {window14.checkedInDays}/14 ngày có ghi lại
          </p>
          <p className="mbw-quiet">
            Tính đến{' '}
            {new Date(`${progress.asOfLocalDate}T00:00:00`).toLocaleDateString(
              'vi-VN',
            )}
            .
          </p>
        </>
      ) : (
        <p className="mbw-quiet">Tạm thời chưa đọc được check-in cảm xúc.</p>
      )}
      <p className="mbw-quiet">Chỉ để bạn tham khảo, không dùng cho gợi ý.</p>
    </section>
  )
}

function Evidence({ review }: Readonly<{ review: Review }>) {
  const summary = review.reassessment?.summary
  const period = review.programPeriod
  const journal = summary?.journalContext
  const barriers = review.patterns.filter(
    (pattern) => pattern.kind === 'REPEATED_BARRIER',
  )
  const helpful = review.patterns.filter(
    (pattern) => pattern.kind === 'REPEATED_HELPFUL',
  )
  return (
    <div
      className="mbw-evidence"
      role="group"
      aria-label="Những gì đã ghi nhận"
    >
      <section className="mbw-evidence-item" aria-labelledby="mbw-ev-pace">
        <h3 id="mbw-ev-pace">Tần suất</h3>
        <p className="mbw-evidence-value">
          Đã làm {period.completedCount}/{period.scheduledCount} lần đã hẹn
        </p>
        <p className="mbw-quiet">
          {period.skippedCount} lần bỏ qua
          {period.openCount > 0
            ? ` · ${period.openCount} lần chưa ghi lại`
            : ''}
        </p>
        {barriers.map((pattern) => (
          <p key={pattern.patternId} className="mbw-quiet">
            “{pattern.actionTitle}”: {pattern.count} lần bạn ghi là{' '}
            {barrier[pattern.code]}.
          </p>
        ))}
        {helpful.map((pattern) => (
          <p key={pattern.patternId} className="mbw-quiet">
            “{pattern.actionTitle}”: {pattern.count} lần bạn thấy có ích.
          </p>
        ))}
      </section>

      <section className="mbw-evidence-item" aria-labelledby="mbw-ev-screen">
        <h3 id="mbw-ev-screen">Bài sàng lọc</h3>
        {summary ? (
          <Screening summary={summary} />
        ) : (
          <p className="mbw-quiet">Chưa có.</p>
        )}
      </section>

      <EmotionContext />

      <section className="mbw-evidence-item" aria-labelledby="mbw-ev-journal">
        <h3 id="mbw-ev-journal">Nhật ký và cảm nhận</h3>
        {!journal ? (
          <p className="mbw-quiet">Chưa có trong phần xem lại này.</p>
        ) : journal.state === 'UNAVAILABLE' ? (
          <p className="mbw-quiet">Tạm thời chưa đọc được nhật ký.</p>
        ) : journal.dataCoverage ? (
          <>
            <p className="mbw-evidence-value">
              {journal.dataCoverage.currentPeriodJournalEntryCount} bài viết
              trong giai đoạn này
            </p>
            {!journal.dataCoverage.sufficientForComparison && (
              <p className="mbw-quiet">Chưa đủ để so sánh với trước.</p>
            )}
          </>
        ) : (
          <p className="mbw-quiet">Chưa đủ bài viết để so sánh với trước.</p>
        )}
        <SelfReportText report={selfReport(review)} />
      </section>
    </div>
  )
}

/**
 * The preferred kind moves up, but only past options of its own stretch: a professional-support option
 * Care ranked above it stays above it. Stable, Care's own order otherwise.
 */
function preferFirst<T extends { kind: string }>(
  options: readonly T[],
  prefer: string | undefined,
): T[] {
  const ordered: T[] = []
  let stretch: T[] = []
  const flush = () => {
    ordered.push(
      ...stretch.sort(
        (a, b) => Number(b.kind === prefer) - Number(a.kind === prefer),
      ),
    )
    stretch = []
  }
  for (const option of options) {
    if (option.kind === 'PROFESSIONAL_SUPPORT_NEXT_STEP') {
      flush()
      ordered.push(option)
    } else stretch.push(option)
  }
  flush()
  return ordered
}

const reassessmentNote = {
  NOT_STARTED: 'Bạn chưa làm bài đánh giá lại cho giai đoạn này.',
  INCOMPLETE: 'Bài đánh giá lại của giai đoạn này chưa hoàn tất.',
  STALE: 'Bài đánh giá lại cần được cập nhật.',
  UNAVAILABLE: 'Tạm thời chưa đọc được bài đánh giá lại.',
} as const

export default function AdaptiveReview({
  plan,
  locked,
  prefer,
  pendingDraft,
  onApplied,
  onDiscardDraft,
  onRefreshPlan,
  onProposeReplacement,
  onOpenAlternatives,
}: Props) {
  const [review, setReview] = useState<Review>()
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [choice, setChoice] = useState<string>()
  /** Which option prepared which draft here; it survives "back", a canceled or failed discard. */
  const [binding, setBinding] = useState<{
    optionId: string
    draftId: string
  }>()
  const [comparing, setComparing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [kept, setKept] = useState(false)
  /** Set after a failed refresh: the shown review may be out of date. */
  const [stale, setStale] = useState<string>()
  const [recoveringByHand, setRecoveringByHand] = useState(false)
  const checkRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)
  const lockedNoteId = useId()
  const keyRef = useRef<{ payload: string; key: string } | undefined>(undefined)
  const request = useRef(0)

  const load = useCallback(async () => {
    const token = ++request.current
    setLoadState('loading')
    try {
      const next = await getAdaptiveSupportPlanReview(plan.supportPlanId)
      if (token !== request.current) return false
      setReview(next)
      setChoice(undefined)
      setComparing(false)
      setStale(undefined)
      setLoadState('ready')
      return true
    } catch {
      if (token === request.current) setLoadState('error')
      return false
    }
  }, [plan.supportPlanId])

  useEffect(() => {
    // Re-read whenever the plan version changes; Care owns every option.
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, plan.version])

  const selected = review?.options.find((option) => option.optionId === choice)
  // The binding holds only while Care still has that exact draft; any other draft is foreign.
  const draftOptionId =
    binding && pendingDraft?.supportPlanId === binding.draftId
      ? binding.optionId
      : undefined
  const draft = draftOptionId ? pendingDraft : undefined
  const blockingDraft =
    selected?.executionKind === 'PREPARE_REPLACEMENT' &&
    pendingDraft &&
    draftOptionId !== selected.optionId
      ? pendingDraft
      : undefined
  const showCompare = Boolean(
    draft && comparing && selected?.optionId === draftOptionId,
  )

  async function confirm() {
    if (
      !review ||
      !selected ||
      submitting ||
      locked ||
      blockingDraft ||
      loadState !== 'ready' ||
      stale !== undefined
    )
      return
    const replacing = showCompare && draft
    const body = {
      reviewFingerprint: review.reviewFingerprint,
      optionId: selected.optionId,
      ...(review.reassessment?.summary
        ? { reassessmentSummaryId: review.reassessment?.summary.summaryId }
        : {}),
      ...(replacing
        ? {
            proposedPlanId: draft.supportPlanId,
            proposedVersion: draft.version,
          }
        : {}),
    }
    // One key per exact choice so a lost reply is retried, never re-chosen.
    const payload = JSON.stringify(body)
    if (keyRef.current?.payload !== payload)
      keyRef.current = { payload, key: crypto.randomUUID() }
    setSubmitting(true)
    setMessage('')
    try {
      const result = await confirmAdaptiveReviewOption(
        plan.supportPlanId,
        review.planVersion,
        body,
        keyRef.current.key,
      )
      keyRef.current = undefined
      if (result.result === 'DRAFT_PREPARED' && result.draft) {
        setBinding({
          optionId: selected.optionId,
          draftId: result.draft.supportPlanId,
        })
        setComparing(true)
        setStatus('Đã chuẩn bị phương án thay thế. Hãy so sánh trước khi chọn.')
      } else if (result.result === 'KEPT') {
        setChoice(undefined)
        setKept(true)
      } else setBinding(undefined)
      // Care already applied the choice; a failed refresh must not say otherwise.
      try {
        await onApplied(result)
      } catch {
        setStale(
          result.result === 'DRAFT_PREPARED'
            ? 'Đã chuẩn bị phương án, nhưng chưa tải lại được. Hãy tải lại phần xem lại.'
            : 'Đã cập nhật kế hoạch, nhưng chưa tải lại được. Hãy tải lại phần xem lại.',
        )
      }
    } catch (error) {
      setMessage(problem(error))
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        keyRef.current = undefined
        // The plan itself may have changed (paused, rescheduled): reload it first.
        await recover(error.status === 412)
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** Drops the old choice and blocks confirmation until the plan and a fresh review load. */
  async function recover(refreshPlan: boolean, focusAfter = false) {
    setChoice(undefined)
    setComparing(false)
    setStale('')
    try {
      if (refreshPlan) await onRefreshPlan()
      const loaded = await load()
      if (!focusAfter) return
      // The reload button disappears either way; keep keyboard focus in the review.
      window.requestAnimationFrame(() =>
        (loaded ? reviewRef.current : retryRef.current)?.focus(),
      )
      if (loaded) setStatus('Đã tải lại phần xem lại.')
    } catch {
      setMessage('')
      setStale('Chưa tải lại được kế hoạch. Hãy thử tải lại phần xem lại.')
    }
  }

  function choose(optionId: string) {
    const first = !choice
    setChoice(optionId)
    setComparing(optionId === draftOptionId)
    setMessage('')
    setKept(false)
    if (!first) return
    // Bring the confirm step into view once; phones otherwise leave it below the fold.
    window.requestAnimationFrame(() =>
      checkRef.current?.scrollIntoView?.({
        block: 'nearest',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches
          ? 'auto'
          : 'smooth',
      }),
    )
  }

  async function discardDraft() {
    setSubmitting(true)
    try {
      // Cancel or failure leaves the draft, so its binding stays; removal ends it.
      await onDiscardDraft()
      setComparing(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadState === 'loading' && !review)
    return (
      <div className="mbw-review" aria-busy="true">
        <span className="mbw-skeleton mbw-skeleton-line" />
        <span className="mbw-skeleton mbw-skeleton-line is-short" />
        <span className="mbw-visually-hidden" role="status">
          Đang tải phần xem lại…
        </span>
      </div>
    )
  if (loadState === 'error' || !review)
    return (
      <div className="mbw-review">
        <p role="alert">Chưa tải được phần xem lại. Kế hoạch vẫn như cũ.</p>
        <div className="mbw-actions">
          <button
            type="button"
            className="mbw-secondary"
            ref={retryRef}
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      </div>
    )

  const period = review.programPeriod
  const lead =
    review.reviewState === 'REVIEW_DUE'
      ? 'Bạn đã đi hết 14 ngày. Đây là những gì đã ghi nhận và các cách đi tiếp.'
      : review.reviewState === 'PAUSED'
        ? 'Kế hoạch đang tạm dừng. Bạn vẫn có thể xem lại; không có gì thay đổi cho đến khi bạn chọn.'
        : `Bạn đang ở ngày ${period.elapsedDays} của kế hoạch. Đây là những gì đã ghi nhận đến hôm nay.`
  const reassessmentState = review.reassessment?.state ?? 'UNAVAILABLE'
  const canKeep = review.options.some(
    (option) => option.kind === 'KEEP_CURRENT',
  )
  const hasSelfReport = Boolean(selfReport(review)?.source)
  const unavailable = review.unavailableOptions.filter(
    (entry) => !review.options.some((option) => option.kind === entry.kind),
  )
  const currentTitles = planActions(plan).map(
    (action) => action.presentation.title,
  )
  const offerNewPlan =
    reassessmentState === 'AVAILABLE' && !!onProposeReplacement
  // A draft no Care option prepared here is the plan made from the reassessment.
  const proposal = draftOptionId ? undefined : pendingDraft
  const offerSpecialist = !review.options.some(
    (option) => option.kind === 'PROFESSIONAL_SUPPORT_NEXT_STEP',
  )

  return (
    <div className="mbw-review" ref={reviewRef} tabIndex={-1}>
      <p className="mbw-why">{lead}</p>

      <Evidence review={review} />

      {review.contradictions.map((item) => (
        <p key={item.contradictionId} className="mbw-review-note">
          {contradiction[item.kind]} Cả hai đều được hiển thị để bạn tự cân
          nhắc.
        </p>
      ))}

      {reassessmentState !== 'AVAILABLE' && (
        <div className="mbw-review-note">
          <p>
            {reassessmentNote[reassessmentState]}{' '}
            {canKeep ? 'Bạn vẫn có thể giữ kế hoạch. ' : ''}Để xem phương án đổi
            hoạt động, hãy làm bài đánh giá lại trước.
          </p>
          <Link className="mbw-text-link" href={REVIEW_REASSESSMENT_HREF}>
            Làm bài đánh giá lại
          </Link>
        </div>
      )}

      {review.currentAdmission === 'UNAVAILABLE' && (
        <p className="mbw-review-note">
          Chưa kiểm tra được kế hoạch lúc này nên chưa thể áp dụng thay đổi. Kế
          hoạch của bạn vẫn như cũ.
        </p>
      )}
      {review.currentAdmission === 'INADMISSIBLE' && (
        <p className="mbw-review-note">
          Kế hoạch hiện tại không còn phù hợp với kết quả mới nhất. Lịch sử của
          bạn vẫn được giữ.
        </p>
      )}

      {(review.options.length > 0 || offerNewPlan) && !showCompare && (
        <fieldset
          className="mbw-options"
          disabled={submitting || loadState !== 'ready' || stale !== undefined}
        >
          <legend>Bạn muốn đi tiếp thế nào?</legend>
          {offerNewPlan && (
            <label className="mbw-option">
              <input
                type="radio"
                name={`adaptive-option-${review.supportPlanId}`}
                value={NEW_PLAN}
                checked={choice === NEW_PLAN}
                onChange={() => choose(NEW_PLAN)}
              />
              <span>
                <strong>Lập kế hoạch mới</strong>
                <span className="mbw-quiet">
                  {proposal
                    ? 'Đã có phương án mới, chưa áp dụng.'
                    : 'Dựa trên kết quả bài đánh giá lại của bạn.'}
                </span>
              </span>
            </label>
          )}
          {preferFirst(review.options, prefer).map((option) => {
            // A source the user never gave is not shown as a reason.
            const why = option.evidenceRefs
              .filter(
                (ref) =>
                  ref.source !== 'SELF_REPORTED_EXPERIENCE' || hasSelfReport,
              )
              .map((ref) => evidenceText(ref, review))
            const against = option.conflictingEvidenceRefs
              .filter(
                (ref) =>
                  ref.source !== 'SELF_REPORTED_EXPERIENCE' || hasSelfReport,
              )
              .map((ref) => evidenceText(ref, review))
            return (
              <label key={option.optionId} className="mbw-option">
                <input
                  type="radio"
                  name={`adaptive-option-${review.supportPlanId}`}
                  value={option.optionId}
                  checked={choice === option.optionId}
                  onChange={() => choose(option.optionId)}
                />
                <span>
                  <strong>{optionTitle(option, review)}</strong>
                  {prefer && option.kind === prefer && (
                    <span className="mbw-quiet">Hợp với điều bạn vừa chọn</span>
                  )}
                  {option.executionKind === 'CONTINUE_CYCLE' && (
                    <span className="mbw-quiet">
                      Tiếp tục {currentTitles.length} hoạt động hiện tại thêm
                      một chu kỳ.
                    </span>
                  )}
                  {(option.changes ?? []).map((change) => (
                    <span key={change.field}>{changeText(change)}</span>
                  ))}
                  {option.optionId === draftOptionId && draft && (
                    <span className="mbw-quiet">
                      Đã chuẩn bị phương án, chưa áp dụng.
                    </span>
                  )}
                  {why.length > 0 && (
                    <span className="mbw-quiet">
                      Dựa trên: {why.join('; ')}
                    </span>
                  )}
                  {against.length > 0 && (
                    <span className="mbw-quiet">
                      Điều chưa khớp: {against.join('; ')}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
          {offerSpecialist && (
            <label className="mbw-option">
              <input
                type="radio"
                name={`adaptive-option-${review.supportPlanId}`}
                value={SPECIALIST}
                checked={choice === SPECIALIST}
                onChange={() => choose(SPECIALIST)}
              />
              <span>
                <strong>Cần chuyên gia hỗ trợ</strong>
                <span className="mbw-quiet">
                  Bạn tự chọn chuyên gia và tự đặt lịch.
                </span>
              </span>
            </label>
          )}
        </fieldset>
      )}

      {choice === NEW_PLAN && (
        <div ref={checkRef} className="mbw-check" aria-live="polite">
          <p>
            <strong>Bạn chọn:</strong> Lập kế hoạch mới.
          </p>
          <p className="mbw-quiet">
            {proposal
              ? `${replacementDiff(plan, proposal).summary}. Kế hoạch hiện tại không đổi cho đến khi bạn áp dụng.`
              : 'Bạn sẽ xem phương án mới trước. Kế hoạch hiện tại không đổi cho đến khi bạn xác nhận.'}
          </p>
          <div className="mbw-actions">
            {proposal && onOpenAlternatives ? (
              <button
                type="button"
                className="mbw-primary"
                onClick={onOpenAlternatives}
              >
                Xem phương án mới
              </button>
            ) : (
              <button
                type="button"
                className="mbw-primary"
                disabled={locked}
                onClick={onProposeReplacement}
              >
                Lập kế hoạch mới từ kết quả đánh giá
              </button>
            )}
          </div>
        </div>
      )}

      {choice === SPECIALIST && (
        <div ref={checkRef} className="mbw-check" aria-live="polite">
          <p>
            <strong>Bạn chọn:</strong> Cần chuyên gia hỗ trợ.
          </p>
          <p className="mbw-quiet">
            Bạn tự chọn chuyên gia và tự xác nhận lịch hẹn. Kế hoạch không tự
            đặt lịch.
          </p>
          <div className="mbw-actions">
            <Link className="mbw-primary" href="/specialists">
              Tìm chuyên gia
            </Link>
          </div>
        </div>
      )}

      {showCompare && draft && (
        <div
          className="mbw-compare"
          role="group"
          aria-label="So sánh kế hoạch hiện tại và phương án thay thế"
        >
          <section>
            <p className="mbw-row-title">Đang dùng</p>
            <ul>
              {currentTitles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </section>
          <section>
            <p className="mbw-row-title">Phương án thay thế</p>
            <ul>
              {planActions(draft).map((action) => (
                <li key={action.actionId}>{action.presentation.title}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {kept && (
        <p className="mbw-review-note" role="status">
          Bạn giữ kế hoạch như hiện tại. Không có gì thay đổi.
        </p>
      )}

      {selected && (
        <div ref={checkRef} className="mbw-check" aria-live="polite">
          <p>
            <strong>Bạn chọn:</strong> {optionTitle(selected, review)}.
          </p>
          <p className="mbw-quiet">
            {selected.executionKind === 'NAVIGATE_PROFESSIONAL_SUPPORT'
              ? 'Bạn tự chọn chuyên gia và tự xác nhận lịch hẹn. Kế hoạch không tự đặt lịch.'
              : blockingDraft
                ? 'Bạn đang có một phương án thay thế chưa dùng. Hãy bỏ phương án đó trước khi chuẩn bị phương án mới.'
                : showCompare
                  ? 'Kế hoạch đang dùng chuyển vào lịch sử. Những gì bạn đã ghi nhận vẫn được giữ.'
                  : selected.executionKind === 'CONTINUE_CYCLE'
                    ? 'Kế hoạch giữ nguyên, thêm 14 ngày bắt đầu từ hôm nay.'
                    : selected.executionKind === 'PREPARE_REPLACEMENT'
                      ? 'Bạn sẽ thấy phương án thay thế để so sánh trước khi chọn. Chưa có gì thay đổi.'
                      : selected.changes.length > 0
                        ? 'Chỉ phần trên thay đổi. Phần còn lại của kế hoạch giữ nguyên.'
                        : 'Kế hoạch giữ nguyên.'}
          </p>
          {locked && !submitting && (
            <p id={lockedNoteId} className="mbw-quiet">
              Hãy lưu hoặc hoàn tác thay đổi đang dở ở phần trên trước khi áp
              dụng.
            </p>
          )}
          {message && <ReviewMessage message={message} />}
          <div className="mbw-actions">
            {selected.executionKind === 'NAVIGATE_PROFESSIONAL_SUPPORT' ? (
              <Link className="mbw-primary" href="/specialists">
                Tìm chuyên gia
              </Link>
            ) : blockingDraft ? (
              <button
                type="button"
                className="mbw-secondary"
                aria-disabled={submitting}
                onClick={() => !submitting && void discardDraft()}
              >
                Bỏ phương án đã chuẩn bị
              </button>
            ) : (
              <button
                type="button"
                className="mbw-primary"
                aria-disabled={
                  submitting ||
                  locked ||
                  stale !== undefined ||
                  loadState !== 'ready'
                }
                aria-busy={submitting}
                aria-describedby={locked ? lockedNoteId : undefined}
                onClick={() =>
                  // Resuming a draft prepared here only reopens the comparison.
                  selected.optionId === draftOptionId && draft && !showCompare
                    ? setComparing(true)
                    : void confirm()
                }
              >
                {submitting
                  ? 'Đang áp dụng…'
                  : showCompare
                    ? 'Chuyển sang phương án này'
                    : selected.optionId === draftOptionId && draft
                      ? 'So sánh phương án đã chuẩn bị'
                      : confirmLabel(selected)}
              </button>
            )}
            {showCompare && (
              <button
                type="button"
                className="mbw-text-button"
                onClick={() => setComparing(false)}
              >
                Quay lại các lựa chọn
              </button>
            )}
          </div>
        </div>
      )}

      {unavailable.length > 0 && (
        <details className="mbw-review-more">
          <summary>Vì sao không có lựa chọn khác?</summary>
          <ul>
            {unavailable.map((entry) => (
              <li key={entry.kind}>
                {kindName[entry.kind]}: {unavailableReason[entry.reasonCode]}.
              </li>
            ))}
          </ul>
        </details>
      )}

      {message && !selected && <ReviewMessage message={message} alert />}
      {stale !== undefined && (stale || recoveringByHand) && (
        <div className="mbw-review-note">
          {stale && <p role="alert">{stale}</p>}
          {/* Stays mounted while reloading so focus is not lost. */}
          <button
            type="button"
            className="mbw-secondary"
            aria-disabled={!stale}
            aria-busy={!stale}
            onClick={() => {
              if (!stale) return
              setRecoveringByHand(true)
              void recover(true, true).finally(() => setRecoveringByHand(false))
            }}
          >
            {stale ? 'Tải lại phần xem lại' : 'Đang tải lại…'}
          </button>
        </div>
      )}
      <p className="mbw-visually-hidden" role="status">
        {status}
      </p>
    </div>
  )
}

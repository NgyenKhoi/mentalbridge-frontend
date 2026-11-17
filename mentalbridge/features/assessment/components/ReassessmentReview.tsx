'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ChevronDown, Equal } from 'lucide-react'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type { ActivityDashboard } from '@/features/analytics/api/activity-dashboard-contract'
import { getAnalyticsEvents } from '@/features/analytics/api/browser-analytics'
import { getResourceCatalogue } from '@/features/resources/api/browser-resources'
import { ApiError } from '@/lib/api/api-error'
import { emotionPresentation } from '@/lib/emotion-check-in/presentation'
import type { LongitudinalAnalysisJob } from '@/lib/journal/journal-contract'
import {
  composeReassessmentSummary,
  createLongitudinalAnalysis,
  createReassessmentSelfReport,
  deleteReassessmentSelfReport,
  getCurrentReassessmentSelfReport,
  getLongitudinalAnalysisJob,
  getReassessmentContext,
  listReassessmentSummaries,
  replaceReassessmentSelfReport,
} from '../api/browser-care'
import type {
  ReassessmentContext,
  ReassessmentCurrentExperience,
  ReassessmentSelfReport,
  ReassessmentSummary,
  ScreeningLevel,
} from '../api/care-contract'
import { levelLabels } from './assessment-meanings'
import {
  formatDayMonth,
  helpfulSources,
  moodRangeFor,
  moodRow,
  topBarriers,
  type MoodRow,
} from './reassessment-review-model'

import './reassessment-review.css'

type Phase =
  'loading' | 'incomplete' | 'composing' | 'jobRunning' | 'ready' | 'error'

const experienceOptions: ReadonlyArray<
  readonly [ReassessmentCurrentExperience, string]
> = [
  ['BETTER', 'Dễ chịu hơn trước'],
  ['ABOUT_THE_SAME', 'Gần như không thay đổi'],
  ['MORE_DIFFICULT', 'Khó khăn hơn trước'],
  ['UNSURE', 'Tôi chưa chắc'],
]
const experienceLabels = Object.fromEntries(experienceOptions) as Record<
  ReassessmentCurrentExperience,
  string
>

const directionLabels = {
  MORE_FREQUENT: 'nhắc nhiều hơn',
  LESS_FREQUENT: 'nhắc ít hơn',
  SIMILAR: 'tương tự kỳ trước',
} as const

const helpfulnessLabels = {
  VERY_HELPFUL: 'Rất giúp ích',
  HELPFUL: 'Giúp ích',
} as const

const instrumentNames = {
  PHQ9: 'Trầm cảm (PHQ-9)',
  GAD7: 'Lo âu (GAD-7)',
} as const

const levelToEmotion = ['VERY_LOW', 'LOW', 'OKAY', 'GOOD', 'GREAT'] as const

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function terminalJob(initial: LongitudinalAnalysisJob) {
  let job = initial
  for (let attempt = 0; attempt < 20 && job.status === 'RUNNING'; attempt++) {
    await wait(750)
    job = await getLongitudinalAnalysisJob(job.jobId)
  }
  return job
}

const dayMonth = (iso: string) => formatDayMonth(iso)
// Periods are half-open, so the last day shown is the day before endAt.
const periodLabel = (period: ReassessmentSummary['currentPeriod']) =>
  `${dayMonth(period.startAt)}–${dayMonth(
    new Date(Date.parse(period.endAt) - 1).toISOString(),
  )}`

const samePair = (summary: ReassessmentSummary, context: ReassessmentContext) =>
  summary.screening.trends.every(
    (trend) =>
      trend.current.assessmentId ===
      (trend.instrument === 'PHQ9'
        ? context.phq9AssessmentId
        : context.gad7AssessmentId),
  )

const samePeriod = (
  report: ReassessmentSelfReport,
  context: Pick<ReassessmentContext, 'currentPeriod'>,
) =>
  report.currentPeriod.startAt === context.currentPeriod.startAt &&
  report.currentPeriod.endAt === context.currentPeriod.endAt

const isConsentError = (error: unknown) =>
  error instanceof ApiError && error.code === 'AI_CONTEXT_CONSENT_REQUIRED'

/** Starts the journal job; undefined when consent is off, so Care composes the journal part as unavailable. */
async function startJob(ctx: ReassessmentContext) {
  try {
    return await terminalJob(
      await createLongitudinalAnalysis(
        {
          previousPeriod: ctx.previousPeriod,
          currentPeriod: ctx.currentPeriod,
          excludedJournalIds: [],
        },
        crypto.randomUUID(),
      ),
    )
  } catch (error) {
    if (isConsentError(error)) return undefined
    throw error
  }
}

function Collapse({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="rr-disclosure">
      <button
        type="button"
        className="rr-disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="content"
            className="rr-disclosure-content"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rr-disclosure-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Block({
  index,
  title,
  children,
  wide,
}: Readonly<{
  index: number
  title: string
  children: ReactNode
  wide?: boolean
}>) {
  const headingId = useId()
  return (
    <section
      className={`rr-block rr-rise${wide ? ' rr-block-wide' : ''}`}
      style={{ '--rr-i': index } as CSSProperties}
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>{title}</h3>
      {children}
    </section>
  )
}

function Pill({
  level,
  now,
}: Readonly<{ level: ScreeningLevel; now?: boolean }>) {
  return (
    <div
      className={`rr-pill${now ? ' rr-pill-now rr-band-now' : ''}`}
      data-level={level.toLowerCase()}
    >
      {levelLabels[level]}
    </div>
  )
}

function ScreeningBlock({
  summary,
}: Readonly<{ summary: ReassessmentSummary }>) {
  const trends = summary.screening.trends
  return (
    <Block index={4} title="Mức độ sàng lọc">
      <ul className="rr-tiles rr-tiles-2">
        {trends.map((trend) => {
          const previous =
            trend.state === 'AVAILABLE' ? trend.previous : undefined
          return (
            <li key={trend.instrument} className="rr-tile">
              <div className="rr-tile-name">
                {instrumentNames[trend.instrument]}
              </div>
              <div
                className="rr-band-flow"
                data-compared={previous ? 'yes' : 'no'}
              >
                {previous && (
                  <>
                    <Pill level={previous.screeningLevel} />
                    <svg
                      className="rr-arrow"
                      viewBox="0 0 28 12"
                      width="32"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 6h24M20 1.5 25.5 6 20 10.5" />
                    </svg>
                  </>
                )}
                <Pill level={trend.current.screeningLevel} now />
                {previous && <div className="rr-caption">Kỳ trước</div>}
                {previous && <div />}
                <div className="rr-caption rr-band-now">Kỳ này</div>
              </div>
              {!previous && (
                <p className="rr-note">Chưa có kết quả kỳ trước để so sánh.</p>
              )}
            </li>
          )
        })}
      </ul>
      <Collapse label="Xem điểm chi tiết">
        <ul className="rr-rows">
          {trends.map((trend) => (
            <li key={trend.instrument} className="rr-score-line">
              {instrumentNames[trend.instrument]}:{' '}
              {trend.previous ? `${trend.previous.totalScore} → ` : ''}
              {trend.current.totalScore} điểm
              {trend.previous && trend.rawDelta != null
                ? ` (thay đổi ${trend.rawDelta > 0 ? '+' : ''}${trend.rawDelta})`
                : ''}
            </li>
          ))}
        </ul>
      </Collapse>
    </Block>
  )
}

const directionIcons = {
  MORE_FREQUENT: ArrowUp,
  LESS_FREQUENT: ArrowDown,
  SIMILAR: Equal,
} as const

function JournalBlock({ summary }: Readonly<{ summary: ReassessmentSummary }>) {
  const journal = summary.journalContext
  const coverage = journal.dataCoverage
  const changes = journal.changesComparedWithPreviousPeriod.filter(
    (change) => change.direction !== 'INSUFFICIENT_DATA',
  )
  const hasChips =
    journal.recurringThemes.length > 0 || journal.helpfulPatterns.length > 0
  let body: ReactNode
  if (journal.state === 'UNAVAILABLE') {
    body =
      journal.unavailableReason === 'CONSENT_REQUIRED' ||
      journal.unavailableReason === 'CONSENT_REVOKED' ? (
        <GateNote
          text={
            journal.unavailableReason === 'CONSENT_REVOKED'
              ? 'Bạn đã tắt quyền cho AI đọc nhật ký.'
              : 'Bật quyền cho AI đọc nhật ký để thấy phần này.'
          }
          href="/profile"
          action="Mở quyền riêng tư"
        />
      ) : (
        <p className="rr-note">Chưa đọc được nhật ký lần này.</p>
      )
  } else if (journal.state === 'INSUFFICIENT_DATA') {
    body = (
      <GateNote
        text={`Cần ít nhất 3 bài mỗi kỳ để so sánh. Kỳ này bạn có ${coverage?.currentPeriodJournalEntryCount ?? 0} bài.`}
        href="/journal"
        action="Viết nhật ký"
      />
    )
  } else {
    body = (
      <>
        <div className="rr-journal-grid" data-chips={hasChips ? 'yes' : 'no'}>
          <div className="rr-journal-col">
            <div className="rr-sub">So với kỳ trước</div>
            {changes.length > 0 ? (
              <ul className="rr-rows">
                {changes.map((change) => {
                  const direction =
                    change.direction as keyof typeof directionIcons
                  const Icon = directionIcons[direction]
                  return (
                    <li key={change.signal} className="rr-change">
                      <div className="rr-change-label">{change.signal}</div>
                      <div className="rr-direction">
                        {Icon && <Icon aria-hidden="true" size={14} />}
                        {directionLabels[direction] ?? ''}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="rr-note">Chưa thấy thay đổi rõ giữa hai kỳ.</p>
            )}
          </div>
          {hasChips && (
            <div className="rr-journal-col">
              <ChipGroup
                label="Chủ đề lặp lại"
                items={journal.recurringThemes}
              />
              <ChipGroup
                label="Điều bạn thấy giúp ích"
                items={journal.helpfulPatterns}
              />
            </div>
          )}
        </div>
        {coverage && (
          <p className="rr-note">
            Dựa trên {coverage.currentPeriodJournalEntryCount} bài nhật ký kỳ
            này ({coverage.previousPeriodJournalEntryCount} bài kỳ trước).
          </p>
        )}
      </>
    )
  }
  return (
    <Block index={5} title="Điều bạn viết trong nhật ký">
      {body}
    </Block>
  )
}

function GateNote({
  text,
  href,
  action,
}: Readonly<{ text: string; href: string; action: string }>) {
  return (
    <div className="rr-gate">
      <p>{text}</p>
      <Link href={href} className="rr-link">
        {action}
      </Link>
    </div>
  )
}

function ChipGroup({
  label,
  items,
}: Readonly<{ label: string; items: string[] }>) {
  if (items.length === 0) return null
  return (
    <div className="rr-chip-group">
      <div className="rr-sub">{label}</div>
      <ul className="rr-chips">
        {items.map((item) => (
          <li key={item} className="rr-chip">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

const emotionDotStyle = (emotion: (typeof levelToEmotion)[number] | null) =>
  ({
    '--rr-dot': emotion ? emotionPresentation[emotion].color : 'transparent',
  }) as CSSProperties

function MoodDots({
  row,
  label,
  range,
  offset,
}: Readonly<{ row: MoodRow; label: string; range: string; offset: number }>) {
  const description = `${label} ${range}: ${row.checkedDays} ngày có check-in, ${row.goodDays} ngày tốt hoặc rất tốt`
  return (
    <div className="rr-mood-row">
      <div className="rr-mood-label">
        {label} <div className="rr-range">{range}</div>
      </div>
      <div className="rr-dots" role="img" aria-label={description}>
        {row.days.map((day, index) => {
          const emotion = day.level ? levelToEmotion[day.level - 1] : null
          return (
            <i
              key={day.localDate}
              className="rr-dot"
              data-empty={emotion ? undefined : 'true'}
              title={`${day.localDate.slice(8, 10)}/${day.localDate.slice(5, 7)}: ${
                emotion ? emotionPresentation[emotion].label : 'chưa ghi'
              }`}
              style={
                {
                  ...emotionDotStyle(emotion),
                  '--rr-d': offset + index,
                } as CSSProperties
              }
            />
          )
        })}
      </div>
      <div className="rr-mood-count">
        {row.goodDays} ngày tốt hoặc rất tốt · {row.checkedDays} ngày ghi
      </div>
    </div>
  )
}

function MoodLegend() {
  return (
    <ul className="rr-legend" aria-label="Ý nghĩa màu của các chấm">
      {[...levelToEmotion].reverse().map((emotion) => (
        <li key={emotion}>
          <i className="rr-dot rr-dot-key" style={emotionDotStyle(emotion)} />
          {emotionPresentation[emotion].label}
        </li>
      ))}
      <li>
        <i
          className="rr-dot rr-dot-key"
          data-empty="true"
          style={emotionDotStyle(null)}
        />
        Chưa ghi
      </li>
    </ul>
  )
}

type MoodState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'none' }
  | { phase: 'ready'; previous: MoodRow; current: MoodRow }

/** Daily mood from the activity dashboard, shared by the overview strip and the mood section. */
function useMood(
  periods:
    Pick<ReassessmentContext, 'previousPeriod' | 'currentPeriod'> | undefined,
) {
  const [state, setState] = useState<MoodState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const previousPeriod = periods?.previousPeriod
  const currentPeriod = periods?.currentPeriod

  useEffect(() => {
    if (!previousPeriod || !currentPeriod) return
    let active = true
    const range = moodRangeFor(previousPeriod)
    if (!range) {
      void Promise.resolve().then(() => active && setState({ phase: 'none' }))
      return () => {
        active = false
      }
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getAnalyticsEvents(range, timeZone)
      .then((dashboard: ActivityDashboard) => {
        if (!active) return
        if (dashboard.sources.emotions === 'unavailable') {
          setState({ phase: 'error' })
          return
        }
        setState({
          phase: 'ready',
          previous: moodRow(dashboard, previousPeriod, timeZone),
          current: moodRow(dashboard, currentPeriod, timeZone),
        })
      })
      .catch(() => active && setState({ phase: 'error' }))
    return () => {
      active = false
    }
  }, [previousPeriod, currentPeriod, attempt])

  const retry = () => {
    setState({ phase: 'loading' })
    setAttempt((value) => value + 1)
  }
  return [state, retry] as const
}

function MoodBlock({
  periods,
  mood,
  onRetry,
}: Readonly<{
  periods: Pick<ReassessmentContext, 'previousPeriod' | 'currentPeriod'>
  mood: MoodState
  onRetry: () => void
}>) {
  let body: ReactNode
  if (mood.phase === 'loading')
    body = <Skeleton height={96} width="100%" className="rr-skeleton" />
  else if (mood.phase === 'error')
    body = (
      <div className="rr-gate">
        <p>Chưa tải được check-in cảm xúc.</p>
        <button type="button" className="rr-link" onClick={onRetry}>
          Thử lại
        </button>
      </div>
    )
  else if (
    mood.phase === 'none' ||
    mood.previous.checkedDays + mood.current.checkedDays === 0
  )
    body = (
      <GateNote
        text="Chưa có check-in cảm xúc trong 14 ngày."
        href="/dashboard"
        action="Check-in cảm xúc"
      />
    )
  else
    body = (
      <>
        <MoodDots
          row={mood.previous}
          label="Kỳ trước"
          range={periodLabel(periods.previousPeriod)}
          offset={0}
        />
        <MoodDots
          row={mood.current}
          label="Kỳ này"
          range={periodLabel(periods.currentPeriod)}
          offset={14}
        />
        <MoodLegend />
      </>
    )
  return (
    <Block index={6} title="Cảm xúc hằng ngày">
      {body}
    </Block>
  )
}

function StatTile({
  index,
  value,
  label,
  note,
}: Readonly<{ index: number; value: string; label: string; note: string }>) {
  return (
    <li
      className="rr-stat rr-rise"
      style={{ '--rr-i': index } as CSSProperties}
    >
      <div className="rr-stat-number">{value}</div>
      <div className="rr-stat-label">{label}</div>
      <div className="rr-stat-note">{note}</div>
    </li>
  )
}

/** Counts only: what the user wrote, checked in and did; never a score or a judgement. */
function OverviewStrip({
  summary,
  mood,
}: Readonly<{ summary: ReassessmentSummary; mood: MoodState }>) {
  const journal = summary.journalContext
  const coverage = journal.dataCoverage
  const consentOff =
    journal.unavailableReason === 'CONSENT_REQUIRED' ||
    journal.unavailableReason === 'CONSENT_REVOKED'
  const activity = summary.supportPlanEngagement
  return (
    <ul className="rr-strip" aria-label="Tóm tắt kỳ này">
      {coverage ? (
        <StatTile
          index={1}
          value={String(coverage.currentPeriodJournalEntryCount)}
          label="bài nhật ký"
          note={`kỳ trước ${coverage.previousPeriodJournalEntryCount}`}
        />
      ) : (
        <StatTile
          index={1}
          value="—"
          label="bài nhật ký"
          note={
            consentOff ? 'Chưa bật quyền đọc nhật ký' : 'Chưa đọc được nhật ký'
          }
        />
      )}
      {mood.phase === 'loading' && (
        <li className="rr-stat" aria-hidden="true">
          <Skeleton height={104} width="100%" className="rr-skeleton" />
        </li>
      )}
      {mood.phase === 'ready' && (
        <StatTile
          index={2}
          value={String(mood.current.checkedDays)}
          label="ngày ghi cảm xúc"
          note={`kỳ trước ${mood.previous.checkedDays}`}
        />
      )}
      <StatTile
        index={3}
        value={String(activity.currentPeriod.completedCount)}
        label="việc hoàn thành"
        note={`kỳ trước ${activity.previousPeriod.completedCount}`}
      />
    </ul>
  )
}

function ActivityBlock({
  summary,
  titles,
}: Readonly<{
  summary: ReassessmentSummary
  titles: ReadonlyMap<string, string>
}>) {
  const engagement = summary.supportPlanEngagement
  const current = engagement.currentPeriod
  const previous = engagement.previousPeriod
  const empty = current.completedCount + current.skippedCount === 0
  const helpful = helpfulSources(summary)
  const barriers = topBarriers(summary)
  const engagementByOccurrence = new Map(
    (engagement.sources ?? []).map((source) => [source.occurrenceId, source]),
  )
  return (
    <Block index={7} title="Việc đã làm">
      {empty ? (
        <p className="rr-note">Kỳ này chưa có hoạt động trong kế hoạch.</p>
      ) : (
        <>
          <div className="rr-figure">
            {current.completedCount} việc hoàn thành · {current.skippedCount} bỏ
            qua
          </div>
          <p className="rr-note">
            Kỳ trước: {previous.completedCount} hoàn thành,{' '}
            {previous.skippedCount} bỏ qua.
          </p>
          {helpful.length > 0 && (
            <ul className="rr-tiles rr-tiles-auto">
              {helpful.map((source) => {
                const origin = engagementByOccurrence.get(source.occurrenceId)
                const title =
                  (origin?.sourceResourceId &&
                    titles.get(origin.sourceResourceId)) ||
                  (origin
                    ? `Hoạt động ngày ${dayMonth(origin.scheduledAt)}`
                    : 'Một hoạt động trong kế hoạch')
                return (
                  <li key={source.occurrenceId} className="rr-tile rr-helpful">
                    <div className="rr-helpful-title">{title}</div>
                    <div className="rr-direction">
                      {helpfulnessLabels[
                        source.helpfulness as keyof typeof helpfulnessLabels
                      ] ?? ''}
                    </div>
                    {source.reflection && (
                      <blockquote className="rr-quote">
                        “{source.reflection}”<footer>— bạn ghi</footer>
                      </blockquote>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {barriers.length > 0 && (
            <p className="rr-note">
              Lý do bỏ qua thường gặp: {barriers.join(', ')}.
            </p>
          )}
        </>
      )}
    </Block>
  )
}

function SelfReportBlock({
  summary,
  editable,
  report,
  working,
  notice,
  onSave,
  onRemove,
}: Readonly<{
  summary: ReassessmentSummary
  editable: boolean
  report: ReassessmentSelfReport | undefined
  working: boolean
  notice: string | undefined
  onSave: (payload: {
    currentExperience: ReassessmentCurrentExperience
    helpfulContext: string | null
    difficultContext: string | null
  }) => void
  onRemove: () => void
}>) {
  const saved = summary.selfReportedExperience?.source
  const [experience, setExperience] = useState<
    ReassessmentCurrentExperience | undefined
  >(report?.currentExperience)
  const [helpful, setHelpful] = useState(report?.helpfulContext ?? '')
  const [difficult, setDifficult] = useState(report?.difficultContext ?? '')
  if (!saved && !editable) return null
  return (
    <Block index={8} title="Cảm nhận của bạn" wide>
      {saved && (
        <div className="rr-self">
          <div className="rr-figure">
            {experienceLabels[saved.currentExperience]}
          </div>
          {saved.helpfulContext && (
            <p className="rr-note">Điều giúp ích: {saved.helpfulContext}</p>
          )}
          {saved.difficultContext && (
            <p className="rr-note">Điều khó khăn: {saved.difficultContext}</p>
          )}
        </div>
      )}
      {notice && (
        <p className="rr-ack" role="status">
          {notice}
        </p>
      )}
      {editable && (
        <Collapse
          label={
            saved
              ? 'Sửa cảm nhận của bạn'
              : 'Thêm cảm nhận của bạn (không bắt buộc)'
          }
        >
          <form
            className="rr-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!experience) return
              onSave({
                currentExperience: experience,
                helpfulContext: helpful.trim() || null,
                difficultContext: difficult.trim() || null,
              })
            }}
          >
            <fieldset>
              <legend>So với kỳ trước, bạn cảm thấy kỳ này:</legend>
              <div className="rr-options">
                {experienceOptions.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="rr-experience"
                      value={value}
                      checked={experience === value}
                      onChange={() => setExperience(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="rr-field">
              Điều gì đã giúp ích? (không bắt buộc)
              <textarea
                value={helpful}
                maxLength={500}
                rows={3}
                onChange={(event) => setHelpful(event.target.value)}
              />
            </label>
            <label className="rr-field">
              Điều gì khiến bạn thấy khó khăn? (không bắt buộc)
              <textarea
                value={difficult}
                maxLength={500}
                rows={3}
                onChange={(event) => setDifficult(event.target.value)}
              />
            </label>
            <div className="rr-form-actions">
              <button
                type="submit"
                className="rr-button"
                disabled={!experience || working}
              >
                {working ? 'Đang lưu…' : 'Lưu cảm nhận'}
              </button>
              {report && (
                <button
                  type="button"
                  className="rr-link"
                  disabled={working}
                  onClick={onRemove}
                >
                  Xóa cảm nhận đã lưu
                </button>
              )}
            </div>
          </form>
        </Collapse>
      )}
    </Block>
  )
}

export function ReassessmentReview({
  variant,
  summary: shownSummary,
  planReview = false,
  onReady,
  footer,
}: Readonly<{
  variant: 'flow' | 'tab'
  /** The one next step, centred under the disclaimer (the flow passes its plan or overview link). */
  footer?: ReactNode
  /** Called with the snapshot being shown once it is ready (the tab uses it to list only the older ones). */
  onReady?: (summary: ReassessmentSummary) => void
  /** An older snapshot to show as it was composed; the review then never composes or edits. */
  summary?: ReassessmentSummary
  planReview?: boolean
}>) {
  const { confirm, showActionToast } = useFeedback()
  const [phase, setPhase] = useState<Phase>(shownSummary ? 'ready' : 'loading')
  const [context, setContext] = useState<ReassessmentContext>()
  const [composed, setComposed] = useState<ReassessmentSummary>()
  const [report, setReport] = useState<ReassessmentSelfReport>()
  const [reportKnown, setReportKnown] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map())
  const [attempt, setAttempt] = useState(0)
  const pendingJob = useRef<LongitudinalAnalysisJob>(undefined)
  const headingId = useId()
  const summary = shownSummary ?? composed

  const composeFrom = useCallback(async function compose(
    ctx: ReassessmentContext,
    job: LongitudinalAnalysisJob | undefined,
    selfReport: ReassessmentSelfReport | undefined,
  ): Promise<void> {
    if (!ctx.phq9AssessmentId || !ctx.gad7AssessmentId) return
    let result: ReassessmentSummary
    try {
      result = await composeReassessmentSummary(
        {
          phq9AssessmentId: ctx.phq9AssessmentId,
          gad7AssessmentId: ctx.gad7AssessmentId,
          ...(job ? { journalJobId: job.jobId } : {}),
          previousPeriod: ctx.previousPeriod,
          currentPeriod: ctx.currentPeriod,
          ...(selfReport ? { selfReportId: selfReport.selfReportId } : {}),
        },
        crypto.randomUUID(),
      )
    } catch (error) {
      // Consent became effective meanwhile: take the normal job path once.
      if (
        job ||
        !(
          error instanceof ApiError &&
          error.code === 'INVALID_JOURNAL_EVIDENCE_REFERENCE'
        )
      )
        throw error
      const retry = await startJob(ctx)
      if (!retry) throw error
      if (retry.status === 'RUNNING') {
        pendingJob.current = retry
        setPhase('jobRunning')
        return
      }
      return compose(ctx, retry, selfReport)
    }
    pendingJob.current = undefined
    setComposed(result)
    setPhase('ready')
  }, [])

  // The journal job is never required: without consent Care composes every other section.
  const composeFresh = useCallback(
    async (
      ctx: ReassessmentContext,
      selfReport: ReassessmentSelfReport | undefined,
    ) => {
      setPhase('composing')
      try {
        const job = await startJob(ctx)
        if (job?.status === 'RUNNING') {
          pendingJob.current = job
          setPhase('jobRunning')
          return
        }
        await composeFrom(ctx, job, selfReport)
      } catch {
        setPhase('error')
      }
    },
    [composeFrom],
  )

  useEffect(() => {
    if (shownSummary) return
    let active = true
    void (async () => {
      try {
        const ctx = await getReassessmentContext()
        if (!active) return
        setContext(ctx)
        let reportKnown = true
        const ready =
          ctx.state === 'READY' &&
          !!ctx.phq9AssessmentId &&
          !!ctx.gad7AssessmentId
        const [page, savedReport] = await Promise.all([
          listReassessmentSummaries(10).catch(() => undefined),
          ready
            ? getCurrentReassessmentSelfReport().catch((error: unknown) => {
                // A missing report is normal; any other failure means we must not create a second one.
                if (!(error instanceof ApiError && error.status === 404))
                  reportKnown = false
                return undefined
              })
            : undefined,
        ])
        if (!active) return
        setReportKnown(reportKnown)
        const matching =
          savedReport && samePeriod(savedReport, ctx) ? savedReport : undefined
        setReport(matching)
        // The tab shows the newest snapshot as it was composed; the flow shows the one for this reassessment.
        const existing =
          (ready
            ? page?.items.find((item) => samePair(item, ctx))
            : undefined) ?? (variant === 'tab' ? page?.items[0] : undefined)
        if (existing) {
          setComposed(existing)
          setPhase('ready')
          return
        }
        // Only the guided flow composes on its own; opening the tab never starts a journal job.
        if (ready && variant === 'flow') await composeFresh(ctx, matching)
        else setPhase('incomplete')
      } catch {
        if (active) setPhase('error')
      }
    })()
    return () => {
      active = false
    }
  }, [shownSummary, attempt, composeFresh, variant])

  useEffect(() => {
    if (summary) onReady?.(summary)
  }, [summary, onReady])

  const needsTitles = summary ? helpfulSources(summary).length > 0 : false
  useEffect(() => {
    if (!needsTitles) return
    let active = true
    getResourceCatalogue()
      .then((catalogue) => {
        if (active)
          setTitles(
            new Map(catalogue.items.map((item) => [item.id, item.title])),
          )
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [needsTitles])

  async function resume() {
    if (!context || !pendingJob.current) return
    setPhase('composing')
    try {
      const job = await terminalJob(
        await getLongitudinalAnalysisJob(pendingJob.current.jobId),
      )
      if (job.status === 'RUNNING') {
        pendingJob.current = job
        setPhase('jobRunning')
      } else await composeFrom(context, job, report)
    } catch {
      setPhase('error')
    }
  }

  async function saveReport(payload: {
    currentExperience: ReassessmentCurrentExperience
    helpfulContext: string | null
    difficultContext: string | null
  }) {
    if (!context || !summary) return
    setWorking(true)
    setNotice(undefined)
    try {
      const unchanged =
        report != null &&
        report.currentExperience === payload.currentExperience &&
        report.helpfulContext === payload.helpfulContext &&
        report.difficultContext === payload.difficultContext
      const saved = unchanged
        ? report
        : report
          ? await replaceReassessmentSelfReport(report, payload)
          : await createReassessmentSelfReport(
              { currentPeriod: context.currentPeriod, ...payload },
              crypto.randomUUID(),
            )
      setReport(saved)
      const jobId = summary.journalContext.jobId
      const job = jobId
        ? await getLongitudinalAnalysisJob(jobId)
        : await startJob(context)
      if (job?.status === 'RUNNING') {
        pendingJob.current = job
        setPhase('jobRunning')
        return
      }
      await composeFrom(context, job, saved)
      setNotice('Đã lưu cảm nhận của bạn.')
    } catch {
      setNotice(
        'Chưa lưu được cảm nhận. Phần nhìn lại hiện tại vẫn giữ nguyên.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function removeReport() {
    if (!report) return
    const confirmed = await confirm({
      title: 'Xóa cảm nhận đã lưu?',
      description: 'Bản nhìn lại đã tạo trước đó vẫn giữ nguyên cảm nhận này.',
      confirmLabel: 'Xóa cảm nhận',
      tone: 'danger',
    })
    if (!confirmed) return
    setWorking(true)
    try {
      await deleteReassessmentSelfReport(report)
      setReport(undefined)
      showActionToast({ title: 'Đã xóa cảm nhận đã lưu', tone: 'success' })
    } catch {
      setNotice('Chưa xóa được cảm nhận. Bạn thử lại sau nhé.')
    } finally {
      setWorking(false)
    }
  }

  const periods = summary ?? context
  const [mood, retryMood] = useMood(summary)
  const headerLine = periods
    ? `Từ những gì bạn đã chia sẻ, kỳ trước ${periodLabel(periods.previousPeriod)} và kỳ này ${periodLabel(periods.currentPeriod)}.`
    : 'Từ những gì bạn đã chia sẻ trong hai kỳ gần nhất.'

  return (
    <section
      className={`rr-root rr-${variant}`}
      aria-labelledby={headingId}
      aria-busy={phase === 'loading' || phase === 'composing'}
    >
      <header
        className="rr-header rr-rise"
        style={{ '--rr-i': 0 } as CSSProperties}
      >
        <h2 id={headingId} tabIndex={-1}>
          Nhìn lại 14 ngày
        </h2>
        {phase !== 'incomplete' && <p>{headerLine}</p>}
      </header>

      {(phase === 'loading' || phase === 'composing') && (
        <div className="rr-loading" role="status">
          <div className="rr-busy">
            {phase === 'composing'
              ? 'Đang đọc lại nhật ký của bạn…'
              : 'Đang chuẩn bị phần nhìn lại…'}
          </div>
          <Skeleton height={112} width="100%" className="rr-skeleton" />
          <div className="rr-pair">
            <Skeleton height={160} width="100%" className="rr-skeleton" />
            <Skeleton height={160} width="100%" className="rr-skeleton" />
          </div>
        </div>
      )}

      {phase === 'incomplete' && (
        <div className="rr-empty">
          <p>Bạn chưa có lần đánh giá lại nào.</p>
          <Link
            href={
              planReview
                ? '/initial-check?purpose=reassessment&returnTo=plan-review'
                : '/initial-check?purpose=reassessment'
            }
            className="rr-button"
          >
            Làm bài đánh giá lại
          </Link>
        </div>
      )}

      {phase === 'error' && (
        <div className="rr-empty" role="alert">
          <p>Chưa tạo được phần nhìn lại.</p>
          <button
            type="button"
            className="rr-button"
            onClick={() => {
              setPhase('loading')
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {phase === 'jobRunning' && (
        <div className="rr-empty" role="status">
          <p>Nhật ký của bạn vẫn đang được đọc.</p>
          <button
            type="button"
            className="rr-button"
            onClick={() => void resume()}
          >
            Kiểm tra lại
          </button>
        </div>
      )}

      {phase === 'ready' && summary && (
        <>
          <OverviewStrip summary={summary} mood={mood} />
          <ScreeningBlock summary={summary} />
          <JournalBlock summary={summary} />
          <div className="rr-pair">
            <MoodBlock periods={summary} mood={mood} onRetry={retryMood} />
            <ActivityBlock summary={summary} titles={titles} />
          </div>
          <SelfReportBlock
            key={`${summary.summaryId}`}
            summary={summary}
            editable={
              !shownSummary &&
              reportKnown &&
              !!context &&
              samePair(summary, context)
            }
            report={report}
            working={working}
            notice={notice}
            onSave={(payload) => void saveReport(payload)}
            onRemove={() => void removeReport()}
          />
          <div
            className="rr-footer rr-rise"
            style={{ '--rr-i': 9 } as CSSProperties}
          >
            <p className="rr-boundary">
              Các phần trên được đặt cạnh nhau để bạn tự nhìn lại, không gộp
              thành điểm hay kết luận.
            </p>
            {footer}
            {variant === 'tab' && planReview && (
              <Link href="/support-plan?review=open" className="rr-link">
                Quay lại xem lại kế hoạch
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  )
}

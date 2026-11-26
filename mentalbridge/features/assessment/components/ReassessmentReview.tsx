'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
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

import { useFeedback } from '@/components/ui/FeedbackProvider'
import type { ActivityDashboard } from '@/features/analytics/api/activity-dashboard-contract'
import { getAnalyticsEvents } from '@/features/analytics/api/browser-analytics'
import {
  ChapterDetail,
  ChapterDetailSkeleton,
} from '@/features/look-back/ChapterDetail'
import { buildJourney } from '@/features/look-back/look-back-chapters'
import { dateRange } from '@/features/look-back/look-back-copy'
import { useResourceTitles } from '@/features/look-back/use-resource-titles'
import { ApiError } from '@/lib/api/api-error'
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
} from '../api/care-contract'

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

/** The journal count reads "–" without consent; this says why and where to change it. */
function JournalConsentNote({
  summary,
}: Readonly<{ summary: ReassessmentSummary }>) {
  const reason = summary.journalContext.unavailableReason
  if (
    summary.journalContext.state !== 'UNAVAILABLE' ||
    (reason !== 'CONSENT_REQUIRED' && reason !== 'CONSENT_REVOKED')
  )
    return null
  return (
    <div className="rr-gate">
      <p>
        {reason === 'CONSENT_REVOKED'
          ? 'Bạn đã tắt quyền cho AI đọc nhật ký.'
          : 'Bật quyền cho AI đọc nhật ký để thấy phần này.'}
      </p>
      <Link href="/profile" className="rr-link">
        Mở quyền riêng tư
      </Link>
    </div>
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

/** The chapter this reassessment just closed: composes its summary (once) and shows it as the look-back does. */
export function ReassessmentReview({
  planReview = false,
  footer,
}: Readonly<{
  /** The one next step, centred under the disclaimer (the flow passes its plan or overview link). */
  footer?: ReactNode
  planReview?: boolean
}>) {
  const { confirm, showActionToast } = useFeedback()
  const [phase, setPhase] = useState<Phase>('loading')
  const [context, setContext] = useState<ReassessmentContext>()
  const [composed, setComposed] = useState<ReassessmentSummary>()
  const [earlier, setEarlier] = useState<readonly ReassessmentSummary[]>([])
  // undefined while loading; null when the daily mood could not be read.
  const [activity, setActivity] = useState<ActivityDashboard | null>()
  const [report, setReport] = useState<ReassessmentSelfReport>()
  const [reportKnown, setReportKnown] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const pendingJob = useRef<LongitudinalAnalysisJob>(undefined)
  const headingId = useId()
  const summary = composed

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
          // 50 is the page maximum: enough to number this chapter after the ones before it.
          listReassessmentSummaries(50).catch(() => undefined),
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
        setEarlier(page?.items ?? [])
        // The summary for this reassessment may already exist (a reload); otherwise compose it.
        const existing = ready
          ? page?.items.find((item) => samePair(item, ctx))
          : undefined
        if (existing) {
          setComposed(existing)
          setPhase('ready')
          return
        }
        if (ready) await composeFresh(ctx, matching)
        else setPhase('incomplete')
      } catch {
        if (active) setPhase('error')
      }
    })()
    return () => {
      active = false
    }
  }, [attempt, composeFresh])

  // The daily mood of the chapter: 90 days reach back far enough for the one just closed.
  const summaryId = summary?.summaryId
  useEffect(() => {
    if (!summaryId) return
    let active = true
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getAnalyticsEvents(90, timeZone)
      .then((dashboard) => active && setActivity(dashboard))
      .catch(() => active && setActivity(null))
    return () => {
      active = false
    }
  }, [summaryId])

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const chapter = (() => {
    if (!summary) return undefined
    const { chapters } = buildJourney({
      summaries: [
        ...earlier.filter((item) => item.summaryId !== summary.summaryId),
        summary,
      ],
      dashboard: activity ?? null,
      cycle: null,
      timeZone,
    })
    return chapters.find((item) => item.summaryId === summary.summaryId)
  })()
  const titles = useResourceTitles((chapter?.reflections.length ?? 0) > 0)

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

  // The chapter reads once its summary and the daily mood have both arrived.
  const reading =
    phase === 'loading' ||
    phase === 'composing' ||
    (phase === 'ready' && activity === undefined)

  const shown = reading ? undefined : chapter

  return (
    <section
      className="rr-root rr-flow"
      aria-labelledby={headingId}
      aria-busy={reading}
    >
      <header
        className="rr-header rr-rise"
        style={{ '--rr-i': 0 } as CSSProperties}
      >
        <h2 id={headingId} tabIndex={-1}>
          {shown ? `Chặng ${shown.number} vừa khép lại` : 'Chặng vừa khép lại'}
        </h2>
        {phase !== 'incomplete' && (
          <p>
            {shown
              ? `Từ những gì bạn đã chia sẻ, ${dateRange(shown.startLocalDate, shown.endLocalDate)}.`
              : 'Từ những gì bạn đã chia sẻ trong chặng này.'}
          </p>
        )}
      </header>

      {reading && (
        <div className="rr-loading" role="status">
          <div className="rr-busy">
            {phase === 'composing'
              ? 'Đang đọc lại nhật ký của bạn…'
              : 'Đang chuẩn bị phần nhìn lại…'}
          </div>
          <ChapterDetailSkeleton />
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

      {phase === 'ready' && summary && chapter && activity !== undefined && (
        <>
          <ChapterDetail chapter={chapter} titles={titles} />
          <JournalConsentNote summary={summary} />
          <SelfReportBlock
            key={`${summary.summaryId}`}
            summary={summary}
            editable={reportKnown && !!context && samePair(summary, context)}
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
          </div>
        </>
      )}
    </section>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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
  replaceReassessmentSelfReport,
} from '../api/browser-care'
import type {
  ReassessmentContext,
  ReassessmentCurrentExperience,
  ReassessmentSelfReport,
  ReassessmentSummary,
} from '../api/care-contract'

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

const stateLabels = {
  AVAILABLE: 'Có dữ liệu',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
  UNAVAILABLE: 'Không thể truy cập dữ liệu',
} as const

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

function samePeriod(
  report: ReassessmentSelfReport,
  context: ReassessmentContext,
) {
  return (
    report.currentPeriod.startAt === context.currentPeriod.startAt &&
    report.currentPeriod.endAt === context.currentPeriod.endAt
  )
}

function friendlyError(error: unknown) {
  if (
    error instanceof ApiError &&
    error.code === 'REASSESSMENT_SELF_REPORT_VERSION_MISMATCH'
  )
    return 'Câu trả lời đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.'
  if (error instanceof ApiError && error.code === 'ASSESSMENT_NOT_CURRENT')
    return 'Kết quả sàng lọc đã thay đổi. Hãy tải lại ngữ cảnh đánh giá lại.'
  return 'Chưa thể hoàn tất đánh giá lại. Không có kết quả nào được giả định hoặc tự tạo.'
}

async function terminalJob(initial: LongitudinalAnalysisJob) {
  let job = initial
  for (let attempt = 0; attempt < 20 && job.status === 'RUNNING'; attempt++) {
    await wait(750)
    job = await getLongitudinalAnalysisJob(job.jobId)
  }
  return job
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function SummaryCards({ summary }: { summary: ReassessmentSummary }) {
  const selfReport = summary.selfReportedExperience
  const activityReflection = summary.activityReflection
  return (
    <div className="reassessment-summary" aria-label="Bốn chiều đánh giá lại">
      <article className="reassessment-dimension">
        <span>1. Thay đổi sàng lọc</span>
        <strong>{stateLabels[summary.screening.state]}</strong>
        {summary.screening.trends.map((trend) => (
          <p key={trend.instrument}>
            <b>{trend.instrument}:</b>{' '}
            {trend.state === 'AVAILABLE'
              ? `${trend.current.totalScore} điểm, thay đổi ${trend.rawDelta ?? 0}`
              : 'Chưa có kết quả trước đó tương thích để so sánh'}
          </p>
        ))}
      </article>

      <article className="reassessment-dimension">
        <span>2. Bối cảnh nhật ký</span>
        <strong>{stateLabels[summary.journalContext.state]}</strong>
        {summary.journalContext.changesComparedWithPreviousPeriod.map(
          (change) => (
            <p key={`${change.signal}-${change.direction}`}>
              {change.signal}: {change.direction}
            </p>
          ),
        )}
        {summary.journalContext.state !== 'AVAILABLE' && (
          <p>
            Trạng thái này được Care xác nhận từ Journal job
            {summary.journalContext.unavailableReason
              ? ` (${summary.journalContext.unavailableReason})`
              : ''}
            .
          </p>
        )}
      </article>

      <article className="reassessment-dimension">
        <span>3. Mức độ tham gia kế hoạch</span>
        <strong>{stateLabels[summary.supportPlanEngagement.state]}</strong>
        <p>
          Giai đoạn trước:{' '}
          {summary.supportPlanEngagement.previousPeriod.completedCount} hoàn
          thành, {summary.supportPlanEngagement.previousPeriod.skippedCount} bỏ
          qua.
        </p>
        <p>
          Giai đoạn hiện tại:{' '}
          {summary.supportPlanEngagement.currentPeriod.completedCount} hoàn
          thành, {summary.supportPlanEngagement.currentPeriod.skippedCount} bỏ
          qua.
        </p>
      </article>

      <article className="reassessment-dimension">
        <span>4. Trải nghiệm tự báo cáo</span>
        <strong>
          {selfReport ? stateLabels[selfReport.state] : 'Chưa có dữ liệu'}
        </strong>
        {selfReport?.source && (
          <>
            <p>
              <b>Nguồn chính — câu trả lời trực tiếp:</b>{' '}
              {experienceLabels[selfReport.source.currentExperience]}
            </p>
            {selfReport.source.helpfulContext && (
              <p>Điều giúp ích: {selfReport.source.helpfulContext}</p>
            )}
            {selfReport.source.difficultContext && (
              <p>Điều khó khăn: {selfReport.source.difficultContext}</p>
            )}
          </>
        )}
        <div className="reassessment-supporting-source">
          <b>Nguồn hỗ trợ — phản hồi hoạt động:</b>{' '}
          {activityReflection
            ? `${activityReflection.sources.length} phản hồi`
            : 'không có'}
        </div>
      </article>
    </div>
  )
}

export function ReassessmentJourney() {
  const [context, setContext] = useState<ReassessmentContext>()
  const [report, setReport] = useState<ReassessmentSelfReport>()
  const [summary, setSummary] = useState<ReassessmentSummary>()
  const [pendingJob, setPendingJob] = useState<LongitudinalAnalysisJob>()
  const [experience, setExperience] = useState<ReassessmentCurrentExperience>()
  const [helpfulContext, setHelpfulContext] = useState('')
  const [difficultContext, setDifficultContext] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    let active = true
    void Promise.all([
      getReassessmentContext(),
      getCurrentReassessmentSelfReport().catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return undefined
        throw error
      }),
    ])
      .then(([loadedContext, loadedReport]) => {
        if (!active) return
        setContext(loadedContext)
        if (loadedReport && samePeriod(loadedReport, loadedContext)) {
          setReport(loadedReport)
          setExperience(loadedReport.currentExperience)
          setHelpfulContext(loadedReport.helpfulContext ?? '')
          setDifficultContext(loadedReport.difficultContext ?? '')
        }
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setMessage('Chưa thể tải dữ liệu đánh giá lại. Vui lòng thử lại sau.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function composeFrom(
    job: LongitudinalAnalysisJob,
    saved: ReassessmentSelfReport,
  ) {
    if (!context || !context.phq9AssessmentId || !context.gad7AssessmentId)
      return
    const result = await composeReassessmentSummary(
      {
        phq9AssessmentId: context.phq9AssessmentId,
        gad7AssessmentId: context.gad7AssessmentId,
        journalJobId: job.jobId,
        previousPeriod: context.previousPeriod,
        currentPeriod: context.currentPeriod,
        selfReportId: saved.selfReportId,
      },
      crypto.randomUUID(),
    )
    setSummary(result)
    setPendingJob(undefined)
    setMessage('Đã tạo bản tổng hợp đánh giá lại từ bốn nguồn riêng biệt.')
  }

  async function start() {
    if (!context || context.state !== 'READY' || !experience) {
      setMessage('Hãy hoàn tất sàng lọc cần thiết và chọn trải nghiệm của bạn.')
      return
    }
    setWorking(true)
    setMessage('Đang lưu câu trả lời và thu thập bằng chứng nhật ký…')
    try {
      const payload = {
        currentExperience: experience,
        helpfulContext: helpfulContext.trim() || null,
        difficultContext: difficultContext.trim() || null,
      }
      const reportChanged =
        report != null &&
        (report.currentExperience !== payload.currentExperience ||
          report.helpfulContext !== payload.helpfulContext ||
          report.difficultContext !== payload.difficultContext)
      const saved = report
        ? reportChanged
          ? await replaceReassessmentSelfReport(report, payload)
          : report
        : await createReassessmentSelfReport(
            { currentPeriod: context.currentPeriod, ...payload },
            crypto.randomUUID(),
          )
      setReport(saved)
      const job = await terminalJob(
        await createLongitudinalAnalysis(
          {
            previousPeriod: context.previousPeriod,
            currentPeriod: context.currentPeriod,
            excludedJournalIds: [],
          },
          crypto.randomUUID(),
        ),
      )
      if (job.status === 'RUNNING') {
        setPendingJob(job)
        setMessage(
          'Journal vẫn đang xử lý. Bạn có thể tiếp tục kiểm tra mà không tạo job mới.',
        )
        return
      }
      await composeFrom(job, saved)
    } catch (error) {
      setMessage(friendlyError(error))
    } finally {
      setWorking(false)
    }
  }

  async function resume() {
    if (!pendingJob || !report) return
    setWorking(true)
    try {
      const job = await terminalJob(
        await getLongitudinalAnalysisJob(pendingJob.jobId),
      )
      if (job.status === 'RUNNING') {
        setPendingJob(job)
        setMessage(
          'Journal vẫn đang xử lý. Chưa có trạng thái nào bị suy đoán.',
        )
      } else await composeFrom(job, report)
    } catch (error) {
      setMessage(friendlyError(error))
    } finally {
      setWorking(false)
    }
  }

  async function removeReport() {
    if (!report) return
    setWorking(true)
    try {
      await deleteReassessmentSelfReport(report)
      setReport(undefined)
      setExperience(undefined)
      setHelpfulContext('')
      setDifficultContext('')
      setMessage(
        summary
          ? 'Đã xóa nguồn tự báo cáo. Bản tổng hợp cũ vẫn là snapshot bất biến.'
          : 'Đã xóa nguồn tự báo cáo.',
      )
    } catch (error) {
      setMessage(friendlyError(error))
    } finally {
      setWorking(false)
    }
  }

  if (loading)
    return (
      <section className="reassessment-report" aria-live="polite">
        <p>Đang tải ngữ cảnh đánh giá lại…</p>
      </section>
    )

  return (
    <section
      className="reassessment-report"
      aria-labelledby="reassessment-title"
    >
      <div className="reassessment-heading">
        <div>
          <span>Đánh giá lại</span>
          <h2 id="reassessment-title">
            Hiểu những thay đổi của bạn qua bốn góc nhìn
          </h2>
        </div>
        <p>
          Đặt kết quả sàng lọc, nhật ký, việc thực hiện kế hoạch và cảm nhận của
          bạn cạnh nhau để nhận ra thay đổi và chọn bước hỗ trợ phù hợp.
        </p>
      </div>

      {context?.state === 'INCOMPLETE' ? (
        <div
          className="reassessment-message reassessment-incomplete"
          role="status"
        >
          <span>
            Cần hoàn tất: {context.missingInstruments.join(', ')} trước khi bắt
            đầu.
          </span>
          <Link
            className="reassessment-secondary-action"
            href="/initial-check?purpose=reassessment"
          >
            Bắt đầu lượt đánh giá lại
          </Link>
        </div>
      ) : context ? (
        <>
          <p className="reassessment-policy">
            Giai đoạn hiện tại do Care cung cấp:{' '}
            {dateLabel(context.currentPeriod.startAt)} –{' '}
            {dateLabel(context.currentPeriod.endAt)} ({context.policyVersion})
          </p>
          <div className="reassessment-form">
            <fieldset>
              <legend>
                So với giai đoạn trước, bạn cảm nhận giai đoạn này:
              </legend>
              <div className="reassessment-options">
                {experienceOptions.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="currentExperience"
                      value={value}
                      checked={experience === value}
                      onChange={() => setExperience(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="reassessment-context">
              <span>Điều gì đã giúp ích? (không bắt buộc)</span>
              <textarea
                value={helpfulContext}
                maxLength={500}
                rows={3}
                onChange={(event) => setHelpfulContext(event.target.value)}
              />
            </label>
            <label className="reassessment-context">
              <span>Điều gì khiến bạn thấy khó khăn? (không bắt buộc)</span>
              <textarea
                value={difficultContext}
                maxLength={500}
                rows={3}
                onChange={(event) => setDifficultContext(event.target.value)}
              />
            </label>
            <div className="reassessment-actions">
              <button
                type="button"
                className="assessment-start"
                disabled={working}
                onClick={() => void start()}
              >
                {working
                  ? 'Đang xử lý…'
                  : summary
                    ? 'Tạo snapshot mới'
                    : 'Bắt đầu đánh giá lại'}
              </button>
              {pendingJob && (
                <button
                  type="button"
                  className="reassessment-secondary-action"
                  disabled={working}
                  onClick={() => void resume()}
                >
                  Kiểm tra Journal job
                </button>
              )}
              {report && (
                <button
                  type="button"
                  className="reassessment-secondary-action"
                  disabled={working}
                  onClick={() => void removeReport()}
                >
                  Xóa câu trả lời tự báo cáo
                </button>
              )}
            </div>
          </div>
        </>
      ) : null}

      {message && (
        <p className="reassessment-message" role="status">
          {message}
        </p>
      )}
      {summary && (
        <>
          <SummaryCards summary={summary} />
          <div className="reassessment-actions">
            <Link
              className="reassessment-secondary-action"
              href="/support-plan"
            >
              Xem lại kế hoạch hỗ trợ
            </Link>
          </div>
        </>
      )}
      <p className="assessment-progress-boundary">
        Bốn chiều có thể mâu thuẫn và không được gộp thành điểm số, chẩn đoán
        hay kết luận tổng thể.
      </p>
    </section>
  )
}

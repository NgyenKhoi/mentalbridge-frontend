import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getReassessmentContext: vi.fn(),
  getCurrentReassessmentSelfReport: vi.fn(),
  createReassessmentSelfReport: vi.fn(),
  replaceReassessmentSelfReport: vi.fn(),
  deleteReassessmentSelfReport: vi.fn(),
  createLongitudinalAnalysis: vi.fn(),
  getLongitudinalAnalysisJob: vi.fn(),
  composeReassessmentSummary: vi.fn(),
  listReassessmentSummaries: vi.fn(),
}))
vi.mock('../api/browser-care', () => api)
const analytics = vi.hoisted(() => ({ getAnalyticsEvents: vi.fn() }))
vi.mock('@/features/analytics/api/browser-analytics', () => analytics)
vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: vi.fn().mockResolvedValue({
    items: [{ id: '60000000-0000-4000-8000-000000000001', title: 'Thở chậm' }],
    hasMore: false,
  }),
}))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ confirm: vi.fn(), showActionToast: vi.fn() }),
}))

import { ApiError } from '@/lib/api/api-error'
import {
  context,
  currentPeriod,
  dashboard,
  job,
  makeSummary,
  report,
  runningJob,
} from '@/tests/fixtures/reassessment-review'
import { ReassessmentReview } from './ReassessmentReview'

const notFound = new ApiError({ message: 'x', code: 'NOT_FOUND', status: 404 })

describe('ReassessmentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getReassessmentContext.mockResolvedValue(context)
    api.getCurrentReassessmentSelfReport.mockRejectedValue(notFound)
    api.listReassessmentSummaries.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    api.createLongitudinalAnalysis.mockResolvedValue(job)
    api.composeReassessmentSummary.mockResolvedValue(makeSummary())
    api.createReassessmentSelfReport.mockResolvedValue(report)
    analytics.getAnalyticsEvents.mockResolvedValue(
      dashboard([...Array(14).fill(2), ...Array(14).fill(4)]),
    )
  })
  afterEach(() => vi.useRealTimers())

  it('shows a skeleton first then every section for a sufficient and consented review', async () => {
    const { container } = render(<ReassessmentReview />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang chuẩn bị phần nhìn lại',
    )
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')

    expect(
      await screen.findByRole('heading', { name: 'Chặng 1 vừa khép lại' }),
    ).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'false')
    // Bands before and after, plain names, no raw score until the disclosure opens.
    expect(screen.getAllByText('Mức trung bình → Mức nhẹ')).toHaveLength(2)
    const details = screen.getByText('Xem điểm chi tiết').closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(details).toHaveTextContent('Trầm cảm (PHQ-9): 14 → 8 điểm')

    // Counts against the 14 days before, with the journal count from the summary.
    const metrics = screen.getByText('Bài nhật ký').closest('dl')!
    expect(metrics).toHaveTextContent('Bài nhật ký5')
    expect(metrics).toHaveTextContent('14 ngày trước đó: 4')
    expect(metrics).toHaveTextContent('Việc hoàn thành6')
    expect(metrics).toHaveTextContent('14 ngày trước đó: 2')

    // Daily mood with a text equivalent.
    expect(
      screen.getByRole('img', {
        name: /^\d+ ngày có ghi cảm xúc, \d+ ngày tốt hoặc rất tốt$/,
      }),
    ).toBeInTheDocument()

    // Activity: counts, resolved title, the user's own words.
    expect(screen.getByText('6 việc hoàn thành · 2 bỏ qua')).toBeInTheDocument()
    expect(await screen.findByText('Thở chậm')).toBeInTheDocument()
    expect(screen.getByText(/Thở xong thấy nhẹ người/)).toBeInTheDocument()

    // One disclaimer, no recovery verdict, plan untouched.
    expect(
      screen.getAllByText(/không gộp thành điểm hay kết luận/),
    ).toHaveLength(1)
    expect(api.createLongitudinalAnalysis).toHaveBeenCalledTimes(1)
    expect(api.composeReassessmentSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        journalJobId: job.jobId,
        phq9AssessmentId: context.phq9AssessmentId,
      }),
      expect.any(String),
    )
  })

  it('numbers the chapter after the ones already closed', async () => {
    // Other screenings than this reassessment's, so none of them is mistaken for it.
    const screening = makeSummary().screening
    const earlierScreening = {
      ...screening,
      trends: screening.trends.map((trend) => ({
        ...trend,
        current: { ...trend.current, assessmentId: 'earlier' },
      })),
    }
    api.listReassessmentSummaries.mockResolvedValue({
      items: [
        makeSummary({
          summaryId: 'old-2',
          screening: earlierScreening,
          composedAt: '2020-02-01T00:00:00Z',
          currentPeriod: {
            startAt: '2020-01-18T00:00:00Z',
            endAt: '2020-02-01T00:00:00Z',
          },
        }),
        makeSummary({
          summaryId: 'old-1',
          screening: earlierScreening,
          composedAt: '2020-01-01T00:00:00Z',
          currentPeriod: {
            startAt: '2019-12-18T00:00:00Z',
            endAt: '2020-01-01T00:00:00Z',
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    })
    render(<ReassessmentReview />)
    expect(
      await screen.findByRole('heading', { name: 'Chặng 3 vừa khép lại' }),
    ).toBeInTheDocument()
  })

  it('still shows the chapter, without daily dots, when the daily mood cannot be read', async () => {
    analytics.getAnalyticsEvents.mockRejectedValue(new Error('down'))
    render(<ReassessmentReview />)
    expect(
      await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('reuses a summary already composed for the same screening pair', async () => {
    api.listReassessmentSummaries.mockResolvedValue({
      items: [makeSummary()],
      nextCursor: null,
      hasMore: false,
    })
    render(<ReassessmentReview />)
    await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' })
    expect(api.createLongitudinalAnalysis).not.toHaveBeenCalled()
    expect(api.composeReassessmentSummary).not.toHaveBeenCalled()
  })

  it('tells the user what is needed when journal consent is missing and keeps the other sections', async () => {
    api.composeReassessmentSummary.mockResolvedValue(
      makeSummary({
        journalContext: {
          ...makeSummary().journalContext,
          state: 'UNAVAILABLE',
          unavailableReason: 'CONSENT_REQUIRED',
          changesComparedWithPreviousPeriod: [],
          recurringThemes: [],
          helpfulPatterns: [],
          dataCoverage: null,
        },
      }),
    )
    render(<ReassessmentReview />)
    expect(
      await screen.findByText('Bật quyền cho AI đọc nhật ký để thấy phần này.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Mở quyền riêng tư' }),
    ).toHaveAttribute('href', '/profile')
    expect(screen.getAllByText('Mức trung bình → Mức nhẹ')).toHaveLength(2)
    expect(screen.getByText('6 việc hoàn thành · 2 bỏ qua')).toBeInTheDocument()
  })

  it('shows a busy row while the journal job runs and composes once it finishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.createLongitudinalAnalysis.mockResolvedValue(runningJob)
    api.getLongitudinalAnalysisJob
      .mockResolvedValueOnce(runningJob)
      .mockResolvedValue(job)
    render(<ReassessmentReview />)
    expect(
      await screen.findByText('Đang đọc lại nhật ký của bạn…'),
    ).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(
      await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' }),
    ).toBeInTheDocument()
  })

  it('offers a recheck when the journal job is still running after the wait', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.createLongitudinalAnalysis.mockResolvedValue(runningJob)
    api.getLongitudinalAnalysisJob.mockResolvedValue(runningJob)
    render(<ReassessmentReview />)
    await act(() => vi.advanceTimersByTimeAsync(16_000))
    expect(
      await screen.findByText('Nhật ký của bạn vẫn đang được đọc.'),
    ).toBeInTheDocument()
    expect(api.composeReassessmentSummary).not.toHaveBeenCalled()
  })

  const consentRefused = () =>
    new ApiError({
      message: 'consent',
      code: 'AI_CONTEXT_CONSENT_REQUIRED',
      status: 409,
    })

  it('composes without a journal reference when consent is off and shows every section', async () => {
    api.createLongitudinalAnalysis.mockRejectedValue(consentRefused())
    api.composeReassessmentSummary.mockResolvedValue(
      makeSummary({
        journalContext: {
          ...makeSummary().journalContext,
          state: 'UNAVAILABLE',
          unavailableReason: 'CONSENT_REQUIRED',
          jobId: null,
          analysisId: null,
          changesComparedWithPreviousPeriod: [],
          recurringThemes: [],
          helpfulPatterns: [],
          dataCoverage: null,
        },
      }),
    )
    render(<ReassessmentReview />)
    expect(
      await screen.findByText('Bật quyền cho AI đọc nhật ký để thấy phần này.'),
    ).toBeInTheDocument()
    expect(api.composeReassessmentSummary).toHaveBeenCalledTimes(1)
    expect(api.composeReassessmentSummary.mock.calls[0][0]).not.toHaveProperty(
      'journalJobId',
    )
    expect(screen.getByText('Bài nhật ký').closest('div')).toHaveTextContent(
      'Chưa có số liệu',
    )
    expect(screen.getAllByText('Mức trung bình → Mức nhẹ')).toHaveLength(2)
    expect(screen.getByText('6 việc hoàn thành · 2 bỏ qua')).toBeInTheDocument()
    expect(await screen.findByRole('img')).toBeInTheDocument()
  })

  it('says the user switched journal reading off when consent was withdrawn', async () => {
    api.listReassessmentSummaries.mockResolvedValue({
      items: [
        makeSummary({
          journalContext: {
            ...makeSummary().journalContext,
            state: 'UNAVAILABLE',
            unavailableReason: 'CONSENT_REVOKED',
            changesComparedWithPreviousPeriod: [],
            dataCoverage: null,
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    })
    render(<ReassessmentReview />)
    expect(
      await screen.findByText('Bạn đã tắt quyền cho AI đọc nhật ký.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Mở quyền riêng tư' }),
    ).toHaveAttribute('href', '/profile')
  })

  it('takes the normal job path once when Care rejects a no-reference composition', async () => {
    api.createLongitudinalAnalysis
      .mockRejectedValueOnce(consentRefused())
      .mockResolvedValueOnce(job)
    api.composeReassessmentSummary
      .mockRejectedValueOnce(
        new ApiError({
          message: 'x',
          code: 'INVALID_JOURNAL_EVIDENCE_REFERENCE',
          status: 400,
        }),
      )
      .mockResolvedValueOnce(makeSummary())
    render(<ReassessmentReview />)
    await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' })
    expect(api.composeReassessmentSummary).toHaveBeenCalledTimes(2)
    expect(api.composeReassessmentSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ journalJobId: job.jobId }),
      expect.any(String),
    )
  })

  it('says so, with no dots, when no mood was recorded in the chapter', async () => {
    analytics.getAnalyticsEvents.mockResolvedValue(
      dashboard(Array(28).fill(null)),
    )
    render(<ReassessmentReview />)
    expect(await screen.findByText(/^0 ngày tốt hoặc rất tốt/)).toBeVisible()
  })

  it('says the plan had no activity when the chapter has none', async () => {
    api.composeReassessmentSummary.mockResolvedValue(
      makeSummary({
        supportPlanEngagement: {
          state: 'AVAILABLE',
          previousPeriod: { completedCount: 0, skippedCount: 0 },
          currentPeriod: { completedCount: 0, skippedCount: 0 },
          sources: [],
        },
        activityReflection: { state: 'INSUFFICIENT_DATA', sources: [] },
      }),
    )
    render(<ReassessmentReview />)
    expect(
      await screen.findByText('Chặng này chưa có hoạt động nào được ghi.'),
    ).toBeInTheDocument()
  })

  it('says a reassessment is needed when the context is incomplete', async () => {
    api.getReassessmentContext.mockResolvedValue({
      ...context,
      state: 'INCOMPLETE',
      missingInstruments: ['GAD7'],
      gad7AssessmentId: null,
    })
    render(<ReassessmentReview planReview />)
    expect(
      await screen.findByText('Bạn chưa có lần đánh giá lại nào.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Làm bài đánh giá lại' }),
    ).toHaveAttribute(
      'href',
      '/initial-check?purpose=reassessment&returnTo=plan-review',
    )
    expect(api.createLongitudinalAnalysis).not.toHaveBeenCalled()
  })

  it('shows an error with a retry and never a fake success when composing fails', async () => {
    api.composeReassessmentSummary.mockRejectedValueOnce(
      new ApiError({ message: 'down', code: 'CARE_UNAVAILABLE', status: 503 }),
    )
    render(<ReassessmentReview />)
    expect(
      await screen.findByText('Chưa tạo được phần nhìn lại.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Kết quả tự đánh giá' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' }),
    ).toBeInTheDocument()
  })

  it('adds an optional self-report, recomposes with it and acknowledges in place', async () => {
    api.composeReassessmentSummary
      .mockResolvedValueOnce(makeSummary())
      .mockResolvedValueOnce(
        makeSummary({
          summaryId: '40000000-0000-4000-8000-000000000002',
          selfReportedExperience: {
            state: 'AVAILABLE',
            unavailableReason: null,
            source: { ...report, sourceRevision: 0 },
          },
        }),
      )
    api.getLongitudinalAnalysisJob.mockResolvedValue(job)
    render(<ReassessmentReview />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Thêm cảm nhận của bạn (không bắt buộc)',
      }),
    )
    fireEvent.click(await screen.findByLabelText('Dễ chịu hơn trước'))
    fireEvent.change(screen.getByLabelText(/Điều gì đã giúp ích/), {
      target: { value: 'Đi bộ buổi tối.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cảm nhận' }))

    expect(await screen.findByText('Đã lưu cảm nhận của bạn.')).toBeVisible()
    expect(api.createReassessmentSelfReport).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPeriod,
        currentExperience: 'BETTER',
        helpfulContext: 'Đi bộ buổi tối.',
      }),
      expect.any(String),
    )
    // The finished journal job is reused instead of starting another one.
    expect(api.createLongitudinalAnalysis).toHaveBeenCalledTimes(1)
    expect(api.composeReassessmentSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ selfReportId: report.selfReportId }),
      expect.any(String),
    )
    expect(screen.getByText('Dễ chịu hơn trước')).toBeInTheDocument()
  })

  it('does not offer to add a self-report when the saved one could not be read', async () => {
    api.getCurrentReassessmentSelfReport.mockRejectedValue(
      new ApiError({ message: 'down', code: 'HTTP_500', status: 500 }),
    )
    render(<ReassessmentReview />)
    await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' })
    expect(
      screen.queryByRole('button', { name: /Thêm cảm nhận/ }),
    ).not.toBeInTheDocument()
  })
})

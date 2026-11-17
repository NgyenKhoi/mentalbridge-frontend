import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    render(<ReassessmentReview variant="flow" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang chuẩn bị phần nhìn lại',
    )

    expect(
      await screen.findByRole('heading', { name: 'Mức độ sàng lọc' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Nhìn lại 14 ngày' }),
    ).toBeInTheDocument()
    // Overview strip: counts only, with the previous period as a quiet note.
    const strip = screen.getByRole('list', { name: 'Tóm tắt kỳ này' })
    expect(strip).toHaveTextContent('5bài nhật kýkỳ trước 4')
    expect(strip).toHaveTextContent('6việc hoàn thànhkỳ trước 2')
    await waitFor(() =>
      expect(strip).toHaveTextContent('14ngày ghi cảm xúckỳ trước 14'),
    )
    // Bands before and after, plain names, no raw score until the disclosure opens.
    expect(screen.getByText('Trầm cảm (PHQ-9)')).toBeInTheDocument()
    expect(screen.getAllByText('Trung bình')).toHaveLength(2)
    expect(screen.getAllByText('Nhẹ')).toHaveLength(2)
    expect(screen.queryByText(/14 → 8 điểm/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem điểm chi tiết' }))
    expect(
      await screen.findByText(/14 → 8 điểm \(thay đổi -6\)/),
    ).toBeInTheDocument()

    // Journal: direction words only, INSUFFICIENT_DATA skipped, themes and coverage.
    expect(screen.getByText('Áp lực công việc')).toBeInTheDocument()
    expect(screen.getByText('nhắc ít hơn')).toBeInTheDocument()
    expect(screen.getByText('tương tự kỳ trước')).toBeInTheDocument()
    expect(screen.queryByText('Ẩn')).not.toBeInTheDocument()
    expect(screen.getByText('Công việc')).toBeInTheDocument()
    expect(screen.getByText('Đi bộ')).toBeInTheDocument()
    expect(
      screen.getByText(/Dựa trên 5 bài nhật ký kỳ này \(4 bài kỳ trước\)/),
    ).toBeInTheDocument()

    // Mood: two rows with an accessible text equivalent and the count line.
    expect(
      await screen.findByRole('img', {
        name: /^Kỳ trước \d{2}\/\d{2}–\d{2}\/\d{2}: 14 ngày có check-in, 0 ngày tốt hoặc rất tốt$/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: /^Kỳ này \d{2}\/\d{2}–\d{2}\/\d{2}: 14 ngày có check-in, 14 ngày tốt hoặc rất tốt$/,
      }),
    ).toBeInTheDocument()

    // Activity: counts, resolved title, the user's own words attributed to them.
    expect(screen.getByText('6 việc hoàn thành · 2 bỏ qua')).toBeInTheDocument()
    expect(await screen.findByText('Thở chậm')).toBeInTheDocument()
    expect(screen.getByText(/Thở xong thấy nhẹ người/)).toBeInTheDocument()
    expect(screen.getByText('— bạn ghi')).toBeInTheDocument()
    expect(
      screen.getByText('Lý do bỏ qua thường gặp: Không đủ thời gian.'),
    ).toBeInTheDocument()

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

  it('reuses a summary already composed for the same screening pair', async () => {
    api.listReassessmentSummaries.mockResolvedValue({
      items: [makeSummary()],
      nextCursor: null,
      hasMore: false,
    })
    render(<ReassessmentReview variant="flow" />)
    await screen.findByRole('heading', { name: 'Mức độ sàng lọc' })
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
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText('Bật quyền cho AI đọc nhật ký để thấy phần này.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Mở quyền riêng tư' }),
    ).toHaveAttribute('href', '/profile')
    expect(screen.getByText('Trầm cảm (PHQ-9)')).toBeInTheDocument()
    expect(screen.getByText('6 việc hoàn thành · 2 bỏ qua')).toBeInTheDocument()
  })

  it('shows counts and one next step when a period has fewer than three entries', async () => {
    api.composeReassessmentSummary.mockResolvedValue(
      makeSummary({
        journalContext: {
          ...makeSummary().journalContext,
          state: 'INSUFFICIENT_DATA',
          changesComparedWithPreviousPeriod: [],
          dataCoverage: {
            previousPeriodJournalEntryCount: 1,
            currentPeriodJournalEntryCount: 2,
            sufficientForComparison: false,
          },
        },
      }),
    )
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText(
        'Cần ít nhất 3 bài mỗi kỳ để so sánh. Kỳ này bạn có 2 bài.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Viết nhật ký' })).toHaveAttribute(
      'href',
      '/journal',
    )
  })

  it('shows a busy row while the journal job runs and composes once it finishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.createLongitudinalAnalysis.mockResolvedValue(runningJob)
    api.getLongitudinalAnalysisJob
      .mockResolvedValueOnce(runningJob)
      .mockResolvedValue(job)
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText('Đang đọc lại nhật ký của bạn…'),
    ).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(
      await screen.findByRole('heading', { name: 'Mức độ sàng lọc' }),
    ).toBeInTheDocument()
  })

  it('offers a recheck when the journal job is still running after the wait', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.createLongitudinalAnalysis.mockResolvedValue(runningJob)
    api.getLongitudinalAnalysisJob.mockResolvedValue(runningJob)
    render(<ReassessmentReview variant="flow" />)
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
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText('Bật quyền cho AI đọc nhật ký để thấy phần này.'),
    ).toBeInTheDocument()
    expect(api.composeReassessmentSummary).toHaveBeenCalledTimes(1)
    expect(api.composeReassessmentSummary.mock.calls[0][0]).not.toHaveProperty(
      'journalJobId',
    )
    expect(
      screen.getByRole('list', { name: 'Tóm tắt kỳ này' }),
    ).toHaveTextContent('—bài nhật kýChưa bật quyền đọc nhật ký')
    expect(screen.getByText('Trầm cảm (PHQ-9)')).toBeInTheDocument()
    expect(screen.getByText('6 việc hoàn thành · 2 bỏ qua')).toBeInTheDocument()
    expect(
      await screen.findByRole('img', {
        name: /^Kỳ này .*: 14 ngày có check-in/,
      }),
    ).toBeInTheDocument()
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
    render(<ReassessmentReview variant="flow" />)
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
    render(<ReassessmentReview variant="flow" />)
    await screen.findByRole('heading', { name: 'Mức độ sàng lọc' })
    expect(api.composeReassessmentSummary).toHaveBeenCalledTimes(2)
    expect(api.composeReassessmentSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ journalJobId: job.jobId }),
      expect.any(String),
    )
  })

  it('shows an empty state with a check-in link when no mood was recorded', async () => {
    analytics.getAnalyticsEvents.mockResolvedValue(
      dashboard(Array(28).fill(null)),
    )
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText('Chưa có check-in cảm xúc trong 14 ngày.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Check-in cảm xúc' }),
    ).toHaveAttribute('href', '/dashboard')
  })

  it('shows an empty state when the plan had no activity this period', async () => {
    api.composeReassessmentSummary.mockResolvedValue(
      makeSummary({
        supportPlanEngagement: {
          state: 'INSUFFICIENT_DATA',
          previousPeriod: { completedCount: 0, skippedCount: 0 },
          currentPeriod: { completedCount: 0, skippedCount: 0 },
          sources: [],
        },
        activityReflection: { state: 'INSUFFICIENT_DATA', sources: [] },
      }),
    )
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText('Kỳ này chưa có hoạt động trong kế hoạch.'),
    ).toBeInTheDocument()
  })

  it('says a reassessment is needed when the context is incomplete', async () => {
    api.getReassessmentContext.mockResolvedValue({
      ...context,
      state: 'INCOMPLETE',
      missingInstruments: ['GAD7'],
      gad7AssessmentId: null,
    })
    render(<ReassessmentReview variant="flow" planReview />)
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
    render(<ReassessmentReview variant="flow" />)
    expect(
      await screen.findByText('Chưa tạo được phần nhìn lại.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Mức độ sàng lọc' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('heading', { name: 'Mức độ sàng lọc' }),
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
    render(<ReassessmentReview variant="flow" />)
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
    render(<ReassessmentReview variant="flow" />)
    await screen.findByRole('heading', { name: 'Mức độ sàng lọc' })
    expect(
      screen.queryByRole('button', { name: /Thêm cảm nhận/ }),
    ).not.toBeInTheDocument()
  })

  it('in the tab never composes by itself and shows the newest saved review', async () => {
    api.listReassessmentSummaries.mockResolvedValue({
      items: [
        makeSummary({ summaryId: '40000000-0000-4000-8000-000000000009' }),
      ],
      nextCursor: null,
      hasMore: false,
    })
    api.getReassessmentContext.mockResolvedValue({
      ...context,
      phq9AssessmentId: '10000000-0000-4000-8000-0000000000aa',
    })
    const onReady = vi.fn()
    render(<ReassessmentReview variant="tab" onReady={onReady} />)
    await screen.findByRole('heading', { name: 'Mức độ sàng lọc' })
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({
          summaryId: '40000000-0000-4000-8000-000000000009',
        }),
      ),
    )
    expect(api.createLongitudinalAnalysis).not.toHaveBeenCalled()
    // The pair differs from the current context, so the snapshot is read-only.
    expect(
      screen.queryByRole('button', { name: /Thêm cảm nhận/ }),
    ).not.toBeInTheDocument()
  })

  it('in the tab shows the empty state instead of composing when nothing was saved', async () => {
    render(<ReassessmentReview variant="tab" />)
    expect(
      await screen.findByText('Bạn chưa có lần đánh giá lại nào.'),
    ).toBeInTheDocument()
    expect(api.createLongitudinalAnalysis).not.toHaveBeenCalled()
  })
})

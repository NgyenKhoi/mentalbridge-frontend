import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getReassessmentContext: vi.fn(),
  getCurrentReassessmentSelfReport: vi.fn(),
  createReassessmentSelfReport: vi.fn(),
  replaceReassessmentSelfReport: vi.fn(),
  deleteReassessmentSelfReport: vi.fn(),
  createLongitudinalAnalysis: vi.fn(),
  getLongitudinalAnalysisJob: vi.fn(),
  composeReassessmentSummary: vi.fn(),
}))
vi.mock('../api/browser-care', () => api)

import { ApiError } from '@/lib/api/api-error'
import { ReassessmentJourney } from './ReassessmentJourney'
import type { ReassessmentSummary } from '../api/care-contract'

const context = {
  policyVersion: 'reassessment-comparison-v1' as const,
  state: 'READY' as const,
  missingInstruments: [],
  phq9AssessmentId: '10000000-0000-4000-8000-000000000001',
  gad7AssessmentId: '10000000-0000-4000-8000-000000000002',
  previousPeriod: {
    startAt: '2026-08-27T00:00:00Z',
    endAt: '2026-09-10T00:00:00Z',
  },
  currentPeriod: {
    startAt: '2026-09-10T00:00:00Z',
    endAt: '2026-09-24T00:00:00Z',
  },
}

const report = {
  selfReportId: '20000000-0000-4000-8000-000000000001',
  sourceVersion: 'reassessment-self-report-v1' as const,
  currentPeriod: context.currentPeriod,
  currentExperience: 'MORE_DIFFICULT' as const,
  helpfulContext: null,
  difficultContext: 'Áp lực công việc.',
  version: 0,
  authoredAt: '2026-09-24T00:01:00Z',
  updatedAt: '2026-09-24T00:01:00Z',
}

const job = {
  jobId: '30000000-0000-4000-8000-000000000001',
  previousPeriod: context.previousPeriod,
  currentPeriod: context.currentPeriod,
  sourceJournalRevisions: [],
  dataCoverage: {
    previousPeriodJournalEntryCount: 0,
    currentPeriodJournalEntryCount: 0,
    sufficientForComparison: false,
  },
  status: 'FAILED' as const,
  attemptCount: 2,
  terminalReason: 'PROVIDER_TIMEOUT' as const,
  result: null,
  createdAt: '2026-09-24T00:01:00Z',
  updatedAt: '2026-09-24T00:01:01Z',
  completedAt: '2026-09-24T00:01:01Z',
}

const summary = {
  summaryId: '40000000-0000-4000-8000-000000000001',
  summaryVersion: 'reassessment-summary-v2',
  composedAt: '2026-09-24T00:01:02Z',
  previousPeriod: context.previousPeriod,
  currentPeriod: context.currentPeriod,
  screening: {
    state: 'AVAILABLE',
    trends: [
      {
        instrument: 'PHQ9',
        state: 'AVAILABLE',
        scoringVersion: 'v1',
        previous: null,
        current: {
          assessmentId: context.phq9AssessmentId,
          questionnaireVersion: 'v1',
          submittedAt: '2026-09-23T00:00:00Z',
          totalScore: 8,
          screeningLevel: 'MILD',
        },
        rawDelta: -2,
        direction: 'DECREASED',
      },
      {
        instrument: 'GAD7',
        state: 'INSUFFICIENT_DATA',
        scoringVersion: 'v1',
        previous: null,
        current: {
          assessmentId: context.gad7AssessmentId,
          questionnaireVersion: 'v1',
          submittedAt: '2026-09-23T00:00:00Z',
          totalScore: 7,
          screeningLevel: 'MILD',
        },
        rawDelta: null,
        direction: 'INSUFFICIENT_DATA',
      },
    ],
  },
  journalContext: {
    state: 'UNAVAILABLE',
    unavailableReason: 'PROVIDER_TIMEOUT',
    jobId: job.jobId,
    analysisId: null,
    sourceJournalRevisions: [],
    contextSignals: [],
    emotionIndicators: [],
    recurringThemes: [],
    changesComparedWithPreviousPeriod: [],
    preferences: [],
    barriers: [],
    helpfulPatterns: [],
    dataCoverage: null,
    provenance: null,
  },
  supportPlanEngagement: {
    state: 'INSUFFICIENT_DATA',
    previousPeriod: { completedCount: 0, skippedCount: 0 },
    currentPeriod: { completedCount: 0, skippedCount: 0 },
    sources: [],
  },
  selfReportedExperience: {
    state: 'AVAILABLE',
    unavailableReason: null,
    source: {
      ...report,
      sourceRevision: 0,
    },
  },
  activityReflection: { state: 'INSUFFICIENT_DATA', sources: [] },
  disclaimerCode: 'FOUR_DIMENSIONS_NOT_COMBINED',
} as ReassessmentSummary

describe('ReassessmentJourney', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getReassessmentContext.mockResolvedValue(context)
    api.getCurrentReassessmentSelfReport.mockRejectedValue(
      new ApiError({
        message: 'not found',
        code: 'REASSESSMENT_SELF_REPORT_NOT_FOUND',
        status: 404,
      }),
    )
    api.createReassessmentSelfReport.mockResolvedValue(report)
    api.replaceReassessmentSelfReport.mockResolvedValue(report)
    api.createLongitudinalAnalysis.mockResolvedValue(job)
    api.composeReassessmentSummary.mockResolvedValue(summary)
  })

  it('uses Care periods and a Journal job to render four separate dimensions', async () => {
    render(<ReassessmentJourney />)
    fireEvent.click(await screen.findByLabelText('Khó khăn hơn trước'))
    fireEvent.change(screen.getByLabelText(/Điều gì khiến bạn/), {
      target: { value: 'Áp lực công việc.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Bắt đầu đánh giá lại' }),
    )

    await screen.findByText('1. Thay đổi sàng lọc')
    expect(screen.getByText('2. Bối cảnh nhật ký')).toBeInTheDocument()
    expect(screen.getByText('3. Mức độ tham gia kế hoạch')).toBeInTheDocument()
    expect(screen.getByText('4. Trải nghiệm tự báo cáo')).toBeInTheDocument()
    expect(
      screen.getByText(/Nguồn chính — câu trả lời trực tiếp/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Nguồn hỗ trợ — phản hồi hoạt động/),
    ).toBeInTheDocument()
    expect(api.createReassessmentSelfReport).toHaveBeenCalledWith(
      expect.objectContaining({ currentPeriod: context.currentPeriod }),
      expect.any(String),
    )
    expect(api.createLongitudinalAnalysis).toHaveBeenCalledWith(
      {
        previousPeriod: context.previousPeriod,
        currentPeriod: context.currentPeriod,
        excludedJournalIds: [],
      },
      expect.any(String),
    )
    expect(api.composeReassessmentSummary).toHaveBeenCalledWith(
      expect.objectContaining({ journalJobId: job.jobId }),
      expect.any(String),
    )
  })

  it('does not start when Care reports missing screening evidence', async () => {
    api.getReassessmentContext.mockResolvedValue({
      ...context,
      state: 'INCOMPLETE',
      missingInstruments: ['GAD7'],
      gad7AssessmentId: null,
    })
    render(<ReassessmentJourney />)
    expect(await screen.findByText(/Cần hoàn tất: GAD7/)).toBeInTheDocument()
    const action = screen.getByRole('link', {
      name: 'Bắt đầu lượt đánh giá lại',
    })
    expect(action).toHaveAttribute(
      'href',
      '/initial-check?purpose=reassessment',
    )
    expect(action).toHaveClass('reassessment-secondary-action')
    expect(action).not.toHaveClass('assessment-row-action')
    expect(api.createLongitudinalAnalysis).not.toHaveBeenCalled()
  })

  it('blocks report creation when the current report cannot be loaded', async () => {
    api.getCurrentReassessmentSelfReport.mockRejectedValue(
      new ApiError({
        message: 'dependency unavailable',
        code: 'HTTP_500',
        status: 500,
      }),
    )

    render(<ReassessmentJourney />)

    expect(
      await screen.findByText(
        'Chưa thể tải dữ liệu đánh giá lại. Vui lòng thử lại sau.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu đánh giá lại' }),
    ).not.toBeInTheDocument()
    expect(api.createReassessmentSelfReport).not.toHaveBeenCalled()
  })

  it('keeps an existing summary visible after deleting its source', async () => {
    api.getCurrentReassessmentSelfReport.mockResolvedValue(report)
    api.deleteReassessmentSelfReport.mockResolvedValue(undefined)
    render(<ReassessmentJourney />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu đánh giá lại' }),
    )
    await screen.findByText('4. Trải nghiệm tự báo cáo')
    fireEvent.click(
      screen.getByRole('button', { name: 'Xóa câu trả lời tự báo cáo' }),
    )
    expect(api.replaceReassessmentSelfReport).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(api.deleteReassessmentSelfReport).toHaveBeenCalledWith(report),
    )
    expect(screen.getByText('4. Trải nghiệm tự báo cáo')).toBeInTheDocument()
    expect(screen.getByText(/snapshot bất biến/)).toBeInTheDocument()
  })
})

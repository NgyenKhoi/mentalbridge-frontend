import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'

import { ApiError } from '@/api/api-error'
import { trend } from '@/journal/journal-test-fixtures'
import type { TrendJob } from '@/journal/journal-contract'

import type { ReassessmentApi } from './reassessment-api'
import type { ReassessmentExperience } from './reassessment-contract'
import { ReassessmentJourneyScreen } from './ReassessmentJourneyScreen'
import { makeMobileReassessmentSummary } from './reassessment-test-fixtures'

const context = {
  policyVersion: 'reassessment-comparison-v1',
  state: 'READY',
  missingInstruments: [],
  phq9AssessmentId: '10000000-0000-4000-8000-000000000664',
  gad7AssessmentId: '20000000-0000-4000-8000-000000000664',
  previousPeriod: trend.previousPeriod,
  currentPeriod: trend.currentPeriod,
} as const

const notFound = () =>
  new ApiError({ message: 'missing', code: 'NOT_FOUND', status: 404 })

function savedReport(
  version = 0,
  currentExperience: ReassessmentExperience = 'BETTER',
) {
  return {
    selfReportId: '30000000-0000-4000-8000-000000000664',
    sourceVersion: 'reassessment-self-report-v1' as const,
    currentPeriod: context.currentPeriod,
    currentExperience,
    helpfulContext: null,
    difficultContext: null,
    version,
    authoredAt: '2026-10-07T01:00:00Z',
    updatedAt: '2026-10-07T01:00:00Z',
  }
}

function summary() {
  return {
    ...makeMobileReassessmentSummary(),
    summaryVersion: 'reassessment-summary-v2' as const,
    previousPeriod: context.previousPeriod,
    currentPeriod: context.currentPeriod,
  }
}

function api(overrides: Partial<jest.Mocked<ReassessmentApi>> = {}) {
  return {
    getContext: jest.fn().mockResolvedValue(context),
    getCurrentReport: jest.fn().mockRejectedValue(notFound()),
    getCurrentSummary: jest.fn().mockRejectedValue(notFound()),
    createReport: jest.fn().mockResolvedValue(savedReport()),
    replaceReport: jest.fn(),
    compose: jest.fn().mockResolvedValue(summary()),
    ...overrides,
  } as jest.Mocked<ReassessmentApi>
}

const successfulJournal = () => ({
  requestTrend: jest.fn().mockResolvedValue(trend),
  trendJob: jest.fn().mockResolvedValue(trend),
})

describe('mobile reassessment journey', () => {
  afterEach(() => {
    ;(randomUUID as jest.Mock)
      .mockReset()
      .mockReturnValue('11111111-1111-4111-8111-111111111111')
  })

  it('saves explicit self-report, composes four sourced dimensions and returns to plan review', async () => {
    const care = api()
    const onReturnToPlan = jest.fn()
    const view = await render(
      <ReassessmentJourneyScreen
        api={care}
        journalApi={successfulJournal()}
        onScreening={jest.fn()}
        onReturnToPlan={onReturnToPlan}
        wait={() => Promise.resolve()}
      />,
    )
    await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    await waitFor(() => expect(care.compose).toHaveBeenCalledTimes(1))
    expect(care.createReport).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ currentExperience: 'BETTER' }),
      expect.any(String),
    )
    expect(await view.findByText('Bốn góc nhìn riêng biệt')).toBeTruthy()
    await fireEvent.press(view.getByText('Xem lựa chọn giữ hoặc đổi kế hoạch'))
    expect(onReturnToPlan).toHaveBeenCalledTimes(1)
  })

  it('refreshes the retained screen after paired screening and then submits the report', async () => {
    const incomplete = {
      ...context,
      state: 'INCOMPLETE' as const,
      missingInstruments: ['GAD7'] as const,
      gad7AssessmentId: null,
    }
    const care = api({
      getContext: jest
        .fn()
        .mockResolvedValueOnce(incomplete)
        .mockResolvedValue(context),
    })
    const onScreening = jest.fn()
    const props = {
      api: care,
      journalApi: successfulJournal(),
      onScreening,
      onReturnToPlan: jest.fn(),
      wait: () => Promise.resolve(),
    }
    const view = await render(
      <ReassessmentJourneyScreen {...props} refreshToken={0} />,
    )
    await fireEvent.press(await view.findByText('Làm bài kiểm tra lại'))
    expect(onScreening).toHaveBeenCalledTimes(1)

    await view.rerender(
      <ReassessmentJourneyScreen {...props} refreshToken={1} />,
    )
    await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    await waitFor(() => expect(care.compose).toHaveBeenCalledTimes(1))
    expect(care.getContext).toHaveBeenCalledTimes(2)
  })

  it('rotates compose idempotency after a report revision and preserves it for a lost-response retry', async () => {
    let uuidSequence = 0
    ;(randomUUID as jest.Mock).mockReset().mockImplementation(() => {
      uuidSequence += 1
      return `${String(uuidSequence).padStart(8, '0')}-1111-4111-8111-111111111111`
    })
    const revised = {
      ...savedReport(1, 'MORE_DIFFICULT'),
      difficultContext: 'Khó ngủ',
      updatedAt: '2026-10-07T02:00:00Z',
    }
    const care = api({
      replaceReport: jest.fn().mockResolvedValue(revised),
      compose: jest
        .fn()
        .mockResolvedValueOnce(summary())
        .mockRejectedValueOnce(new Error('lost response'))
        .mockResolvedValueOnce({
          ...summary(),
          summaryId: '40000000-0000-4000-8000-000000000665',
        }),
    })
    const view = await render(
      <ReassessmentJourneyScreen
        api={care}
        journalApi={successfulJournal()}
        onScreening={jest.fn()}
        onReturnToPlan={jest.fn()}
        wait={() => Promise.resolve()}
      />,
    )
    await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    await waitFor(() => expect(care.compose).toHaveBeenCalledTimes(1))

    await fireEvent.press(view.getByText('Khó khăn hơn trước'))
    await fireEvent.changeText(
      view.getByLabelText('Điều gì khiến bạn thấy khó khăn'),
      'Khó ngủ',
    )
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    await waitFor(() => expect(care.compose).toHaveBeenCalledTimes(2))
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    await waitFor(() => expect(care.compose).toHaveBeenCalledTimes(3))

    const firstKey = care.compose.mock.calls[0]?.[3]
    const revisedKey = care.compose.mock.calls[1]?.[3]
    const retryKey = care.compose.mock.calls[2]?.[3]
    expect(revisedKey).not.toBe(firstKey)
    expect(retryKey).toBe(revisedKey)
  })

  it.each(['CONSENT_REQUIRED', 'CONSENT_REVOKED'])(
    'keeps local sources accessible without inventing a Journal job for %s',
    async (code) => {
      const care = api()
      const journalApi = {
        requestTrend: jest.fn().mockRejectedValue(
          new ApiError({
            message: 'not authorized',
            code,
            status: 403,
          }),
        ),
        trendJob: jest.fn(),
      }
      const view = await render(
        <ReassessmentJourneyScreen
          api={care}
          journalApi={journalApi}
          onScreening={jest.fn()}
          onReturnToPlan={jest.fn()}
        />,
      )
      await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
      await fireEvent.press(view.getByTestId('reassessment-submit'))
      expect(await view.findByText('Các nguồn hiện có')).toBeTruthy()
      expect(view.getByText('Tạm thời không khả dụng')).toBeTruthy()
      expect(care.createReport).toHaveBeenCalledTimes(1)
      expect(care.compose).not.toHaveBeenCalled()
    },
  )

  it('keeps local sources accessible when Journal fails before returning a job id', async () => {
    const care = api()
    const view = await render(
      <ReassessmentJourneyScreen
        api={care}
        journalApi={{
          requestTrend: jest.fn().mockRejectedValue(new Error('offline')),
          trendJob: jest.fn(),
        }}
        onScreening={jest.fn()}
        onReturnToPlan={jest.fn()}
      />,
    )
    await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    expect(await view.findByText('Các nguồn hiện có')).toBeTruthy()
    expect(care.compose).not.toHaveBeenCalled()
  })

  it('passes a terminal FAILED Journal job to Care so Care persists the unavailable dimension', async () => {
    const care = api()
    const failed = {
      ...trend,
      status: 'FAILED',
      result: null,
      terminalReason: 'CONSENT_REVOKED',
    } as TrendJob
    const view = await render(
      <ReassessmentJourneyScreen
        api={care}
        journalApi={{
          requestTrend: jest.fn().mockResolvedValue(failed),
          trendJob: jest.fn(),
        }}
        onScreening={jest.fn()}
        onReturnToPlan={jest.fn()}
      />,
    )
    await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
    await fireEvent.press(view.getByTestId('reassessment-submit'))
    await waitFor(() => expect(care.compose).toHaveBeenCalledTimes(1))
    expect(care.compose).toHaveBeenCalledWith(
      context,
      failed.jobId,
      savedReport().selfReportId,
      expect.any(String),
    )
  })

  it('shows an explicit retry after first-load failure', async () => {
    const care = api({
      getContext: jest
        .fn()
        .mockRejectedValueOnce(
          new ApiError({
            message: 'offline',
            code: 'UNAVAILABLE',
            status: 503,
          }),
        )
        .mockResolvedValue(context),
    })
    const view = await render(
      <ReassessmentJourneyScreen
        api={care}
        journalApi={successfulJournal()}
        onScreening={jest.fn()}
        onReturnToPlan={jest.fn()}
      />,
    )
    expect(await view.findByText('Chưa tải được đánh giá lại')).toBeTruthy()
    await fireEvent.press(view.getByTestId('reassessment-retry'))
    expect(await view.findByText('Dễ chịu hơn trước')).toBeTruthy()
  })

  it('marks retained data stale and blocks writes after a failed focus refresh', async () => {
    const care = api({
      getContext: jest
        .fn()
        .mockResolvedValueOnce(context)
        .mockRejectedValueOnce(
          new ApiError({
            message: 'offline',
            code: 'UNAVAILABLE',
            status: 503,
          }),
        ),
    })
    const props = {
      api: care,
      journalApi: successfulJournal(),
      onScreening: jest.fn(),
      onReturnToPlan: jest.fn(),
    }
    const view = await render(
      <ReassessmentJourneyScreen {...props} refreshToken={0} />,
    )
    expect(await view.findByText('Dễ chịu hơn trước')).toBeTruthy()
    await view.rerender(
      <ReassessmentJourneyScreen {...props} refreshToken={1} />,
    )
    expect(await view.findByText(/mọi thao tác lưu đang bị khóa/)).toBeTruthy()
    expect(view.getByTestId('reassessment-submit')).toBeDisabled()
  })

  it('clears period-specific fields and selections after Care rolls the period', async () => {
    const rolled = {
      ...context,
      previousPeriod: context.currentPeriod,
      currentPeriod: {
        startAt: '2026-10-07T00:00:00.000Z',
        endAt: '2026-10-14T00:00:00.000Z',
      },
    }
    const care = api({
      getContext: jest
        .fn()
        .mockResolvedValueOnce(context)
        .mockResolvedValueOnce(rolled),
    })
    const props = {
      api: care,
      journalApi: successfulJournal(),
      onScreening: jest.fn(),
      onReturnToPlan: jest.fn(),
    }
    const view = await render(
      <ReassessmentJourneyScreen {...props} refreshToken={0} />,
    )
    await fireEvent.press(await view.findByText('Dễ chịu hơn trước'))
    await fireEvent.changeText(
      view.getByLabelText('Điều gì đã giúp ích'),
      'Dữ liệu kỳ cũ',
    )
    await view.rerender(
      <ReassessmentJourneyScreen {...props} refreshToken={1} />,
    )
    expect(
      await view.findByText('Đã tải giai đoạn đánh giá mới từ Care.'),
    ).toBeTruthy()
    expect(view.getByLabelText('Điều gì đã giúp ích').props.value).toBe('')
    expect(
      view.getByRole('radio', { name: 'Dễ chịu hơn trước' }).props
        .accessibilityState.checked,
    ).toBe(false)
  })
})

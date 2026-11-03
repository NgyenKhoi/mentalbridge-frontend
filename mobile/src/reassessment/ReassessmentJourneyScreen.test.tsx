import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'
import { trend } from '@/journal/journal-test-fixtures'
import type { ReassessmentApi } from './reassessment-api'
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

function api(overrides: Partial<jest.Mocked<ReassessmentApi>> = {}) {
  const summary = {
    ...makeMobileReassessmentSummary(),
    summaryVersion: 'reassessment-summary-v2' as const,
    previousPeriod: context.previousPeriod,
    currentPeriod: context.currentPeriod,
  }
  return {
    getContext: jest.fn().mockResolvedValue(context),
    getCurrentReport: jest
      .fn()
      .mockRejectedValue(
        new ApiError({ message: 'missing', code: 'NOT_FOUND', status: 404 }),
      ),
    getCurrentSummary: jest
      .fn()
      .mockRejectedValue(
        new ApiError({ message: 'missing', code: 'NOT_FOUND', status: 404 }),
      ),
    createReport: jest.fn().mockResolvedValue({
      selfReportId: '30000000-0000-4000-8000-000000000664',
      sourceVersion: 'reassessment-self-report-v1',
      currentPeriod: context.currentPeriod,
      currentExperience: 'BETTER',
      helpfulContext: null,
      difficultContext: null,
      version: 0,
      authoredAt: '2026-10-07T01:00:00Z',
      updatedAt: '2026-10-07T01:00:00Z',
    }),
    replaceReport: jest.fn(),
    compose: jest.fn().mockResolvedValue(summary),
    ...overrides,
  } as jest.Mocked<ReassessmentApi>
}

describe('mobile reassessment journey', () => {
  it('saves explicit self-report, composes four sourced dimensions and returns to plan review', async () => {
    const care = api()
    const journalApi = {
      requestTrend: jest.fn().mockResolvedValue(trend),
      trendJob: jest.fn(),
    }
    const onReturnToPlan = jest.fn()
    const view = await render(
      <ReassessmentJourneyScreen
        api={care}
        journalApi={journalApi}
        onScreening={jest.fn()}
        onReturnToPlan={onReturnToPlan}
        wait={() => Promise.resolve()}
      />,
    )
    expect(await view.findByText('Dễ chịu hơn trước')).toBeTruthy()
    await fireEvent.press(view.getByText('Dễ chịu hơn trước'))
    await fireEvent.press(view.getByText('Xem bốn góc nhìn'))
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

  it('routes an incomplete reassessment to a purpose-specific screening episode', async () => {
    const onScreening = jest.fn()
    const view = await render(
      <ReassessmentJourneyScreen
        api={api({
          getContext: jest.fn().mockResolvedValue({
            ...context,
            state: 'INCOMPLETE',
            missingInstruments: ['GAD7'],
            gad7AssessmentId: null,
          }),
        })}
        journalApi={{ requestTrend: jest.fn(), trendJob: jest.fn() }}
        onScreening={onScreening}
        onReturnToPlan={jest.fn()}
      />,
    )
    await fireEvent.press(await view.findByText('Làm bài kiểm tra lại'))
    expect(onScreening).toHaveBeenCalledTimes(1)
  })
})

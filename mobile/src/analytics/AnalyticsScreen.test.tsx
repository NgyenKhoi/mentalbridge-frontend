import { fireEvent, render, screen } from '@testing-library/react-native'
import { create, type AxiosAdapter } from 'axios'

import { AnalyticsScreen } from './AnalyticsScreen'
import { createActivityApi, type ActivityDashboard } from './activity-api'

jest.mock('@/theme/useDashboardFonts', () => ({
  useDashboardFonts: () => false,
}))

const data: ActivityDashboard = {
  timezone: 'Asia/Ho_Chi_Minh',
  startLocalDate: '2026-11-09',
  asOfLocalDate: '2026-11-15',
  summary: {
    totalActivities: 2,
    activeDays: 1,
    assessmentSubmissions: 0,
    journalEntries: 0,
    journalActiveDays: 0,
    emotionCheckIns: 1,
    emotionActiveDays: 1,
    supportCompleted: 1,
    supportSkipped: 0,
    appointmentEvents: 0,
    currentEmotionStreak: 0,
    latestAssessmentInstrument: null,
    latestAssessmentSubmittedAt: null,
  },
  daily: Array.from({ length: 7 }, (_, index) => ({
    localDate: `2026-11-${String(index + 9).padStart(2, '0')}`,
    assessments: 0,
    journals: 0,
    emotions: index === 1 ? 1 : 0,
    emotionLevel: index === 1 ? 4 : null,
    supportCompleted: index === 1 ? 1 : 0,
    supportSkipped: 0,
    appointments: 0,
    total: index === 1 ? 2 : 0,
  })),
  sources: {
    assessments: 'empty',
    journals: 'empty',
    emotions: 'available',
    supportPlans: 'available',
    appointments: 'empty',
  },
  partial: false,
  bounded: {
    windowDays: 7,
    assessmentLimit: 50,
    journalLimit: 50,
    emotionLimit: 90,
    appointmentLimit: 100,
  },
}

it('opens the selected day and shows the real activity counts and recorded emotion', async () => {
  const onRangeChange = jest.fn()
  await render(
    <AnalyticsScreen
      data={data}
      range={7}
      loading={false}
      onRangeChange={onRangeChange}
      retry={jest.fn()}
      goBack={jest.fn()}
      openCheckIn={jest.fn()}
    />,
  )
  expect(
    screen.getByText('Chưa ghi nhận hoạt động trong ngày này.'),
  ).toBeOnTheScreen()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Ngày 10/11/2026, 2 hoạt động' }),
  )
  expect(screen.getByText('1 xong · 0 bỏ qua')).toBeOnTheScreen()
  expect(screen.getByText('Tốt')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('tab', { name: '90 ngày' }))
  expect(onRangeChange).toHaveBeenCalledWith(90)
})

it('requests the canonical Care range and rejects a response for a different window', async () => {
  const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
    async (config) => ({
      config,
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
    }),
  )
  const fetchActivity = createActivityApi(create({ adapter }))
  const { signal } = new AbortController()
  await expect(fetchActivity(7, 'Asia/Ho_Chi_Minh', signal)).resolves.toEqual(
    data,
  )
  expect(adapter).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/api/v1/activity-dashboard',
      params: { range: 7, timezone: 'Asia/Ho_Chi_Minh' },
    }),
  )
  await expect(fetchActivity(30, 'Asia/Ho_Chi_Minh', signal)).rejects.toThrow(
    'Activity dashboard does not match the requested window.',
  )
})

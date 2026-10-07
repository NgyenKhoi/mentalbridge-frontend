import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'

import type { EmotionApi } from './emotion-api'
import type {
  EmotionCheckIn,
  EmotionCheckInList,
  EmotionCheckInProgress,
} from './emotion-contract'
import { EmotionCheckInScreen } from './EmotionCheckInScreen'

const mockBack = jest.fn()
const mockSignOut = jest.fn()
let mockSubject: string | null = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: mockSubject ? { subject: mockSubject, role: 'USER' } : null,
    signOut: mockSignOut,
  }),
}))

const today: EmotionCheckIn = {
  id: '11111111-1111-4111-8111-111111111111',
  localDate: '2026-10-07',
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD',
  intensity: 4,
  note: null,
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision: 1,
  recordedAt: '2026-10-07T01:00:00.000Z',
  createdAt: '2026-10-07T01:00:00.000Z',
  updatedAt: '2026-10-07T01:00:00.000Z',
}
const earlier: EmotionCheckIn = {
  ...today,
  id: '22222222-2222-4222-8222-222222222222',
  localDate: '2026-10-05',
  emotion: 'OKAY',
  intensity: 2,
}

const emptyList: EmotionCheckInList = {
  items: [],
  page: { limit: 30, hasMore: false },
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
}

function progress(
  checkedInDays: readonly [number, number, number] = [0, 0, 0],
): EmotionCheckInProgress {
  return {
    asOfLocalDate: '2026-10-07',
    timezone: 'Asia/Ho_Chi_Minh',
    currentEmotion: checkedInDays[0] ? 'GOOD' : null,
    currentStreak: checkedInDays[0] ? 1 : 0,
    longestStreak: checkedInDays[0] ? 2 : 0,
    windows: ([7, 14, 30] as const).map((days, index) => ({
      days,
      startLocalDate:
        days === 7 ? '2026-10-01' : days === 14 ? '2026-09-24' : '2026-09-08',
      endLocalDate: '2026-10-07',
      checkedInDays: checkedInDays[index] ?? 0,
      totalDays: days,
      distribution: {
        GREAT: 0,
        GOOD: checkedInDays[index] ?? 0,
        OKAY: 0,
        LOW: 0,
        VERY_LOW: 0,
      },
    })),
    label: 'SELF_REPORTED_EMOTION',
    interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
  }
}

function emotionApi(overrides: Partial<EmotionApi> = {}): EmotionApi {
  return {
    getCheckIn: jest.fn().mockResolvedValue(today),
    listCheckIns: jest.fn().mockResolvedValue({
      ...emptyList,
      items: [today, earlier],
    }),
    getProgress: jest.fn().mockResolvedValue(progress([2, 2, 2])),
    createCheckIn: jest.fn().mockResolvedValue(today),
    updateCheckIn: jest.fn().mockResolvedValue({ ...today, revision: 2 }),
    deleteCheckIn: jest.fn().mockResolvedValue({
      localDate: today.localDate,
      deleted: true,
      deletedAt: '2026-10-07T02:00:00.000Z',
    }),
    ...overrides,
  }
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false },
    },
  })
}

async function renderEmotion(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
) {
  const result = await render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
  return { ...result, queryClient }
}

const screenFor = (api: EmotionApi) => (
  <EmotionCheckInScreen
    api={api}
    now={() => new Date('2026-10-07T03:00:00.000Z')}
    timezone="Asia/Ho_Chi_Minh"
  />
)

describe('mobile daily emotion check-in journey', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSubject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  })

  it('records the first check-in and refreshes authoritative history and progress', async () => {
    const api = emotionApi({
      getCheckIn: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'NOT_FOUND', message: 'Missing', status: 404 }),
        ),
      listCheckIns: jest
        .fn()
        .mockResolvedValueOnce(emptyList)
        .mockResolvedValue({ ...emptyList, items: [today] }),
      getProgress: jest
        .fn()
        .mockResolvedValueOnce(progress())
        .mockResolvedValue(progress([1, 1, 1])),
    })
    await renderEmotion(screenFor(api))

    expect(
      await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Tốt' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Mức cảm nhận 4' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    await waitFor(() =>
      expect(api.createCheckIn).toHaveBeenCalledWith(
        {
          emotion: 'GOOD',
          intensity: 4,
          note: null,
          localDate: '2026-10-07',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    )
    expect(
      await screen.findByText('Đã lưu ghi nhận hôm nay.'),
    ).toBeOnTheScreen()
    await waitFor(() => expect(api.listCheckIns).toHaveBeenCalledTimes(2))
    expect(api.getProgress).toHaveBeenCalledTimes(2)
  })

  it('updates the same-day revision and reloads persisted server state on remount', async () => {
    const updated = {
      ...today,
      emotion: 'GREAT' as const,
      intensity: 5,
      revision: 2,
      updatedAt: '2026-10-07T02:00:00.000Z',
    }
    const api = emotionApi({
      getCheckIn: jest
        .fn()
        .mockResolvedValueOnce(today)
        .mockResolvedValue(updated),
      updateCheckIn: jest.fn().mockResolvedValue(updated),
    })
    const queryClient = createTestQueryClient()
    const first = await renderEmotion(screenFor(api), queryClient)

    await screen.findByText(
      'Bạn có thể điều chỉnh lựa chọn đã lưu trong hôm nay.',
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Rất tốt' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Mức cảm nhận 5' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cập nhật ghi nhận' }),
    )

    await waitFor(() =>
      expect(api.updateCheckIn).toHaveBeenCalledWith(
        '2026-10-07',
        1,
        { emotion: 'GREAT', intensity: 5, note: null },
        '11111111-1111-4111-8111-111111111111',
      ),
    )
    await first.unmount()
    await renderEmotion(screenFor(api), queryClient)

    await waitFor(() => expect(api.getCheckIn).toHaveBeenCalledTimes(2))
    expect(
      screen.getByRole('radio', { name: 'Rất tốt', checked: true }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('radio', { name: 'Mức cảm nhận 5', checked: true }),
    ).toBeOnTheScreen()
  })

  it('shows sparse history as missing data and only authoritative 7/14/30 periods', async () => {
    const api = emotionApi({
      getProgress: jest.fn().mockResolvedValue(progress([2, 4, 6])),
    })
    await renderEmotion(screenFor(api))

    expect(await screen.findByText('Đã ghi nhận 2/7 ngày')).toBeOnTheScreen()
    expect(screen.getByText('07/10/2026')).toBeOnTheScreen()
    expect(screen.getByText('05/10/2026')).toBeOnTheScreen()
    expect(
      screen.getByText(/Những ngày không có ghi nhận được để trống/),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '14 ngày' }))
    expect(screen.getByText('Đã ghi nhận 4/14 ngày')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '30 ngày' }))
    expect(screen.getByText('Đã ghi nhận 6/30 ngày')).toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: '90 ngày' }),
    ).not.toBeOnTheScreen()
    expect(screen.queryByText(/trung bình/i)).not.toBeOnTheScreen()
    expect(screen.queryByText(/hồi phục tốt/i)).not.toBeOnTheScreen()
  })

  it('renders truthful no-history state without inventing a default emotion', async () => {
    const api = emotionApi({
      getCheckIn: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'NOT_FOUND', message: 'Missing', status: 404 }),
        ),
      listCheckIns: jest.fn().mockResolvedValue(emptyList),
      getProgress: jest.fn().mockResolvedValue(progress()),
    })
    await renderEmotion(screenFor(api))

    expect(
      await screen.findByText('Lịch sử sẽ xuất hiện sau lần lưu đầu tiên.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Đã ghi nhận 0/7 ngày')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { checked: true })).not.toBeOnTheScreen()
  })

  it('deletes an owned check-in and removes it from cached history', async () => {
    const api = emotionApi({
      listCheckIns: jest
        .fn()
        .mockResolvedValueOnce({ ...emptyList, items: [today] })
        .mockResolvedValue(emptyList),
      getProgress: jest
        .fn()
        .mockResolvedValueOnce(progress([1, 1, 1]))
        .mockResolvedValue(progress()),
    })
    await renderEmotion(screenFor(api))

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Xóa ghi nhận ngày 07/10/2026',
      }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() =>
      expect(api.deleteCheckIn).toHaveBeenCalledWith(
        '2026-10-07',
        '11111111-1111-4111-8111-111111111111',
      ),
    )
    expect(
      await screen.findByText('Đã xóa ghi nhận đã chọn.'),
    ).toBeOnTheScreen()
    expect(
      await screen.findByText('Lịch sử sẽ xuất hiện sau lần lưu đầu tiên.'),
    ).toBeOnTheScreen()
  })

  it('never queries or exposes an actor selector without an authenticated subject', async () => {
    mockSubject = null
    const api = emotionApi()
    await renderEmotion(screenFor(api))

    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập lại' }))
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(api.getCheckIn).not.toHaveBeenCalled()
    expect(api.listCheckIns).not.toHaveBeenCalled()
    expect(api.getProgress).not.toHaveBeenCalled()
    expect(
      screen.queryByLabelText(/actor|tài khoản khác/i),
    ).not.toBeOnTheScreen()
  })

  it('distinguishes dependency failure and offers bounded recovery actions', async () => {
    const unavailable = new ApiError({
      code: 'JOURNAL_AI_UNAVAILABLE',
      message: 'Unavailable',
      status: 503,
    })
    const api = emotionApi({
      getCheckIn: jest.fn().mockRejectedValue(unavailable),
      listCheckIns: jest.fn().mockRejectedValue(unavailable),
      getProgress: jest.fn().mockRejectedValue(unavailable),
    })
    await renderEmotion(screenFor(api))

    expect(
      await screen.findByText(
        'Chưa thể tải dữ liệu cảm xúc lúc này. Dữ liệu đã lưu không bị thay đổi.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Thử tải lại' }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Thử tải tiến độ' }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Thử tải lịch sử' }),
    ).toBeOnTheScreen()
  })
})

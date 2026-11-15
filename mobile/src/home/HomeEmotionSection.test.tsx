import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Alert, StyleSheet } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { EmotionApi } from '@/emotion/emotion-api'
import type {
  EmotionCheckIn,
  EmotionCheckInList,
  EmotionCheckInProgress,
} from '@/emotion/emotion-contract'

import { HomeEmotionSection } from './HomeEmotionSection'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockPush(href) },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: { subject: 'user-1', role: 'USER' } }),
}))

function checkIn(
  localDate: string,
  emotion: EmotionCheckIn['emotion'],
): EmotionCheckIn {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    localDate,
    timezone: 'Asia/Ho_Chi_Minh',
    emotion,
    intensity: 4,
    factors: [],
    note: null,
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision: 1,
    recordedAt: '2026-10-07T01:00:00.000Z',
    createdAt: '2026-10-07T01:00:00.000Z',
    updatedAt: '2026-10-07T01:00:00.000Z',
  }
}

const today = checkIn('2026-10-07', 'GOOD')
const yesterday = checkIn('2026-10-06', 'OKAY')

const list = (items: EmotionCheckIn[]): EmotionCheckInList => ({
  items,
  page: { limit: 7, hasMore: false },
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
})

const progress: EmotionCheckInProgress = {
  asOfLocalDate: '2026-10-07',
  timezone: 'Asia/Ho_Chi_Minh',
  currentEmotion: null,
  currentStreak: 0,
  longestStreak: 0,
  windows: ([7, 14, 30] as const).map((days) => ({
    days,
    startLocalDate: '2026-10-01',
    endLocalDate: '2026-10-07',
    checkedInDays: 0,
    totalDays: days,
    distribution: { GREAT: 0, GOOD: 0, OKAY: 0, LOW: 0, VERY_LOW: 0 },
  })),
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
}

const notFound = () =>
  new ApiError({ code: 'NOT_FOUND', message: 'Missing', status: 404 })

function emotionApi(overrides: Partial<EmotionApi> = {}): EmotionApi {
  return {
    getCheckIn: jest.fn().mockResolvedValue(today),
    listCheckIns: jest.fn().mockResolvedValue(list([today, yesterday])),
    getProgress: jest.fn().mockResolvedValue(progress),
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

function view(api: EmotionApi) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <HomeEmotionSection api={api} />
    </QueryClientProvider>,
  )
}

describe('HomeEmotionSection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows static loading states with the same structure as the loaded week', async () => {
    const pending = new Promise<never>(() => undefined)
    await view(
      emotionApi({
        getCheckIn: jest.fn().mockReturnValue(pending),
        getProgress: jest.fn().mockReturnValue(pending),
        listCheckIns: jest.fn().mockReturnValue(pending),
      }),
    )

    expect(
      screen.getByRole('progressbar', {
        name: 'Đang tải cảm xúc 7 ngày gần đây',
      }),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText('Đang tải ghi nhận hôm nay')).toBeOnTheScreen()
  })

  it('renders the week with faces, the yesterday line and the message for today', async () => {
    await view(emotionApi())

    expect(await screen.findByLabelText('Nay 7/10: Tốt')).toBeOnTheScreen()
    expect(screen.getByLabelText('T3 6/10: Bình thường')).toBeOnTheScreen()
    expect(screen.getByLabelText('T2 5/10: Chưa ghi nhận')).toBeOnTheScreen()
    expect(screen.getByText('Hôm qua bạn chọn Bình thường.')).toBeOnTheScreen()
    expect(screen.getByText('Một lời nhắn cho bạn')).toBeOnTheScreen()
    expect(screen.getByText('Hôm nay: Tốt')).toBeOnTheScreen()
    expect(
      screen.getByText('Dành chỗ cho những điều đang tốt'),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Bạn đã dành thời gian ghi nhận cảm xúc 2/7 ngày gần đây.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('Đã ghi nhận: 😊 Tốt')).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Viết vài dòng cho mình →' }),
    )
    expect(mockPush).toHaveBeenCalledWith('/(user)/journal')
  })

  it('invites a first entry without a journal link when nothing is recorded', async () => {
    await view(
      emotionApi({
        getCheckIn: jest.fn().mockRejectedValue(notFound()),
        listCheckIns: jest.fn().mockResolvedValue(list([])),
      }),
    )

    expect(
      await screen.findByText('Dành một phút để lắng nghe mình'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Hôm qua chưa có ghi nhận.')).toBeOnTheScreen()
    expect(
      screen.getByText('Bạn có thể bắt đầu từ hôm nay, theo nhịp của mình.'),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Viết vài dòng cho mình →')).toBeNull()
    expect(screen.queryByText('Mức độ cảm nhận')).toBeNull()
  })

  it('shows the week error and recovers on retry', async () => {
    const listCheckIns = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(list([today, yesterday]))
    await view(emotionApi({ listCheckIns }))

    expect(
      await screen.findByText('Chưa tải được cảm xúc tuần này.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByLabelText('Nay 7/10: Tốt')).toBeOnTheScreen()
    expect(listCheckIns).toHaveBeenCalledTimes(2)
  })

  it('shows the check-in load error with retry', async () => {
    const getCheckIn = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(today)
    await view(emotionApi({ getCheckIn }))

    expect(
      await screen.findByText(
        'Ghi nhận cảm xúc hôm nay tạm thời chưa tải được.',
      ),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Đã ghi nhận: 😊 Tốt')).toBeOnTheScreen()
  })

  it('saves inline and refreshes the week and progress', async () => {
    const api = emotionApi({
      getCheckIn: jest.fn().mockRejectedValue(notFound()),
      listCheckIns: jest
        .fn()
        .mockResolvedValueOnce(list([]))
        .mockResolvedValue(list([today])),
    })
    await view(api)

    await fireEvent.press(await screen.findByRole('radio', { name: 'Tốt' }))
    expect(
      screen.getByText('1 là nhẹ, 5 là mạnh — không phải điểm sức khỏe.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Lựa chọn này chưa được lưu.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Mức cảm nhận 4' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    await waitFor(() => expect(api.createCheckIn).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Đã ghi nhận: 😊 Tốt')).toBeOnTheScreen()
    expect(
      screen.getByText('Cảm ơn bạn đã dành chút thời gian cho mình.'),
    ).toBeOnTheScreen()
    await waitFor(() => expect(api.listCheckIns).toHaveBeenCalledTimes(2))
    expect(api.getProgress).toHaveBeenCalledTimes(2)
    expect(await screen.findByLabelText('Nay 7/10: Tốt')).toBeOnTheScreen()
  })

  it('keeps the choice and says so when saving fails', async () => {
    const api = emotionApi({
      getCheckIn: jest.fn().mockRejectedValue(notFound()),
      listCheckIns: jest.fn().mockResolvedValue(list([])),
      createCheckIn: jest.fn().mockRejectedValue(new Error('offline')),
    })
    await view(api)

    await fireEvent.press(await screen.findByRole('radio', { name: 'Tốt' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Mức cảm nhận 4' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    expect(
      await screen.findByText(
        'Chưa thể lưu thay đổi. Lựa chọn của bạn vẫn được giữ để thử lại.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('radio', { name: 'Tốt' }).props.accessibilityState,
    ).toMatchObject({ checked: true })
  })

  it('edits a saved check-in with the revision and confirms before deleting', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const api = emotionApi()
    await view(api)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Chỉnh sửa ghi nhận' }),
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Rất tốt' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cập nhật ghi nhận' }),
    )
    await waitFor(() =>
      expect(api.updateCheckIn).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.objectContaining({ emotion: 'GREAT' }),
        expect.any(String),
      ),
    )

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Xóa ghi nhận' }),
    )
    expect(alert).toHaveBeenCalledWith(
      'Xóa ghi nhận hôm nay?',
      expect.any(String),
      expect.any(Array),
    )
    const buttons = alert.mock.calls[0]?.[2] ?? []
    buttons.find(({ style }) => style === 'destructive')?.onPress?.()
    await waitFor(() => expect(api.deleteCheckIn).toHaveBeenCalledTimes(1))
    alert.mockRestore()
  })

  it('never truncates the face labels', async () => {
    await view(
      emotionApi({ getCheckIn: jest.fn().mockRejectedValue(notFound()) }),
    )

    for (const label of ['Rất tốt', 'Bình thường', 'Rất không tốt']) {
      const text = await screen.findByText(label)
      expect(text.props.numberOfLines).toBeUndefined()
      expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen()
    }
  })

  it('keeps the round day ring with a constant border after the check-in is deleted', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const api = emotionApi({
      getCheckIn: jest
        .fn()
        .mockResolvedValueOnce(today)
        .mockRejectedValue(notFound()),
      listCheckIns: jest
        .fn()
        .mockResolvedValueOnce(list([today, yesterday]))
        .mockResolvedValue(list([yesterday])),
    })
    await view(api)
    const ringStyle = () =>
      StyleSheet.flatten(
        screen.getByTestId('home-emotion-ring-2026-10-07').props.style,
      )

    await screen.findByLabelText('Nay 7/10: Tốt')
    expect(ringStyle()).toMatchObject({
      borderColor: 'transparent',
      borderWidth: 1.5,
    })
    const radius = ringStyle().borderRadius
    expect(radius).toBeGreaterThan(0)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Xóa ghi nhận' }),
    )
    const buttons = alert.mock.calls[0]?.[2] ?? []
    buttons.find(({ style }) => style === 'destructive')?.onPress?.()
    await screen.findByLabelText('Nay 7/10: Chưa ghi nhận')
    expect(ringStyle()).toMatchObject({
      borderRadius: radius,
      borderWidth: 1.5,
    })
    expect(ringStyle().borderColor).not.toBe('transparent')
    alert.mockRestore()
  })
})

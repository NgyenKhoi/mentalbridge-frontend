import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { ScrollView } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { EmotionApi } from '@/emotion/emotion-api'

import type { HomeApi } from '@/home/home-api'
import {
  activePlanHome,
  firstUseHome,
  freeGuideHome,
  ids,
  pausedPlanHome,
  priorityPlanHome,
} from '@/home/home-test-fixtures'

import { UserHomeScreen } from './UserHomeScreen'

const mockPush = jest.fn()
const mockSetParams = jest.fn()
const mockSignOut = jest.fn()
let focusEffect: (() => void) | undefined
let mockParams: { focus?: string } = {}

jest.mock('expo-router', () => ({
  router: {
    push: (href: unknown) => mockPush(href),
    setParams: (params: unknown) => mockSetParams(params),
  },
  useFocusEffect: (callback: () => void) => {
    focusEffect = callback
  },
  useLocalSearchParams: () => mockParams,
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { subject: 'user-1', role: 'USER' },
    signOut: mockSignOut,
  }),
}))

jest.mock('@/mam/MamHomePet', () => ({
  MamHomePet: () => null,
}))

function view(api: HomeApi, ui: ReactElement = <UserHomeScreen api={api} />) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('USER Home next-step hub', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    focusEffect = undefined
    mockParams = {}
  })

  it('shows one first-use action instead of the feature wall', async () => {
    await view({ getNextStep: jest.fn().mockResolvedValue(firstUseHome) })

    await screen.findByText('Bắt đầu bằng một bài sàng lọc ngắn')
    expect(screen.queryByText('Phiên trò chuyện')).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Bắt đầu sàng lọc' }),
    )
    expect(mockPush).toHaveBeenCalledWith('/(user)/assessment')
  })

  it('keeps FREE resources useful when entitlement cannot be confirmed', async () => {
    await view({ getNextStep: jest.fn().mockResolvedValue(freeGuideHome) })

    await screen.findByText(
      'Chưa xác nhận được lựa chọn theo gói. Bạn vẫn có thể xem gợi ý và tài nguyên miễn phí.',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Khám phá tài nguyên' }),
    )
    expect(mockPush).toHaveBeenCalledWith('/(user)/resources')
  })

  it('deep-links a supported Journal activity with only authoritative origin IDs', async () => {
    await view({
      getNextStep: jest.fn().mockResolvedValue(activePlanHome('JOURNAL')),
    })

    await screen.findByText('Dành năm phút để chăm sóc bản thân')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Bắt đầu hoạt động' }),
    )
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(user)/journal',
      params: {
        source: 'journal',
        occurrenceId: ids.occurrence,
        actionId: ids.action,
        localDate: '2026-10-29',
      },
    })
  })

  it('keeps the plan cycle line in the next-step card', async () => {
    await view({
      getNextStep: jest.fn().mockResolvedValue(activePlanHome('JOURNAL')),
    })

    expect(await screen.findByText('Chu kỳ 1/14 ngày')).toBeOnTheScreen()
  })

  it('anchors a Resource activity in the plan without inventing a Content ID', async () => {
    await view({
      getNextStep: jest.fn().mockResolvedValue(activePlanHome('RESOURCE')),
    })

    await screen.findByText('Dành năm phút để chăm sóc bản thân')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Bắt đầu hoạt động' }),
    )
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(user)/support-plan',
      params: {
        source: 'home',
        occurrenceId: ids.occurrence,
        actionId: ids.action,
        actionType: 'RESOURCE',
        localDate: '2026-10-29',
      },
    })
  })

  it.each([
    ['REVIEW_SAFETY_SUPPORT', 'Xem hướng dẫn hỗ trợ'],
    ['FIND_SPECIALIST', 'Tìm chuyên gia'],
  ] as const)(
    'keeps %s primary when an owner plan also exists',
    async (nextAction, label) => {
      await view({
        getNextStep: jest.fn().mockResolvedValue(priorityPlanHome(nextAction)),
      })

      // The "Tìm chuyên gia" shortcut tile shares the primary button's name.
      expect(
        await screen.findByTestId('home-primary-action'),
      ).toHaveTextContent(label)
      expect(
        screen.queryByRole('button', { name: 'Bắt đầu hoạt động' }),
      ).toBeNull()
    },
  )

  it('uses neutral paused-plan language and reconciles when Home is focused again', async () => {
    const getNextStep = jest
      .fn()
      .mockResolvedValueOnce(pausedPlanHome)
      .mockResolvedValueOnce(activePlanHome('EMOTION_CHECK_IN'))
    await view({ getNextStep })

    await screen.findByText('Tiếp tục khi bạn thấy phù hợp')
    await act(async () => focusEffect?.())
    await act(async () => focusEffect?.())
    await screen.findByText('Dành năm phút để chăm sóc bản thân')
    expect(getNextStep).toHaveBeenCalledTimes(2)
  })

  it('refreshes the owner decision after returning from a Resource occurrence', async () => {
    const completed = {
      ...activePlanHome('RESOURCE'),
      plan: {
        ...activePlanHome('RESOURCE').plan!,
        focus: 'TODAY_DONE' as const,
        today: { total: 2, completed: 2 },
        nextOccurrence: null,
      },
    }
    const getNextStep = jest
      .fn()
      .mockResolvedValueOnce(activePlanHome('RESOURCE'))
      .mockResolvedValueOnce(completed)
    await view({ getNextStep })

    await screen.findByRole('button', { name: 'Bắt đầu hoạt động' })
    await act(async () => focusEffect?.())
    await act(async () => focusEffect?.())
    await screen.findByText('Không còn hoạt động đang chờ hôm nay')
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu hoạt động' }),
    ).toBeNull()
    expect(getNextStep).toHaveBeenCalledTimes(2)
  })

  it('keeps the last grounded step when a re-entry refresh fails', async () => {
    const getNextStep = jest
      .fn()
      .mockResolvedValueOnce(pausedPlanHome)
      .mockRejectedValueOnce(new Error('offline'))
    await view({ getNextStep })

    await screen.findByText('Tiếp tục khi bạn thấy phù hợp')
    await act(async () => focusEffect?.())
    await act(async () => focusEffect?.())
    await screen.findByText(
      'Chưa cập nhật được thay đổi mới nhất. Bước đang hiển thị là lần tải gần nhất; bạn có thể thử lại.',
    )
    expect(screen.getByText('Tiếp tục khi bạn thấy phù hợp')).toBeOnTheScreen()
  })

  it('shows an honest recoverable error and keeps secondary tools collapsed', async () => {
    const getNextStep = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(firstUseHome)
    await view({ getNextStep })

    await screen.findByText('Bước tiếp theo tạm thời chưa khả dụng')
    expect(screen.queryByText('Lịch hẹn của tôi')).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải lại bước tiếp theo' }),
    )
    await screen.findByText('Bắt đầu bằng một bài sàng lọc ngắn')

    await fireEvent.press(
      screen.getByRole('button', { name: 'Các khu vực khác' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Lịch hẹn của tôi' }),
    )
    expect(mockPush).toHaveBeenCalledWith('/(user)/appointments')
  })
})

describe('USER Home emotion section', () => {
  const emotionApi = (): EmotionApi => ({
    getCheckIn: jest
      .fn()
      .mockRejectedValue(
        new ApiError({ code: 'NOT_FOUND', message: 'Missing', status: 404 }),
      ),
    listCheckIns: jest.fn().mockResolvedValue({
      items: [],
      page: { limit: 7, hasMore: false },
      label: 'SELF_REPORTED_EMOTION',
      interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
    }),
    getProgress: jest.fn().mockResolvedValue({
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
    }),
    createCheckIn: jest.fn(),
    updateCheckIn: jest.fn(),
    deleteCheckIn: jest.fn(),
  })
  const home = () => ({
    getNextStep: jest.fn().mockResolvedValue(firstUseHome),
  })
  const screenWithEmotion = () => (
    <UserHomeScreen api={home()} emotionApi={emotionApi()} />
  )
  const scrollTo = ScrollView.prototype.scrollTo as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = {}
  })

  it('expands the emotion form inline after selecting a mood', async () => {
    await view(home(), screenWithEmotion())

    expect(await screen.findByTestId('home-emotion-anchor')).toBeOnTheScreen()
    expect(screen.getByText(/Tuần này của bạn/)).toBeOnTheScreen()
    expect(screen.queryByText('Mức độ cảm nhận')).toBeNull()

    await fireEvent.press(screen.getByRole('button', { name: 'Tốt' }))

    expect(await screen.findByText('Mức độ cảm nhận')).toBeOnTheScreen()
    expect(screen.getByText(/Tuần này của bạn/)).toBeOnTheScreen()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('invites the user to enable push, but never in safety mode', async () => {
    await view(home(), screenWithEmotion())
    expect(await screen.findByTestId('push-invite-card')).toBeOnTheScreen()
    await screen.unmount()

    const safety: HomeApi = {
      getNextStep: jest
        .fn()
        .mockResolvedValue(priorityPlanHome('REVIEW_SAFETY_SUPPORT')),
    }
    await view(
      safety,
      <UserHomeScreen api={safety} emotionApi={emotionApi()} />,
    )
    await screen.findByRole('button', { name: 'Xem hướng dẫn hỗ trợ' })
    expect(screen.queryByTestId('push-invite-card')).toBeNull()
  })

  it('scrolls the section to the top once for focus=emotion, then clears the param', async () => {
    mockParams = { focus: 'emotion' }
    await view(home(), screenWithEmotion())

    await fireEvent(
      await screen.findByTestId('home-emotion-anchor'),
      'layout',
      { nativeEvent: { layout: { x: 0, y: 640, width: 360, height: 500 } } },
    )

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ y: 640, animated: true }),
    )
    expect(mockSetParams).toHaveBeenCalledWith({ focus: undefined })
  })

  it('does not scroll without the focus param', async () => {
    await view(home(), screenWithEmotion())

    await fireEvent(
      await screen.findByTestId('home-emotion-anchor'),
      'layout',
      { nativeEvent: { layout: { x: 0, y: 640, width: 360, height: 500 } } },
    )

    expect(scrollTo).not.toHaveBeenCalled()
    expect(mockSetParams).not.toHaveBeenCalled()
  })
})

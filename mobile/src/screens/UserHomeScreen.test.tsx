import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import type { HomeApi } from '@/home/home-api'
import {
  activePlanHome,
  firstUseHome,
  freeGuideHome,
  ids,
  pausedPlanHome,
} from '@/home/home-test-fixtures'

import { UserHomeScreen } from './UserHomeScreen'

const mockPush = jest.fn()
const mockSignOut = jest.fn()
let focusEffect: (() => void) | undefined

jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useFocusEffect: (callback: () => void) => {
    focusEffect = callback
  },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { subject: 'user-1', role: 'USER' },
    signOut: mockSignOut,
  }),
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
      params: { occurrenceId: ids.occurrence, actionId: ids.action },
    })
  })

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

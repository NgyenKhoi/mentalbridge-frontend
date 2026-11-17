import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AccessibilityInfo } from 'react-native'
import * as reanimated from 'react-native-reanimated'
import {
  chatFixtureConversation,
  chatFixtureId,
} from './community-chat-test-fixtures'
import {
  CommunityInboxBanner,
  setViewedConversation,
} from './CommunityInboxBanner'

const mockConversations = jest.fn()
const mockOwnId = '22222222-2222-4222-8222-222222222222'
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }))
jest.mock('@/api/api-client', () => ({ createApiClient: () => ({}) }))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({ apiBaseUrl: 'https://edge.invalid' }),
}))
jest.mock('./community-chat-api', () => ({
  createCommunityChatApi: () => ({ conversations: mockConversations }),
}))
jest.mock('@/community/community-api', () => ({
  createCommunityApi: () => ({
    profile: jest.fn().mockResolvedValue({
      profile: { status: 'ACTIVE', communityProfileId: mockOwnId },
    }),
  }),
}))

const page = (unreadCount: number) => ({
  items: [{ ...chatFixtureConversation, unreadCount }],
  nextCursor: null,
})
const title = 'Bạn có tin nhắn mới'
async function tick(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
    // react-query hands results to observers on a 0 ms timer.
    await jest.advanceTimersByTimeAsync(1)
  })
}
async function mount() {
  const client = new QueryClient()
  await render(
    <QueryClientProvider client={client}>
      <CommunityInboxBanner subject="account" />
    </QueryClientProvider>,
  )
  await tick(0)
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  setViewedConversation(null)
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue()
  // Exit animations never finish under jest; reduced motion also covers that branch.
  jest.mocked(reanimated.useReducedMotion).mockReturnValue(true)
})
afterEach(() => jest.useRealTimers())

it('records the baseline silently, then shows the peer name when unread rises', async () => {
  mockConversations.mockResolvedValue(page(2))
  await mount()
  expect(screen.queryByText(title)).toBeNull()
  mockConversations.mockResolvedValue(page(3))
  await tick(12_000)
  // Not accessible itself: grouping would hide the two buttons from screen readers.
  const banner = screen.getByTestId('community-inbox-banner')
  expect(banner).not.toHaveProp('accessibilityRole')
  expect(banner).toHaveProp('accessibilityLiveRegion', 'polite')
  expect(screen.getByText(title)).toBeOnTheScreen()
  expect(screen.getByText('Mây')).toBeOnTheScreen()
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1)
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(title)
})

it('stays quiet when unread is unchanged or the user views that conversation', async () => {
  mockConversations.mockResolvedValue(page(2))
  await mount()
  await tick(12_000)
  expect(screen.queryByText(title)).toBeNull()
  setViewedConversation(chatFixtureId)
  mockConversations.mockResolvedValue(page(5))
  await tick(12_000)
  expect(screen.queryByText(title)).toBeNull()
})

it('backs off to 60 s after an error and recovers on a later success', async () => {
  mockConversations.mockRejectedValue(new Error('TARGET_UNAVAILABLE'))
  await mount()
  await tick(12_000)
  expect(mockConversations).toHaveBeenCalledTimes(1)
  mockConversations.mockResolvedValue(page(0))
  await tick(48_000)
  expect(mockConversations).toHaveBeenCalledTimes(2)
  expect(screen.queryByText(title)).toBeNull()
  mockConversations.mockResolvedValue(page(1))
  await tick(12_000)
  expect(screen.getByText(title)).toBeOnTheScreen()
})

it('keeps the notice while a screen reader is on', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true)
  mockConversations.mockResolvedValue(page(0))
  await mount()
  mockConversations.mockResolvedValue(page(1))
  await tick(12_000)
  await tick(9_000)
  expect(screen.getByText(title)).toBeOnTheScreen()
})

it('dismisses after 9 s and from the close button', async () => {
  mockConversations.mockResolvedValue(page(0))
  await mount()
  mockConversations.mockResolvedValue(page(1))
  await tick(12_000)
  expect(screen.getByText(title)).toBeOnTheScreen()
  await tick(9_000)
  expect(screen.queryByText(title)).toBeNull()
  mockConversations.mockResolvedValue(page(2))
  await tick(12_000)
  await fireEvent.press(screen.getByLabelText('Đóng thông báo'))
  expect(screen.queryByText(title)).toBeNull()
})

it('opens the conversation on tap', async () => {
  mockConversations.mockResolvedValue(page(0))
  await mount()
  mockConversations.mockResolvedValue(page(1))
  await tick(12_000)
  await fireEvent.press(screen.getByLabelText('Mở cuộc trò chuyện: Mây'))
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: '/(user)/community-chat',
    params: { conversationId: chatFixtureId },
  })
  expect(screen.queryByText(title)).toBeNull()
})

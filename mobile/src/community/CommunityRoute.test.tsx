import { fireEvent, render, screen } from '@testing-library/react-native'
import { CommunityRoute } from './CommunityRoute'
import { fixturePostId } from './community-fixtures'
import { router } from 'expo-router'
const mockCreate = jest.fn(() => ({
  interceptors: { request: { use: jest.fn(), eject: jest.fn() } },
}))
let mockParams: { postId?: string | string[] } = {}
const mockProps = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { role: 'USER', subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => mockCreate() }))
jest.mock('./community-media', () => ({ communityMediaTransport: {} }))
jest.mock('./CommunityScreen', () => ({
  CommunityScreen: (props: unknown) => {
    mockProps(props)
    return null
  },
}))
beforeEach(() => {
  mockParams = {}
  jest.clearAllMocks()
})
it('passes a UUID notification post target to the existing authoritative detail journey', async () => {
  mockParams = { postId: fixturePostId }
  await render(<CommunityRoute />)
  expect(mockProps).toHaveBeenCalledWith(
    expect.objectContaining({ initialPostId: fixturePostId }),
  )
})
it('replaces the screen with the chat inbox for the Tin nhắn tab and pushes available-peer handoffs', async () => {
  await render(<CommunityRoute />)
  const props: { onChat: () => void; onPeerChat: (id: string) => void } =
    mockProps.mock.calls[0]?.[0]
  props.onChat()
  expect(router.replace).toHaveBeenCalledWith('/(user)/community-chat')
  expect(router.push).not.toHaveBeenCalled()
  props.onPeerChat(fixturePostId)
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(user)/community-chat',
    params: { peerId: fixturePostId },
  })
  jest.mocked(router.push).mockClear()
  props.onPeerChat('bad')
  expect(router.push).not.toHaveBeenCalled()
})
it.each(['not-an-id', ['bad', fixturePostId]])(
  'rejects malformed/repeated post params before creating a protected client',
  async (postId) => {
    mockParams = { postId }
    await render(<CommunityRoute />)
    expect(
      screen.getByText('Liên kết bài chia sẻ không hợp lệ.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }))
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockProps).not.toHaveBeenCalled()
  },
)

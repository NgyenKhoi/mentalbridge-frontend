import { render, screen } from '@testing-library/react-native'
import { CommunityRoute } from './CommunityRoute'
import { fixturePostId } from './community-fixtures'
const mockCreate = jest.fn(() => ({
  interceptors: { request: { use: jest.fn(), eject: jest.fn() } },
}))
let mockParams: { postId?: string | string[] } = {}
const mockProps = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
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
it.each(['not-an-id', ['bad', fixturePostId]])(
  'rejects malformed/repeated post params before creating a protected client',
  async (postId) => {
    mockParams = { postId }
    await render(<CommunityRoute />)
    expect(
      screen.getByText('Liên kết bài chia sẻ không hợp lệ.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeOnTheScreen()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockProps).not.toHaveBeenCalled()
  },
)

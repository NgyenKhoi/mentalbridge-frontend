import { render, screen } from '@testing-library/react-native'
import { CommunityChatRoute, chatTargetSchema } from './CommunityChatRoute'
import { chatFixtureId as id } from './community-chat-test-fixtures'
let mockParams: Record<string, unknown> = {}
let mockRole = 'USER'
const mockClient = jest.fn()
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: { subject: 'account', role: mockRole } }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => mockClient() }))
beforeEach(() => {
  mockParams = {}
  mockRole = 'USER'
  jest.clearAllMocks()
})
it.each([
  { conversationId: 'bad' },
  { requestId: [id, id] },
  { conversationId: id, invitationId: id },
  { actor: id },
  { peerId: 'https://private.invalid' },
])(
  'rejects malformed or ambiguous route input before creating an authenticated client',
  async (params) => {
    mockParams = params
    await render(<CommunityChatRoute />)
    expect(
      screen.getByText(
        'Liên kết trò chuyện hoặc phiên đăng nhập không hợp lệ.',
      ),
    ).toBeOnTheScreen()
    expect(mockClient).not.toHaveBeenCalled()
  },
)
it('rejects a non-USER route and accepts each single target shape', async () => {
  mockRole = 'SPECIALIST'
  await render(<CommunityChatRoute />)
  expect(mockClient).not.toHaveBeenCalled()
  for (const key of ['conversationId', 'requestId', 'invitationId', 'peerId'])
    expect(chatTargetSchema.safeParse({ [key]: id }).success).toBe(true)
})

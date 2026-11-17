import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'

import { CommunityFriendsRoute } from './CommunityFriendsRoute'
import { CommunityGroupsRoute } from './CommunityGroupsRoute'
import { CommunityMemberRoute } from './CommunityMemberRoute'
import { circleId, peerId } from './community-social-fixtures'

let mockParams: Record<string, string | string[]> = {}
let mockSession: { role: string; subject: string } | null = {
  role: 'USER',
  subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}
const mockCreate = jest.fn(() => ({
  interceptors: { request: { use: jest.fn(), eject: jest.fn() } },
}))
const mockFriends = jest.fn()
const mockGroups = jest.fn()
const mockCircle = jest.fn()
const mockMember = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => mockCreate() }))
jest.mock('./CommunityFriendsScreen', () => ({
  CommunityFriendsScreen: (props: unknown) => {
    mockFriends(props)
    return null
  },
}))
jest.mock('./CommunityGroupsScreen', () => ({
  CommunityGroupsScreen: (props: unknown) => {
    mockGroups(props)
    return null
  },
}))
jest.mock('./CommunityCircleScreen', () => ({
  CommunityCircleScreen: (props: unknown) => {
    mockCircle(props)
    return null
  },
}))
jest.mock('./CommunityMemberScreen', () => ({
  CommunityMemberScreen: (props: unknown) => {
    mockMember(props)
    return null
  },
}))

beforeEach(() => {
  mockParams = {}
  mockSession = {
    role: 'USER',
    subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }
  jest.clearAllMocks()
})

describe('social routes', () => {
  it('wires the friends screen to member pages and peer chat', async () => {
    await render(<CommunityFriendsRoute />)
    const props = mockFriends.mock.calls[0]?.[0]
    props.onOpenMember(peerId)
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/(user)/community-member',
      params: { profileId: peerId },
    })
    props.onMessage(peerId)
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/(user)/community-chat',
      params: { peerId },
    })
    jest.mocked(router.push).mockClear()
    props.onMessage('bad')
    props.onOpenMember('bad')
    expect(router.push).not.toHaveBeenCalled()
    props.onBack()
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('shows the group list without a circle param and the circle with one', async () => {
    await render(<CommunityGroupsRoute />)
    expect(mockGroups).toHaveBeenCalledTimes(1)
    mockGroups.mock.calls[0]?.[0].onOpenCircle(circleId)
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/(user)/community-groups',
      params: { circleId },
    })
    expect(mockCircle).not.toHaveBeenCalled()
  })

  it('passes a valid circle id to the circle screen', async () => {
    mockParams = { circleId }
    await render(<CommunityGroupsRoute />)
    expect(mockCircle).toHaveBeenCalledWith(
      expect.objectContaining({ circleId }),
    )
    mockCircle.mock.calls[0]?.[0].onLeft()
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('passes a valid member id and opens a post in the Community detail', async () => {
    mockParams = { profileId: peerId }
    await render(<CommunityMemberRoute />)
    const props = mockMember.mock.calls[0]?.[0]
    expect(props.profileId).toBe(peerId)
    props.onOpenPost(circleId)
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/(user)/community',
      params: { postId: circleId },
    })
  })

  it.each([
    [CommunityGroupsRoute, { circleId: 'nope' }],
    [CommunityGroupsRoute, { circleId: [circleId, circleId] }],
    [CommunityMemberRoute, {}],
    [CommunityMemberRoute, { profileId: 'nope' }],
  ])(
    'rejects a malformed param before creating a protected client',
    async (Route, params) => {
      mockParams = params
      await render(<Route />)
      expect(
        screen.getByText('Liên kết hoặc phiên đăng nhập không hợp lệ.'),
      ).toBeOnTheScreen()
      await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }))
      expect(router.back).toHaveBeenCalledTimes(1)
      expect(mockCreate).not.toHaveBeenCalled()
      expect(mockCircle).not.toHaveBeenCalled()
      expect(mockMember).not.toHaveBeenCalled()
    },
  )

  it('shows the same fallback without a session', async () => {
    mockSession = null
    await render(<CommunityFriendsRoute />)
    expect(
      screen.getByText('Liên kết hoặc phiên đăng nhập không hợp lệ.'),
    ).toBeOnTheScreen()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

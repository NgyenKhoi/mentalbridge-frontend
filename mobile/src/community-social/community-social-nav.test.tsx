import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'

import { CommunityRoute } from '@/community/CommunityRoute'
import { fixturePost, fixturePostId } from '@/community/community-fixtures'
import {
  CommunityNavContext,
  type CommunityNav,
} from '@/community/community-nav'
import { PostHeader } from '@/community/CommunityPostBlock'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
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
jest.mock('@/api/api-client', () => ({
  createApiClient: () => ({
    interceptors: { request: { use: jest.fn(), eject: jest.fn() } },
  }),
}))
jest.mock('@/community/community-media', () => ({
  communityMediaTransport: {},
}))
let mockNav: CommunityNav = {}
jest.mock('@/community/CommunityScreen', () => ({
  CommunityScreen: () => {
    const { useCommunityNav } = jest.requireActual('@/community/community-nav')
    mockNav = useCommunityNav()
    return null
  },
}))

beforeEach(() => {
  mockNav = {}
  jest.clearAllMocks()
})

describe('CommunityRoute navigation context', () => {
  it('opens friends, groups and a member through the three social routes', async () => {
    await render(<CommunityRoute />)
    mockNav.openFriends?.()
    expect(router.push).toHaveBeenLastCalledWith('/(user)/community-friends')
    mockNav.openGroups?.()
    expect(router.push).toHaveBeenLastCalledWith('/(user)/community-groups')
    mockNav.openMember?.(fixturePostId)
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/(user)/community-member',
      params: { profileId: fixturePostId },
    })
  })

  it('ignores a member id that is not a UUID', async () => {
    await render(<CommunityRoute />)
    jest.mocked(router.push).mockClear()
    mockNav.openMember?.('not-a-uuid')
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('PostHeader author link', () => {
  const header = (author: Parameters<typeof PostHeader>[0]['author']) => (
    <CommunityNavContext.Provider
      value={{ openMember: (id: string) => mockOpen(id) }}
    >
      <PostHeader
        author={author}
        publishedAt={fixturePost.publishedAt}
        topics={[]}
      />
    </CommunityNavContext.Provider>
  )
  const mockOpen = jest.fn()

  it('makes an ACTIVE author with a profile id pressable', async () => {
    await render(header(fixturePost.author))
    await fireEvent.press(
      screen.getByRole('button', {
        name: `Xem trang của ${fixturePost.author.displayName}`,
      }),
    )
    expect(mockOpen).toHaveBeenCalledWith(fixturePost.author.communityProfileId)
  })

  it.each([
    [
      'anonymous',
      {
        ...fixturePost.author,
        communityProfileId: null,
        avatarPreset: null,
        state: 'ANONYMOUS' as const,
      },
    ],
    [
      'deleted',
      {
        ...fixturePost.author,
        avatarPreset: null,
        state: 'DELETED' as const,
      },
    ],
  ])('never links an %s author', async (_name, author) => {
    await render(header(author))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is plain text when the screen provides no navigation', async () => {
    await render(
      <PostHeader
        author={fixturePost.author}
        publishedAt={fixturePost.publishedAt}
        topics={[]}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(fixturePost.author.displayName)).toBeOnTheScreen()
  })
})

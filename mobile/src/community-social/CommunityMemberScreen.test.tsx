import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'
import type { CommunityApi } from '@/community/community-api'
import {
  fixtureSummary,
  fixturePostId,
  fixtureTopics,
} from '@/community/community-fixtures'

import type { CommunitySocialApi } from './community-social-api'
import { CommunityMemberScreen } from './CommunityMemberScreen'
import {
  friendship,
  friendshipId,
  memberProfile,
  peer,
  peerId,
} from './community-social-fixtures'

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: 'VideoView',
}))

function apis(
  profile: ReturnType<typeof memberProfile> | Error = memberProfile('NONE'),
  overrides: Partial<CommunitySocialApi> = {},
) {
  let current = profile
  const social = {
    member: jest.fn(async () => {
      if (current instanceof Error) throw current
      return current
    }),
    requestFriend: jest.fn(async () => {
      current = memberProfile('OUTGOING')
      return friendship('OUTGOING')
    }),
    acceptFriend: jest.fn(async () => {
      current = memberProfile('FRIENDS')
      return friendship('FRIENDS')
    }),
    removeFriend: jest.fn(async () => {
      current = memberProfile('NONE')
    }),
    ...overrides,
  } as unknown as CommunitySocialApi
  const community = {
    topics: jest.fn().mockResolvedValue(fixtureTopics),
    block: jest.fn().mockResolvedValue(undefined),
    react: jest.fn().mockResolvedValue(undefined),
    bookmark: jest.fn().mockResolvedValue(undefined),
    detail: jest.fn().mockResolvedValue({ post: {}, etag: null }),
  } as unknown as CommunityApi
  return { social, community }
}
async function mount(bundle: ReturnType<typeof apis>) {
  const props = {
    ...bundle,
    subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    profileId: peerId,
    onBack: jest.fn(),
    onMessage: jest.fn(),
    onOpenPost: jest.fn(),
    onBlocked: jest.fn(),
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  await render(
    <QueryClientProvider client={client}>
      <CommunityMemberScreen {...props} />
    </QueryClientProvider>,
  )
  return { ...props, client }
}
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }))
const pressWhenReady = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }))

describe('CommunityMemberScreen', () => {
  it('shows the display identity and the member posts, and opens a post', async () => {
    const props = await mount(apis())
    await screen.findByRole('header', { name: 'Minh An' })
    await screen.findByText(fixtureSummary.contentPreview)
    expect(props.social.member).toHaveBeenCalledWith(peerId, undefined)
    await press(/^Mở chia sẻ của/)
    expect(props.onOpenPost).toHaveBeenCalledWith(fixturePostId)
    await press('Quay lại')
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('sends a friend request and then shows the sent state', async () => {
    const props = await mount(apis())
    await pressWhenReady('Kết bạn')
    await waitFor(() =>
      expect(props.social.requestFriend).toHaveBeenCalledWith(peerId),
    )
    await screen.findByRole('button', { name: 'Đã gửi lời mời' })
    expect(screen.queryByRole('button', { name: 'Kết bạn' })).toBeNull()
  })

  it('replaces the sent state with the refreshed accepted friendship', async () => {
    const member = jest
      .fn()
      .mockResolvedValueOnce(memberProfile('NONE'))
      .mockResolvedValue(memberProfile('FRIENDS'))
    await mount(apis(memberProfile('NONE'), { member }))
    await pressWhenReady('Kết bạn')
    await waitFor(() => expect(member).toHaveBeenCalledTimes(2))
    await screen.findByRole('button', { name: 'Nhắn tin' })
  })

  it('cancels a sent request from the sheet', async () => {
    const props = await mount(apis(memberProfile('OUTGOING')))
    await pressWhenReady('Đã gửi lời mời')
    await press('Hủy lời mời kết bạn')
    await waitFor(() =>
      expect(props.social.removeFriend).toHaveBeenCalledWith(friendshipId),
    )
  })

  it('accepts or declines an incoming request', async () => {
    const props = await mount(apis(memberProfile('INCOMING')))
    await pressWhenReady('Chấp nhận')
    await waitFor(() =>
      expect(props.social.acceptFriend).toHaveBeenCalledWith(friendshipId),
    )
    await screen.findByRole('button', { name: 'Nhắn tin' })
  })

  it('declines an incoming request', async () => {
    const props = await mount(apis(memberProfile('INCOMING')))
    await pressWhenReady('Từ chối')
    await waitFor(() =>
      expect(props.social.removeFriend).toHaveBeenCalledWith(friendshipId),
    )
    await screen.findByRole('button', { name: 'Kết bạn' })
  })

  it('messages a friend and unfriends only after a confirm step', async () => {
    const props = await mount(apis(memberProfile('FRIENDS')))
    await pressWhenReady('Nhắn tin')
    expect(props.onMessage).toHaveBeenCalledWith(peerId)
    await press('Tùy chọn cho Minh An')
    await press('Hủy kết bạn')
    await screen.findByText('Hủy kết bạn với Minh An?')
    expect(props.social.removeFriend).not.toHaveBeenCalled()
    await press('Hủy kết bạn')
    await waitFor(() =>
      expect(props.social.removeFriend).toHaveBeenCalledWith(friendshipId),
    )
  })

  it('blocks the member after a confirm step and leaves the page', async () => {
    const props = await mount(apis())
    await pressWhenReady('Tùy chọn cho Minh An')
    await press('Chặn thành viên')
    await screen.findByText('Chặn Minh An?')
    expect(props.community.block).not.toHaveBeenCalled()
    await press('Xác nhận chặn')
    await waitFor(() =>
      expect(props.community.block).toHaveBeenCalledWith(peerId),
    )
    await waitFor(() => expect(props.onBlocked).toHaveBeenCalledTimes(1))
  })

  it("offers no friendship action or block on the viewer's own page", async () => {
    await mount(apis(memberProfile('SELF')))
    await screen.findByRole('header', { name: 'Minh An' })
    expect(screen.queryByRole('button', { name: 'Kết bạn' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Tùy chọn cho Minh An' }),
    ).toBeNull()
  })

  it('pages more posts with the feed cursor', async () => {
    const first = {
      ...memberProfile('NONE'),
      posts: {
        ...memberProfile('NONE').posts,
        nextCursor: 'next',
        hasMore: true,
      },
    }
    const second = {
      ...memberProfile('NONE'),
      posts: {
        items: [
          {
            ...fixtureSummary,
            postId: peerId,
            author: peer,
            contentPreview: 'Một bài khác.',
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    }
    const member = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(second)
    const props = await mount(apis(memberProfile('NONE'), { member }))
    await screen.findByText(fixtureSummary.contentPreview)
    await press('Xem thêm bài viết')
    await screen.findByText('Một bài khác.')
    expect(props.social.member).toHaveBeenLastCalledWith(peerId, 'next')
  })

  it('names an empty post list', async () => {
    const profile = {
      ...memberProfile('NONE'),
      posts: { items: [], nextCursor: null, hasMore: false },
    }
    await mount(apis(profile))
    await screen.findByText('Chưa có bài viết nào trong mục này')
  })

  it('shows a skeleton while loading', async () => {
    await mount(
      apis(memberProfile('NONE'), {
        member: jest.fn(() => new Promise(() => {})),
      }),
    )
    expect(
      screen.getByRole('progressbar', { name: 'Đang tải trang cá nhân…' }),
    ).toBeOnTheScreen()
  })

  it('says the page is unavailable on 404 and goes back', async () => {
    const props = await mount(
      apis(new ApiError({ code: 'X', message: 'x', status: 404 })),
    )
    await screen.findByText('Trang này hiện không khả dụng.')
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Quay lại' })[1]!,
    )
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('retries a failed load', async () => {
    const member = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'X', message: 'x', status: 500 }),
      )
      .mockResolvedValue(memberProfile('NONE'))
    await mount(apis(memberProfile('NONE'), { member }))
    await screen.findByText('Chưa tải được trang cá nhân.')
    await press('Thử lại')
    await screen.findByRole('header', { name: 'Minh An' })
  })
})

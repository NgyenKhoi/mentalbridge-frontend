import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { CommunitySocialApi } from './community-social-api'
import { CommunityFriendsScreen } from './CommunityFriendsScreen'
import {
  friendship,
  friendshipId,
  peer,
  peerId,
  secondFriendshipId,
  secondPeer,
} from './community-social-fixtures'

const page = <T,>(items: T[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
})
function api(overrides: Partial<CommunitySocialApi> = {}): CommunitySocialApi {
  return {
    friends: jest.fn(async (view) =>
      page(
        view === 'accepted'
          ? [friendship('FRIENDS')]
          : view === 'incoming'
            ? [friendship('INCOMING', secondPeer, secondFriendshipId)]
            : [friendship('OUTGOING')],
      ),
    ),
    searchMembers: jest.fn(async () => page([peer])),
    requestFriend: jest.fn(async () => friendship('OUTGOING')),
    acceptFriend: jest.fn(async () => friendship('FRIENDS')),
    removeFriend: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CommunitySocialApi
}
async function mount(social: CommunitySocialApi) {
  const props = {
    api: social,
    subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    onBack: jest.fn(),
    onOpenMember: jest.fn(),
    onMessage: jest.fn(),
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  await render(
    <QueryClientProvider client={client}>
      <CommunityFriendsScreen {...props} />
    </QueryClientProvider>,
  )
  return props
}
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }))

describe('CommunityFriendsScreen', () => {
  it('shows accepted friends as flat rows, opens messages and the member page', async () => {
    const props = await mount(api())
    await screen.findByText('Minh An')
    await press('Nhắn tin với Minh An')
    expect(props.onMessage).toHaveBeenCalledWith(peerId)
    await press('Xem trang của Minh An')
    expect(props.onOpenMember).toHaveBeenCalledWith(peerId)
    await press('Quay lại cộng đồng')
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('asks before unfriending and then calls the client with the friendship id', async () => {
    const social = api()
    await mount(social)
    await screen.findByText('Minh An')
    await press('Tùy chọn cho Minh An')
    await press('Hủy kết bạn')
    await screen.findByText('Hủy kết bạn với Minh An?')
    expect(social.removeFriend).not.toHaveBeenCalled()
    await press('Hủy kết bạn')
    await waitFor(() =>
      expect(social.removeFriend).toHaveBeenCalledWith(friendshipId),
    )
  })

  it('accepts or declines an incoming request and cancels a sent one', async () => {
    const social = api()
    await mount(social)
    await screen.findByText('Minh An')
    await press('Lời mời')
    await screen.findByText('Lan Chi')
    expect(screen.getByText('Muốn kết nối với bạn')).toBeOnTheScreen()
    await press('Chấp nhận kết bạn với Lan Chi')
    await waitFor(() =>
      expect(social.acceptFriend).toHaveBeenCalledWith(secondFriendshipId),
    )
    await press('Từ chối lời mời của Lan Chi')
    await waitFor(() =>
      expect(social.removeFriend).toHaveBeenCalledWith(secondFriendshipId),
    )
    await press('Đã gửi')
    await screen.findByText('Đang chờ chấp nhận')
    await press('Hủy lời mời kết bạn với Minh An')
    await waitFor(() =>
      expect(social.removeFriend).toHaveBeenCalledWith(friendshipId),
    )
  })

  it('names an empty list per view and pages with "Xem thêm kết nối"', async () => {
    const friends = jest
      .fn()
      .mockResolvedValueOnce(
        page([friendship('FRIENDS')], secondPeer.communityProfileId),
      )
      .mockResolvedValueOnce(
        page([friendship('FRIENDS', secondPeer, secondFriendshipId)]),
      )
      .mockResolvedValue(page([]))
    await mount(api({ friends }))
    await screen.findByText('Minh An')
    await press('Xem thêm kết nối')
    await screen.findByText('Lan Chi')
    expect(friends).toHaveBeenLastCalledWith(
      'accepted',
      secondPeer.communityProfileId,
    )
    await press('Lời mời')
    await screen.findByText('Chưa có lời mời kết bạn mới')
  })

  it('shows skeleton rows while loading', async () => {
    await mount(api({ friends: jest.fn(() => new Promise(() => {})) }))
    expect(
      screen.getByRole('progressbar', { name: 'Đang tải kết nối của bạn…' }),
    ).toBeOnTheScreen()
  })

  it('retries a failed load and says honestly when friends are unavailable', async () => {
    const friends = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'X', message: 'x', status: 500 }),
      )
      .mockResolvedValue(page([friendship('FRIENDS')]))
    const props = await mount(api({ friends }))
    await screen.findByText('Chưa tải được kết nối.')
    await press('Thử lại')
    await screen.findByText('Minh An')
    expect(friends).toHaveBeenCalledTimes(2)
    expect(props.onBack).not.toHaveBeenCalled()
  })

  it('shows the unavailable card on a 503 and goes back', async () => {
    const friends = jest
      .fn()
      .mockRejectedValue(new ApiError({ code: 'X', message: 'x', status: 503 }))
    const props = await mount(api({ friends }))
    await screen.findByText('Bạn bè hiện chưa khả dụng.')
    await press('Quay lại')
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('searches after two characters, debounced, and sends a friend request from a result', async () => {
    const social = api({
      friends: jest.fn(async (view) =>
        page(view === 'accepted' ? [friendship('FRIENDS')] : []),
      ),
    })
    await mount(social)
    await screen.findByText('Minh An')
    const field = screen.getByLabelText('Tìm bạn theo tên cộng đồng')
    await fireEvent.changeText(field, 'm')
    expect(
      screen.getByText('Nhập từ 2 đến 80 ký tự để tìm theo tên cộng đồng.'),
    ).toBeOnTheScreen()
    expect(social.searchMembers).not.toHaveBeenCalled()
    await fireEvent.changeText(field, 'mi')
    await waitFor(() =>
      expect(social.searchMembers).toHaveBeenCalledWith('mi', undefined),
    )
    // The loaded friends list already says Minh An is a friend.
    await screen.findByRole('button', { name: 'Nhắn tin với Minh An' })
    expect(
      screen.queryByRole('button', { name: 'Kết bạn với Minh An' }),
    ).toBeNull()
  })

  it('offers "Kết bạn" for a stranger and then shows the sent state', async () => {
    const social = api({
      searchMembers: jest.fn(async () => page([secondPeer])),
      friends: jest.fn(async () => page([])),
      requestFriend: jest.fn(async () =>
        friendship('OUTGOING', secondPeer, secondFriendshipId),
      ),
    })
    await mount(social)
    await fireEvent.changeText(
      screen.getByLabelText('Tìm bạn theo tên cộng đồng'),
      'lan',
    )
    fireEvent.press(
      await screen.findByRole('button', { name: 'Kết bạn với Lan Chi' }),
    )
    await waitFor(() =>
      expect(social.requestFriend).toHaveBeenCalledWith(
        secondPeer.communityProfileId,
      ),
    )
    await screen.findByText('Đã gửi lời mời')
  })

  it('says no match was found and clears the search', async () => {
    await mount(api({ searchMembers: jest.fn(async () => page([])) }))
    await fireEvent.changeText(
      screen.getByLabelText('Tìm bạn theo tên cộng đồng'),
      'zz',
    )
    await screen.findByText('Chưa tìm thấy tên cộng đồng phù hợp.')
    await press('Xóa nội dung tìm kiếm')
    await screen.findByText('Minh An')
  })
})

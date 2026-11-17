import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { randomUUID } from 'expo-crypto'

import { ApiError } from '@/api/api-error'
import type { CommunityApi } from '@/community/community-api'
import { fixtureProfile } from '@/community/community-fixtures'

import type { CommunitySocialApi } from './community-social-api'
import { CommunityCircleScreen } from './CommunityCircleScreen'
import {
  circleDetail,
  circleId,
  entry,
  entryId,
  friendship,
  ownProfileId,
  peerId,
  secondFriendshipId,
  secondPeer,
  secondPeerId,
} from './community-social-fixtures'

const page = <T,>(items: T[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
})
const uuid = '11111111-1111-4111-8111-111111111111'
function api(overrides: Partial<CommunitySocialApi> = {}): CommunitySocialApi {
  return {
    circle: jest.fn(async () => circleDetail('MEMBER')),
    entries: jest.fn(async () => page([entry()])),
    comments: jest.fn(async () => page([])),
    friends: jest.fn(async () =>
      page([friendship('FRIENDS', secondPeer, secondFriendshipId)]),
    ),
    publish: jest.fn(async () => entry()),
    comment: jest.fn(async () => entry()),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
    deleteComment: jest.fn().mockResolvedValue(undefined),
    invite: jest.fn().mockResolvedValue(undefined),
    removeMember: jest.fn().mockResolvedValue(undefined),
    archiveCircle: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CommunitySocialApi
}
async function mount(social: CommunitySocialApi) {
  const props = {
    api: social,
    community: {
      profile: jest.fn().mockResolvedValue(fixtureProfile),
    } as unknown as CommunityApi,
    subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    circleId,
    onBack: jest.fn(),
    onLeft: jest.fn(),
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  await render(
    <QueryClientProvider client={client}>
      <CommunityCircleScreen {...props} />
    </QueryClientProvider>,
  )
  return props
}
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }))
const pressWhenReady = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }))

describe('CommunityCircleScreen feed', () => {
  it('shows text entries as flat blocks under the group name', async () => {
    const props = await mount(api())
    await screen.findByText('Hôm nay mình đi dạo một vòng.')
    expect(
      screen.getByRole('header', { name: 'Buổi sáng dịu nhẹ' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Nơi chia sẻ những điều nhỏ.')).toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: /Tùy chọn bài viết/ }),
    ).toBeNull()
    await press('Quay lại danh sách nhóm')
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('invites the first story when the group is empty and posts it with a stable key', async () => {
    const social = api({ entries: jest.fn(async () => page([])) })
    await mount(social)
    await screen.findByText('Bắt đầu câu chuyện đầu tiên')
    expect(screen.getByRole('button', { name: 'Đăng bài' })).toBeDisabled()
    await fireEvent.changeText(
      screen.getByLabelText('Chia sẻ cùng nhóm'),
      ' Chào cả nhà ',
    )
    await press('Đăng bài')
    await waitFor(() =>
      expect(social.publish).toHaveBeenCalledWith(
        circleId,
        'Chào cả nhà',
        uuid,
      ),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Chia sẻ cùng nhóm').props.value).toBe(''),
    )
  })

  it('sends identical text twice as two commands with distinct keys', async () => {
    jest
      .mocked(randomUUID)
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const social = api({ entries: jest.fn(async () => page([])) })
    await mount(social)
    await screen.findByText('Bắt đầu câu chuyện đầu tiên')
    for (const sent of [1, 2]) {
      await fireEvent.changeText(
        screen.getByLabelText('Chia sẻ cùng nhóm'),
        'Chào',
      )
      await press('Đăng bài')
      await waitFor(() => expect(social.publish).toHaveBeenCalledTimes(sent))
      await waitFor(() =>
        expect(screen.getByLabelText('Chia sẻ cùng nhóm').props.value).toBe(''),
      )
    }
    expect(social.publish).toHaveBeenNthCalledWith(
      1,
      circleId,
      'Chào',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    expect(social.publish).toHaveBeenNthCalledWith(
      2,
      circleId,
      'Chào',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    )
  })

  it('keeps the draft and shows the error when posting fails', async () => {
    const social = api({
      entries: jest.fn(async () => page([])),
      publish: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'X', message: 'x', status: 429 }),
        ),
    })
    await mount(social)
    await screen.findByText('Bắt đầu câu chuyện đầu tiên')
    await fireEvent.changeText(
      screen.getByLabelText('Chia sẻ cùng nhóm'),
      'Chào',
    )
    await press('Đăng bài')
    await screen.findByText(/Chưa thể xác nhận yêu cầu lúc này/)
    expect(screen.getByLabelText('Chia sẻ cùng nhóm').props.value).toBe('Chào')
  })

  it('deletes an own entry only after a confirm step', async () => {
    const social = api({
      entries: jest.fn(async () => page([entry({ canDelete: true })])),
    })
    await mount(social)
    await pressWhenReady('Tùy chọn bài viết')
    await press('Xóa bài viết')
    await screen.findByText('Xóa bài viết này?')
    expect(social.deleteEntry).not.toHaveBeenCalled()
    await press('Xóa nội dung')
    await waitFor(() =>
      expect(social.deleteEntry).toHaveBeenCalledWith(circleId, entryId),
    )
  })

  it('pages older entries', async () => {
    const entries = jest
      .fn()
      .mockResolvedValueOnce(page([entry()], peerId))
      .mockResolvedValue(
        page([entry({ id: secondPeerId, text: 'Một bài cũ hơn.' })]),
      )
    await mount(api({ entries }))
    await screen.findByText('Hôm nay mình đi dạo một vòng.')
    await press('Xem bài viết trước')
    await screen.findByText('Một bài cũ hơn.')
    expect(entries).toHaveBeenLastCalledWith(circleId, peerId)
  })

  it('opens the unavailable card when the group is gone and goes back', async () => {
    const social = api({
      circle: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ code: 'X', message: 'x', status: 404 }),
        ),
    })
    const props = await mount(social)
    await screen.findByText(
      'Nhóm hoặc nội dung này không còn khả dụng với bạn.',
    )
    await press('Quay lại')
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('shows a skeleton while the group opens', async () => {
    await mount(api({ circle: jest.fn(() => new Promise(() => {})) }))
    expect(
      screen.getByRole('progressbar', { name: 'Đang mở nhóm của bạn…' }),
    ).toBeOnTheScreen()
  })

  it('retries a failed detail load', async () => {
    const circle = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'X', message: 'x', status: 500 }),
      )
      .mockResolvedValue(circleDetail('MEMBER'))
    await mount(api({ circle }))
    await screen.findByText('Chưa mở được nhóm.')
    await press('Thử lại')
    await screen.findByText('Hôm nay mình đi dạo một vòng.')
  })
})

describe('CommunityCircleScreen comments', () => {
  it('opens an entry, lists flat comments, sends one and deletes an own one', async () => {
    const comments = jest.fn(async () =>
      page([entry({ id: peerId, text: 'Mình ở đây.', canDelete: true })]),
    )
    const social = api({ comments })
    await mount(social)
    await pressWhenReady('Bình luận bài viết của Minh An')
    await screen.findByText('Mình ở đây.')
    expect(screen.getByRole('header', { name: 'Bình luận' })).toBeOnTheScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Viết bình luận'),
      'Cảm ơn bạn',
    )
    await press('Gửi bình luận')
    await waitFor(() =>
      expect(social.comment).toHaveBeenCalledWith(
        circleId,
        entryId,
        'Cảm ơn bạn',
        uuid,
      ),
    )
    await press('Tùy chọn bình luận')
    await press('Xóa bình luận')
    await screen.findByText('Xóa bình luận này?')
    await press('Xóa nội dung')
    await waitFor(() =>
      expect(social.deleteComment).toHaveBeenCalledWith(circleId, peerId),
    )
    await press('Quay lại nhóm')
    await screen.findByText('Hôm nay mình đi dạo một vòng.')
  })

  it('sends identical comment text twice with distinct keys', async () => {
    jest
      .mocked(randomUUID)
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const social = api()
    await mount(social)
    await pressWhenReady('Bình luận bài viết của Minh An')
    for (const sent of [1, 2]) {
      await fireEvent.changeText(
        screen.getByLabelText('Viết bình luận'),
        'Cảm ơn',
      )
      await press('Gửi bình luận')
      await waitFor(() => expect(social.comment).toHaveBeenCalledTimes(sent))
      await waitFor(() =>
        expect(screen.getByLabelText('Viết bình luận').props.value).toBe(''),
      )
    }
    expect(
      jest.mocked(social.comment).mock.calls.map((call) => call[3]),
    ).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ])
  })

  it('names an empty thread', async () => {
    await mount(api())
    await pressWhenReady('Bình luận bài viết của Minh An')
    await screen.findByText(
      'Chưa có bình luận. Bạn có thể bắt đầu bằng một lời đồng hành.',
    )
  })

  it('retries a failed comment list', async () => {
    const comments = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'X', message: 'x', status: 500 }),
      )
      .mockResolvedValue(page([]))
    await mount(api({ comments }))
    await pressWhenReady('Bình luận bài viết của Minh An')
    await pressWhenReady('Thử lại')
    await screen.findByText(/Chưa có bình luận/)
  })
})

describe('CommunityCircleScreen members and leaving', () => {
  it('lets a member read roles and leave after confirming', async () => {
    const social = api()
    const props = await mount(social)
    await pressWhenReady('Tùy chọn nhóm')
    await press('Thành viên & thông tin')
    await screen.findByText('3 thành viên')
    expect(screen.getByText('Chủ nhóm')).toBeOnTheScreen()
    expect(screen.getByText('Thành viên · Bạn')).toBeOnTheScreen()
    expect(screen.queryByText('Mời bạn bè')).toBeNull()
    await press('Quay lại nhóm')
    await pressWhenReady('Tùy chọn nhóm')
    await press('Rời nhóm')
    await screen.findByText('Rời nhóm này?')
    expect(social.removeMember).not.toHaveBeenCalled()
    await press('Xác nhận')
    await waitFor(() =>
      expect(social.removeMember).toHaveBeenCalledWith(circleId, ownProfileId),
    )
    await waitFor(() => expect(props.onLeft).toHaveBeenCalledTimes(1))
  })

  it('lets the owner invite a friend, remove a member and archive the group', async () => {
    const detail = circleDetail('OWNER')
    detail.members[1] = { ...detail.members[1]!, role: 'MEMBER' }
    const social = api({ circle: jest.fn(async () => detail) })
    const props = await mount(social)
    await pressWhenReady('Tùy chọn nhóm')
    await press('Thành viên & thông tin')
    await pressWhenReady('Mời Lan Chi')
    await waitFor(() =>
      expect(social.invite).toHaveBeenCalledWith(circleId, secondPeerId),
    )
    await screen.findByText('Đã mời')
    await press('Tùy chọn cho Bạn cùng cộng đồng')
    await press('Xóa Bạn cùng cộng đồng khỏi nhóm')
    await screen.findByText('Xóa Bạn cùng cộng đồng khỏi nhóm?')
    await press('Xác nhận')
    await waitFor(() =>
      expect(social.removeMember).toHaveBeenCalledWith(circleId, ownProfileId),
    )
    await press('Quay lại nhóm')
    await pressWhenReady('Tùy chọn nhóm')
    await press('Lưu trữ nhóm')
    await screen.findByText('Lưu trữ nhóm này?')
    await press('Xác nhận')
    await waitFor(() =>
      expect(social.archiveCircle).toHaveBeenCalledWith(circleId),
    )
    await waitFor(() => expect(props.onLeft).toHaveBeenCalledTimes(1))
  })
})

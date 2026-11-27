import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { BackHandler } from 'react-native'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { ApiError } from '@/api/api-error'
import type { AssessmentApi } from '@/assessment/assessment-api'
import type { AppSession } from '@/auth/session'
import type { ResourceApi } from '@/resources/resource-api'

import type { CommunityApi } from './community-api'
import type {
  CommunityComment,
  CommunityPage,
  VersionedPost,
} from './community-contract'
import {
  fixtureDate,
  fixturePost,
  fixturePostId,
  fixtureProfile,
  fixtureProfileId,
  fixtureSummary,
  fixtureTopics,
} from './community-fixtures'
import type { CommunityMediaTransport } from './community-media'
import { CommunityScreen } from './CommunityScreen'

let mockSession: AppSession | null = {
  subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'USER',
}
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession, signOut: jest.fn() }),
}))
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: 'VideoView',
}))

const page = (
  items = [fixtureSummary],
  cursor: string | null = null,
): CommunityPage => ({ items, nextCursor: cursor, hasMore: cursor !== null })
const unavailable = () =>
  new ApiError({
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'unavailable',
    status: 503,
  })
function api(overrides: Partial<CommunityApi> = {}): CommunityApi {
  return {
    feed: jest.fn().mockResolvedValue(page()),
    saved: jest.fn().mockResolvedValue(page([])),
    topics: jest.fn().mockResolvedValue(fixtureTopics),
    detail: jest.fn().mockResolvedValue({ post: fixturePost, etag: null }),
    create: jest.fn().mockResolvedValue({ post: fixturePost, etag: '"0"' }),
    update: jest.fn().mockResolvedValue({ post: fixturePost, etag: '"1"' }),
    remove: jest.fn().mockResolvedValue(undefined),
    profile: jest.fn().mockResolvedValue(fixtureProfile),
    saveProfile: jest.fn().mockResolvedValue(fixtureProfile),
    comments: jest
      .fn()
      .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    comment: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue(undefined),
    commentReaction: jest.fn(async (commentId: string) => ({
      commentId,
      reaction: null,
      reactionCount: 0,
    })),
    setCommentReaction: jest.fn(async (commentId: string, reaction) => ({
      commentId,
      reaction,
      reactionCount: 1,
    })),
    clearCommentReaction: jest.fn().mockResolvedValue(undefined),
    bookmark: jest.fn().mockResolvedValue(undefined),
    report: jest.fn().mockResolvedValue(undefined),
    block: jest.fn().mockResolvedValue(undefined),
    hide: jest.fn().mockResolvedValue(undefined),
    uploadIntent: jest.fn(),
    finalize: jest.fn(),
    removeMedia: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}
function dependencies(community: CommunityApi) {
  return {
    api: community,
    resources: {
      listResources: jest.fn().mockResolvedValue({ data: [], count: 0 }),
    } as unknown as ResourceApi,
    safety: { lookupSafetyDirectory: jest.fn() } as unknown as AssessmentApi,
    media: {
      pick: jest.fn().mockResolvedValue(null),
      upload: jest.fn().mockResolvedValue(undefined),
    } satisfies CommunityMediaTransport,
    onBack: jest.fn(),
    onResource: jest.fn(),
    onChat: jest.fn(),
    onPeerChat: jest.fn(),
  }
}
async function mount(community: CommunityApi, initialPostId?: string) {
  const props = dependencies(community)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  const tree = () => (
    <QueryClientProvider client={client}>
      <CommunityScreen
        {...props}
        {...(initialPostId ? { initialPostId } : {})}
      />
    </QueryClientProvider>
  )
  const rendered = await render(tree())
  return { ...rendered, props, client, tree }
}
const press = (label: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name: label }))
const openCard = /^Mở chia sẻ của/
const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))
async function openProfile() {
  await tab('Trang của tôi')
  await press('Sửa danh tính')
}
async function openHelp() {
  await tab('Trang của tôi')
  await press('Hỗ trợ ngay')
}
async function openPost() {
  await screen.findByText(fixturePost.content)
  await press(openCard)
  await screen.findByRole('header', { name: 'Bài viết' })
  await screen.findByRole('button', {
    name: /^(An toàn cho|Tùy chọn) bài viết$/,
  })
}
async function draft() {
  await press('Viết chia sẻ')
  await screen.findByRole('button', { name: 'Câu chuyện của tôi' })
  await fireEvent.changeText(
    screen.getByLabelText('Nội dung chia sẻ'),
    'Một chia sẻ của tôi',
  )
  await press('Câu chuyện của tôi')
}

describe('mobile Community peer-support journey', () => {
  it('switches the tab panels and hands the Tin nhắn tab to the route', async () => {
    const value = await mount(api())
    await screen.findByText(fixturePost.content)
    expect(
      screen.getByRole('tab', { name: 'Bảng tin' }).props.accessibilityState
        .selected,
    ).toBe(true)
    await tab('Khoảnh khắc')
    expect(await screen.findByText('Chưa có khoảnh khắc nào')).toBeOnTheScreen()
    await tab('Trang của tôi')
    expect(
      await screen.findByRole('button', { name: 'Sửa danh tính' }),
    ).toBeOnTheScreen()
    await tab('Bảng tin')
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
    await tab('Tin nhắn')
    expect(value.props.onChat).toHaveBeenCalledTimes(1)
    await tab('Viết')
    expect(
      screen.getByRole('header', { name: 'Viết chia sẻ' }),
    ).toBeOnTheScreen()
  })
  it('returns from the moments and me tabs to the feed on Android back', async () => {
    const listen = jest.spyOn(BackHandler, 'addEventListener')
    await mount(api())
    await screen.findByText(fixturePost.content)
    await tab('Trang của tôi')
    await screen.findByRole('button', { name: 'Sửa danh tính' })
    const handler = listen.mock.calls.at(-1)?.[1]
    await act(async () => expect((handler as () => boolean)()).toBe(true))
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
  })
  it.each([
    ['ACTIVE', null, true],
    ['ACTIVE', '"0"', false],
    ['ANONYMOUS', null, false],
    ['DELETED', null, false],
  ] as const)(
    'offers peer chat only for an available non-owner author: %s %s',
    async (state, etag, expected) => {
      const post = {
        ...fixturePost,
        author: {
          ...fixturePost.author,
          state,
          ...(state === 'ANONYMOUS'
            ? { communityProfileId: null, avatarPreset: null }
            : {}),
        },
      }
      const value = await mount(
        api({ detail: jest.fn().mockResolvedValue({ post, etag }) }),
        fixturePostId,
      )
      await screen.findByText(fixturePost.content)
      await fireEvent.press(
        await screen.findByRole('button', {
          name: /^(An toàn cho|Tùy chọn) bài viết$/,
        }),
      )
      const button = screen.queryByRole('button', {
        name: 'Trò chuyện với tác giả',
      })
      if (expected) {
        expect(button).toBeOnTheScreen()
        await press('Trò chuyện với tác giả')
        expect(value.props.onPeerChat).toHaveBeenCalledWith(
          fixturePost.author.communityProfileId,
        )
      } else expect(button).toBeNull()
    },
  )
  it('opens the exact notification target directly and loads authoritative post detail', async () => {
    const community = api()
    await mount(community, fixturePostId)
    expect(
      await screen.findByRole('header', { name: 'Bài viết' }),
    ).toBeOnTheScreen()
    await screen.findByText(fixturePost.content)
    expect(community.detail).toHaveBeenCalledWith(fixturePostId)
    expect(community.feed).not.toHaveBeenCalled()
  })

  it('does not substitute cached post content when a notification target is gone', async () => {
    const community = api({
      detail: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'COMMUNITY_POST_NOT_FOUND',
          status: 404,
          message: 'gone',
        }),
      ),
    })
    await mount(community, fixturePostId)
    expect(
      await screen.findByRole('button', { name: 'Tải lại bài viết' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText(fixturePost.content)).toBeNull()
    expect(community.comments).not.toHaveBeenCalled()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession = {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    }
  })
  it('collapses blank lines in a feed preview so the clamp never ends on a lone ellipsis', async () => {
    await mount(
      api({
        feed: jest
          .fn()
          .mockResolvedValue(
            page([{ ...fixtureSummary, contentPreview: 'Một\n\n\nHai' }]),
          ),
      }),
    )
    expect(await screen.findByText('Một\nHai')).toBeOnTheScreen()
  })
  it('paginates governed feed filters', async () => {
    const community = api({
      feed: jest.fn(async (topics, cursor) =>
        cursor
          ? page([
              {
                ...fixtureSummary,
                postId: '33333333-3333-4333-8333-333333333333',
                contentPreview: 'Trang tiếp theo',
              },
            ])
          : topics.length
            ? page([])
            : page([fixtureSummary], 'opaque-next'),
      ),
    })
    await mount(community)
    await screen.findByText(fixturePost.content)
    await press('Xem thêm chia sẻ')
    expect(await screen.findByText('Trang tiếp theo')).toBeOnTheScreen()
    expect(community.feed).toHaveBeenCalledWith([], 'opaque-next')
    await press('Bước nhỏ')
    expect(
      await screen.findByText('Chưa có chia sẻ hiển thị cho chủ đề này.'),
    ).toBeOnTheScreen()
    expect(community.feed).toHaveBeenCalledWith(['SMALL_MILESTONE'], undefined)
  })
  it('creates an explicit anonymous post then edits/deletes only with the owner ETag', async () => {
    const community = api({
      detail: jest.fn().mockResolvedValue({ post: fixturePost, etag: '"4"' }),
    })
    await mount(community)
    await screen.findByText(fixturePost.content)
    await draft()
    await fireEvent.press(screen.getByRole('radio', { name: 'Ẩn danh' }))
    await press('Đăng chia sẻ')
    await screen.findByRole('button', { name: 'Tùy chọn bài viết' })
    await press('Tùy chọn bài viết')
    await screen.findByRole('button', { name: 'Sửa bài viết của tôi' })
    expect(community.create).toHaveBeenCalledWith(
      {
        content: 'Một chia sẻ của tôi',
        topics: ['MY_STORY'],
        mediaIds: [],
        authorMode: 'ANONYMOUS',
        resourceId: null,
        sensitiveContentWarning: null,
      },
      expect.any(String),
    )
    await press('Sửa bài viết của tôi')
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung chia sẻ'),
      'Bản sửa',
    )
    await press('Lưu thay đổi')
    await waitFor(() =>
      expect(community.update).toHaveBeenCalledWith(
        fixturePostId,
        '"4"',
        expect.objectContaining({ content: 'Bản sửa' }),
      ),
    )
    await screen.findByRole('button', { name: 'Tùy chọn bài viết' })
    await press('Tùy chọn bài viết')
    await press('Xóa bài viết của tôi')
    expect(community.remove).not.toHaveBeenCalled()
    await press('Xác nhận xóa bài viết')
    await waitFor(() =>
      expect(community.remove).toHaveBeenCalledWith(fixturePostId, '"4"'),
    )
  })
  it('retains one unchanged idempotent create after ambiguous failure and locks edits', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValueOnce({ post: fixturePost, etag: '"0"' })
    const community = api({ create })
    await mount(community)
    await screen.findByText(fixturePost.content)
    await draft()
    await press('Đăng chia sẻ')
    await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu' })
    expect(screen.getByLabelText('Nội dung chia sẻ').props.editable).toBe(false)
    await press('Thử lại cùng yêu cầu')
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    expect(create.mock.calls[0]).toEqual(create.mock.calls[1])
  })

  it('retains a report acknowledgement through a genuinely asynchronous visibility refresh', async () => {
    let complete: ((value: VersionedPost) => void) | undefined
    const detail = jest
      .fn()
      .mockResolvedValueOnce({ post: fixturePost, etag: null })
      .mockImplementationOnce(
        () =>
          new Promise<VersionedPost>((resolve) => {
            complete = resolve
          }),
      )
    await mount(api({ detail }))
    await openPost()
    await press('An toàn cho bài viết')
    await press('Báo cáo bài viết')
    await press('Gửi báo cáo')
    await screen.findByText('Đang xác nhận bài viết còn hiển thị…')
    expect(screen.queryByText(fixturePost.content)).not.toBeOnTheScreen()
    complete?.({ post: fixturePost, etag: null })
    expect(
      await screen.findByText(
        /Báo cáo đã được gửi để đội ngũ quản trị xem xét/,
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Chặn tác giả' }),
    ).toBeOnTheScreen()
  })

  it('preserves a draft on stale If-Match without automatically overwriting the new version', async () => {
    const community = api({
      detail: jest.fn().mockResolvedValue({ post: fixturePost, etag: '"4"' }),
      update: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'VERSION_CONFLICT',
          message: 'stale',
          status: 412,
        }),
      ),
    })
    await mount(community)
    await openPost()
    await press('Tùy chọn bài viết')
    await press('Sửa bài viết của tôi')
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung chia sẻ'),
      'Nháp chưa lưu',
    )
    await press('Lưu thay đổi')
    await screen.findByText(/Nội dung đã thay đổi/)
    expect(screen.getByLabelText('Nội dung chia sẻ').props.value).toBe(
      'Nháp chưa lưu',
    )
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
    expect(community.update).toHaveBeenCalledTimes(1)
  })
  it('never infers ownership or a blockable identity from an anonymous author', async () => {
    const anonymous: VersionedPost = {
      etag: null,
      post: {
        ...fixturePost,
        author: {
          communityProfileId: null,
          avatarPreset: null,
          displayName: 'Ẩn danh',
          state: 'ANONYMOUS',
        },
      },
    }
    await mount(api({ detail: jest.fn().mockResolvedValue(anonymous) }))
    await openPost()
    await press('An toàn cho bài viết')
    expect(
      screen.queryByRole('button', { name: 'Chặn tác giả' }),
    ).not.toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: 'Sửa bài viết của tôi' }),
    ).not.toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Báo cáo bài viết' }),
    ).toBeOnTheScreen()
  })
  it('sets and clears reactions and bookmarks on the detail without refetching the post', async () => {
    const community = api()
    await mount(community)
    await openPost()
    await press('Thả cảm xúc')
    expect(
      await screen.findByRole('button', { name: 'Bạn đã thả: Thương' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('1 lời động viên')).toBeOnTheScreen()
    expect(screen.getByLabelText('0 bình luận')).toBeOnTheScreen()
    await press('Lưu bài viết')
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Bỏ lưu bài viết' }),
    )
    await waitFor(() =>
      expect(community.bookmark).toHaveBeenLastCalledWith(fixturePostId, false),
    )
    expect(community.react).toHaveBeenCalledWith(fixturePostId, 'SUPPORT')
    expect(community.detail).toHaveBeenCalledTimes(1)
    await press('Bạn đã thả: Thương')
    await waitFor(() =>
      expect(community.react).toHaveBeenLastCalledWith(fixturePostId, null),
    )
    expect(await screen.findByText('0 lời động viên')).toBeOnTheScreen()
  })
  it('sets a reaction from the tray on the feed card and the feed cache keeps the count', async () => {
    const community = api()
    await mount(community)
    await screen.findByText(fixturePost.content)
    await fireEvent(
      screen.getByRole('button', { name: 'Thả cảm xúc' }),
      'longPress',
    )
    await press('Ôm')
    await waitFor(() =>
      expect(community.react).toHaveBeenCalledWith(fixturePostId, 'RELATE'),
    )
    expect(
      await screen.findByRole('button', { name: 'Bạn đã thả: Ôm' }),
    ).toBeOnTheScreen()
    expect(await screen.findByText('1')).toBeOnTheScreen()
    await press('Bạn đã thả: Ôm')
    await waitFor(() =>
      expect(community.react).toHaveBeenLastCalledWith(fixturePostId, null),
    )
    expect(
      await screen.findByRole('button', { name: 'Thả cảm xúc' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('1')).toBeNull()
    expect(community.feed).toHaveBeenCalledTimes(1)
  })
  it('rolls the feed reaction back and says so when the command fails', async () => {
    const community = api({ react: jest.fn().mockRejectedValue(unavailable()) })
    await mount(community)
    await screen.findByText(fixturePost.content)
    await press('Thả cảm xúc')
    expect(
      await screen.findByText(/Chưa thể xác nhận yêu cầu lúc này/),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Thả cảm xúc' }),
    ).toBeOnTheScreen()
  })
  it('sets the heart on a double tap of the feed media and bookmarks from the card', async () => {
    const item = {
      mediaId: fixturePostId,
      type: 'IMAGE' as const,
      url: 'https://cdn.example.test/a.jpg',
      width: null,
      height: null,
      durationSeconds: null,
      altText: null,
    }
    const community = api({
      feed: jest
        .fn()
        .mockResolvedValue(
          page([
            { ...fixtureSummary, media: [item], mediaAvailability: 'READY' },
          ]),
        ),
    })
    await mount(community)
    await screen.findByText(fixturePost.content)
    const media = screen.getByTestId('community-post-media')
    await fireEvent.press(media)
    expect(community.react).not.toHaveBeenCalled()
    await fireEvent.press(media)
    await waitFor(() =>
      expect(community.react).toHaveBeenCalledWith(fixturePostId, 'SUPPORT'),
    )
    await fireEvent.press(media)
    await fireEvent.press(media)
    expect(community.react).toHaveBeenCalledTimes(1)
    await press('Lưu bài viết')
    await waitFor(() =>
      expect(community.bookmark).toHaveBeenCalledWith(fixturePostId, true),
    )
    expect(
      await screen.findByRole('button', { name: 'Bỏ lưu bài viết' }),
    ).toBeOnTheScreen()
  })
  it('opens the feed overflow sheet with safety rows, or owner rows when the post has an ETag', async () => {
    const community = api({
      detail: jest.fn().mockResolvedValue({ post: fixturePost, etag: '"2"' }),
    })
    await mount(community)
    await screen.findByText(fixturePost.content)
    await press('An toàn cho bài viết')
    expect(
      await screen.findByRole('button', { name: 'Sửa bài viết của tôi' }),
    ).toBeOnTheScreen()
    expect(community.detail).toHaveBeenCalledWith(fixturePostId)
    await fireEvent.press(screen.getByTestId('community-bottom-sheet-scrim'))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Sửa bài viết của tôi' }),
      ).toBeNull(),
    )
  })
  it('shows the safety rows of another member from the feed overflow sheet', async () => {
    const mounted = await mount(api())
    await screen.findByText(fixturePost.content)
    await press('An toàn cho bài viết')
    expect(
      await screen.findByRole('button', { name: 'Báo cáo bài viết' }),
    ).toBeOnTheScreen()
    await press('Trò chuyện với tác giả')
    expect(mounted.props.onPeerChat).toHaveBeenCalledWith(
      fixturePost.author.communityProfileId,
    )
  })
  it('sends comments and only one-level replies without an actor or health payload', async () => {
    const root: CommunityComment = {
      commentId: '44444444-4444-4444-8444-444444444444',
      postId: fixturePostId,
      parentCommentId: null,
      author: fixturePost.author,
      content: 'Lời chia sẻ',
      state: 'ACTIVE',
      version: 0,
      createdAt: fixtureDate,
      updatedAt: fixtureDate,
    }
    const community = api({
      comments: jest.fn().mockResolvedValue({
        items: [
          root,
          {
            ...root,
            commentId: '55555555-5555-4555-8555-555555555555',
            parentCommentId: root.commentId,
            content: 'Trả lời cũ',
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    })
    await mount(community)
    await openPost()
    await screen.findByText('Lời chia sẻ')
    await press('Trả lời Bạn cùng cộng đồng')
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung bình luận'),
      'Cảm ơn chia sẻ',
    )
    await press('Gửi trả lời')
    await waitFor(() =>
      expect(community.comment).toHaveBeenCalledWith(
        fixturePostId,
        'Cảm ơn chia sẻ',
        root.commentId,
        expect.any(String),
      ),
    )
    expect(
      screen.getAllByRole('button', { name: 'Trả lời Bạn cùng cộng đồng' }),
    ).toHaveLength(1)
  })
  describe('comment reactions', () => {
    const commentId = '44444444-4444-4444-8444-444444444444'
    const comment: CommunityComment = {
      commentId,
      postId: fixturePostId,
      parentCommentId: null,
      author: fixturePost.author,
      content: 'Lời chia sẻ',
      state: 'ACTIVE',
      version: 0,
      createdAt: fixtureDate,
      updatedAt: fixtureDate,
    }
    const withComments = (items: CommunityComment[]) =>
      jest.fn().mockResolvedValue({ items, nextCursor: null, hasMore: false })
    const label = 'Thả cảm xúc cho bình luận của Bạn cùng cộng đồng'
    it('loads each visible comment reaction, then sets and clears it with the count beside Trả lời', async () => {
      const community = api({ comments: withComments([comment]) })
      await mount(community)
      await openPost()
      await screen.findByText('Lời chia sẻ')
      // The control mounts only after its own reaction query resolves.
      await fireEvent.press(await screen.findByRole('button', { name: label }))
      expect(
        await screen.findByRole('button', {
          name: 'Bạn đã thả: Thương cho bình luận của Bạn cùng cộng đồng',
        }),
      ).toBeOnTheScreen()
      await waitFor(() =>
        expect(community.setCommentReaction).toHaveBeenCalledWith(
          commentId,
          'SUPPORT',
        ),
      )
      expect(await screen.findByLabelText('1 cảm xúc')).toBeOnTheScreen()
      await press('Bạn đã thả: Thương cho bình luận của Bạn cùng cộng đồng')
      await waitFor(() =>
        expect(community.clearCommentReaction).toHaveBeenCalledWith(commentId),
      )
      expect(
        await screen.findByRole('button', { name: label }),
      ).toBeOnTheScreen()
      expect(screen.queryByLabelText('1 cảm xúc')).toBeNull()
    })
    it('rolls the comment reaction back when the command fails', async () => {
      const community = api({
        comments: withComments([comment]),
        setCommentReaction: jest.fn().mockRejectedValue(unavailable()),
      })
      await mount(community)
      await openPost()
      await screen.findByText('Lời chia sẻ')
      // The control mounts only after its own reaction query resolves.
      await fireEvent.press(await screen.findByRole('button', { name: label }))
      expect(
        await screen.findByText(/Chưa thể xác nhận yêu cầu lúc này/),
      ).toBeOnTheScreen()
      expect(
        await screen.findByRole('button', { name: label }),
      ).toBeOnTheScreen()
    })
    it('retries a transient reaction read failure and then shows the control', async () => {
      const community = api({
        comments: withComments([comment]),
        commentReaction: jest
          .fn()
          .mockRejectedValueOnce(unavailable())
          .mockResolvedValue({ commentId, reaction: null, reactionCount: 0 }),
      })
      await mount(community)
      await openPost()
      await screen.findByText('Lời chia sẻ')
      expect(
        await screen.findByRole('button', { name: label }, { timeout: 3000 }),
      ).toBeOnTheScreen()
      expect(community.commentReaction).toHaveBeenCalledTimes(2)
    })
    it('hides the control, without an error state or a retry, when the comment is unavailable, and for hidden comments', async () => {
      const hidden: CommunityComment = {
        ...comment,
        commentId: '55555555-5555-4555-8555-555555555555',
        state: 'MODERATION_HIDDEN',
      }
      const community = api({
        comments: withComments([comment, hidden]),
        commentReaction: jest
          .fn()
          .mockRejectedValue(
            new ApiError({ code: 'NOT_FOUND', message: 'gone', status: 404 }),
          ),
      })
      await mount(community)
      await openPost()
      await screen.findByText('Lời chia sẻ')
      await waitFor(() => expect(community.commentReaction).toHaveBeenCalled())
      expect(community.commentReaction).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('button', { name: label })).toBeNull()
      expect(screen.queryByText(/Chưa thể xác nhận yêu cầu lúc này/)).toBeNull()
      expect(
        screen.getByText('Bình luận này không còn hiển thị.'),
      ).toBeOnTheScreen()
    })
  })
  it('inserts quick emoji into the comment and shows the identity note only on anonymous posts', async () => {
    const anonymous: VersionedPost = {
      etag: null,
      post: {
        ...fixturePost,
        author: {
          communityProfileId: null,
          avatarPreset: null,
          displayName: 'Ẩn danh',
          state: 'ANONYMOUS',
        },
      },
    }
    const note = /Bình luận hiển thị tên cộng đồng của bạn/
    await mount(api({ detail: jest.fn().mockResolvedValue(anonymous) }))
    await openPost()
    expect(screen.getByText(note)).toBeOnTheScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung bình luận'),
      'Cố lên',
    )
    await press('Chèn 🥰')
    await press('Chèn 🤗')
    expect(screen.getByLabelText('Nội dung bình luận').props.value).toBe(
      'Cố lên🥰🤗',
    )
    expect(screen.queryByRole('button', { name: 'Chèn 👏' })).toBeNull()
  })
  it('does not show the identity note on a named post', async () => {
    await mount(api())
    await openPost()
    expect(
      screen.queryByText(/Bình luận hiển thị tên cộng đồng của bạn/),
    ).toBeNull()
  })
  it('acknowledges report intake, then block removes the authoritative peer content', async () => {
    let blocked = false
    const community = api({
      feed: jest.fn(async () => (blocked ? page([]) : page())),
      block: jest.fn(async () => {
        blocked = true
      }),
    })
    await mount(community)
    await openPost()
    await press('An toàn cho bài viết')
    await press('Báo cáo bài viết')
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Spam hoặc quảng cáo' }),
    )
    await press('Gửi báo cáo')
    expect(
      await screen.findByText(
        /Báo cáo đã được gửi để đội ngũ quản trị xem xét/,
      ),
    ).toBeOnTheScreen()
    expect(community.report).toHaveBeenCalledWith(
      {
        targetType: 'POST',
        targetId: fixturePostId,
        reason: 'SPAM',
        details: null,
      },
      expect.any(String),
    )
    await press('Chặn tác giả')
    expect(community.block).not.toHaveBeenCalled()
    await press('Xác nhận chặn tác giả')
    expect(
      await screen.findByText('Chưa có chia sẻ hiển thị cho chủ đề này.'),
    ).toBeOnTheScreen()
    expect(screen.queryByText(fixturePost.content)).not.toBeOnTheScreen()
    expect(community.block).toHaveBeenCalledWith(
      fixtureProfile.profile.communityProfileId,
    )
  })

  it('closes stale content when report intake confirms the target is no longer visible', async () => {
    const community = api({
      feed: jest.fn().mockResolvedValueOnce(page()).mockResolvedValue(page([])),
      report: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'NOT_FOUND',
          message: 'not visible',
          status: 404,
        }),
      ),
    })
    await mount(community)
    await openPost()
    await press('An toàn cho bài viết')
    await press('Báo cáo bài viết')
    await press('Gửi báo cáo')
    await screen.findByText('Chưa có chia sẻ hiển thị cho chủ đề này.')
    expect(screen.queryByText(fixturePost.content)).not.toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: 'Gửi bình luận' }),
    ).not.toBeOnTheScreen()
  })

  it('does not initialize profile drafts from a cached identity before the fresh owner GET completes', async () => {
    let complete: ((value: typeof fixtureProfile) => void) | undefined
    const community = api({
      profile: jest.fn(
        () =>
          new Promise<typeof fixtureProfile>((resolve) => {
            complete = resolve
          }),
      ),
    })
    const mounted = await mount(community)
    await screen.findByText(fixturePost.content)
    mounted.client.setQueryData(
      ['community', mockSession?.subject, 'profile'],
      fixtureProfile,
    )
    await openProfile()
    await screen.findByRole('progressbar', { name: 'Đang tải danh tính…' })
    expect(
      screen.queryByLabelText('Tên hiển thị cộng đồng'),
    ).not.toBeOnTheScreen()
    complete?.({
      etag: '"1"',
      profile: {
        ...fixtureProfile.profile,
        displayName: 'Danh tính mới từ máy chủ',
        version: 1,
      },
    })
    await screen.findByLabelText('Tên hiển thị cộng đồng')
    expect(screen.getByLabelText('Tên hiển thị cộng đồng').props.value).toBe(
      'Danh tính mới từ máy chủ',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị cộng đồng'),
      'Tên chỉnh sửa',
    )
    await press('Lưu danh tính cộng đồng')
    await waitFor(() =>
      expect(community.saveProfile).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Tên chỉnh sửa' }),
        '"1"',
      ),
    )
  })
  it('hides warned content until explicitly revealed and routes only the resource reference', async () => {
    const post = {
      ...fixturePost,
      sensitiveContentWarning: 'SENSITIVE_CONTENT' as const,
      resourceAttachment: { resourceId: fixturePostId },
    }
    const mounted = await mount(
      api({
        feed: jest.fn().mockResolvedValue(
          page([
            {
              ...fixtureSummary,
              sensitiveContentWarning: 'SENSITIVE_CONTENT',
            },
          ]),
        ),
        detail: jest.fn().mockResolvedValue({ post, etag: null }),
      }),
    )
    await screen.findByText(/Nội dung có cảnh báo nhạy cảm/)
    expect(screen.queryByText(fixturePost.content)).not.toBeOnTheScreen()
    await press('Mở bài viết')
    await screen.findByRole('button', { name: 'Xem nội dung nhạy cảm' })
    expect(screen.queryByText(fixturePost.content)).not.toBeOnTheScreen()
    await press('Xem nội dung nhạy cảm')
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
    await press('Mở tài nguyên tham khảo')
    expect(mounted.props.onResource).toHaveBeenCalledWith(fixturePostId)
  })
  it.each([401, 403, 404, 503])(
    'fails closed on a fresh detail failure %i, including cached content',
    async (status) => {
      const detail = jest
        .fn()
        .mockResolvedValueOnce({ post: fixturePost, etag: null })
        .mockRejectedValue(
          new ApiError({ code: 'UNAVAILABLE', message: 'no body', status }),
        )
      await mount(api({ detail }))
      await openPost()
      await press('Quay lại danh sách')
      await screen.findByRole('button', { name: openCard })
      await press(openCard)
      await screen.findByRole('button', { name: 'Tải lại bài viết' })
      expect(screen.queryByText(fixturePost.content)).not.toBeOnTheScreen()
      expect(
        screen.queryByRole('button', { name: 'Gửi bình luận' }),
      ).not.toBeOnTheScreen()
    },
  )
  it('clears in-memory drafts and display identity when the authenticated subject changes', async () => {
    const mounted = await mount(api())
    await screen.findByText(fixturePost.content)
    await draft()
    mockSession = {
      subject: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'USER',
    }
    await mounted.rerender(mounted.tree())
    await screen.findByText(fixturePost.content)
    await press('Viết chia sẻ')
    expect(screen.getByLabelText('Nội dung chia sẻ').props.value).toBe('')
    expect(screen.getByRole('button', { name: 'Đăng chia sẻ' })).toBeDisabled()
  })
  it('loads Community display identity and saves exactly the owner profile ETag', async () => {
    const community = api()
    await mount(community)
    await screen.findByText(fixturePost.content)
    await openProfile()
    await screen.findByLabelText('Tên hiển thị cộng đồng')
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị cộng đồng'),
      'Tên mới',
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Mây' }))
    await press('Lưu danh tính cộng đồng')
    await waitFor(() =>
      expect(community.saveProfile).toHaveBeenCalledWith(
        { displayName: 'Tên mới', avatarPreset: 'CLOUD' },
        '"0"',
      ),
    )
  })
  it('exposes only the existing explicit help-now lookup, with truthful unavailable guidance', async () => {
    const mounted = await mount(api())
    await screen.findByText(fixturePost.content)
    await openHelp()
    await press('Tôi cần hỗ trợ ngay')
    jest.mocked(mounted.props.safety.lookupSafetyDirectory).mockResolvedValue({
      trigger: 'HELP_NOW',
      state: 'UNAVAILABLE',
      areaWording: 'Cơ sở trong khu vực đã chọn',
      entries: [],
      safetyGuidance: 'Hướng dẫn từ Care',
      limitation: 'Danh bạ chưa sẵn sàng',
    })
    await fireEvent.changeText(
      screen.getByLabelText('Khu vực cần tìm hỗ trợ'),
      'Thành phố Hồ Chí Minh',
    )
    await press('Tìm hỗ trợ đã rà soát')
    expect(await screen.findByText('Hướng dẫn từ Care')).toBeOnTheScreen()
    expect(mounted.props.safety.lookupSafetyDirectory).toHaveBeenCalledWith(
      'HELP_NOW',
      'Thành phố Hồ Chí Minh',
    )
  })
  it('shows a skeleton while the feed loads, then the cards', async () => {
    let complete: ((value: CommunityPage) => void) | undefined
    await mount(
      api({
        feed: jest.fn(
          () =>
            new Promise<CommunityPage>((resolve) => {
              complete = resolve
            }),
        ),
      }),
    )
    expect(
      screen.getByRole('progressbar', {
        name: 'Đang tải các chia sẻ còn hiển thị…',
      }),
    ).toBeOnTheScreen()
    await act(async () => complete?.(page()))
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen()
  })
  it('shows a skeleton post with comment rows while the detail loads', async () => {
    await mount(
      api({
        detail: jest.fn(() => new Promise<VersionedPost>(() => undefined)),
      }),
      fixturePostId,
    )
    expect(
      screen.getByRole('progressbar', {
        name: 'Đang xác nhận bài viết còn hiển thị…',
      }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Quay lại danh sách' }),
    ).toBeOnTheScreen()
  })
  it.each([
    ['no filter', [], 'Viết chia sẻ đầu tiên'],
    ['a topic filter', ['SMALL_MILESTONE'], 'Xem tất cả chủ đề'],
  ] as const)(
    'shows one empty state with a single next step for %s',
    async (_name, selected, action) => {
      await mount(api({ feed: jest.fn().mockResolvedValue(page([])) }))
      if (selected.length)
        await fireEvent.press(
          await screen.findByRole('button', { name: 'Bước nhỏ' }),
        )
      expect(
        await screen.findByText('Chưa có chia sẻ hiển thị cho chủ đề này.'),
      ).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: action })).toBeOnTheScreen()
    },
  )
  it('shows the retryable feed error card and recovers on retry', async () => {
    const feedFn = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue(page())
    await mount(api({ feed: feedFn }))
    expect(
      await screen.findByText('Bảng tin cộng đồng tạm thời chưa tải được.'),
    ).toBeOnTheScreen()
    await press('Thử lại')
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
  })
  it('shows the offline banner above cached content and hides it when back online', async () => {
    await mount(api())
    await screen.findByText(fixturePost.content)
    const banner = 'Bạn đang ngoại tuyến. Nội dung sẽ cập nhật khi có mạng lại.'
    expect(screen.queryByText(banner)).not.toBeOnTheScreen()
    await act(async () => onlineManager.setOnline(false))
    expect(screen.getByText(banner)).toBeOnTheScreen()
    await act(async () => onlineManager.setOnline(true))
    expect(screen.queryByText(banner)).not.toBeOnTheScreen()
  })
  it('opens the post as one control labelled with the author and exposes the counts as a hint', async () => {
    await mount(api())
    await screen.findByText(fixturePost.content)
    const card = screen.getByTestId(`community-open-${fixturePostId}`)
    expect(card.props.accessibilityLabel).toBe(
      'Mở chia sẻ của Bạn cùng cộng đồng',
    )
    expect(card.props.accessibilityHint).toBe('0 bình luận, 0 lời động viên')
  })
  it('shows the composer with identity rows, counter, topic chips and a sticky save button', async () => {
    await mount(api())
    await screen.findByText(fixturePost.content)
    await press('Viết chia sẻ')
    expect(
      screen.getByRole('header', { name: 'Viết chia sẻ' }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('radio', { name: 'Bạn cùng cộng đồng' }),
    ).toBeChecked()
    await fireEvent.press(screen.getByRole('radio', { name: 'Ẩn danh' }))
    expect(screen.getByRole('radio', { name: 'Ẩn danh' })).toBeChecked()
    expect(screen.getByText('0 / 5.000')).toBeOnTheScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung chia sẻ'),
      'Một chia sẻ',
    )
    expect(screen.getByText('11 / 5.000')).toBeOnTheScreen()
    expect(
      screen.getByText('Chọn ít nhất một chủ đề cho bài viết.'),
    ).toBeOnTheScreen()
    await screen.findByRole('button', { name: 'Bước nhỏ' })
    expect(screen.getByTestId('community-post-save')).toBeDisabled()
  })
  it('shows topic skeletons then an empty-topics line in the composer', async () => {
    await mount(api({ topics: jest.fn().mockResolvedValue([]) }))
    await screen.findByText(fixturePost.content)
    await press('Viết chia sẻ')
    await screen.findByText(
      'Chủ đề đang được cập nhật. Bạn có thể quay lại đăng bài sau.',
    )
    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen()
  })
  it('disables publishing offline and says why', async () => {
    await mount(api())
    await screen.findByText(fixturePost.content)
    await draft()
    expect(screen.getByTestId('community-post-save')).toBeEnabled()
    await act(async () => onlineManager.setOnline(false))
    expect(screen.getByTestId('community-post-save')).toBeDisabled()
    expect(
      screen.getByText(
        'Bạn đang ngoại tuyến. Hãy kết nối mạng để đăng chia sẻ.',
      ),
    ).toBeOnTheScreen()
    await act(async () => onlineManager.setOnline(true))
  })
  it('keeps the draft behind a confirm step in the sticky footer', async () => {
    const mounted = await mount(api())
    await screen.findByText(fixturePost.content)
    await draft()
    await press('Quay lại cộng đồng')
    await press('Tiếp tục chỉnh sửa')
    expect(screen.getByLabelText('Nội dung chia sẻ').props.value).toBe(
      'Một chia sẻ của tôi',
    )
    await press('Quay lại cộng đồng')
    await press('Bỏ bản nháp')
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
    expect(mounted.props.api.create).not.toHaveBeenCalled()
  })
  it('previews the first media of a feed card with the remaining count', async () => {
    const item = (mediaId: string) => ({
      mediaId,
      type: 'IMAGE' as const,
      url: 'https://cdn.example.test/' + mediaId + '.jpg',
      width: null,
      height: null,
      durationSeconds: null,
      altText: null,
    })
    await mount(
      api({
        feed: jest.fn().mockResolvedValue(
          page([
            {
              ...fixtureSummary,
              media: [item(fixturePostId), item(fixtureProfileId)],
              mediaAvailability: 'READY',
            },
          ]),
        ),
      }),
    )
    await screen.findByText(fixturePost.content)
    expect(screen.getByLabelText('Ảnh được chia sẻ')).toBeOnTheScreen()
    expect(screen.getByText('+1')).toBeOnTheScreen()
  })
  it('shows a skeleton then the preset grid with the saved avatar as a live preview', async () => {
    await mount(api())
    await screen.findByText(fixturePost.content)
    await openProfile()
    await screen.findByLabelText('Tên hiển thị cộng đồng')
    expect(screen.getByRole('radio', { name: 'Lá' })).toBeChecked()
    expect(
      screen.getAllByTestId('community-avatar-preset', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(7)
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Không dùng biểu tượng' }),
    )
    expect(
      screen.getByRole('radio', { name: 'Không dùng biểu tượng' }),
    ).toBeChecked()
    expect(
      screen.getAllByTestId('community-avatar-initial', {
        includeHiddenElements: true,
      }).length,
    ).toBeGreaterThan(1)
  })
  it('shows the help panel with a header, the intro card and the Care lookup', async () => {
    await mount(api())
    await screen.findByText(fixturePost.content)
    await openHelp()
    expect(
      screen.getByRole('header', { name: 'Hỗ trợ ngay' }),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/MentalBridge không tự động gọi, điều phối/),
    ).toBeOnTheScreen()
    await press('Quay lại cộng đồng')
    expect(await screen.findByText(fixturePost.content)).toBeOnTheScreen()
  })
})

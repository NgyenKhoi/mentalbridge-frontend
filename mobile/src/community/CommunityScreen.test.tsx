import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
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
  }
}
async function mount(community: CommunityApi) {
  const props = dependencies(community)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  const tree = () => (
    <QueryClientProvider client={client}>
      <CommunityScreen {...props} />
    </QueryClientProvider>
  )
  const rendered = await render(tree())
  return { ...rendered, props, client, tree }
}
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }))
async function openPost() {
  await screen.findByText(fixturePost.content)
  await press('Mở chia sẻ')
  await screen.findByRole('header', { name: 'Chia sẻ trong cộng đồng' })
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
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession = {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    }
  })
  it('paginates governed feed filters and the owner-private saved collection', async () => {
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
    await press('Tải thêm chia sẻ')
    expect(await screen.findByText('Trang tiếp theo')).toBeOnTheScreen()
    expect(community.feed).toHaveBeenCalledWith([], 'opaque-next')
    await press('Bước nhỏ')
    expect(
      await screen.findByText('Chưa có chia sẻ hiển thị cho chủ đề này.'),
    ).toBeOnTheScreen()
    expect(community.feed).toHaveBeenCalledWith(['SMALL_MILESTONE'], undefined)
    await press('Bài đã lưu')
    expect(
      await screen.findByText('Chưa có bài đã lưu còn hiển thị với bạn.'),
    ).toBeOnTheScreen()
    expect(community.saved).toHaveBeenCalledWith(undefined)
  })
  it('creates an explicit anonymous post then edits/deletes only with the owner ETag', async () => {
    const community = api({
      detail: jest.fn().mockResolvedValue({ post: fixturePost, etag: '"4"' }),
    })
    await mount(community)
    await screen.findByText(fixturePost.content)
    await draft()
    await press('Ẩn danh')
    await press('Đăng chia sẻ')
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
    await screen.findByRole('button', { name: 'Xóa bài viết của tôi' })
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
  it('renders authoritative reactions/bookmarks and refreshes after explicit commands', async () => {
    let post = { ...fixturePost }
    const react = jest.fn(async (_id, reaction) => {
      post = {
        ...post,
        counts: { ...post.counts, reactions: reaction ? 1 : 0 },
        viewerState: { ...post.viewerState, reaction },
      }
    })
    const bookmark = jest.fn(async (_id, saved) => {
      post = {
        ...post,
        viewerState: { ...post.viewerState, bookmarked: saved },
      }
    })
    const community = api({
      detail: jest.fn(async () => ({ post, etag: null })),
      react,
      bookmark,
    })
    await mount(community)
    await openPost()
    await press('Mình ở đây')
    expect(
      await screen.findByText('0 bình luận · 1 lời động viên'),
    ).toBeOnTheScreen()
    await press('Lưu bài viết')
    await screen.findByRole('button', { name: 'Bỏ lưu bài viết' })
    await press('Bỏ lưu bài viết')
    await waitFor(() =>
      expect(bookmark).toHaveBeenLastCalledWith(fixturePostId, false),
    )
    expect(react).toHaveBeenCalledWith(fixturePostId, 'SUPPORT')
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
    await press('Spam hoặc quảng cáo')
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
      report: jest
        .fn()
        .mockRejectedValue(
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
    await press('Danh tính cộng đồng')
    await screen.findByText('Đang tải danh tính…')
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
    await press('Mở chia sẻ')
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
      await screen.findByRole('button', { name: 'Mở chia sẻ' })
      await press('Mở chia sẻ')
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
    await press('Danh tính cộng đồng')
    await screen.findByLabelText('Tên hiển thị cộng đồng')
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị cộng đồng'),
      'Tên mới',
    )
    await press('Mây')
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
    await press('Cần hỗ trợ ngay')
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
})

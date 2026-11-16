import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { BackHandler } from 'react-native'

import type { AssessmentApi } from '@/assessment/assessment-api'
import type { AppSession } from '@/auth/session'
import type { ResourceApi } from '@/resources/resource-api'

import type { CommunityApi } from './community-api'
import type {
  CommunityMedia,
  CommunityPage,
  CommunitySummary,
} from './community-contract'
import {
  fixtureProfile,
  fixtureSummary,
  fixtureTopics,
} from './community-fixtures'
import { isMoment, momentsOf } from './community-moments'
import { CommunityNavContext } from './community-nav'
import { CommunityMePanel } from './CommunityMePanel'
import { CommunityScreen } from './CommunityScreen'

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    } satisfies AppSession,
    signOut: jest.fn(),
  }),
}))
// One shared fake player: tests read what the viewer sets on it and fire its events.
const mockListeners: Record<string, (payload: unknown) => void> = {}
const mockPlayer = {
  loop: false,
  muted: false,
  timeUpdateEventInterval: 0,
  duration: 10,
  play: jest.fn(),
  pause: jest.fn(),
  addListener: jest.fn((event: string, handler: (payload: unknown) => void) => {
    mockListeners[event] = handler
    return { remove: jest.fn() }
  }),
}
jest.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, setup?: (player: unknown) => void) => {
    setup?.(mockPlayer)
    return mockPlayer
  },
  VideoView: 'VideoView',
}))

const media = (type: CommunityMedia['type'], id: string): CommunityMedia => ({
  mediaId: id,
  type,
  url: `https://cdn.example.test/${id}`,
  width: null,
  height: null,
  durationSeconds: null,
  altText: null,
})
const post = (
  id: string,
  name: string,
  extra: Partial<CommunitySummary> = {},
): CommunitySummary => ({
  ...fixtureSummary,
  postId: id,
  author: { ...fixtureSummary.author, displayName: name },
  contentPreview: `Nội dung của ${name}`,
  ...extra,
})
const videoA = post('post-a', 'An', {
  media: [media('VIDEO', 'va')],
  mediaAvailability: 'READY',
  counts: { comments: 3, reactions: 5 },
})
const videoC = post('post-c', 'Cúc', {
  media: [media('IMAGE', 'ic'), media('VIDEO', 'vc')],
  mediaAvailability: 'READY',
  counts: { comments: 7, reactions: 1 },
})
const warned = post('post-w', 'Vy', {
  media: [media('VIDEO', 'vw')],
  mediaAvailability: 'READY',
  sensitiveContentWarning: 'SENSITIVE_CONTENT',
})
const textOnly = post('post-t', 'Bình')
const imageOnly = post('post-i', 'Dung', {
  media: [media('IMAGE', 'ii')],
  mediaAvailability: 'READY',
})

const page = (
  items: CommunitySummary[],
  cursor: string | null = null,
): CommunityPage => ({ items, nextCursor: cursor, hasMore: cursor !== null })
function api(overrides: Partial<CommunityApi> = {}): CommunityApi {
  return {
    feed: jest.fn().mockResolvedValue(page([videoA, textOnly, videoC, warned])),
    saved: jest.fn().mockResolvedValue(page([])),
    topics: jest.fn().mockResolvedValue(fixtureTopics),
    detail: jest.fn().mockResolvedValue({ post: fixtureSummary, etag: null }),
    profile: jest.fn().mockResolvedValue(fixtureProfile),
    comments: jest
      .fn()
      .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    commentReaction: jest.fn(async (commentId: string) => ({
      commentId,
      reaction: null,
      reactionCount: 0,
    })),
    react: jest.fn().mockResolvedValue(undefined),
    bookmark: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CommunityApi
}
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
async function mount(community: CommunityApi) {
  const props = {
    api: community,
    resources: {} as ResourceApi,
    safety: { lookupSafetyDirectory: jest.fn() } as unknown as AssessmentApi,
    media: { pick: jest.fn(), upload: jest.fn() },
    onBack: jest.fn(),
    onResource: jest.fn(),
    onChat: jest.fn(),
  }
  await render(
    <QueryClientProvider client={client()}>
      <CommunityScreen {...props} />
    </QueryClientProvider>,
  )
  return props
}
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }))
const openMoment = (name: string) => press(`Mở khoảnh khắc của ${name}`)

describe('moments source', () => {
  it('keeps posts with a video and no sensitive warning', () => {
    expect(isMoment(videoA)).toBe(true)
    expect(isMoment(warned)).toBe(false)
    expect(isMoment(textOnly)).toBe(false)
    expect(isMoment(imageOnly)).toBe(false)
    expect(
      momentsOf([videoA, textOnly, videoC, warned, imageOnly]).map(
        (item) => item.postId,
      ),
    ).toEqual(['post-a', 'post-c'])
  })
})

describe('moments strip and viewer', () => {
  beforeEach(() => {
    mockPlayer.muted = false
    mockPlayer.play.mockClear()
    mockPlayer.pause.mockClear()
  })
  it('lists a tile per moment next to "Tạo" and never loads the feed twice for it', async () => {
    const props = await mount(api())
    await screen.findByText(textOnly.contentPreview)
    expect(
      screen.getByRole('button', { name: 'Tạo khoảnh khắc mới' }),
    ).toBeOnTheScreen()
    expect(openMomentCount()).toBe(2)
    expect(screen.queryByLabelText('Mở khoảnh khắc của Vy')).toBeNull()
    expect(props.api.feed).toHaveBeenCalledTimes(1)
  })
  it('opens the viewer at the tapped tile, closes it and keeps the feed', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await openMoment('Cúc')
    expect(screen.getByText('2 / 2')).toBeOnTheScreen()
    expect(screen.getByText(videoC.contentPreview)).toBeOnTheScreen()
    expect(screen.getByLabelText('Tạm dừng video')).toBeOnTheScreen()
    await press('Đóng khoảnh khắc')
    expect(screen.queryByText('2 / 2')).toBeNull()
    expect(screen.getByText(textOnly.contentPreview)).toBeOnTheScreen()
  })
  it('closes on Android back', async () => {
    const listen = jest.spyOn(BackHandler, 'addEventListener')
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await openMoment('An')
    const handler = listen.mock.calls.at(-1)?.[1] as () => boolean
    await act(async () => expect(handler()).toBe(true))
    expect(screen.queryByText('1 / 2')).toBeNull()
  })
  it('starts muted and toggles sound with the selected state', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await openMoment('An')
    expect(mockPlayer.muted).toBe(true)
    await press('Bật âm thanh')
    expect(mockPlayer.muted).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Tắt âm thanh' }).props
        .accessibilityState,
    ).toEqual({ selected: true })
  })
  it('pauses and resumes on a tap of the video', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await openMoment('An')
    await fireEvent.press(screen.getByLabelText('Tạm dừng video'))
    expect(mockPlayer.pause).toHaveBeenCalled()
    await fireEvent.press(screen.getByLabelText('Phát video'))
    expect(mockPlayer.play.mock.calls.length).toBeGreaterThan(1)
  })
  it('opens the post detail from the comment button', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await openMoment('Cúc')
    await press('7 bình luận')
    expect(
      await screen.findByRole('header', { name: 'Bài viết' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('2 / 2')).toBeNull()
  })
  it('reacts and saves through the shared post commands', async () => {
    const community = api()
    await mount(community)
    await screen.findByText(textOnly.contentPreview)
    await openMoment('An')
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Thả cảm xúc' })[0]!,
    )
    await waitFor(() =>
      expect(community.react).toHaveBeenCalledWith('post-a', 'SUPPORT'),
    )
    await press('Lưu bài viết')
    await waitFor(() =>
      expect(community.bookmark).toHaveBeenCalledWith('post-a', true),
    )
  })
  it('shows a retryable error tile when the video fails to play', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await openMoment('An')
    await act(async () => mockListeners.statusChange?.({ status: 'error' }))
    expect(screen.getByText('Chưa phát được video này.')).toBeOnTheScreen()
    await press('Thử lại')
    expect(screen.queryByText('Chưa phát được video này.')).toBeNull()
    expect(screen.getByLabelText('Tạm dừng video')).toBeOnTheScreen()
  })
  it('hints that a video post becomes a moment, unless it carries a warning', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await press('Tạo khoảnh khắc mới')
    expect(
      screen.getByText('Bài có video sẽ xuất hiện trong Khoảnh khắc.'),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('switch', { name: 'Cảnh báo nội dung nhạy cảm' }),
    )
    expect(
      screen.queryByText('Bài có video sẽ xuất hiện trong Khoảnh khắc.'),
    ).toBeNull()
  })
  it('lists the moments on its own tab and opens the viewer from a tile', async () => {
    await mount(api())
    await screen.findByText(textOnly.contentPreview)
    await fireEvent.press(screen.getByRole('tab', { name: 'Khoảnh khắc' }))
    expect(
      screen.getByRole('header', { name: 'Khoảnh khắc' }),
    ).toBeOnTheScreen()
    await openMoment('An')
    expect(screen.getByText('1 / 2')).toBeOnTheScreen()
  })
  it('shows the empty state with a create action when the feed has no video', async () => {
    await mount(api({ feed: jest.fn().mockResolvedValue(page([textOnly])) }))
    await screen.findByText(textOnly.contentPreview)
    await fireEvent.press(screen.getByRole('tab', { name: 'Khoảnh khắc' }))
    expect(screen.getByText('Chưa có khoảnh khắc nào')).toBeOnTheScreen()
    expect(
      screen.getByText('Đăng một video ngắn để chia sẻ khoảnh khắc của bạn.'),
    ).toBeOnTheScreen()
    await press('Tạo khoảnh khắc')
    expect(
      screen.getByRole('header', { name: 'Viết chia sẻ' }),
    ).toBeOnTheScreen()
  })
  it('shows the retry card when the feed fails', async () => {
    const feed = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(page([videoA]))
    await mount(api({ feed }))
    await fireEvent.press(screen.getByRole('tab', { name: 'Khoảnh khắc' }))
    await press('Thử lại')
    await screen.findByLabelText('Mở khoảnh khắc của An')
  })
})
const openMomentCount = () =>
  screen.getAllByLabelText(/^Mở khoảnh khắc của/).length

async function mountMe(
  community: CommunityApi,
  nav: Parameters<typeof CommunityNavContext.Provider>[0]['value'] = {},
) {
  const props = {
    api: community,
    subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    own: {
      displayName: 'Mộc',
      avatarPreset: 'LEAF',
      state: 'ACTIVE' as const,
    },
    footer: null,
    onEditProfile: jest.fn(),
    onHelp: jest.fn(),
    onOpenPost: jest.fn(),
  }
  const view = await render(
    <QueryClientProvider client={client()}>
      <CommunityNavContext.Provider value={nav}>
        <CommunityMePanel {...props} />
      </CommunityNavContext.Provider>
    </QueryClientProvider>,
  )
  return { props, ...view }
}

describe('Trang của tôi', () => {
  it('shows the identity, the edit and help actions and no friend or follower counts', async () => {
    const { props } = await mountMe(api())
    await screen.findByText('Bạn chưa lưu bài viết nào')
    expect(screen.getByText('Mộc')).toBeOnTheScreen()
    expect(
      screen.getAllByText('Danh tính cộng đồng, tách khỏi hồ sơ sức khỏe'),
    ).toHaveLength(1)
    await press('Sửa danh tính')
    expect(props.onEditProfile).toHaveBeenCalledTimes(1)
    await press('Hỗ trợ ngay')
    expect(props.onHelp).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/người theo dõi|bạn chung/i)).toBeNull()
  })
  it('hides Bạn bè and Nhóm without handlers', async () => {
    await mountMe(api())
    await screen.findByText('Bạn chưa lưu bài viết nào')
    expect(screen.queryByRole('button', { name: 'Bạn bè' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nhóm' })).toBeNull()
  })
  it('opens Bạn bè and Nhóm through the nav context', async () => {
    const openFriends = jest.fn()
    const openGroups = jest.fn()
    await mountMe(api(), { openFriends, openGroups })
    await screen.findByText('Bạn chưa lưu bài viết nào')
    await press('Bạn bè')
    await press('Nhóm')
    expect(openFriends).toHaveBeenCalledTimes(1)
    expect(openGroups).toHaveBeenCalledTimes(1)
  })
  it('keeps only the saved list: no own-posts tab, a "Bài đã lưu" heading', async () => {
    await mountMe(api())
    expect(
      await screen.findByRole('header', { name: 'Bài đã lưu' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Bài của tôi')).toBeNull()
  })
  it('shows a skeleton while the saved posts load', async () => {
    await mountMe(
      api({ saved: jest.fn(() => new Promise<CommunityPage>(() => {})) }),
    )
    expect(
      screen.getByRole('progressbar', { name: 'Đang tải bài đã lưu…' }),
    ).toBeOnTheScreen()
  })
  it('shows the empty state', async () => {
    await mountMe(api())
    expect(
      await screen.findByText('Bạn chưa lưu bài viết nào'),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Khi gặp một câu chuyện muốn đọc lại, hãy chọn lưu bài.',
      ),
    ).toBeOnTheScreen()
  })
  it('shows an error card and retries', async () => {
    const saved = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(page([textOnly]))
    await mountMe(api({ saved }))
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Thử lại' }),
    )
    expect(await screen.findByText('Nội dung của Bình')).toBeOnTheScreen()
    expect(saved).toHaveBeenCalledTimes(2)
  })
  it('renders text excerpts, thumbnails and a hidden warned post, each opening its detail', async () => {
    const { props } = await mountMe(
      api({
        saved: jest
          .fn()
          .mockResolvedValue(page([textOnly, imageOnly, videoA, warned])),
      }),
    )
    expect(await screen.findByText('Nội dung của Bình')).toBeOnTheScreen()
    expect(screen.getByLabelText('Ảnh được chia sẻ')).toBeOnTheScreen()
    expect(
      screen.getByTestId('icon-play-circle-outline', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Nội dung nhạy cảm')).toBeOnTheScreen()
    expect(screen.queryByText('Nội dung của Vy')).toBeNull()
    await fireEvent.press(screen.getByTestId('community-saved-post-t'))
    expect(props.onOpenPost).toHaveBeenCalledWith('post-t')
    await fireEvent.press(screen.getByTestId('community-saved-post-w'))
    expect(props.onOpenPost).toHaveBeenLastCalledWith('post-w')
  })
  it('labels each cell with its author and loads more on request', async () => {
    const saved = jest
      .fn()
      .mockResolvedValueOnce(page([textOnly], 'next'))
      .mockResolvedValueOnce(page([imageOnly]))
    await mountMe(api({ saved }))
    await screen.findByRole('button', { name: 'Mở chia sẻ của Bình' })
    await press('Xem thêm')
    expect(
      await screen.findByRole('button', { name: 'Mở chia sẻ của Dung' }),
    ).toBeOnTheScreen()
    expect(saved).toHaveBeenLastCalledWith('next')
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull()
  })
})

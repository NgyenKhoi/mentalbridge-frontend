import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { AssessmentApi } from '@/assessment/assessment-api'
import { HelpNowPanel } from '@/assessment/AssessmentJourneyScreen'
import { useSession } from '@/auth/session-context'
import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import type { ResourceApi } from '@/resources/resource-api'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import type { CommunityApi } from './community-api'
import type { CommunityTopicCode, VersionedPost } from './community-contract'
import type { CommunityMediaTransport } from './community-media'
import { momentsOf } from './community-moments'
import { usePostCommands } from './community-reaction-hooks'
import { communityColors } from './community-theme'
import { CommunityComposer } from './CommunityComposer'
import { CommunityDetail } from './CommunityDetail'
import { CommunityFeedPost } from './CommunityFeedPost'
import { CommunityMePanel } from './CommunityMePanel'
import { CommunityMomentsPanel } from './CommunityMomentsPanel'
import { CommunityMomentsStrip } from './CommunityMomentsStrip'
import { CommunityReelsViewer } from './CommunityReelsViewer'
import { CommunityPostMenu } from './CommunityPostMenu'
import { CommunityProfileEditor } from './CommunityProfileEditor'
import {
  Avatar,
  Band,
  Chip,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
  communityText,
  IconButton,
  OfflineBanner,
  Reveal,
  SkeletonGroup,
  SkeletonPost,
  StateCard,
  CommunityTabBar,
  type CommunityTab,
} from './community-ui'

type Props = Readonly<{
  initialPostId?: string
  initialPanel?: 'feed' | 'moments' | 'me' | 'composer'
  api: CommunityApi
  resources: ResourceApi
  safety: AssessmentApi
  media: CommunityMediaTransport
  onBack: () => void
  onResource: (id: string) => void
  /** Tin nhắn tab: the route replaces this screen with the chat inbox. */
  onChat?: () => void
  onPeerChat?: (id: string) => void
}>
type Panel =
  'feed' | 'moments' | 'me' | 'composer' | 'detail' | 'profile' | 'help'

/** Entrance only: no other motion on safety help. */
function HelpPanel({
  safety,
  onBack,
}: Readonly<{ safety: AssessmentApi; onBack: () => void }>) {
  return (
    <Screen
      layout="dashboard"
      backgroundColor={communityColors.background}
      header={
        <CommunityHeader
          padded
          title="Hỗ trợ ngay"
          backLabel="Quay lại cộng đồng"
          onBack={onBack}
        />
      }
    >
      <View style={styles.column}>
        <Reveal step={0} style={local.helpTitle}>
          <CommunityIcon name="lifebuoy" color={communityColors.terracotta} />
          <Txt style={[communityText.body, local.helpText]}>
            Bạn chủ động tìm thông tin. MentalBridge không tự động gọi, điều
            phối hoặc liên hệ bên thứ ba.
          </Txt>
        </Reveal>
        <Reveal step={1}>
          <HelpNowPanel api={safety} defaultTrigger="HELP_NOW" />
        </Reveal>
      </View>
    </Screen>
  )
}

function AccountCommunityScreen({
  initialPostId,
  initialPanel = 'feed',
  api,
  resources,
  safety,
  media,
  onBack,
  onResource,
  onChat,
  onPeerChat,
  subject,
}: Props & { subject: string }) {
  const client = useQueryClient()
  const [panel, setPanel] = useState<Panel>(
    initialPostId ? 'detail' : initialPanel,
  )
  const [topics, setTopics] = useState<CommunityTopicCode[]>([])
  const [postId, setPostId] = useState<string | null>(initialPostId ?? null)
  const [editing, setEditing] = useState<VersionedPost | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  // Where the post detail returns to: Trang của tôi when opened from its saved grid.
  const [origin, setOrigin] = useState<'feed' | 'me'>('feed')
  const [menu, setMenu] = useState<{ postId: string; open: boolean } | null>(
    null,
  )
  const browsing = panel === 'feed' || panel === 'moments' || panel === 'me'
  const topicQuery = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => api.topics(),
  })
  // Same key as the profile editor: its saves invalidate this avatar too.
  const profileQuery = useQuery({
    queryKey: ['community', subject, 'profile'],
    queryFn: () => api.profile(),
    enabled: browsing,
  })
  const query = useInfiniteQuery({
    queryKey: ['community', subject, 'feed', topics],
    enabled: browsing,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.feed(topics, pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    staleTime: 0,
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['community', subject] })
  }
  const commands = usePostCommands(api, subject, refresh)
  // Cards stagger in once; pagination and refetches do not replay the entrance.
  const [arrived, setArrived] = useState(false)
  const markArrived = useCallback(() => setArrived(true), [])
  useEffect(() => {
    if (panel === 'composer') return
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (panel === 'feed') return false
        setPanel(
          panel === 'profile' ? 'me' : panel === 'detail' ? origin : 'feed',
        )
        return true
      },
    )
    return () => subscription.remove()
  }, [panel, origin])
  const closeViewer = useCallback(() => setViewer(null), [])
  const openPost = (id: string, from: 'feed' | 'me' = 'feed') => {
    setViewer(null)
    setPostId(id)
    setNotice(null)
    setOrigin(from)
    setPanel('detail')
  }
  const feed = () => {
    setPanel('feed')
    setEditing(null)
  }
  const savedPost = async (value: VersionedPost) => {
    await refresh()
    setEditing(null)
    setPostId(value.post.postId)
    setPanel('detail')
    setNotice('Chia sẻ đã được lưu.')
  }
  const compose = () => {
    setEditing(null)
    setNotice(null)
    setPanel('composer')
  }
  const selectTab = (tab: CommunityTab) => {
    if (tab === 'compose') compose()
    else if (tab === 'chat') onChat?.()
    else setPanel(tab)
  }
  const tabBar = (active: Exclude<CommunityTab, 'compose' | 'chat'>) => (
    <CommunityTabBar active={active} onSelect={selectTab} />
  )
  const profile = profileQuery.data?.profile
  const posts = query.data?.pages.flatMap((page) => page.items) ?? []
  const moments = momentsOf(posts)
  const reels = moments.flatMap((post) =>
    post.media
      .filter((media) => media.type === 'VIDEO')
      .map((media) => ({
        id: [post.postId, media.mediaId].join(':'),
        media,
        post,
      })),
  )
  const initialReel =
    viewer === null
      ? undefined
      : reels.find((reel) => reel.post.postId === moments[viewer]?.postId)
  const overlay = initialReel ? (
    <CommunityReelsViewer
      items={reels}
      initialId={initialReel.id}
      api={api}
      onClose={closeViewer}
      onOpenPost={openPost}
      onLoadMore={
        query.hasNextPage && !query.isFetchingNextPage
          ? () => void query.fetchNextPage()
          : undefined
      }
    />
  ) : null
  // The panel under the viewer stays mounted but silent for screen readers.
  const withViewer = (screen: ReactNode) => (
    <View style={local.fill}>
      <View
        accessibilityElementsHidden={overlay !== null}
        importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}
        style={local.fill}
      >
        {screen}
      </View>
      {overlay}
    </View>
  )
  const own = profile && {
    displayName: profile.displayName,
    avatarPreset: profile.avatarPreset,
    avatarImage: profile.avatarImage,
    state:
      profile.status === 'ACTIVE' ? ('ACTIVE' as const) : ('DELETED' as const),
  }
  if (panel === 'detail' && postId)
    return (
      <CommunityDetail
        key={postId}
        api={api}
        subject={subject}
        postId={postId}
        own={own || undefined}
        onBack={() => {
          setEditing(null)
          setPanel(origin)
        }}
        onEdit={(value) => {
          setEditing(value)
          setPanel('composer')
        }}
        onHelp={() => setPanel('help')}
        onResource={onResource}
        {...(onPeerChat ? { onPeerChat } : {})}
        onGone={(message) => {
          setNotice(message)
          feed()
        }}
      />
    )
  if (panel === 'composer')
    return (
      <CommunityComposer
        api={api}
        resources={resources}
        subject={subject}
        initial={editing}
        author={own || undefined}
        transport={media}
        onCancel={feed}
        onSaved={(value) => void savedPost(value)}
      />
    )
  if (panel === 'profile')
    return (
      <CommunityProfileEditor
        api={api}
        subject={subject}
        onBack={() => setPanel('me')}
      />
    )
  if (panel === 'help') return <HelpPanel safety={safety} onBack={feed} />
  if (panel === 'moments')
    return withViewer(
      <CommunityMomentsPanel
        key="moments"
        moments={moments}
        loading={query.isPending}
        failed={query.isError}
        hasMore={query.hasNextPage}
        loadingMore={query.isFetchingNextPage}
        onRetry={() => void query.refetch()}
        onMore={() => void query.fetchNextPage()}
        onOpen={setViewer}
        onCreate={compose}
        footer={tabBar('moments')}
      />,
    )
  if (panel === 'me')
    return (
      <CommunityMePanel
        key="me"
        api={api}
        subject={subject}
        own={own || undefined}
        footer={tabBar('me')}
        onEditProfile={() => setPanel('profile')}
        onHelp={() => setPanel('help')}
        onOpenPost={(id) => openPost(id, 'me')}
      />
    )
  const topicLabels = new Map<string, string>(
    topicQuery.data?.map((topic) => [topic.code, topic.label]),
  )
  const loading =
    query.isPending || (query.isFetching && !query.isFetchingNextPage)
  return withViewer(
    <Screen
      key="feed"
      layout="bleed"
      backgroundColor={communityColors.background}
      header={
        <CommunityHeader
          padded
          size="large"
          title="Cộng đồng"
          backLabel="Về không gian của bạn"
          onBack={onBack}
        />
      }
      footer={tabBar('feed')}
    >
      <OfflineBanner inset />
      <Reveal step={0}>
        <CommunityMomentsStrip
          moments={moments}
          onCreate={compose}
          onOpen={setViewer}
        />
      </Reveal>
      <Band />
      <Reveal step={1} style={local.compose}>
        <Avatar author={own || undefined} size={38} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Viết chia sẻ"
          hitSlop={{ top: 2, bottom: 2 }}
          scaleTo={0.98}
          onPress={compose}
          style={local.pill}
        >
          <Txt style={local.pillText}>Hôm nay bạn muốn chia sẻ điều gì?</Txt>
        </PressableScale>
        <IconButton
          icon="image-outline"
          label="Thêm ảnh hoặc video"
          onPress={compose}
        />
      </Reveal>
      <Reveal step={2}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={local.chips}
        >
          <Chip
            label="Tất cả"
            selected={topics.length === 0}
            onPress={() => setTopics([])}
          />
          {topicQuery.data?.map((topic) => {
            const selected = topics.includes(topic.code)
            return (
              <Chip
                key={topic.code}
                label={topic.label}
                selected={selected}
                disabled={!selected && topics.length >= 3}
                onPress={() =>
                  setTopics((values) =>
                    values.includes(topic.code)
                      ? values.filter((code) => code !== topic.code)
                      : [...values, topic.code],
                  )
                }
              />
            )
          })}
        </ScrollView>
        {topicQuery.isError && (
          <View style={local.pad}>
            <CommunityMessage>Chưa thể tải danh sách chủ đề.</CommunityMessage>
            <CommunityButton
              variant="quiet"
              label="Tải lại chủ đề"
              onPress={() => void topicQuery.refetch()}
            />
          </View>
        )}
      </Reveal>
      <Band />
      {(notice || commands.error) && (
        <View style={local.pad}>
          {notice && <CommunityMessage>{notice}</CommunityMessage>}
          {commands.error && (
            <CommunityMessage>{commands.error}</CommunityMessage>
          )}
        </View>
      )}
      {loading ? (
        <SkeletonGroup label="Đang tải các chia sẻ còn hiển thị…">
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </SkeletonGroup>
      ) : query.isError ? (
        <StateCard
          tone="error"
          icon="alert-circle-outline"
          title="Bảng tin cộng đồng tạm thời chưa tải được."
          body={
            query.error instanceof ApiError &&
            [401, 403].includes(query.error.status ?? 0)
              ? communityMessage(query.error)
              : undefined
          }
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : (
        <View>
          {posts.map((post, index) => (
            <CommunityFeedPost
              key={post.postId}
              post={post}
              topicLabels={topicLabels}
              step={index}
              animate={!arrived}
              commands={commands}
              onEntered={markArrived}
              onMenu={() => setMenu({ postId: post.postId, open: true })}
              onOpen={() => openPost(post.postId)}
            />
          ))}
          {posts.length === 0 && (
            <StateCard
              icon="text-box-outline"
              title="Chưa có chia sẻ hiển thị cho chủ đề này."
              actionLabel={
                topics.length > 0
                  ? 'Xem tất cả chủ đề'
                  : 'Viết chia sẻ đầu tiên'
              }
              onAction={topics.length > 0 ? () => setTopics([]) : compose}
            />
          )}
          <View style={local.pad}>
            {query.hasNextPage && (
              <CommunityButton
                label="Xem thêm chia sẻ"
                disabled={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            )}
            <CommunityButton
              variant="quiet"
              label="Tải lại danh sách"
              disabled={query.isFetching}
              onPress={() => void query.refetch()}
            />
          </View>
        </View>
      )}
      <CommunityPostMenu
        api={api}
        subject={subject}
        postId={menu?.postId ?? ''}
        open={menu?.open ?? false}
        onClose={() => setMenu((value) => value && { ...value, open: false })}
        onEdit={(value) => {
          setEditing(value)
          setPanel('composer')
        }}
        onHelp={() => {
          setMenu(null)
          setPanel('help')
        }}
        onHidden={async () => {
          setMenu(null)
          setNotice(
            'Nội dung không còn hiển thị với bạn. Danh sách đã được tải lại theo quyền hiện tại.',
          )
          await refresh()
        }}
        onRefresh={refresh}
        onPeerChat={
          onPeerChat
            ? (id) => {
                setMenu(null)
                onPeerChat(id)
              }
            : undefined
        }
      />
    </Screen>,
  )
}

export function CommunityScreen(props: Props) {
  const { session, signOut } = useSession()
  if (!session || session.role !== 'USER')
    return (
      <Screen backgroundColor={communityColors.background}>
        <View style={styles.column}>
          <Txt accessibilityRole="header" style={styles.title}>
            Cộng đồng đồng hành
          </Txt>
          <StateCard
            icon="lock-outline"
            title="Bạn cần đăng nhập bằng tài khoản cá nhân để dùng cộng đồng."
            actionLabel="Đăng nhập lại"
            onAction={() => void signOut()}
          />
        </View>
      </Screen>
    )
  return (
    <AccountCommunityScreen
      key={`${session.subject}:${props.initialPostId ?? props.initialPanel ?? 'feed'}`}
      {...props}
      subject={session.subject}
    />
  )
}

const local = StyleSheet.create({
  fill: { flex: 1 },
  compose: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pill: {
    backgroundColor: communityColors.soft,
    borderRadius: 20,
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pillText: { color: communityColors.inkSoft, fontSize: 14.5, lineHeight: 20 },
  chips: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pad: { gap: spacing.sm, padding: spacing.md },
  helpTitle: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  helpText: { flex: 1 },
})

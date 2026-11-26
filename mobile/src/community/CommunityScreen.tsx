import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { BackHandler, Text, View } from 'react-native'

import type { AssessmentApi } from '@/assessment/assessment-api'
import { HelpNowPanel } from '@/assessment/AssessmentJourneyScreen'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import type { ResourceApi } from '@/resources/resource-api'

import type { CommunityApi } from './community-api'
import type { CommunityTopicCode, VersionedPost } from './community-contract'
import type { CommunityMediaTransport } from './community-media'
import { CommunityComposer } from './CommunityComposer'
import { CommunityDetail } from './CommunityDetail'
import { CommunityProfileEditor } from './CommunityProfileEditor'
import { CommunityFeedView } from './CommunityFeedView'
import { CommunityGroups } from './CommunityGroups'
import {
  CommunityHeader,
  CommunityNavigation,
  type CommunitySection,
} from './CommunitySpace'
import type { CircleApi } from './community-circle-api'
import {
  CommunityButton,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
} from './community-ui'

type Props = Readonly<{
  initialPostId?: string
  initialSection?: CommunitySection
  api: CommunityApi
  resources: ResourceApi
  safety: AssessmentApi
  media: CommunityMediaTransport
  onBack: () => void
  onResource: (id: string) => void
  onChat?: () => void
  onPeerChat?: (id: string) => void
  circles?: CircleApi
}>
type Panel = 'feed' | 'profile' | 'composer' | 'detail' | 'help' | 'groups'

function AccountCommunityScreen({
  initialPostId,
  initialSection = 'feed',
  api,
  resources,
  safety,
  media,
  onBack,
  onResource,
  onChat,
  onPeerChat,
  circles,
  subject,
}: Props & { subject: string }) {
  const client = useQueryClient()
  const [panel, setPanel] = useState<Panel>(
    initialPostId
      ? 'detail'
      : initialSection === 'profile'
        ? 'profile'
        : initialSection === 'groups'
          ? 'groups'
          : 'feed',
  )
  const [saved, setSaved] = useState(false)
  const [topics, setTopics] = useState<CommunityTopicCode[]>([])
  const [postId, setPostId] = useState<string | null>(initialPostId ?? null)
  const [editing, setEditing] = useState<VersionedPost | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [section, setSection] = useState<CommunitySection>(initialSection)
  const [starter, setStarter] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const topicQuery = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => api.topics(),
  })
  const query = useInfiniteQuery({
    queryKey: ['community', subject, saved ? 'saved' : 'feed', topics],
    enabled: panel === 'feed' || panel === 'composer',
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      saved ? api.saved(pageParam) : api.feed(topics, pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    staleTime: 0,
  })
  useEffect(() => {
    if (panel === 'composer') return
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (panel === 'feed') return false
        setPanel('feed')
        setSection((current) => (current === 'reels' ? 'reels' : 'feed'))
        return true
      },
    )
    return () => subscription.remove()
  }, [panel])
  const feed = () => {
    setPanel('feed')
    setSection((current) => (current === 'reels' ? 'reels' : 'feed'))
    setEditing(null)
  }
  const savedPost = async (value: VersionedPost) => {
    await client.invalidateQueries({ queryKey: ['community', subject] })
    setEditing(null)
    setPostId(value.post.postId)
    setPanel('detail')
    setNotice('Chia sẻ đã được lưu.')
  }
  const selectSection = (next: CommunitySection) => {
    if (panel === 'composer') return
    setSection(next)
    setPanel(
      next === 'profile' ? 'profile' : next === 'groups' ? 'groups' : 'feed',
    )
    setEditing(null)
    if (next === 'reels') {
      setSaved(false)
      setTopics([])
    }
  }
  return (
    <Screen
      key={`${panel === 'composer' ? 'feed' : panel}:${section}`}
      layout="dashboard"
      backgroundColor="#F5FAF6"
      bottomActions={
        <CommunityNavigation
          section={
            panel === 'profile'
              ? 'profile'
              : panel === 'groups'
                ? 'groups'
                : panel === 'feed'
                  ? section
                  : null
          }
          onSelect={selectSection}
          onChat={onChat}
        />
      }
    >
      <View style={styles.column}>
        <View
          style={styles.column}
          importantForAccessibility={
            panel === 'composer' ? 'no-hide-descendants' : 'auto'
          }
          accessibilityElementsHidden={panel === 'composer'}
        >
          {(panel !== 'composer' || !editing) && (
            <CommunityHeader
              onBack={panel === 'feed' || panel === 'composer' ? onBack : feed}
              onHelp={() => setPanel('help')}
            />
          )}
          {panel === 'profile' ? (
            <CommunityProfileEditor api={api} subject={subject} onBack={feed} />
          ) : panel === 'groups' ? (
            circles ? (
              <CommunityGroups api={circles} subject={subject} />
            ) : (
              <CommunityMessage>Chưa tải được nhóm đồng hành.</CommunityMessage>
            )
          ) : panel === 'help' ? (
            <>
              <CommunityButton label="Quay lại cộng đồng" onPress={feed} />
              <Text accessibilityRole="header" style={styles.title}>
                Hỗ trợ ngay
              </Text>
              <Text style={styles.muted}>
                Bạn chủ động tìm thông tin. MentalBridge không tự động gọi, điều
                phối hoặc liên hệ bên thứ ba.
              </Text>
              <HelpNowPanel api={safety} defaultTrigger="HELP_NOW" />
            </>
          ) : panel === 'detail' && postId ? (
            <CommunityDetail
              key={postId}
              api={api}
              subject={subject}
              postId={postId}
              onBack={feed}
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
          ) : (
            <CommunityFeedView
              api={api}
              resources={resources}
              subject={subject}
              posts={
                query.isSuccess && !query.isRefetching
                  ? [
                      ...new Map(
                        query.data.pages
                          .flatMap((page) => page.items)
                          .map((post) => [post.postId, post]),
                      ).values(),
                    ]
                  : []
              }
              topicOptions={topicQuery.data ?? []}
              topics={topics}
              onTopics={setTopics}
              saved={saved}
              onSaved={setSaved}
              onCompose={(content = '', hideName = false) => {
                setEditing(null)
                setStarter(content)
                setAnonymous(hideName)
                setNotice(null)
                setPanel('composer')
              }}
              onOpen={(id) => {
                setPostId(id)
                setNotice(null)
                setPanel('detail')
              }}
              onGroups={() => selectSection('groups')}
              onChat={onChat}
              onResource={onResource}
              onRefresh={async () => {
                await client.invalidateQueries({
                  queryKey: ['community', subject],
                })
              }}
              reelsOnly={section === 'reels' && panel !== 'composer'}
              loading={query.isPending || query.isRefetching}
              onLoadMore={
                query.hasNextPage
                  ? () => {
                      if (!query.isFetching) void query.fetchNextPage()
                    }
                  : undefined
              }
              more={
                query.hasNextPage && (
                  <CommunityButton
                    label="Tải thêm chia sẻ"
                    disabled={query.isFetching}
                    onPress={() => void query.fetchNextPage()}
                  />
                )
              }
              status={
                <>
                  {notice && <CommunityMessage>{notice}</CommunityMessage>}
                  {topicQuery.isError && (
                    <CommunityButton
                      label="Tải lại chủ đề"
                      onPress={() => void topicQuery.refetch()}
                    />
                  )}
                  <CommunityButton
                    label="Tải lại danh sách"
                    disabled={query.isFetching}
                    onPress={() => void query.refetch()}
                  />
                  {query.isPending || query.isRefetching ? (
                    <CommunityMessage>
                      Đang tải các chia sẻ còn hiển thị…
                    </CommunityMessage>
                  ) : query.isError ? (
                    <CommunityMessage>
                      {communityMessage(query.error)}
                    </CommunityMessage>
                  ) : query.data?.pages.every(
                      (page) => page.items.length === 0,
                    ) ? (
                    <CommunityMessage>
                      {saved
                        ? 'Chưa có bài đã lưu còn hiển thị với bạn.'
                        : 'Chưa có chia sẻ hiển thị cho chủ đề này.'}
                    </CommunityMessage>
                  ) : null}
                </>
              }
            />
          )}
        </View>
        {panel === 'composer' && (
          <CommunityComposer
            api={api}
            resources={resources}
            subject={subject}
            initial={editing}
            transport={media}
            initialContent={starter}
            initialMode={anonymous ? 'ANONYMOUS' : 'PROFILE'}
            onCancel={feed}
            onSaved={savedPost}
          />
        )}
      </View>
    </Screen>
  )
}

export function CommunityScreen(props: Props) {
  const { session, signOut } = useSession()
  if (!session || session.role !== 'USER')
    return (
      <Screen>
        <View style={styles.column}>
          <Text accessibilityRole="header" style={styles.title}>
            Cộng đồng đồng hành
          </Text>
          <CommunityMessage>
            Bạn cần đăng nhập bằng tài khoản cá nhân để dùng cộng đồng.
          </CommunityMessage>
          <CommunityButton
            label="Đăng nhập lại"
            onPress={() => void signOut()}
          />
        </View>
      </Screen>
    )
  return (
    <AccountCommunityScreen
      key={`${session.subject}:${props.initialPostId ?? 'feed'}:${props.initialSection ?? 'feed'}`}
      {...props}
      subject={session.subject}
    />
  )
}

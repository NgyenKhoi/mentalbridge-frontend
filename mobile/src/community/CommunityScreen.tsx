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
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { ResourceApi } from '@/resources/resource-api'

import type { CommunityApi } from './community-api'
import type { CommunityTopicCode, VersionedPost } from './community-contract'
import type { CommunityMediaTransport } from './community-media'
import { CommunityComposer } from './CommunityComposer'
import { CommunityDetail } from './CommunityDetail'
import { CommunityProfileEditor } from './CommunityProfileEditor'
import {
  CommunityButton,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
} from './community-ui'

type Props = Readonly<{
  api: CommunityApi
  resources: ResourceApi
  safety: AssessmentApi
  media: CommunityMediaTransport
  onBack: () => void
  onResource: (id: string) => void
}>
type Panel = 'feed' | 'profile' | 'composer' | 'detail' | 'help'

function AccountCommunityScreen({
  api,
  resources,
  safety,
  media,
  onBack,
  onResource,
  subject,
}: Props & { subject: string }) {
  const client = useQueryClient()
  const [panel, setPanel] = useState<Panel>('feed')
  const [saved, setSaved] = useState(false)
  const [topics, setTopics] = useState<CommunityTopicCode[]>([])
  const [postId, setPostId] = useState<string | null>(null)
  const [editing, setEditing] = useState<VersionedPost | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const topicQuery = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => api.topics(),
  })
  const query = useInfiniteQuery({
    queryKey: ['community', subject, saved ? 'saved' : 'feed', topics],
    enabled: panel === 'feed',
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
        return true
      },
    )
    return () => subscription.remove()
  }, [panel])
  const feed = () => {
    setPanel('feed')
    setEditing(null)
  }
  const savedPost = async (value: VersionedPost) => {
    await client.invalidateQueries({ queryKey: ['community', subject] })
    setEditing(null)
    setPostId(value.post.postId)
    setPanel('detail')
    setNotice('Chia sẻ đã được lưu.')
  }
  return (
    <Screen key={panel}>
      <View style={styles.column}>
        {panel === 'composer' ? (
          <CommunityComposer
            api={api}
            resources={resources}
            subject={subject}
            initial={editing}
            transport={media}
            onCancel={feed}
            onSaved={(value) => void savedPost(value)}
          />
        ) : panel === 'profile' ? (
          <CommunityProfileEditor api={api} subject={subject} onBack={feed} />
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
            onGone={(message) => {
              setNotice(message)
              feed()
            }}
          />
        ) : (
          <>
            <CommunityButton label="Về không gian của bạn" onPress={onBack} />
            <Text accessibilityRole="header" style={styles.title}>
              Cộng đồng đồng hành
            </Text>
            <Text style={styles.muted}>
              Chia sẻ trải nghiệm, lắng nghe và động viên nhau. Không gian này
              không thay thế tư vấn chuyên môn.
            </Text>
            <View style={styles.row}>
              <CommunityButton
                label="Bảng tin"
                selected={!saved}
                onPress={() => setSaved(false)}
              />
              <CommunityButton
                label="Bài đã lưu"
                selected={saved}
                onPress={() => setSaved(true)}
              />
              <CommunityButton
                label="Danh tính cộng đồng"
                onPress={() => setPanel('profile')}
              />
              <CommunityButton
                label="Cần hỗ trợ ngay"
                onPress={() => setPanel('help')}
              />
            </View>
            <PrimaryButton
              label="Viết chia sẻ"
              onPress={() => {
                setEditing(null)
                setNotice(null)
                setPanel('composer')
              }}
            />
            {!saved && (
              <View style={styles.column}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Chủ đề bạn muốn xem
                </Text>
                <View style={styles.row}>
                  <CommunityButton
                    label="Tất cả chủ đề"
                    selected={topics.length === 0}
                    onPress={() => setTopics([])}
                  />
                  {topicQuery.data?.map((topic) => (
                    <CommunityButton
                      key={topic.code}
                      label={topic.label}
                      selected={topics.includes(topic.code)}
                      disabled={
                        !topics.includes(topic.code) && topics.length >= 3
                      }
                      onPress={() =>
                        setTopics((values) =>
                          values.includes(topic.code)
                            ? values.filter((code) => code !== topic.code)
                            : [...values, topic.code],
                        )
                      }
                    />
                  ))}
                </View>
                {topicQuery.isError && (
                  <>
                    <CommunityMessage>
                      Chưa thể tải danh sách chủ đề.
                    </CommunityMessage>
                    <CommunityButton
                      label="Tải lại chủ đề"
                      onPress={() => void topicQuery.refetch()}
                    />
                  </>
                )}
              </View>
            )}
            {notice && <CommunityMessage>{notice}</CommunityMessage>}
            <CommunityButton
              label="Tải lại danh sách"
              disabled={query.isFetching}
              onPress={() => void query.refetch()}
            />
            {query.isPending ||
            (query.isFetching && !query.isFetchingNextPage) ? (
              <CommunityMessage>
                Đang tải các chia sẻ còn hiển thị…
              </CommunityMessage>
            ) : query.isError ? (
              <CommunityMessage>
                {communityMessage(query.error)}
              </CommunityMessage>
            ) : (
              <>
                {query.data?.pages
                  .flatMap((page) => page.items)
                  .map((post) => (
                    <View key={post.postId} style={styles.card}>
                      <Text style={styles.heading}>
                        {post.author.displayName}
                      </Text>
                      {post.sensitiveContentWarning === 'SENSITIVE_CONTENT' ? (
                        <Text style={styles.muted}>
                          Nội dung có cảnh báo nhạy cảm. Bạn quyết định có mở
                          bài hay không.
                        </Text>
                      ) : (
                        <Text style={styles.body}>{post.contentPreview}</Text>
                      )}
                      <Text
                        style={styles.muted}
                      >{`${post.counts.comments} bình luận · ${post.counts.reactions} lời động viên${post.viewerState.bookmarked ? ' · Đã lưu' : ''}`}</Text>
                      <CommunityButton
                        testID={`community-open-${post.postId}`}
                        label="Mở chia sẻ"
                        onPress={() => {
                          setPostId(post.postId)
                          setNotice(null)
                          setPanel('detail')
                        }}
                      />
                    </View>
                  ))}
                {query.data?.pages.every((page) => page.items.length === 0) && (
                  <CommunityMessage>
                    {saved
                      ? 'Chưa có bài đã lưu còn hiển thị với bạn.'
                      : 'Chưa có chia sẻ hiển thị cho chủ đề này.'}
                  </CommunityMessage>
                )}
                {query.hasNextPage && (
                  <CommunityButton
                    label="Tải thêm chia sẻ"
                    disabled={query.isFetchingNextPage}
                    onPress={() => void query.fetchNextPage()}
                  />
                )}
              </>
            )}
          </>
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
      key={session.subject}
      {...props}
      subject={session.subject}
    />
  )
}

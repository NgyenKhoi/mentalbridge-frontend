import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { ResourceApi } from '@/resources/resource-api'
import { colors, radii, spacing } from '@/theme/tokens'
import type { CommunityApi } from './community-api'
import type {
  CommunitySummary,
  CommunityTopic,
  CommunityTopicCode,
} from './community-contract'
import {
  CommunityReelPreview,
  CommunityReelsViewer,
} from './CommunityReelsViewer'
import { useCommunityAction } from './community-ui'

const prompts = [
  'Một điều nhỏ bé khiến bạn mỉm cười hoặc cảm thấy biết ơn hôm nay là gì?',
  'Có điều gì bạn muốn nhẹ nhàng đặt xuống sau hôm nay?',
  'Bạn đã dành cho bản thân một khoảng nghỉ như thế nào?',
  'Một bước nhỏ mà bạn muốn ghi nhận ở chính mình là gì?',
  'Nếu gửi một lời động viên cho mình lúc này, bạn sẽ nói gì?',
]

function Action({
  label,
  onPress,
  active,
  disabled,
  primary = false,
}: Readonly<{
  label: string
  onPress: () => void
  active?: boolean
  disabled?: boolean
  primary?: boolean
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        ...(active === undefined ? {} : { selected: active }),
        disabled: Boolean(disabled),
      }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.action,
        active && s.selectedAction,
        primary && s.primary,
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.actionText, primary && s.white]}>{label}</Text>
    </Pressable>
  )
}

function PostCard({
  post,
  api,
  onOpen,
  onRefresh,
}: Readonly<{
  post: CommunitySummary
  api: CommunityApi
  onOpen: () => void
  onRefresh: () => Promise<void>
}>) {
  const action = useCommunityAction()
  const protectedContent = Boolean(post.sensitiveContentWarning)
  const firstImage = post.media.find((item) => item.type === 'IMAGE')
  const timestamp = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(post.publishedAt))
  const mutate = (operation: () => Promise<void>) =>
    void action.run(async () => {
      try {
        await operation()
      } finally {
        await onRefresh()
      }
    })
  return (
    <View style={s.card}>
      <View style={s.row}>
        {post.author.avatarImage ? (
          <Image
            source={{ uri: post.author.avatarImage.url }}
            accessibilityLabel={post.author.displayName}
            style={s.avatar}
          />
        ) : (
          <View style={s.avatar}>
            <Text style={s.avatarLetter}>
              {post.author.displayName.trim().charAt(0)}
            </Text>
          </View>
        )}
        <View style={s.flex}>
          <Text style={s.name}>{post.author.displayName}</Text>
          <Text style={s.small}>
            {timestamp} ·{' '}
            {post.author.state === 'ANONYMOUS'
              ? 'Đăng ẩn danh'
              : 'Chia sẻ cộng đồng'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem tùy chọn bài của ${post.author.displayName}`}
          style={s.iconButton}
          onPress={onOpen}
        >
          <Text aria-hidden style={s.icon}>
            ⋯
          </Text>
        </Pressable>
      </View>
      <Text style={s.postText}>
        {protectedContent
          ? 'Nội dung có cảnh báo nhạy cảm. Bạn quyết định có mở bài hay không.'
          : post.contentPreview}
      </Text>
      {!protectedContent && firstImage && (
        <Image
          source={{ uri: firstImage.url }}
          accessibilityLabel="Ảnh trong bài chia sẻ"
          style={s.postImage}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở chia sẻ"
        testID={`community-open-${post.postId}`}
        onPress={onOpen}
        style={s.readMore}
      >
        <Text style={s.linkText}>
          {protectedContent ? 'Xem cảnh báo và mở bài' : 'Đọc tiếp →'}
        </Text>
      </Pressable>
      <View style={s.postActions}>
        <Action
          label={`${post.counts.reactions} Đồng cảm`}
          active={post.viewerState.reaction !== null}
          disabled={action.busy}
          onPress={() =>
            mutate(() =>
              api.react(
                post.postId,
                post.viewerState.reaction === 'RELATE' ? null : 'RELATE',
              ),
            )
          }
        />
        <Action label={`${post.counts.comments} Lời an ủi`} onPress={onOpen} />
        <Action
          label={post.viewerState.bookmarked ? 'Đã lưu' : 'Lưu'}
          active={post.viewerState.bookmarked}
          disabled={action.busy}
          onPress={() =>
            mutate(() =>
              api.bookmark(post.postId, !post.viewerState.bookmarked),
            )
          }
        />
      </View>
      {action.error && (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {action.error}
        </Text>
      )}
    </View>
  )
}

export function CommunityFeedView({
  api,
  resources,
  subject,
  posts,
  topicOptions,
  topics,
  onTopics,
  saved,
  onSaved,
  onCompose,
  onOpen,
  onGroups,
  onChat,
  onResource,
  onRefresh,
  reelsOnly,
  status,
  more,
  loading,
  onLoadMore,
}: Readonly<{
  api: CommunityApi
  resources: ResourceApi
  subject: string
  posts: CommunitySummary[]
  topicOptions: CommunityTopic[]
  topics: CommunityTopicCode[]
  onTopics: (topics: CommunityTopicCode[]) => void
  saved: boolean
  onSaved: (value: boolean) => void
  onCompose: (content?: string, anonymous?: boolean) => void
  onOpen: (id: string) => void
  onGroups: () => void
  onChat?: (() => void) | undefined
  onResource: (id: string) => void
  onRefresh: () => Promise<void>
  reelsOnly: boolean
  status: ReactNode
  more: ReactNode
  loading: boolean
  onLoadMore?: (() => void) | undefined
}>) {
  const [search, setSearch] = useState('')
  const [prompt, setPrompt] = useState(0)
  const [anonymous, setAnonymous] = useState(false)
  const [anonymousOnly, setAnonymousOnly] = useState(false)
  const [popular, setPopular] = useState(false)
  const [draft, setDraft] = useState('')
  const [videoId, setVideoId] = useState<string>()
  const [viewerOpen, setViewerOpen] = useState(reelsOnly)
  const catalogue = useQuery({
    queryKey: ['community', subject, 'breathing-shortcut'],
    queryFn: () =>
      resources.listResources({
        category: 'BREATHING',
        locale: 'vi-VN',
        limit: 1,
      }),
    retry: false,
  })
  const rows = posts.filter(
    (post) =>
      (!anonymousOnly || post.author.state === 'ANONYMOUS') &&
      `${post.contentPreview} ${post.author.displayName}`
        .toLocaleLowerCase('vi')
        .includes(search.trim().toLocaleLowerCase('vi')),
  )
  const ordered = [...rows].sort((a, b) =>
    popular
      ? b.counts.reactions - a.counts.reactions
      : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )
  const videos = posts
    .filter((post) => !post.sensitiveContentWarning)
    .flatMap((post) =>
      post.media
        .filter((media) => media.type === 'VIDEO')
        .map((media) => ({
          id: `${post.postId}:${media.mediaId}`,
          media,
          post,
        })),
    )
  const selectedVideo = viewerOpen
    ? (videos.find((item) => item.id === videoId) ?? videos[0])
    : undefined
  return (
    <View style={s.column}>
      <View style={s.search}>
        <Text aria-hidden style={s.icon}>
          ⌕
        </Text>
        <TextInput
          accessibilityLabel="Tìm trong bài cộng đồng đã tải"
          placeholder="Tìm câu chuyện, người chia sẻ…"
          placeholderTextColor={colors.inkFaint}
          value={search}
          onChangeText={setSearch}
          style={s.searchInput}
        />
      </View>
      {!reelsOnly && (
        <View style={s.prompt}>
          <View style={s.row}>
            <Text style={[s.smallHeading, s.flex]}>
              ♧ Chiếc hộp sẻ chia hôm nay
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi câu gợi ý"
              onPress={() => setPrompt((value) => (value + 1) % prompts.length)}
              style={s.iconButton}
            >
              <Text style={s.linkText}>↻</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Viết từ câu gợi ý"
            onPress={() => onCompose(prompts[prompt])}
            style={s.promptBody}
          >
            <Text aria-hidden style={s.promptLeaf}>
              ♧
            </Text>
            <Text style={[s.body, s.italic, s.flex]}>“{prompts[prompt]}”</Text>
          </Pressable>
        </View>
      )}
      <View style={s.row}>
        <Text accessibilityRole="header" style={[s.smallHeading, s.flex]}>
          KHOẢNH KHẮC &amp; REELS
        </Text>
        {videos.length > 0 ? (
          <Action
            label="Xem tất cả Reels"
            onPress={() => {
              setVideoId(videos[0]?.id)
              setViewerOpen(true)
            }}
          />
        ) : (
          <Text style={s.small}>Từ cộng đồng</Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.moments}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tạo khoảnh khắc"
          onPress={() => onCompose()}
          style={s.createMoment}
        >
          <Text aria-hidden style={s.addMoment}>
            ＋
          </Text>
          <Text style={s.name}>Tạo Reels</Text>
          <Text style={s.small}>Video của bạn</Text>
        </Pressable>
        {videos.slice(0, 2).map(({ id, media, post }) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`Xem video của ${post.author.displayName}`}
            onPress={() => {
              setVideoId(id)
              setViewerOpen(true)
            }}
            style={s.videoCard}
          >
            <CommunityReelPreview media={media} />
            <Text aria-hidden style={s.play}>
              ▷
            </Text>
            <View style={s.videoCaption}>
              <Text numberOfLines={3} style={s.videoTitle}>
                {post.contentPreview}
              </Text>
              <Text style={s.videoAuthor}>{post.author.displayName}</Text>
            </View>
          </Pressable>
        ))}
        {!videos.length && (
          <View style={s.momentEmpty}>
            <Text style={s.name}>
              {loading
                ? 'Đang tải khoảnh khắc…'
                : 'Chia sẻ một khoảnh khắc của bạn'}
            </Text>
            <Text style={s.small}>
              Video từ các bài chia sẻ đã tải sẽ xuất hiện ở đây.
            </Text>
          </View>
        )}
      </ScrollView>
      {selectedVideo && (
        <CommunityReelsViewer
          items={videos}
          initialId={selectedVideo.id}
          api={api}
          onClose={() => {
            setVideoId(undefined)
            setViewerOpen(false)
            void onRefresh()
          }}
          onOpenPost={(id) => {
            setVideoId(undefined)
            setViewerOpen(false)
            onOpen(id)
          }}
          onLoadMore={onLoadMore}
        />
      )}
      {!reelsOnly && (
        <>
          <View style={s.feedTabs}>
            <Action
              label="Bảng tin"
              active={!anonymousOnly && !saved}
              onPress={() => {
                setAnonymousOnly(false)
                onSaved(false)
              }}
            />
            <Action label="Nhóm đồng hành" onPress={onGroups} />
            <Action
              label="Góc ẩn danh"
              active={anonymousOnly && !saved}
              onPress={() => {
                setAnonymousOnly(true)
                onSaved(false)
              }}
            />
          </View>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.avatar}>
                <Text style={s.avatarLetter}>Tôi</Text>
              </View>
              <TextInput
                accessibilityLabel="Bản nháp chia sẻ nhanh"
                placeholder="Viết ra để nhẹ lòng hơn… Bạn không phải gồng mình mạnh mẽ ở đây."
                placeholderTextColor={colors.inkSoft}
                multiline
                value={draft}
                maxLength={5000}
                onChangeText={setDraft}
                style={s.quickInput}
              />
            </View>
            <View style={s.row}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: anonymous }}
                accessibilityLabel="Đăng ẩn danh"
                onPress={() => setAnonymous((value) => !value)}
                style={[s.row, s.flex, s.anonymousSwitch]}
              >
                <Text aria-hidden style={[s.switch, anonymous && s.switchOn]}>
                  {anonymous ? '✓' : ''}
                </Text>
                <Text style={s.small}>Đăng ẩn danh</Text>
              </Pressable>
              <Action
                label="Viết chia sẻ"
                primary
                onPress={() => onCompose(draft, anonymous)}
              />
            </View>
          </View>
          <View style={s.quickLinks}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onTopics(['HELPFUL_REFLECTION'])}
              style={s.quickLink}
            >
              <Text aria-hidden style={s.greenIcon}>
                ♧
              </Text>
              <Text style={s.smallHeading}>Góc biết ơn</Text>
              <Text style={s.small}>Điều nhỏ bé</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !catalogue.data?.data.length }}
              disabled={!catalogue.data?.data.length}
              onPress={() => {
                const resource = catalogue.data?.data[0]
                if (resource) onResource(resource.id)
              }}
              style={[s.quickLink, !catalogue.data?.data.length && s.disabled]}
            >
              <Text aria-hidden style={s.amberIcon}>
                ≈
              </Text>
              <Text style={s.smallHeading}>Nghỉ hơi thở</Text>
              <Text style={s.small}>
                {catalogue.isPending
                  ? 'Đang tải…'
                  : catalogue.data?.data[0]
                    ? 'Một phút an yên'
                    : 'Chưa có bài tập'}
              </Text>
            </Pressable>
            {onChat && (
              <Pressable
                accessibilityRole="button"
                onPress={onChat}
                style={s.quickLink}
              >
                <Text aria-hidden style={s.greenIcon}>
                  ☏
                </Text>
                <Text style={s.smallHeading}>Lắng nghe</Text>
                <Text style={s.small}>Phòng trò chuyện</Text>
              </Pressable>
            )}
          </View>
          <View style={s.row}>
            <Text accessibilityRole="header" style={[s.smallHeading, s.flex]}>
              BÀI VIẾT SẺ CHIA
            </Text>
            <Action
              label="Gần đây"
              active={!popular}
              onPress={() => setPopular(false)}
            />
            <Action
              label="Nhiều đồng cảm"
              active={popular}
              onPress={() => setPopular(true)}
            />
          </View>
          {(search || anonymousOnly || popular) && (
            <Text style={s.small}>
              Lọc trong các chia sẻ đã tải. Tải thêm để xem nhiều hơn.
            </Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.topicStrip}
          >
            <Action
              label="Tất cả chủ đề"
              active={!topics.length}
              onPress={() => onTopics([])}
            />
            {topicOptions.map((topic) => (
              <Action
                key={topic.code}
                label={topic.label}
                active={topics.includes(topic.code)}
                disabled={!topics.includes(topic.code) && topics.length >= 3}
                onPress={() =>
                  onTopics(
                    topics.includes(topic.code)
                      ? topics.filter((code) => code !== topic.code)
                      : [...topics, topic.code],
                  )
                }
              />
            ))}
            <Action
              label="Bài đã lưu"
              active={saved}
              onPress={() => onSaved(!saved)}
            />
          </ScrollView>
          {status}
          {ordered.map((post) => (
            <PostCard
              key={post.postId}
              post={post}
              api={api}
              onOpen={() => onOpen(post.postId)}
              onRefresh={onRefresh}
            />
          ))}
          {more}
          {posts.length > 0 && ordered.length === 0 && (
            <Text style={s.body}>
              Chưa có bài phù hợp trong các chia sẻ đã tải.
            </Text>
          )}
          <View style={s.culture}>
            <Text style={s.name}>♧ Văn hóa lắng nghe MentalBridge</Text>
            <Text style={[s.small, s.center]}>
              Lắng nghe không phán xét · Tôn trọng ranh giới · Riêng tư và nhịp
              điệu riêng của mỗi người.
            </Text>
          </View>
        </>
      )}
      {reelsOnly && (
        <>
          {status}
          {more}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  column: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  small: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  smallHeading: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  search: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, minHeight: 44, color: colors.ink, fontSize: 13 },
  icon: { color: colors.tealDeep, fontSize: 21 },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    borderRadius: radii.panel,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#D8E6DB',
    backgroundColor: '#EFF7F0',
  },
  promptBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FAFCF6',
    padding: spacing.md,
    borderRadius: radii.control,
  },
  promptLeaf: { color: '#287961', fontSize: 23 },
  italic: { fontStyle: 'italic' },
  moments: { gap: spacing.sm },
  createMoment: {
    width: 104,
    minHeight: 156,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  addMoment: {
    color: colors.teal,
    fontSize: 25,
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    borderRadius: 20,
    backgroundColor: '#EDF5EF',
    overflow: 'hidden',
  },
  videoCard: {
    width: 142,
    aspectRatio: 9 / 16,
    borderRadius: radii.control,
    backgroundColor: '#193C31',
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  videoCaption: {
    backgroundColor: 'rgba(5,24,16,0.55)',
    padding: 8,
    margin: -12,
    gap: 3,
  },
  play: { color: colors.white, fontSize: 25 },
  videoTitle: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  videoAuthor: { color: '#C6E1D1', fontSize: 11, marginTop: 5 },
  momentEmpty: {
    width: 188,
    minHeight: 156,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#EAF2EC',
    borderRadius: radii.control,
  },
  feedTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 4,
    borderRadius: radii.control,
    backgroundColor: '#EAF0E9',
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.control,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  actionText: { color: colors.tealDeep, fontSize: 11, fontWeight: '600' },
  primary: {
    backgroundColor: colors.tealDeep,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  white: { color: colors.white },
  selectedAction: { backgroundColor: '#E1EEE5' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DDF2E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.tealDeep, fontWeight: '700', fontSize: 14 },
  quickInput: {
    flex: 1,
    minHeight: 68,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  anonymousSwitch: { minHeight: 44 },
  switch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.white,
    textAlign: 'center',
    fontSize: 11,
  },
  switchOn: { backgroundColor: colors.teal },
  quickLinks: { flexDirection: 'row', gap: spacing.sm },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    padding: spacing.sm,
    minHeight: 90,
  },
  greenIcon: { color: colors.teal, fontSize: 21 },
  amberIcon: { color: '#AC8A36', fontSize: 21 },
  topicStrip: { gap: 5 },
  postText: { fontSize: 14, lineHeight: 23, color: colors.inkSoft },
  postImage: { width: '100%', height: 180, borderRadius: radii.control },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  readMore: {
    minHeight: 36,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  linkText: { color: colors.tealDeep, fontSize: 12, fontWeight: '700' },
  error: { color: '#9C5141', fontSize: 12, lineHeight: 18 },
  culture: {
    backgroundColor: '#EEF4EE',
    borderRadius: radii.panel,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  center: { textAlign: 'center' },
  disabled: { opacity: 0.5 },
})

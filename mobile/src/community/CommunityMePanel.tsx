import { useInfiniteQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import type { CommunityApi } from './community-api'
import type { CommunitySummary } from './community-contract'
import { useCommunityNav } from './community-nav'
import { communityColors } from './community-theme'
import { CommunityMediaThumb } from './CommunityMedia'
import {
  Avatar,
  type AvatarAuthor,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  communityText,
  IconButton,
  Reveal,
  SkeletonBlock,
  SkeletonGroup,
  StateCard,
  type IconName,
} from './community-ui'

const GAP = 2
const COLUMNS = 3
const MAX_WIDTH = 760

function ProfileButton({
  label,
  icon,
  primary = false,
  onPress,
}: Readonly<{
  label: string
  icon?: IconName
  primary?: boolean
  onPress: () => void
}>) {
  const tint = primary ? communityColors.white : communityColors.ink
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.96}
      onPress={onPress}
      style={[button.base, primary && button.primary]}
    >
      {icon && <CommunityIcon name={icon} size={18} color={tint} />}
      <Txt style={[button.label, { color: tint }]}>{label}</Txt>
    </PressableScale>
  )
}

const button = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  primary: { backgroundColor: communityColors.primaryDeep },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
})

/** One square of the saved grid: media thumbnail, or the excerpt of a text post. A warned post stays hidden. */
function SavedCell({
  post,
  size,
  onOpen,
}: Readonly<{ post: CommunitySummary; size: number; onOpen: () => void }>) {
  const [first] = post.media
  const sensitive = post.sensitiveContentWarning === 'SENSITIVE_CONTENT'
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Mở chia sẻ của ${post.author.displayName}`}
      scaleTo={0.97}
      testID={`community-saved-${post.postId}`}
      onPress={onOpen}
      style={[cell.box, { height: size, width: size }]}
    >
      {sensitive ? (
        <View style={cell.text}>
          <CommunityIcon
            name="shield-alert-outline"
            size={20}
            color={communityColors.primaryDeep}
          />
          <Txt style={cell.excerpt}>Nội dung nhạy cảm</Txt>
        </View>
      ) : first ? (
        <CommunityMediaThumb media={first} />
      ) : (
        <View style={cell.text}>
          {/* 11.5 is the mock's grid excerpt size. */}
          <Txt numberOfLines={4} style={cell.excerpt}>
            {post.contentPreview.replace(/\s+/g, ' ')}
          </Txt>
        </View>
      )}
    </PressableScale>
  )
}

const cell = StyleSheet.create({
  box: {
    backgroundColor: communityColors.soft,
    overflow: 'hidden',
  },
  text: { flex: 1, gap: spacing.xs, padding: 7 },
  excerpt: {
    color: communityColors.ink,
    fontSize: 11.5,
    lineHeight: 15,
  },
})

/** Trang của tôi tab: identity, links to friends and groups, and the saved-post grid. */
export function CommunityMePanel({
  api,
  subject,
  own,
  footer,
  onEditProfile,
  onHelp,
  onOpenPost,
}: Readonly<{
  api: CommunityApi
  subject: string
  own: AvatarAuthor | undefined
  footer: ReactNode
  onEditProfile: () => void
  onHelp: () => void
  onOpenPost: (postId: string) => void
}>) {
  const nav = useCommunityNav()
  const { width } = useWindowDimensions()
  const size = Math.floor(
    (Math.min(width, MAX_WIDTH) - GAP * (COLUMNS - 1)) / COLUMNS,
  )
  const saved = useInfiniteQuery({
    queryKey: ['community', subject, 'saved'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.saved(pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    staleTime: 0,
  })
  const posts = saved.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <Screen
      layout="bleed"
      backgroundColor={communityColors.background}
      header={
        <CommunityHeader
          padded
          size="large"
          title="Trang của tôi"
          right={
            <IconButton icon="lifebuoy" label="Hỗ trợ ngay" onPress={onHelp} />
          }
        />
      }
      footer={footer}
    >
      <Reveal step={0} style={styles.identity}>
        <Avatar author={own} size={84} />
        <Txt style={styles.name}>
          {own?.displayName ?? 'Chưa có tên hiển thị'}
        </Txt>
        <Txt style={communityText.meta}>
          Danh tính cộng đồng, tách khỏi hồ sơ sức khỏe
        </Txt>
        <View style={styles.actions}>
          <ProfileButton
            primary
            label="Sửa danh tính"
            onPress={onEditProfile}
          />
          {nav.openFriends && (
            <ProfileButton
              icon="account-multiple-outline"
              label="Bạn bè"
              onPress={nav.openFriends}
            />
          )}
          {nav.openGroups && (
            <ProfileButton
              icon="account-group-outline"
              label="Nhóm"
              onPress={nav.openGroups}
            />
          )}
        </View>
      </Reveal>
      <Reveal step={1}>
        <Txt accessibilityRole="header" style={styles.section}>
          Bài đã lưu
        </Txt>
      </Reveal>
      {saved.isPending ? (
        <SkeletonGroup label="Đang tải bài đã lưu…">
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <SkeletonBlock key={key} width={size} height={size} radius={0} />
            ))}
          </View>
        </SkeletonGroup>
      ) : saved.isError ? (
        <StateCard
          tone="error"
          icon="alert-circle-outline"
          title="Bài đã lưu tạm thời chưa tải được."
          actionLabel="Thử lại"
          onAction={() => void saved.refetch()}
        />
      ) : posts.length === 0 ? (
        <StateCard
          icon="bookmark-outline"
          title="Bạn chưa lưu bài viết nào"
          body="Khi gặp một câu chuyện muốn đọc lại, hãy chọn lưu bài."
        />
      ) : (
        <Reveal>
          <View style={styles.grid}>
            {posts.map((post) => (
              <SavedCell
                key={post.postId}
                post={post}
                size={size}
                onOpen={() => onOpenPost(post.postId)}
              />
            ))}
          </View>
          {saved.hasNextPage && (
            <View style={styles.more}>
              <CommunityButton
                label="Xem thêm"
                disabled={saved.isFetchingNextPage}
                onPress={() => void saved.fetchNextPage()}
              />
            </View>
          )}
        </Reveal>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  name: {
    color: communityColors.ink,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
    marginTop: spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  section: {
    borderBottomColor: communityColors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: communityColors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  more: { padding: spacing.md },
})

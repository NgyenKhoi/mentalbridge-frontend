import { useRef, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'

import { Avatar, relativeTime, type AvatarAuthor } from './community-avatar'
import type { Reaction } from './community-contract'
import {
  CommunityButton,
  CommunityIcon,
  communityText,
  IconButton,
} from './community-primitives'
import { reactionKind } from './community-reactions'
import { communityColors } from './community-theme'
import { useCommunityNav } from './community-nav'
import { ReactionControl, usePop } from './CommunityReactions'

/** Avatar, name, "time · topic" and the overflow button. */
export function PostHeader({
  author,
  publishedAt,
  topics,
  menuLabel,
  onMenu,
}: Readonly<{
  author: AvatarAuthor & Readonly<{ communityProfileId?: string | null }>
  publishedAt: string
  /** Topic labels already limited to what the screen shows. */
  topics: string[]
  menuLabel?: string
  onMenu?: () => void
}>) {
  const { openMember } = useCommunityNav()
  const meta = [relativeTime(publishedAt), ...topics]
    .filter(Boolean)
    .join(' · ')
  const profileId =
    author.state === 'ACTIVE' ? (author.communityProfileId ?? null) : null
  const who = (
    <>
      <Avatar author={author} size={38} />
      <View style={styles.headerText}>
        <Txt numberOfLines={1} style={communityText.author}>
          {author.displayName}
        </Txt>
        <Txt numberOfLines={1} style={styles.meta}>
          {meta}
        </Txt>
      </View>
    </>
  )
  return (
    <View style={styles.header}>
      {openMember && profileId ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Xem trang của ${author.displayName}`}
          scaleTo={0.98}
          onPress={() => openMember(profileId)}
          style={styles.who}
        >
          {who}
        </PressableScale>
      ) : (
        <View style={styles.who}>{who}</View>
      )}
      {onMenu && menuLabel && (
        <IconButton icon="dots-horizontal" label={menuLabel} onPress={onMenu} />
      )}
    </View>
  )
}

/** Post copy at 15.5/24. */
export function PostBody({
  children,
  numberOfLines,
}: Readonly<{ children: string; numberOfLines?: number }>) {
  return (
    <Txt {...(numberOfLines ? { numberOfLines } : {})} style={styles.body}>
      {children}
    </Txt>
  )
}

/** Warning that replaces the body and the media; the reader chooses whether to open the post. */
export function SensitiveBlock({
  text,
  actionLabel,
  onAction,
}: Readonly<{ text: string; actionLabel?: string; onAction?: () => void }>) {
  return (
    <View style={styles.warning}>
      <Txt style={communityText.section}>Nội dung nhạy cảm</Txt>
      <Txt style={communityText.body}>{text}</Txt>
      {actionLabel && onAction && (
        <CommunityButton label={actionLabel} onPress={onAction} />
      )}
    </View>
  )
}

/** Full-width media; a double tap sets SUPPORT and pops a large emoji in the centre. */
export function PostMedia({
  children,
  onDoubleTap,
}: Readonly<{ children: ReactNode; onDoubleTap: () => void }>) {
  const reduceMotion = useReducedMotion()
  const last = useRef(0)
  const burst = useSharedValue(0)
  const style = useAnimatedStyle(() => ({
    opacity:
      burst.value === 0
        ? 0
        : burst.value < 0.8
          ? 1
          : 1 - (burst.value - 0.8) * 5,
    transform: [
      {
        scale:
          burst.value < 0.3
            ? burst.value * 3.8
            : 1.15 - 0.15 * Math.min(1, (burst.value - 0.3) / 0.25),
      },
      { translateY: (-24 * Math.max(0, burst.value - 0.55)) / 0.45 },
    ],
  }))
  return (
    <Pressable
      accessible={false}
      testID="community-post-media"
      style={styles.media}
      onPress={() => {
        const now = Date.now()
        if (now - last.current > 300) {
          last.current = now
          return
        }
        last.current = 0
        if (!reduceMotion)
          burst.set(
            withSequence(
              withTiming(0, { duration: 0 }),
              withTiming(1, { duration: 700, easing: Easing.linear }),
            ),
          )
        onDoubleTap()
      }}
    >
      {children}
      <View pointerEvents="none" style={styles.bigHost}>
        <Animated.Text
          importantForAccessibility="no"
          style={[styles.big, style]}
        >
          {reactionKind('SUPPORT').emoji}
        </Animated.Text>
      </View>
    </Pressable>
  )
}

/** Reaction, comments and bookmark: one row under every post. */
export function PostActionRow({
  reaction,
  reactions,
  comments,
  bookmarked,
  onReact,
  onComments,
  onBookmark,
}: Readonly<{
  reaction: Reaction | null
  reactions: number
  comments: number
  bookmarked: boolean
  onReact: (next: Reaction | null) => void
  onComments: () => void
  onBookmark: () => void
}>) {
  const pop = usePop(bookmarked ? 'saved' : null, 1.2, 300)
  return (
    <View style={styles.actions}>
      <ReactionControl
        reaction={reaction}
        count={reactions}
        onChange={onReact}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${comments} bình luận`}
        scaleTo={0.92}
        onPress={onComments}
        style={styles.comment}
      >
        <CommunityIcon
          name="comment-outline"
          size={24}
          color={communityColors.ink}
        />
        <Txt style={styles.count}>{comments}</Txt>
      </PressableScale>
      <View style={styles.spacer} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={bookmarked ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
        accessibilityState={{ selected: bookmarked }}
        scaleTo={0.92}
        onPress={onBookmark}
        style={styles.save}
      >
        <Animated.View style={pop}>
          <CommunityIcon
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={
              bookmarked ? communityColors.primaryDeep : communityColors.ink
            }
          />
        </Animated.View>
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  who: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm + 2,
    minHeight: 44,
  },
  headerText: { flex: 1 },
  meta: {
    color: communityColors.inkSoft,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
  body: {
    color: communityColors.ink,
    fontSize: 15.5,
    lineHeight: 24,
  },
  warning: {
    borderColor: communityColors.terracottaLine,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
  },
  media: { marginTop: spacing.sm + 2 },
  bigHost: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  big: { fontSize: 92, lineHeight: 110 },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs + 2,
  },
  comment: {
    alignItems: 'center',
    borderRadius: 21,
    flexDirection: 'row',
    gap: spacing.sm - 2,
    height: 42,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
  },
  count: {
    color: communityColors.ink,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  spacer: { flex: 1 },
  save: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
})

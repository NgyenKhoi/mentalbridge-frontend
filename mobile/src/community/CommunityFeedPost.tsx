import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import { spacing } from '@/theme/tokens'

import type { CommunitySummary } from './community-contract'
import type { usePostCommands } from './community-reaction-hooks'
import { CommunityMediaPreview } from './CommunityMedia'
import {
  PostActionRow,
  PostBody,
  PostHeader,
  PostMedia,
  SensitiveBlock,
} from './CommunityPostBlock'
import { Band, Reveal } from './community-ui'

/** One edge-to-edge post of the feed, followed by its band. */
export function CommunityFeedPost({
  post,
  topicLabels,
  step,
  animate,
  commands,
  onOpen,
  onMenu,
  onEntered,
}: Readonly<{
  post: CommunitySummary
  topicLabels: Map<string, string>
  step: number
  animate: boolean
  commands: ReturnType<typeof usePostCommands>
  onOpen: () => void
  onMenu: () => void
  onEntered: () => void
}>) {
  useEffect(() => onEntered(), [onEntered])
  const sensitive = post.sensitiveContentWarning === 'SENSITIVE_CONTENT'
  const name = post.author.displayName
  const topic = post.topics[0]
  return (
    <Reveal step={step} enabled={animate}>
      <View style={styles.block}>
        <PostHeader
          author={post.author}
          publishedAt={post.publishedAt}
          topics={topic ? [topicLabels.get(topic) ?? topic] : []}
          menuLabel="An toàn cho bài viết"
          onMenu={onMenu}
        />
        {sensitive ? (
          <SensitiveBlock
            text="Nội dung có cảnh báo nhạy cảm. Bạn quyết định có mở bài hay không."
            actionLabel="Mở bài viết"
            onAction={onOpen}
          />
        ) : (
          <>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Mở chia sẻ của ${name}`}
              accessibilityHint={`${post.counts.comments} bình luận, ${post.counts.reactions} lời động viên${post.viewerState.bookmarked ? ', đã lưu' : ''}`}
              scaleTo={0.99}
              testID={`community-open-${post.postId}`}
              onPress={onOpen}
              style={styles.body}
            >
              <PostBody numberOfLines={6}>
                {post.contentPreview.replace(/\n{2,}/g, '\n')}
              </PostBody>
            </PressableScale>
            {post.media.length > 0 && (
              <PostMedia onDoubleTap={() => void setSupport(post, commands)}>
                <CommunityMediaPreview flush media={post.media} />
              </PostMedia>
            )}
          </>
        )}
        <PostActionRow
          reaction={post.viewerState.reaction}
          reactions={post.counts.reactions}
          comments={post.counts.comments}
          bookmarked={post.viewerState.bookmarked}
          onReact={(next) => void commands.react(post, next)}
          onComments={onOpen}
          onBookmark={() =>
            void commands.bookmark(post, !post.viewerState.bookmarked)
          }
        />
      </View>
      <Band />
    </Reveal>
  )
}

// A double tap only ever adds the heart; it never clears an existing reaction.
const setSupport = (
  post: CommunitySummary,
  commands: ReturnType<typeof usePostCommands>,
) => (post.viewerState.reaction ? undefined : commands.react(post, 'SUPPORT'))

const styles = StyleSheet.create({
  block: { paddingTop: spacing.md },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2 },
})

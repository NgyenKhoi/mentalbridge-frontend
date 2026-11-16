import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'

import type { CommunityApi } from './community-api'
import type {
  CommentReaction,
  CommunityComment,
  VersionedPost,
} from './community-contract'
import {
  useCommentReactions,
  usePostCommands,
} from './community-reaction-hooks'
import { quickEmoji, reactionKind } from './community-reactions'
import { communityColors } from './community-theme'
import { CommunityMediaView } from './CommunityMedia'
import {
  PostActionRow,
  PostBody,
  PostHeader,
  PostMedia,
  SensitiveBlock,
} from './CommunityPostBlock'
import { CommunityPostMenu } from './CommunityPostMenu'
import { CommunitySafetyActions } from './CommunitySafetyActions'
import { ReactionControl } from './CommunityReactions'
import {
  Avatar,
  type AvatarAuthor,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityText,
  IconButton,
  OfflineBanner,
  relativeTime,
  Reveal,
  SkeletonGroup,
  SkeletonPost,
  SkeletonRow,
  StateCard,
  useCommandKey,
  useCommunityAction,
} from './community-ui'

function useComments({
  api,
  subject,
  postId,
  enabled,
  onRefresh,
  onHidden,
  inputRef,
}: Readonly<{
  api: CommunityApi
  subject: string
  postId: string
  inputRef: RefObject<TextInput | null>
  enabled: boolean
  onRefresh: () => Promise<void>
  onHidden: () => Promise<void>
}>) {
  const [content, setContent] = useState('')
  const [reply, setReply] = useState<CommunityComment | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const action = useCommunityAction()
  const key = useCommandKey()
  const query = useInfiniteQuery({
    queryKey: ['community', subject, 'comments', postId],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.comments(postId, pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
  })
  const comments = useMemo(
    () =>
      query.isError
        ? []
        : (query.data?.pages.flatMap((page) => page.items) ?? []),
    [query.isError, query.data],
  )
  const send = () =>
    action.run(async () => {
      const body = {
        content: content.trim(),
        parentCommentId: reply?.commentId ?? null,
      }
      try {
        await api.comment(postId, body.content, body.parentCommentId, key(body))
        key.done()
        setContent('')
        setReply(null)
        setUnconfirmed(false)
        await query.refetch()
        await onRefresh()
      } catch (error) {
        if (
          error instanceof ApiError &&
          [401, 403, 404].includes(error.status ?? 0)
        )
          await onHidden()
        else if (
          !(error instanceof ApiError) ||
          error.status == null ||
          error.status >= 500
        )
          setUnconfirmed(true)
        throw error
      }
    })
  return {
    query,
    comments,
    content,
    setContent,
    reply,
    startReply: (comment: CommunityComment) => {
      setReply(comment)
      inputRef.current?.focus()
    },
    setReply,
    unconfirmed,
    action,
    send,
  }
}
type CommentsState = ReturnType<typeof useComments>
type CommentReactions = ReturnType<typeof useCommentReactions>

function CommentItem({
  api,
  comment,
  state,
  reactions,
  animate,
  onRefresh,
  onHelp,
}: Readonly<{
  api: CommunityApi
  comment: CommunityComment
  state: CommentsState
  reactions: CommentReactions
  animate: boolean
  onRefresh: () => Promise<void>
  onHelp: () => void
}>) {
  const [safetyOpen, setSafetyOpen] = useState(false)
  const active = comment.state === 'ACTIVE'
  const name = comment.author.displayName
  const reaction: CommentReaction | undefined = active
    ? reactions.of(comment.commentId)
    : undefined
  return (
    <Reveal
      enabled={animate}
      style={[local.comment, comment.parentCommentId && local.reply]}
    >
      <Avatar author={active ? comment.author : undefined} size={30} />
      <View style={local.commentBody}>
        {active ? (
          <>
            <Txt numberOfLines={1} style={local.commentName}>
              {name}
              <Txt style={local.commentTime}>
                {`  ${relativeTime(comment.createdAt)}`}
              </Txt>
            </Txt>
            <Txt style={local.commentText}>{comment.content}</Txt>
            <View style={local.commentActions}>
              {comment.parentCommentId === null && (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Trả lời ${name}`}
                  accessibilityState={{
                    disabled: state.action.busy || state.unconfirmed,
                  }}
                  disabled={state.action.busy || state.unconfirmed}
                  hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                  scaleTo={0.94}
                  onPress={() => {
                    state.startReply(comment)
                  }}
                >
                  <Txt style={local.quiet}>Trả lời</Txt>
                </PressableScale>
              )}
              {reaction && reaction.reactionCount > 0 && (
                <Txt
                  accessibilityLabel={`${reaction.reactionCount} cảm xúc`}
                  style={local.quiet}
                >
                  {reaction.reactionCount}
                </Txt>
              )}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="An toàn cho bình luận"
                accessibilityState={{ expanded: safetyOpen }}
                hitSlop={14}
                scaleTo={0.9}
                onPress={() => setSafetyOpen(true)}
              >
                <CommunityIcon
                  name="dots-horizontal"
                  size={18}
                  color={communityColors.inkSoft}
                />
              </PressableScale>
            </View>
            <CommunitySafetyActions
              api={api}
              targetType="COMMENT"
              targetId={comment.commentId}
              blockableProfileId={null}
              open={safetyOpen}
              onClose={() => setSafetyOpen(false)}
              onHelp={onHelp}
              onHidden={async () => {
                setSafetyOpen(false)
                await state.query.refetch()
                await onRefresh()
              }}
              onRefresh={async () => {
                await state.query.refetch()
              }}
            />
          </>
        ) : (
          <Txt style={[local.commentText, { color: communityColors.inkSoft }]}>
            Bình luận này không còn hiển thị.
          </Txt>
        )}
      </View>
      {active && (
        <View style={local.heart}>
          {reaction && (
            <ReactionControl
              size="small"
              target={`bình luận của ${name}`}
              reaction={reaction.reaction}
              count={reaction.reactionCount}
              onChange={(next) => void reactions.react(comment.commentId, next)}
            />
          )}
        </View>
      )}
    </Reveal>
  )
}

// Mounts when the first page arrives: comments present then appear in place, later ones rise in.
function CommentRows({
  api,
  comments,
  state,
  reactions,
  onRefresh,
  onHelp,
}: Readonly<{
  api: CommunityApi
  comments: CommunityComment[]
  state: CommentsState
  reactions: CommentReactions
  onRefresh: () => Promise<void>
  onHelp: () => void
}>) {
  const [initialIds] = useState(
    () => new Set(comments.map((comment) => comment.commentId)),
  )
  return comments.map((comment) => (
    <CommentItem
      key={comment.commentId}
      api={api}
      comment={comment}
      state={state}
      reactions={reactions}
      animate={!initialIds.has(comment.commentId)}
      onRefresh={onRefresh}
      onHelp={onHelp}
    />
  ))
}

function CommentList({
  api,
  state,
  reactions,
  onRefresh,
  onHelp,
}: Readonly<{
  api: CommunityApi
  state: CommentsState
  reactions: CommentReactions
  onRefresh: () => Promise<void>
  onHelp: () => void
}>) {
  const { query, comments } = state
  return (
    <View style={local.comments}>
      {query.isPending && (
        <View style={local.pad}>
          <SkeletonGroup label="Đang tải bình luận…">
            <SkeletonRow size={30} />
            <SkeletonRow size={30} />
          </SkeletonGroup>
        </View>
      )}
      {query.isError && (
        <StateCard
          tone="error"
          icon="comment-alert-outline"
          title="Chưa tải được bình luận."
          body={communityMessage(query.error)}
          actionLabel="Tải lại bình luận"
          onAction={() => void query.refetch()}
        />
      )}
      {query.isSuccess && comments.length === 0 && (
        <StateCard
          icon="comment-outline"
          title="Chưa có bình luận"
          body="Bạn có thể là người đầu tiên gửi một lời đồng hành."
        />
      )}
      {query.isSuccess && (
        <CommentRows
          api={api}
          comments={comments}
          state={state}
          reactions={reactions}
          onRefresh={onRefresh}
          onHelp={onHelp}
        />
      )}
      {query.hasNextPage && (
        <View style={local.pad}>
          <CommunityButton
            label="Tải thêm bình luận"
            disabled={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
          />
        </View>
      )}
    </View>
  )
}

/** Sticky input bar: quick emoji that insert into the text, own avatar, pill input, send. */
function CommentComposer({
  state,
  inputRef,
  own,
  anonymousPost,
  extraError,
}: Readonly<{
  state: CommentsState
  inputRef: RefObject<TextInput | null>
  own: AvatarAuthor | undefined
  anonymousPost: boolean
  extraError: string | null
}>) {
  const { query, action, reply, unconfirmed, content } = state
  const label = action.busy
    ? 'Đang gửi…'
    : unconfirmed
      ? 'Thử lại bình luận'
      : reply
        ? 'Gửi trả lời'
        : 'Gửi bình luận'
  const editable = !action.busy && !unconfirmed && !query.isError
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={local.footer}
    >
      {reply && (
        <View style={local.replying}>
          <Txt
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            style={[communityText.meta, local.replyingText]}
          >{`Đang trả lời ${reply.author.displayName}`}</Txt>
          <IconButton
            icon="close"
            label="Hủy trả lời"
            disabled={action.busy || unconfirmed}
            onPress={() => state.setReply(null)}
          />
        </View>
      )}
      {anonymousPost && (
        <Txt style={communityText.meta}>
          Bình luận hiển thị tên cộng đồng của bạn, kể cả khi bài viết được đăng
          ẩn danh.
        </Txt>
      )}
      {(action.error || extraError) && (
        <CommunityMessage>{(action.error ?? extraError)!}</CommunityMessage>
      )}
      {unconfirmed && (
        <CommunityMessage>
          Chưa xác nhận bình luận đã gửi. Thử lại nguyên yêu cầu để tránh gửi
          trùng.
        </CommunityMessage>
      )}
      <View style={local.quick}>
        {quickEmoji.map((emoji) => (
          <PressableScale
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`Chèn ${emoji}`}
            disabled={!editable}
            scaleTo={1.3}
            onPress={() =>
              state.setContent((value) => `${value}${emoji}`.slice(0, 2000))
            }
            style={local.quickItem}
          >
            <Text style={local.quickEmoji}>{emoji}</Text>
          </PressableScale>
        ))}
      </View>
      <View style={local.inputRow}>
        <Avatar author={own} size={30} />
        <TextInput
          ref={inputRef}
          accessibilityLabel="Nội dung bình luận"
          testID="community-comment-content"
          placeholder="Viết bình luận…"
          placeholderTextColor={communityColors.inkSoft}
          multiline
          maxLength={2000}
          value={content}
          editable={editable}
          onChangeText={state.setContent}
          style={local.input}
        />
        <IconButton
          icon="send"
          filled
          label={label}
          disabled={
            action.busy || !content.trim() || query.isError || query.isPending
          }
          onPress={() => void state.send()}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

export function CommunityDetail({
  api,
  subject,
  postId,
  own,
  onBack,
  onEdit,
  onHelp,
  onResource,
  onGone,
  onPeerChat,
}: Readonly<{
  api: CommunityApi
  subject: string
  postId: string
  own?: AvatarAuthor | undefined
  onBack: () => void
  onEdit: (post: VersionedPost) => void
  onHelp: () => void
  onResource: (id: string) => void
  onGone: (message: string) => void
  onPeerChat?: (profileId: string) => void
}>) {
  const client = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const query = useQuery({
    queryKey: ['community', subject, 'post', postId],
    queryFn: () => api.detail(postId),
    staleTime: 0,
  })
  const topicQuery = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => api.topics(),
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['community', subject] })
  }
  const hidden = async () => {
    setMenuOpen(false)
    client.removeQueries({ queryKey: ['community', subject, 'post', postId] })
    client.removeQueries({
      queryKey: ['community', subject, 'comments', postId],
    })
    await refresh()
    onGone(
      'Nội dung không còn hiển thị với bạn. Danh sách đã được tải lại theo quyền hiện tại.',
    )
  }
  const commands = usePostCommands(api, subject, hidden)
  const value = query.data
  const warning =
    value?.post.sensitiveContentWarning === 'SENSITIVE_CONTENT' && !revealed
  const comments = useComments({
    api,
    subject,
    postId,
    enabled: query.isSuccess && !warning,
    inputRef,
    onRefresh: refresh,
    onHidden: hidden,
  })
  const reactions = useCommentReactions(api, subject, comments.comments)
  const frame = (right: ReactNode, children: ReactNode, footer?: ReactNode) => (
    <Screen
      layout="bleed"
      backgroundColor={communityColors.background}
      header={
        <Reveal step={0}>
          <CommunityHeader
            padded
            title="Bài viết"
            backLabel="Quay lại danh sách"
            onBack={onBack}
            right={right}
          />
        </Reveal>
      }
      footer={footer}
    >
      <OfflineBanner inset />
      {children}
    </Screen>
  )
  if (query.isPending)
    return frame(
      null,
      <SkeletonGroup label="Đang xác nhận bài viết còn hiển thị…">
        <SkeletonPost />
        <View style={local.pad}>
          <SkeletonRow size={30} />
          <SkeletonRow size={30} />
        </View>
      </SkeletonGroup>,
    )
  if (query.isError || !value)
    return frame(
      null,
      <StateCard
        tone="error"
        icon="alert-circle-outline"
        title={
          query.error instanceof ApiError && query.error.status === 404
            ? 'Bài viết này không còn khả dụng.'
            : 'Bài viết tạm thời chưa tải được.'
        }
        body={
          query.error instanceof ApiError &&
          [401, 403].includes(query.error.status ?? 0)
            ? communityMessage(query.error)
            : undefined
        }
        actionLabel="Tải lại bài viết"
        onAction={() => void query.refetch()}
      />,
    )
  const { post, etag } = value
  const owner = etag !== null
  const topicLabels = new Map(
    topicQuery.data?.map((topic) => [topic.code, topic.label]),
  )
  const emoji = post.viewerState.reaction
    ? reactionKind(post.viewerState.reaction).emoji
    : null
  return frame(
    <IconButton
      icon="dots-horizontal"
      label={owner ? 'Tùy chọn bài viết' : 'An toàn cho bài viết'}
      expanded={menuOpen}
      onPress={() => setMenuOpen(true)}
    />,
    <>
      {query.isFetching && (
        <View style={local.pad}>
          <CommunityMessage>
            Đang xác nhận bài viết còn hiển thị…
          </CommunityMessage>
        </View>
      )}
      <CommunityPostMenu
        api={api}
        subject={subject}
        postId={postId}
        value={value}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEdit={onEdit}
        onHelp={onHelp}
        onHidden={hidden}
        onRefresh={async () => {
          await query.refetch()
        }}
        onPeerChat={onPeerChat}
      />
      <View style={query.isFetching && { display: 'none' }}>
        <Reveal step={1}>
          <View style={local.post}>
            <PostHeader
              author={post.author}
              publishedAt={post.publishedAt}
              topics={post.topics.map((code) => topicLabels.get(code) ?? code)}
            />
            {post.author.state === 'ANONYMOUS' && (
              <Txt style={[communityText.meta, local.note]}>
                Bài viết ẩn danh · Không có liên kết hồ sơ tác giả
              </Txt>
            )}
            {warning ? (
              <SensitiveBlock
                text="Nội dung có cảnh báo nhạy cảm. Bạn có thể chọn xem khi thấy phù hợp."
                actionLabel="Xem nội dung nhạy cảm"
                onAction={() => setRevealed(true)}
              />
            ) : (
              <>
                <View style={local.body}>
                  <PostBody>{post.content}</PostBody>
                </View>
                {post.media.some((item) => item.type === 'VIDEO') ? (
                  // A video keeps its own controls: no double-tap layer over it.
                  <View style={local.media}>
                    <CommunityMediaView flush media={post.media} />
                  </View>
                ) : (
                  post.media.length > 0 && (
                    <PostMedia
                      onDoubleTap={() =>
                        post.viewerState.reaction
                          ? undefined
                          : void commands.react(post, 'SUPPORT')
                      }
                    >
                      <CommunityMediaView flush media={post.media} />
                    </PostMedia>
                  )
                )}
                {['PARTIAL', 'UNAVAILABLE'].includes(
                  post.mediaAvailability,
                ) && (
                  <View style={local.pad}>
                    <CommunityMessage>
                      Một số ảnh hoặc video chưa thể hiển thị. Không có nội dung
                      thay thế được tạo ra.
                    </CommunityMessage>
                  </View>
                )}
                {post.resourceAttachment && (
                  <View style={local.pad}>
                    <CommunityButton
                      icon="book-open-variant"
                      label="Mở tài nguyên tham khảo"
                      onPress={() =>
                        onResource(post.resourceAttachment!.resourceId)
                      }
                    />
                  </View>
                )}
              </>
            )}
            <PostActionRow
              reaction={post.viewerState.reaction}
              reactions={post.counts.reactions}
              comments={post.counts.comments}
              bookmarked={post.viewerState.bookmarked}
              onReact={(next) => void commands.react(post, next)}
              onComments={() => inputRef.current?.focus()}
              onBookmark={() =>
                void commands.bookmark(post, !post.viewerState.bookmarked)
              }
            />
            <View style={local.countLine}>
              {emoji && <Text style={local.countEmoji}>{emoji}</Text>}
              <Txt style={communityText.meta}>
                {`${post.counts.reactions} lời động viên`}
              </Txt>
            </View>
            {commands.error && (
              <View style={local.pad}>
                <CommunityMessage>{commands.error}</CommunityMessage>
              </View>
            )}
          </View>
        </Reveal>
        {!warning && (
          <Reveal step={2}>
            <CommentList
              api={api}
              state={comments}
              reactions={reactions}
              onRefresh={refresh}
              onHelp={onHelp}
            />
          </Reveal>
        )}
      </View>
    </>,
    !warning && !query.isFetching ? (
      <CommentComposer
        state={comments}
        inputRef={inputRef}
        own={own}
        anonymousPost={post.author.state === 'ANONYMOUS'}
        extraError={reactions.error}
      />
    ) : null,
  )
}

const local = StyleSheet.create({
  post: { paddingTop: spacing.xs },
  media: { marginTop: spacing.sm + 2 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2 },
  note: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  pad: { gap: spacing.sm, padding: spacing.md },
  countLine: {
    alignItems: 'center',
    borderBottomColor: communityColors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    minHeight: 32,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  countEmoji: { fontSize: 14, lineHeight: 18 },
  comments: { paddingBottom: spacing.md },
  comment: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  reply: { paddingLeft: 40 + spacing.md },
  commentBody: { flex: 1, gap: 2 },
  commentName: {
    color: communityColors.ink,
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  commentTime: {
    color: communityColors.inkSoft,
    fontSize: 12.5,
    fontWeight: '400',
  },
  commentText: {
    color: communityColors.ink,
    fontSize: 14.5,
    lineHeight: 22,
  },
  commentActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  quiet: {
    color: communityColors.inkSoft,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  heart: { alignSelf: 'center', width: 32 },
  footer: {
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  replying: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  replyingText: { flex: 1 },
  quick: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: {
    alignItems: 'center',
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  quickEmoji: { fontSize: 24, lineHeight: 30 },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: communityColors.soft,
    borderRadius: radii.pill,
    color: communityColors.ink,
    flex: 1,
    fontSize: 14.5,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    textAlignVertical: 'center',
  },
})

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'

import type { CommunityApi } from './community-api'
import type {
  CommunityComment,
  Reaction,
  VersionedPost,
} from './community-contract'
import { CommunityMediaView } from './CommunityMedia'
import { CommunitySafetyActions } from './CommunitySafetyActions'
import {
  CommunityButton,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
  useCommandKey,
  useCommunityAction,
} from './community-ui'

const reactions: { value: Reaction; label: string }[] = [
  { value: 'SUPPORT', label: 'Mình ở đây' },
  { value: 'RELATE', label: 'Mình đồng cảm' },
  { value: 'THANK_YOU', label: 'Cảm ơn bạn' },
]
function Comments({
  api,
  subject,
  postId,
  onRefresh,
  onHidden,
  onHelp,
}: Readonly<{
  api: CommunityApi
  subject: string
  postId: string
  onRefresh: () => Promise<void>
  onHidden: () => Promise<void>
  onHelp: () => void
}>) {
  const [content, setContent] = useState('')
  const [reply, setReply] = useState<CommunityComment | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const action = useCommunityAction()
  const key = useCommandKey()
  const query = useInfiniteQuery({
    queryKey: ['community', subject, 'comments', postId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.comments(postId, pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
  })
  const comments = query.isError
    ? []
    : (query.data?.pages.flatMap((page) => page.items) ?? [])
  const send = () =>
    action.run(async () => {
      const body = {
        content: content.trim(),
        parentCommentId: reply?.commentId ?? null,
      }
      try {
        await api.comment(postId, body.content, body.parentCommentId, key(body))
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
  return (
    <View style={styles.column}>
      <Text accessibilityRole="header" style={styles.heading}>
        Bình luận
      </Text>
      {query.isPending && (
        <CommunityMessage>Đang tải bình luận…</CommunityMessage>
      )}
      {query.isError && (
        <>
          <CommunityMessage>{communityMessage(query.error)}</CommunityMessage>
          <CommunityButton
            label="Tải lại bình luận"
            onPress={() => void query.refetch()}
          />
        </>
      )}
      {query.isSuccess && comments.length === 0 && (
        <CommunityMessage>
          Chưa có bình luận. Bạn có thể để lại lời chia sẻ tôn trọng.
        </CommunityMessage>
      )}
      {comments.map((comment) => (
        <View key={comment.commentId} style={styles.card}>
          {comment.state !== 'ACTIVE' ? (
            <Text style={styles.muted}>Bình luận này không còn hiển thị.</Text>
          ) : (
            <>
              <Text style={styles.heading}>
                {comment.author.displayName}
                {comment.parentCommentId ? ' · Trả lời' : ''}
              </Text>
              <Text style={styles.body}>{comment.content}</Text>
              {comment.parentCommentId === null && (
                <CommunityButton
                  label={`Trả lời ${comment.author.displayName}`}
                  disabled={action.busy || unconfirmed}
                  onPress={() => setReply(comment)}
                />
              )}
              <CommunitySafetyActions
                api={api}
                targetType="COMMENT"
                targetId={comment.commentId}
                blockableProfileId={null}
                onHelp={onHelp}
                onHidden={async () => {
                  await query.refetch()
                  await onRefresh()
                }}
                onRefresh={async () => {
                  await query.refetch()
                }}
              />
            </>
          )}
        </View>
      ))}
      {query.hasNextPage && (
        <CommunityButton
          label="Tải thêm bình luận"
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
      {reply && (
        <>
          <CommunityMessage>{`Đang trả lời ${reply.author.displayName}`}</CommunityMessage>
          <CommunityButton
            label="Hủy trả lời"
            disabled={action.busy || unconfirmed}
            onPress={() => setReply(null)}
          />
        </>
      )}
      <Text style={styles.muted}>
        Bình luận hiển thị tên cộng đồng của bạn, kể cả khi bài viết được đăng
        ẩn danh.
      </Text>
      <TextInput
        accessibilityLabel="Nội dung bình luận"
        testID="community-comment-content"
        multiline
        maxLength={2000}
        value={content}
        editable={!action.busy && !unconfirmed && !query.isError}
        onChangeText={setContent}
        style={styles.input}
      />
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
      {unconfirmed && (
        <CommunityMessage>
          Chưa xác nhận bình luận đã gửi. Thử lại nguyên yêu cầu để tránh gửi
          trùng.
        </CommunityMessage>
      )}
      <PrimaryButton
        label={
          action.busy
            ? 'Đang gửi…'
            : unconfirmed
              ? 'Thử lại bình luận'
              : reply
                ? 'Gửi trả lời'
                : 'Gửi bình luận'
        }
        disabled={
          action.busy || !content.trim() || query.isError || query.isPending
        }
        onPress={() => void send()}
      />
    </View>
  )
}

export function CommunityDetail({
  api,
  subject,
  postId,
  onBack,
  onEdit,
  onHelp,
  onResource,
  onGone,
}: Readonly<{
  api: CommunityApi
  subject: string
  postId: string
  onBack: () => void
  onEdit: (post: VersionedPost) => void
  onHelp: () => void
  onResource: (id: string) => void
  onGone: (message: string) => void
}>) {
  const client = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const action = useCommunityAction()
  const query = useQuery({
    queryKey: ['community', subject, 'post', postId],
    queryFn: () => api.detail(postId),
    staleTime: 0,
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['community', subject] })
  }
  const hidden = async () => {
    client.removeQueries({ queryKey: ['community', subject, 'post', postId] })
    client.removeQueries({
      queryKey: ['community', subject, 'comments', postId],
    })
    await refresh()
    onGone(
      'Nội dung không còn hiển thị với bạn. Danh sách đã được tải lại theo quyền hiện tại.',
    )
  }
  const mutate = (command: () => Promise<void>) =>
    action.run(async () => {
      try {
        await command()
        await refresh()
      } catch (error) {
        if (
          error instanceof ApiError &&
          [401, 403, 404].includes(error.status ?? 0)
        )
          await hidden()
        throw error
      }
    })
  const value = query.data
  if (query.isPending)
    return (
      <View style={styles.column}>
        <CommunityButton label="Quay lại danh sách" onPress={onBack} />
        <CommunityMessage>
          Đang xác nhận bài viết còn hiển thị…
        </CommunityMessage>
      </View>
    )
  if (query.isError || !value)
    return (
      <View style={styles.column}>
        <CommunityButton label="Quay lại danh sách" onPress={onBack} />
        <CommunityMessage>{communityMessage(query.error)}</CommunityMessage>
        <CommunityButton
          label="Tải lại bài viết"
          onPress={() => void query.refetch()}
        />
      </View>
    )
  const { post, etag } = value
  const warning =
    post.sensitiveContentWarning === 'SENSITIVE_CONTENT' && !revealed
  return (
    <View style={styles.column}>
      <CommunityButton label="Quay lại danh sách" onPress={onBack} />
      <Text accessibilityRole="header" style={styles.title}>
        Chia sẻ trong cộng đồng
      </Text>
      {query.isFetching && (
        <CommunityMessage>
          Đang xác nhận bài viết còn hiển thị…
        </CommunityMessage>
      )}
      <View style={[styles.column, query.isFetching && { display: 'none' }]}>
        <Text style={styles.heading}>{post.author.displayName}</Text>
        {post.author.state === 'ANONYMOUS' && (
          <Text style={styles.muted}>
            Bài viết ẩn danh · Không có liên kết hồ sơ tác giả
          </Text>
        )}
        {warning ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              Nội dung có cảnh báo nhạy cảm. Bạn có thể chọn xem khi thấy phù
              hợp.
            </Text>
            <CommunityButton
              label="Xem nội dung nhạy cảm"
              onPress={() => setRevealed(true)}
            />
          </View>
        ) : (
          <>
            <Text style={styles.body}>{post.content}</Text>
            <CommunityMediaView media={post.media} />
            {['PARTIAL', 'UNAVAILABLE'].includes(post.mediaAvailability) && (
              <CommunityMessage>
                Một số ảnh hoặc video chưa thể hiển thị. Không có nội dung thay
                thế được tạo ra.
              </CommunityMessage>
            )}
            {post.resourceAttachment && (
              <CommunityButton
                label="Mở tài nguyên tham khảo"
                onPress={() => onResource(post.resourceAttachment!.resourceId)}
              />
            )}
          </>
        )}
        <Text
          style={styles.muted}
        >{`${post.counts.comments} bình luận · ${post.counts.reactions} lời động viên`}</Text>
        <View style={styles.row}>
          {reactions.map(({ value: reaction, label }) => (
            <CommunityButton
              key={reaction}
              label={label}
              selected={post.viewerState.reaction === reaction}
              disabled={action.busy}
              onPress={() =>
                void mutate(() =>
                  api.react(
                    postId,
                    post.viewerState.reaction === reaction ? null : reaction,
                  ),
                )
              }
            />
          ))}
        </View>
        <CommunityButton
          label={
            post.viewerState.bookmarked ? 'Bỏ lưu bài viết' : 'Lưu bài viết'
          }
          selected={post.viewerState.bookmarked}
          disabled={action.busy}
          onPress={() =>
            void mutate(() =>
              api.bookmark(postId, !post.viewerState.bookmarked),
            )
          }
        />
        {etag !== null && (
          <View style={styles.column}>
            <CommunityButton
              label="Sửa bài viết của tôi"
              disabled={
                action.busy ||
                !['NONE', 'READY'].includes(post.mediaAvailability)
              }
              onPress={() => onEdit(value)}
            />
            {!['NONE', 'READY'].includes(post.mediaAvailability) && (
              <CommunityMessage>
                Tải lại media trước khi sửa để không vô tình bỏ tệp chưa hiển
                thị.
              </CommunityMessage>
            )}
            <CommunityButton
              label="Xóa bài viết của tôi"
              disabled={action.busy}
              onPress={() => setConfirmDelete(true)}
            />
            {confirmDelete && (
              <View style={styles.card}>
                <Text style={styles.body}>
                  Xóa chia sẻ này? Bài sẽ không còn hiển thị trong cộng đồng.
                </Text>
                <CommunityButton
                  label="Giữ bài viết"
                  onPress={() => setConfirmDelete(false)}
                />
                <CommunityButton
                  label="Xác nhận xóa bài viết"
                  disabled={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      await api.remove(postId, etag)
                      await hidden()
                    })
                  }
                />
              </View>
            )}
          </View>
        )}
        {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
        <CommunitySafetyActions
          api={api}
          targetType="POST"
          targetId={postId}
          blockableProfileId={
            etag === null && post.author.state === 'ACTIVE'
              ? post.author.communityProfileId
              : null
          }
          onHidden={hidden}
          onHelp={onHelp}
          onRefresh={async () => {
            await query.refetch()
          }}
        />
        {!warning && (
          <Comments
            api={api}
            subject={subject}
            postId={postId}
            onRefresh={refresh}
            onHidden={hidden}
            onHelp={onHelp}
          />
        )}
      </View>
    </View>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import {
  createCommunityComment,
  deleteCommunityComment,
  getCommunityComments,
  getCommunityProfile,
  updateCommunityComment,
  type CommunityComment,
} from '@/features/community/api/browser-community'
import CommunityAvatar from './CommunityAvatar'

type Props = Readonly<{
  postId: string
  onCountChange: (difference: number) => void
}>

function commentTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function CommunityComments({ postId, onCountChange }: Props) {
  const { confirm, showActionToast } = useFeedback()
  const composer = useRef<HTMLTextAreaElement>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [ownProfileId, setOwnProfileId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [content, setContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [message, setMessage] = useState('')
  const createCommand = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  )

  const load = useCallback(async () => {
    const page = await getCommunityComments(postId)
    setComments(page.items)
    setCursor(page.nextCursor)
    setHasMore(page.hasMore)
  }, [postId])

  useEffect(() => {
    let active = true
    void Promise.all([
      getCommunityComments(postId),
      getCommunityProfile().catch((error) => {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }),
    ])
      .then(([page, profile]) => {
        if (!active) return
        setComments(page.items)
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setOwnProfileId(profile?.data.communityProfileId ?? null)
      })
      .catch(() => {
        if (active)
          setMessage('Bình luận chưa tải được. Bạn có thể thử lại sau ít phút.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [postId])

  function beginReply(comment: CommunityComment) {
    setReplyingTo(comment)
    setEditingId(null)
    requestAnimationFrame(() => composer.current?.focus())
  }

  async function submit() {
    const normalized = content.trim()
    if (!normalized || [...normalized].length > 2000) {
      setMessage('Hãy viết bình luận từ 1 đến 2.000 ký tự.')
      return
    }
    const input = {
      content: normalized,
      parentCommentId: replyingTo?.commentId ?? null,
    }
    const signature = JSON.stringify({ postId, ...input })
    if (
      !createCommand.current ||
      createCommand.current.signature !== signature
    ) {
      createCommand.current = { signature, key: crypto.randomUUID() }
    }
    setSubmitting(true)
    setMessage('')
    try {
      const result = await createCommunityComment(
        postId,
        input,
        createCommand.current.key,
      )
      createCommand.current = undefined
      setComments((current) => [...current, result.comment])
      setOwnProfileId(
        (current) =>
          current ?? result.comment.author.communityProfileId ?? null,
      )
      setContent('')
      setReplyingTo(null)
      onCountChange(1)
      showActionToast({
        title: replyingTo ? 'Đã gửi phản hồi' : 'Đã gửi bình luận',
        tone: 'success',
      })
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 404
          ? 'Nội dung bạn muốn phản hồi không còn khả dụng.'
          : 'Bình luận chưa gửi được. Nội dung vẫn còn ở đây để bạn thử lại.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function saveEdit(comment: CommunityComment) {
    const normalized = editContent.trim()
    if (!normalized || [...normalized].length > 2000) {
      setMessage('Hãy viết bình luận từ 1 đến 2.000 ký tự.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const result = await updateCommunityComment(
        comment.commentId,
        { content: normalized },
        comment.version,
      )
      setComments((current) =>
        current.map((item) =>
          item.commentId === comment.commentId ? result.comment : item,
        ),
      )
      setEditingId(null)
      showActionToast({ title: 'Đã lưu bình luận', tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        await reloadAfterConflict(
          'Bình luận vừa thay đổi ở nơi khác. Nội dung mới nhất đã được tải lại.',
        )
      } else {
        setMessage('Thay đổi chưa lưu được. Bạn có thể thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(comment: CommunityComment) {
    const accepted = await confirm({
      title: 'Xóa bình luận này?',
      description:
        'Nội dung sẽ được thay bằng thông báo đã xóa để các phản hồi vẫn giữ đúng ngữ cảnh.',
      confirmLabel: 'Xóa bình luận',
      tone: 'danger',
    })
    if (!accepted) return
    setSubmitting(true)
    setMessage('')
    try {
      await deleteCommunityComment(comment.commentId, comment.version)
      setComments((current) =>
        current.map((item) =>
          item.commentId === comment.commentId
            ? {
                ...item,
                content: 'Bình luận đã được người viết xóa.',
                state: 'OWNER_DELETED',
                version: item.version + 1,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      )
      onCountChange(-1)
      showActionToast({ title: 'Đã xóa bình luận', tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        await reloadAfterConflict(
          'Bình luận vừa thay đổi. Hãy xem lại nội dung mới nhất trước khi xóa.',
        )
      } else {
        setMessage('Bình luận chưa xóa được. Bạn có thể thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function reloadAfterConflict(nextMessage: string) {
    try {
      await load()
      setEditingId(null)
      setMessage(nextMessage)
    } catch {
      setMessage('Bình luận không còn khả dụng.')
    }
  }

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setMessage('')
    try {
      const page = await getCommunityComments(postId, cursor)
      setComments((current) => [
        ...current,
        ...page.items.filter(
          (item) =>
            !current.some((existing) => existing.commentId === item.commentId),
        ),
      ])
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch {
      setMessage('Chưa tải được các bình luận tiếp theo. Bạn có thể thử lại.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="community-comments" aria-labelledby="comments-title">
      <header>
        <div>
          <span>Cùng lắng nghe</span>
          <h2 id="comments-title">Bình luận hỗ trợ</h2>
        </div>
        <p>
          Chia sẻ trải nghiệm của bạn, điều đã giúp bạn, hoặc một lời động viên.
          Tránh chẩn đoán hay khẳng định thay cho người khác.
        </p>
      </header>

      <div className="community-comment-composer">
        {replyingTo && (
          <div className="community-replying-to">
            <span>
              Đang phản hồi <strong>{replyingTo.author.displayName}</strong>
            </span>
            <button type="button" onClick={() => setReplyingTo(null)}>
              Hủy phản hồi
            </button>
          </div>
        )}
        <label htmlFor="community-comment-content">
          {replyingTo ? 'Lời phản hồi của bạn' : 'Bạn muốn chia sẻ điều gì?'}
        </label>
        <textarea
          ref={composer}
          id="community-comment-content"
          rows={4}
          maxLength={2000}
          value={content}
          placeholder="Viết bằng sự tôn trọng và đồng cảm…"
          onChange={(event) => setContent(event.target.value)}
        />
        <div>
          <span>{[...content].length}/2000</span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting
              ? 'Đang gửi…'
              : replyingTo
                ? 'Gửi phản hồi'
                : 'Gửi bình luận'}
          </button>
        </div>
      </div>

      {message && (
        <p className="community-comment-message" role="alert">
          {message}
        </p>
      )}

      {loading ? (
        <p className="community-comments-state" role="status">
          Đang tải bình luận…
        </p>
      ) : comments.length === 0 ? (
        <div className="community-comments-state">
          <strong>Chưa có bình luận</strong>
          <p>Bạn có thể là người đầu tiên gửi một lời đồng hành.</p>
        </div>
      ) : (
        <ol className="community-comment-list">
          {comments.map((comment) => {
            const own =
              comment.state === 'ACTIVE' &&
              comment.author.communityProfileId === ownProfileId
            const editing = editingId === comment.commentId
            return (
              <li
                key={comment.commentId}
                className={comment.parentCommentId ? 'is-reply' : undefined}
              >
                <CommunityAvatar
                  displayName={comment.author.displayName}
                  avatarPreset={comment.author.avatarPreset}
                  deleted={comment.author.state === 'DELETED'}
                  anonymous={comment.author.state === 'ANONYMOUS'}
                />
                <div className="community-comment-body">
                  <header>
                    <strong>{comment.author.displayName}</strong>
                    <time dateTime={comment.createdAt}>
                      {commentTime(comment.createdAt)}
                    </time>
                  </header>
                  {editing ? (
                    <div className="community-comment-edit">
                      <textarea
                        rows={4}
                        maxLength={2000}
                        value={editContent}
                        aria-label="Chỉnh sửa bình luận"
                        onChange={(event) => setEditContent(event.target.value)}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void saveEdit(comment)}
                        >
                          Lưu thay đổi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={
                        comment.state === 'OWNER_DELETED'
                          ? 'is-deleted'
                          : undefined
                      }
                    >
                      {comment.content}
                    </p>
                  )}
                  {!editing && comment.state === 'ACTIVE' && (
                    <div className="community-comment-actions">
                      {!comment.parentCommentId && (
                        <button
                          type="button"
                          onClick={() => beginReply(comment)}
                        >
                          Phản hồi
                        </button>
                      )}
                      {own && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(comment.commentId)
                              setEditContent(comment.content)
                              setReplyingTo(null)
                            }}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void remove(comment)}
                          >
                            Xóa
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {hasMore && (
        <button
          className="community-comments-more"
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? 'Đang tải…' : 'Xem thêm bình luận'}
        </button>
      )}
    </section>
  )
}

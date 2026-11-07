'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Sprout } from 'lucide-react'

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
import CommunityAuthorLink from './CommunityAuthorLink'
import CommunitySafetyActions from './CommunitySafetyActions'
import styles from './CommunityComments.module.css'

const MAX_COMMENT_CONTENT = 2000

type Props = Readonly<{
  postId: string
  onCountChange: (difference: number) => void
  focusComposer?: boolean
}>

function commentTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function CommunityComments({
  postId,
  onCountChange,
  focusComposer = false,
}: Props) {
  const { confirm, showActionToast } = useFeedback()
  const composer = useRef<HTMLTextAreaElement>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [ownProfileId, setOwnProfileId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [profileLoadError, setProfileLoadError] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [content, setContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [message, setMessage] = useState('')
  const createCommand = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  )

  useEffect(() => {
    if (!focusComposer || loading) return
    const frame = requestAnimationFrame(() =>
      composer.current?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [focusComposer, loading])

  const load = useCallback(async () => {
    const page = await getCommunityComments(postId)
    setComments(page.items)
    setCursor(page.nextCursor)
    setHasMore(page.hasMore)
    setLoadError('')
  }, [postId])

  useEffect(() => {
    let active = true
    void Promise.allSettled([
      getCommunityComments(postId),
      getCommunityProfile().catch((error) => {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }),
    ])
      .then(([pageResult, profileResult]) => {
        if (!active) return
        if (pageResult.status === 'fulfilled') {
          setComments(pageResult.value.items)
          setCursor(pageResult.value.nextCursor)
          setHasMore(pageResult.value.hasMore)
          setLoadError('')
        } else {
          setLoadError('Bình luận tạm thời chưa tải được.')
        }
        if (profileResult.status === 'fulfilled') {
          setOwnProfileId(profileResult.value?.data.communityProfileId ?? null)
          setProfileLoadError(false)
        } else {
          setProfileLoadError(true)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [postId, retryAttempt])

  function retryLoad() {
    setLoading(true)
    setLoadError('')
    setProfileLoadError(false)
    setRetryAttempt((current) => current + 1)
  }

  function beginReply(comment: CommunityComment) {
    setReplyingTo(comment)
    setEditingId(null)
    requestAnimationFrame(() => composer.current?.focus())
  }

  async function submit() {
    const normalized = content.trim()
    if (!normalized || [...normalized].length > MAX_COMMENT_CONTENT) {
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
    if (!normalized || [...normalized].length > MAX_COMMENT_CONTENT) {
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
    <section
      className={`community-comments ${styles.comments}`}
      aria-labelledby="comments-title"
    >
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

      {loadError && !loading && (
        <div className={styles.loadError} role="alert">
          <div>
            <strong>{loadError}</strong>
            <p>Thử tải lại để tiếp tục đọc cuộc trò chuyện.</p>
          </div>
          <button type="button" onClick={retryLoad}>
            Thử lại
          </button>
        </div>
      )}
      {profileLoadError && !loading && (
        <div className={styles.profileNotice} role="status">
          <span>Thông tin danh tính bình luận của bạn chưa tải được.</span>
          <button type="button" onClick={retryLoad}>
            Tải lại
          </button>
        </div>
      )}
      {loading && comments.length === 0 ? (
        <p className="community-comments-state" role="status">
          Đang tải bình luận…
        </p>
      ) : comments.length === 0 && !loadError ? (
        <div className="community-comments-state">
          <strong>Chưa có bình luận</strong>
          <p>Bạn có thể là người đầu tiên gửi một lời đồng hành.</p>
        </div>
      ) : comments.length > 0 ? (
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
                <CommunityAuthorLink author={comment.author}>
                  <CommunityAvatar
                    displayName={comment.author.displayName}
                    avatarPreset={comment.author.avatarPreset}
                    avatarImage={comment.author.avatarImage}
                    deleted={comment.author.state === 'DELETED'}
                    anonymous={comment.author.state === 'ANONYMOUS'}
                  />
                </CommunityAuthorLink>
                <div className="community-comment-body">
                  <div className="community-comment-bubble">
                    <header>
                      <strong>
                        <CommunityAuthorLink author={comment.author} />
                      </strong>
                      <time dateTime={comment.createdAt}>
                        {commentTime(comment.createdAt)}
                      </time>
                    </header>
                    {editing ? (
                      <div className="community-comment-edit">
                        <textarea
                          rows={4}
                          disabled={submitting}
                          maxLength={MAX_COMMENT_CONTENT * 2}
                          value={editContent}
                          aria-label="Chỉnh sửa bình luận"
                          onChange={(event) =>
                            setEditContent(event.target.value)
                          }
                        />
                        <div>
                          <button
                            type="button"
                            disabled={submitting}
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
                  </div>
                  {!editing && comment.state === 'ACTIVE' && (
                    <div className="community-comment-actions">
                      {!comment.parentCommentId && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => beginReply(comment)}
                        >
                          Phản hồi
                        </button>
                      )}
                      {own && (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
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
                  {!editing && comment.state === 'ACTIVE' && !own && (
                    <CommunitySafetyActions
                      targetType="COMMENT"
                      targetId={comment.commentId}
                      communityProfileId={comment.author.communityProfileId}
                      onHidden={() => {
                        setComments((current) =>
                          current.filter(
                            (item) => item.commentId !== comment.commentId,
                          ),
                        )
                        onCountChange(-1)
                      }}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}

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
      {message && (
        <p
          id="community-comment-message"
          className="community-comment-message"
          role="alert"
        >
          {message}
        </p>
      )}
      <div className={`community-comment-composer ${styles.composer}`}>
        {replyingTo && (
          <div className="community-replying-to">
            <span>
              Đang phản hồi <strong>{replyingTo.author.displayName}</strong>
            </span>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setReplyingTo(null)}
            >
              Hủy phản hồi
            </button>
          </div>
        )}
        <label
          className={styles.composerLabel}
          htmlFor="community-comment-content"
        >
          {replyingTo ? 'Lời phản hồi của bạn' : 'Bạn muốn chia sẻ điều gì?'}
        </label>
        <div className={styles.inputRow}>
          <span className={styles.composerMark} aria-hidden="true">
            <Sprout size={21} />
          </span>
          <textarea
            ref={composer}
            id="community-comment-content"
            rows={2}
            disabled={submitting}
            maxLength={MAX_COMMENT_CONTENT * 2}
            value={content}
            aria-describedby={message ? 'community-comment-message' : undefined}
            placeholder="Viết bằng sự tôn trọng và đồng cảm…"
            onChange={(event) => setContent(event.target.value)}
          />
          <button
            type="button"
            className={styles.send}
            disabled={submitting || !content.trim()}
            aria-label={
              submitting
                ? 'Đang gửi…'
                : replyingTo
                  ? 'Gửi phản hồi'
                  : 'Gửi bình luận'
            }
            onClick={() => void submit()}
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.composerMeta}>
          <span>Lắng nghe bằng sự tôn trọng và đồng cảm.</span>
          <span>
            {[...content].length}/{MAX_COMMENT_CONTENT}
          </span>
        </div>
      </div>
    </section>
  )
}

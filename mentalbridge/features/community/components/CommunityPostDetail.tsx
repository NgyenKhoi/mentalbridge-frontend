'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import {
  deleteCommunityPost,
  getCommunityPost,
  getCommunityTopics,
  updateCommunityPost,
  type CommunityPostDetail as Post,
  type CommunityTopic,
  type CommunityTopicCode,
} from '@/features/community/api/browser-community'
import CommunityMedia from './CommunityMedia'
import CommunityAvatar from './CommunityAvatar'
import CommunityComments from './CommunityComments'
import CommunitySafetyActions from './CommunitySafetyActions'
import CommunityInteractions from './CommunityInteractions'
import CommunityResourceAttachment from './CommunityResourceAttachment'
import CommunityResourceSelector from './CommunityResourceSelector'
import CommunitySensitiveContent from './CommunitySensitiveContent'

function communityTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

const DetailStatIcon = ({ name }: Readonly<{ name: 'heart' | 'comment' }>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {name === 'comment' ? (
      <path d="M5 5h14v10H9l-4 4V5Z" />
    ) : (
      <path d="M20.5 9.4c0 4.4-5.2 8-8.5 10.1C8.7 17.4 3.5 13.8 3.5 9.4A4.4 4.4 0 0 1 12 7.8a4.4 4.4 0 0 1 8.5 1.6Z" />
    )}
  </svg>
)

export default function CommunityPostDetail({ postId }: { postId: string }) {
  const router = useRouter()
  const { confirm, showActionToast } = useFeedback()
  const [post, setPost] = useState<Post>()
  const [version, setVersion] = useState<number | null>(null)
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [selected, setSelected] = useState<CommunityTopicCode[]>([])
  const [authorMode, setAuthorMode] = useState<'PROFILE' | 'ANONYMOUS'>(
    'PROFILE',
  )
  const [saving, setSaving] = useState(false)
  const [resourceId, setResourceId] = useState<string | null>(null)
  const [sensitiveContentWarning, setSensitiveContentWarning] = useState<
    'SENSITIVE_CONTENT' | null
  >(null)

  const loadPost = useCallback(async () => {
    const result = await getCommunityPost(postId)
    setPost(result.post)
    setVersion(result.version)
    setContent(result.post.content)
    setSelected(result.post.topics)
    setResourceId(result.post.resourceAttachment?.resourceId ?? null)
    setSensitiveContentWarning(result.post.sensitiveContentWarning)
    setAuthorMode(
      result.post.author.state === 'ANONYMOUS' ? 'ANONYMOUS' : 'PROFILE',
    )
    return result
  }, [postId])

  useEffect(() => {
    let active = true
    void Promise.all([getCommunityPost(postId), getCommunityTopics()])
      .then(([result, topicValues]) => {
        if (!active) return
        setPost(result.post)
        setVersion(result.version)
        setContent(result.post.content)
        setSelected(result.post.topics)
        setResourceId(result.post.resourceAttachment?.resourceId ?? null)
        setSensitiveContentWarning(result.post.sensitiveContentWarning)
        setAuthorMode(
          result.post.author.state === 'ANONYMOUS' ? 'ANONYMOUS' : 'PROFILE',
        )
        setTopics(topicValues)
      })
      .catch((cause) => {
        if (!active) return
        setMessage(
          cause instanceof ApiError && cause.status === 404
            ? 'Bài viết này không còn khả dụng.'
            : 'Bài viết tạm thời chưa tải được.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [postId])

  function toggleTopic(topic: CommunityTopicCode) {
    setSelected((current) =>
      current.includes(topic)
        ? current.filter((value) => value !== topic)
        : current.length < 3
          ? [...current, topic]
          : current,
    )
  }

  async function save() {
    if (!post || version === null) return
    const normalized = content.trim()
    if (
      !normalized ||
      [...normalized].length > 5000 ||
      selected.length < 1 ||
      selected.length > 3
    ) {
      setMessage('Hãy nhập nội dung và chọn từ một đến ba chủ đề.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const result = await updateCommunityPost(
        post.postId,
        {
          content: normalized,
          topics: selected,
          mediaIds: post.media.map((item) => item.mediaId),
          authorMode,
          resourceId,
          sensitiveContentWarning,
        },
        version,
      )
      setPost(result.post)
      setVersion(result.version)
      setEditing(false)
      showActionToast({ title: 'Đã lưu thay đổi', tone: 'success' })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 412) {
        try {
          await loadPost()
          setEditing(false)
          setMessage(
            'Bài viết vừa được thay đổi ở nơi khác. Nội dung mới nhất đã được tải lại.',
          )
        } catch {
          setMessage('Bài viết này không còn khả dụng.')
        }
      } else if (cause instanceof ApiError && cause.status === 404) {
        setPost(undefined)
        setMessage('Bài viết này không còn khả dụng.')
      } else {
        setMessage('Thay đổi chưa thể lưu lúc này. Bạn có thể thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!post || version === null) return
    const accepted = await confirm({
      title: 'Xóa bài viết này?',
      description:
        'Bài viết sẽ biến mất khỏi cộng đồng ngay lập tức. Thao tác này không thể hoàn tác.',
      confirmLabel: 'Xóa bài viết',
      tone: 'danger',
    })
    if (!accepted) return
    setSaving(true)
    setMessage('')
    try {
      await deleteCommunityPost(post.postId, version)
      showActionToast({ title: 'Đã xóa bài viết', tone: 'success' })
      router.push('/community')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 412) {
        try {
          await loadPost()
          setMessage(
            'Bài viết vừa được thay đổi. Hãy xem lại nội dung mới nhất trước khi xóa.',
          )
        } catch {
          setPost(undefined)
          setMessage('Bài viết này không còn khả dụng.')
        }
      } else if (cause instanceof ApiError && cause.status === 404) {
        setPost(undefined)
        setMessage('Bài viết này không còn khả dụng.')
      } else {
        setMessage('Bài viết chưa thể xóa lúc này. Bạn có thể thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section
        className="community-state community-detail-state"
        role="status"
        aria-busy="true"
      >
        <h1>Đang tải bài viết…</h1>
      </section>
    )
  }
  if (!post) {
    return (
      <section className="community-state community-detail-state" role="alert">
        <h1>{message || 'Bài viết này không còn khả dụng.'}</h1>
        <Link href="/community">Trở về bảng tin</Link>
      </section>
    )
  }

  return (
    <div className="community-detail-page">
      <Link className="community-back" href="/community">
        ← Trở về bảng tin
      </Link>
      {message && (
        <p className="community-detail-message" role="alert">
          {message}
        </p>
      )}
      <article className="community-detail">
        <header>
          <CommunityAvatar
            displayName={post.author.displayName}
            avatarPreset={post.author.avatarPreset}
            deleted={post.author.state === 'DELETED'}
            anonymous={post.author.state === 'ANONYMOUS'}
          />
          <div>
            <strong>{post.author.displayName}</strong>
            <time dateTime={post.publishedAt}>
              {communityTime(post.publishedAt)}
            </time>
          </div>
          {version !== null && !editing && (
            <div className="community-owner-actions">
              <button type="button" onClick={() => setEditing(true)}>
                Chỉnh sửa
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
              >
                Xóa
              </button>
            </div>
          )}
        </header>
        {editing ? (
          <div className="community-edit-form">
            <label htmlFor="community-edit-content">Nội dung</label>
            <textarea
              id="community-edit-content"
              rows={8}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <span>{[...content].length}/5000 ký tự</span>
            <fieldset>
              <legend>Chọn 1–3 chủ đề</legend>
              <div className="community-topic-choices">
                {topics.map((topic) => (
                  <label key={topic.code}>
                    <input
                      type="checkbox"
                      checked={selected.includes(topic.code)}
                      disabled={
                        !selected.includes(topic.code) && selected.length >= 3
                      }
                      onChange={() => toggleTopic(topic.code)}
                    />
                    <span>{topic.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="community-identity-choices">
              <legend>Danh tính hiển thị cho bài viết</legend>
              <p>Bạn có thể đổi lựa chọn này riêng cho bài viết hiện tại.</p>
              <div>
                <label>
                  <input
                    type="radio"
                    name="community-edit-author-mode"
                    checked={authorMode === 'PROFILE'}
                    onChange={() => setAuthorMode('PROFILE')}
                  />
                  <span>
                    <strong>Dùng danh tính cộng đồng</strong>
                    <small>Hiển thị tên và hình đại diện bạn đã chọn.</small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="community-edit-author-mode"
                    checked={authorMode === 'ANONYMOUS'}
                    onChange={() => setAuthorMode('ANONYMOUS')}
                  />
                  <span>
                    <strong>Đăng ẩn danh</strong>
                    <small>
                      Ẩn liên kết công khai tới danh tính cộng đồng.
                    </small>
                  </span>
                </label>
              </div>
            </fieldset>
            <CommunityResourceSelector
              value={resourceId}
              disabled={saving}
              onChange={setResourceId}
            />
            <fieldset className="community-sensitive-choice">
              <legend>Cảnh báo nội dung</legend>
              <label>
                <input
                  type="checkbox"
                  checked={sensitiveContentWarning === 'SENSITIVE_CONTENT'}
                  onChange={(event) =>
                    setSensitiveContentWarning(
                      event.target.checked ? 'SENSITIVE_CONTENT' : null,
                    )
                  }
                />
                <span>
                  <strong>Thêm cảnh báo nội dung nhạy cảm</strong>
                  <small>
                    Cảnh báo giúp người đọc chủ động mở nội dung; đây không phải
                    chẩn đoán hay đánh giá mức độ.
                  </small>
                </span>
              </label>
            </fieldset>
            <div className="community-form-actions">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setContent(post.content)
                  setSelected(post.topics)
                  setResourceId(post.resourceAttachment?.resourceId ?? null)
                  setSensitiveContentWarning(post.sensitiveContentWarning)
                  setAuthorMode(
                    post.author.state === 'ANONYMOUS' ? 'ANONYMOUS' : 'PROFILE',
                  )
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="community-card-topics">
              {post.topics.map((topic) => (
                <span key={topic}>
                  {topics.find((value) => value.code === topic)?.label ?? topic}
                </span>
              ))}
            </div>
            <CommunitySensitiveContent
              warned={post.sensitiveContentWarning === 'SENSITIVE_CONTENT'}
            >
              <p className="community-detail-copy">{post.content}</p>
              <CommunityMedia media={post.media} />
              {post.resourceAttachment && (
                <CommunityResourceAttachment
                  resourceId={post.resourceAttachment.resourceId}
                />
              )}
              {post.mediaAvailability === 'PARTIAL' && (
                <p className="community-media-note">
                  Một số nội dung đa phương tiện đang được xử lý.
                </p>
              )}
              {post.mediaAvailability === 'UNAVAILABLE' && (
                <p className="community-media-note">
                  Nội dung đa phương tiện hiện chưa khả dụng.
                </p>
              )}
            </CommunitySensitiveContent>
            {post.viewerState ? (
              <CommunityInteractions
                postId={post.postId}
                viewerState={post.viewerState}
                reactionCount={post.counts.reactions}
                onChange={(viewerState, reactions) =>
                  setPost((current) =>
                    current
                      ? {
                          ...current,
                          viewerState,
                          counts: { ...current.counts, reactions },
                        }
                      : current,
                  )
                }
              />
            ) : null}
            <footer>
              {!post.viewerState && (
                <span className="community-card-stat">
                  <DetailStatIcon name="heart" />
                  {post.counts.reactions} lượt đồng hành
                </span>
              )}
              <span className="community-card-stat">
                <DetailStatIcon name="comment" />
                {post.counts.comments} bình luận
              </span>
            </footer>
            {version === null && (
              <CommunitySafetyActions
                targetType="POST"
                targetId={post.postId}
                communityProfileId={post.author.communityProfileId}
                onHidden={() => router.push('/community')}
              />
            )}
          </>
        )}
      </article>
      <CommunityComments
        postId={post.postId}
        onCountChange={(difference) =>
          setPost((current) =>
            current
              ? {
                  ...current,
                  counts: {
                    ...current.counts,
                    comments: Math.max(0, current.counts.comments + difference),
                  },
                }
              : current,
          )
        }
      />
    </div>
  )
}

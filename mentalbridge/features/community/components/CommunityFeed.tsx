'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import {
  getCommunityFeed,
  getCommunityTopics,
  type CommunityPostDetail,
  type CommunityTopic,
  type CommunityTopicCode,
} from '@/features/community/api/browser-community'
import CommunityMedia from './CommunityMedia'
import CommunityPostComposer from './CommunityPostComposer'
import CommunityAvatar from './CommunityAvatar'
import CommunityInteractions from './CommunityInteractions'
import CommunityResourceAttachment from './CommunityResourceAttachment'

type FeedPost = Omit<CommunityPostDetail, 'content'> & {
  contentPreview: string
}

function communityTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function MediaNotice({ availability }: { availability: string }) {
  if (availability === 'PARTIAL') {
    return (
      <p className="community-media-note">
        Một số nội dung đa phương tiện đang được xử lý.
      </p>
    )
  }
  if (availability === 'UNAVAILABLE') {
    return (
      <p className="community-media-note">
        Nội dung đa phương tiện hiện chưa khả dụng.
      </p>
    )
  }
  return null
}

export default function CommunityFeed() {
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [selectedTopics, setSelectedTopics] = useState<CommunityTopicCode[]>([])
  const [items, setItems] = useState<FeedPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [topicsError, setTopicsError] = useState(false)
  const feedGeneration = useRef(0)

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const requestGeneration = feedGeneration.current
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const page = await getCommunityFeed(selectedTopics, cursor)
        if (requestGeneration !== feedGeneration.current) return
        setItems((current) => {
          if (!append) return page.items
          const known = new Set(current.map((item) => item.postId))
          return [
            ...current,
            ...page.items.filter((item) => !known.has(item.postId)),
          ]
        })
        setNextCursor(page.nextCursor)
      } catch {
        if (requestGeneration === feedGeneration.current) {
          setError('Bảng tin cộng đồng tạm thời chưa tải được.')
        }
      } finally {
        if (requestGeneration === feedGeneration.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [selectedTopics],
  )

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true)
    setTopicsError(false)
    try {
      setTopics(await getCommunityTopics())
    } catch {
      setTopics([])
      setTopicsError(true)
    } finally {
      setTopicsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void getCommunityTopics()
      .then((value) => {
        if (active) setTopics(value)
      })
      .catch(() => {
        if (active) setTopicsError(true)
      })
      .finally(() => {
        if (active) setTopicsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const requestGeneration = feedGeneration.current
    void getCommunityFeed(selectedTopics)
      .then((page) => {
        if (!active || requestGeneration !== feedGeneration.current) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
      })
      .catch(() => {
        if (active && requestGeneration === feedGeneration.current) {
          setError('Bảng tin cộng đồng tạm thời chưa tải được.')
        }
      })
      .finally(() => {
        if (active && requestGeneration === feedGeneration.current) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [selectedTopics])

  function changeTopics(
    update: (current: CommunityTopicCode[]) => CommunityTopicCode[],
  ) {
    feedGeneration.current += 1
    setLoading(true)
    setLoadingMore(false)
    setError('')
    setSelectedTopics(update)
  }

  function toggleTopic(topic: CommunityTopicCode) {
    changeTopics((current) =>
      current.includes(topic)
        ? current.filter((value) => value !== topic)
        : current.length < 3
          ? [...current, topic]
          : current,
    )
  }

  return (
    <div className="community-page">
      <header className="community-hero">
        <div>
          <span>Không gian đồng hành</span>
          <h1>Cộng đồng MentalBridge</h1>
          <p>
            Đọc những câu chuyện, bước tiến nhỏ và kinh nghiệm do thành viên chủ
            động chia sẻ.
          </p>
        </div>
        <aside>
          <strong>Quyền riêng tư là nền tảng</strong>
          <p>
            Bảng tin chỉ dùng chủ đề bạn chọn, không dùng nhật ký, cảm xúc hay
            kết quả sàng lọc để xếp hạng.
          </p>
          <Link className="community-profile-link" href="/community/profile">
            Quản lý tên hiển thị cộng đồng
          </Link>
        </aside>
      </header>

      <CommunityPostComposer topics={topics} />

      <nav className="community-topics" aria-label="Lọc bảng tin theo chủ đề">
        <button
          type="button"
          className={selectedTopics.length === 0 ? 'is-active' : ''}
          aria-pressed={selectedTopics.length === 0}
          onClick={() => changeTopics(() => [])}
        >
          Tất cả
        </button>
        {topics.map((topic) => (
          <button
            key={topic.code}
            type="button"
            title={topic.description}
            className={selectedTopics.includes(topic.code) ? 'is-active' : ''}
            aria-pressed={selectedTopics.includes(topic.code)}
            disabled={
              !selectedTopics.includes(topic.code) && selectedTopics.length >= 3
            }
            onClick={() => toggleTopic(topic.code)}
          >
            {topic.label}
          </button>
        ))}
      </nav>

      {topicsLoading ? (
        <p className="community-topic-status" role="status">
          Đang tải chủ đề cộng đồng…
        </p>
      ) : topicsError ? (
        <div className="community-inline-error" role="alert">
          <span>Danh sách chủ đề tạm thời chưa tải được.</span>
          <button type="button" onClick={() => void loadTopics()}>
            Thử lại
          </button>
        </div>
      ) : topics.length === 0 ? (
        <p className="community-topic-status" role="status">
          Chưa có chủ đề đang hoạt động. Bạn vẫn có thể đọc bảng tin nhưng chưa
          thể lọc hoặc đăng bài mới.
        </p>
      ) : (
        <p className="community-topic-status" aria-live="polite">
          {selectedTopics.length === 0
            ? 'Đang hiển thị tất cả bài viết mới nhất.'
            : `Đang lọc theo ${selectedTopics.length} chủ đề; bài viết chỉ cần thuộc một chủ đề đã chọn.`}
        </p>
      )}

      {loading ? (
        <section className="community-state" role="status" aria-busy="true">
          <h2>Đang tải câu chuyện…</h2>
          <p>Những chia sẻ mới nhất đang được chuẩn bị.</p>
        </section>
      ) : error && items.length === 0 ? (
        <section className="community-state" role="alert">
          <h2>{error}</h2>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : items.length === 0 ? (
        <section className="community-state" role="status">
          <h2>Chưa có bài viết trong chủ đề này</h2>
          <p>Bạn có thể chọn chủ đề khác để tiếp tục khám phá.</p>
        </section>
      ) : (
        <>
          {error && (
            <div className="community-inline-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void load()}>
                Tải lại
              </button>
            </div>
          )}
          <section className="community-feed" aria-label="Bài viết cộng đồng">
            {items.map((post) => (
              <article className="community-card" key={post.postId}>
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
                </header>
                <div className="community-card-topics">
                  {post.topics.map((topic) => (
                    <span key={topic}>
                      {topics.find((value) => value.code === topic)?.label ??
                        topic}
                    </span>
                  ))}
                </div>
                <p className="community-card-copy">{post.contentPreview}</p>
                <CommunityMedia media={post.media} />
                <MediaNotice availability={post.mediaAvailability} />
                {post.resourceAttachment && (
                  <CommunityResourceAttachment
                    resourceId={post.resourceAttachment.resourceId}
                  />
                )}
                <footer>
                  {post.viewerState ? (
                    <CommunityInteractions
                      postId={post.postId}
                      viewerState={post.viewerState}
                      reactionCount={post.counts.reactions}
                      onChange={(viewerState, reactions) =>
                        setItems((current) =>
                          current.map((item) =>
                            item.postId === post.postId
                              ? {
                                  ...item,
                                  viewerState,
                                  counts: { ...item.counts, reactions },
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  ) : (
                    <span>♡ {post.counts.reactions}</span>
                  )}
                  <span>◇ {post.counts.comments} bình luận</span>
                  <Link href={`/community/${post.postId}`}>
                    Đọc bài viết <span aria-hidden="true">→</span>
                  </Link>
                </footer>
              </article>
            ))}
          </section>
          {nextCursor && (
            <button
              type="button"
              className="community-load-more"
              disabled={loadingMore}
              onClick={() => void load(nextCursor, true)}
            >
              {loadingMore ? 'Đang tải…' : 'Xem thêm câu chuyện'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

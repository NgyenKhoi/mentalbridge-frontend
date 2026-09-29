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
  const [selectedTopic, setSelectedTopic] = useState<CommunityTopicCode>()
  const [items, setItems] = useState<FeedPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const feedGeneration = useRef(0)

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const requestGeneration = feedGeneration.current
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const page = await getCommunityFeed(selectedTopic, cursor)
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
    [selectedTopic],
  )

  useEffect(() => {
    let active = true
    void getCommunityTopics()
      .then((value) => {
        if (active) setTopics(value)
      })
      .catch(() => {
        if (active) setTopics([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const requestGeneration = feedGeneration.current
    void getCommunityFeed(selectedTopic)
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
  }, [selectedTopic])

  function selectTopic(topic?: CommunityTopicCode) {
    if (topic === selectedTopic) return
    feedGeneration.current += 1
    setLoading(true)
    setLoadingMore(false)
    setError('')
    setSelectedTopic(topic)
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
        </aside>
      </header>

      <nav className="community-topics" aria-label="Lọc bảng tin theo chủ đề">
        <button
          type="button"
          className={selectedTopic === undefined ? 'is-active' : ''}
          aria-pressed={selectedTopic === undefined}
          onClick={() => selectTopic()}
        >
          Tất cả
        </button>
        {topics.map((topic) => (
          <button
            key={topic.code}
            type="button"
            title={topic.description}
            className={selectedTopic === topic.code ? 'is-active' : ''}
            aria-pressed={selectedTopic === topic.code}
            onClick={() => selectTopic(topic.code)}
          >
            {topic.label}
          </button>
        ))}
      </nav>

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
                  <div
                    className={`community-avatar ${post.author.state === 'DELETED' ? 'is-deleted' : ''}`}
                    aria-hidden="true"
                  >
                    {post.author.state === 'DELETED'
                      ? '—'
                      : post.author.displayName.slice(0, 1).toUpperCase()}
                  </div>
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
                <footer>
                  <span>♡ {post.counts.reactions}</span>
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

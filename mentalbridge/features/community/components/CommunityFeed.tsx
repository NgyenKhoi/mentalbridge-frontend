'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { Disclosure } from '@/components/ui/Disclosure'
import {
  getCommunityFeed,
  getCommunitySavedPosts,
  getCommunityTopics,
  type CommunityPostDetail,
  type CommunityTopic,
  type CommunityTopicCode,
} from '@/features/community/api/browser-community'
import CommunityMedia from './CommunityMedia'
import CommunityPostComposer from './CommunityPostComposer'
import CommunitySensitiveContent from './CommunitySensitiveContent'
import CommunityAvatar from './CommunityAvatar'
import CommunityInteractions from './CommunityInteractions'
import CommunityResourceAttachment from './CommunityResourceAttachment'

type FeedPost = Omit<CommunityPostDetail, 'content'> & {
  contentPreview: string
}

type CommunityFeedProps = {
  view?: 'feed' | 'saved'
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

function FeedIcon({ name }: Readonly<{ name: 'comment' | 'heart' | 'lock' }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'comment' && <path d="M5 5h14v10H9l-4 4V5Z" />}
      {name === 'heart' && (
        <path d="M20.5 9.4c0 4.4-5.2 8-8.5 10.1C8.7 17.4 3.5 13.8 3.5 9.4A4.4 4.4 0 0 1 12 7.8a4.4 4.4 0 0 1 8.5 1.6Z" />
      )}
      {name === 'lock' && (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2.5" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
        </>
      )}
    </svg>
  )
}

export default function CommunityFeed({ view = 'feed' }: CommunityFeedProps) {
  const savedView = view === 'saved'
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [selectedTopics, setSelectedTopics] = useState<CommunityTopicCode[]>([])
  const [items, setItems] = useState<FeedPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [topicsError, setTopicsError] = useState(false)
  const [topicsExpanded, setTopicsExpanded] = useState(true)
  const feedGeneration = useRef(0)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const desktop = window.matchMedia('(min-width: 901px)')
    const sync = () => setTopicsExpanded(desktop.matches)
    sync()
    desktop.addEventListener('change', sync)
    return () => desktop.removeEventListener('change', sync)
  }, [])

  const getPage = useCallback(
    (cursor?: string) =>
      savedView
        ? getCommunitySavedPosts(cursor)
        : cursor === undefined
          ? getCommunityFeed(selectedTopics)
          : getCommunityFeed(selectedTopics, cursor),
    [savedView, selectedTopics],
  )

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const requestGeneration = feedGeneration.current
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const page = await getPage(cursor)
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
          setError(
            savedView
              ? 'Danh sách bài đã lưu tạm thời chưa tải được.'
              : 'Bảng tin cộng đồng tạm thời chưa tải được.',
          )
        }
      } finally {
        if (requestGeneration === feedGeneration.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [getPage, savedView],
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
    void getPage()
      .then((page) => {
        if (!active || requestGeneration !== feedGeneration.current) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
      })
      .catch(() => {
        if (active && requestGeneration === feedGeneration.current) {
          setError(
            savedView
              ? 'Danh sách bài đã lưu tạm thời chưa tải được.'
              : 'Bảng tin cộng đồng tạm thời chưa tải được.',
          )
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
  }, [getPage, savedView])

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
      <div className="community-feed-intro">
        <header className="community-hero">
          <div>
            <h1>{savedView ? 'Bài viết đã lưu' : 'Cộng đồng MentalBridge'}</h1>
            <p>
              {savedView
                ? 'Tìm lại những câu chuyện bạn muốn đọc tiếp hoặc giữ bên mình.'
                : 'Những câu chuyện thật. Những bước tiến nhỏ. Cùng nhau mỗi ngày.'}
            </p>
            {savedView && (
              <div className="community-private-context">
                <FeedIcon name="lock" />
                <span>Chỉ bạn thấy danh sách này</span>
                <Link href="/community">Quay lại bảng tin</Link>
              </div>
            )}
          </div>
        </header>

        {!savedView && <CommunityPostComposer topics={topics} />}
      </div>

      {!savedView && (
        <aside className="community-topic-dock" aria-label="Khám phá chủ đề">
          <Disclosure
            className="community-topic-disclosure"
            summary="Khám phá theo chủ đề"
            meta={
              selectedTopics.length > 0
                ? `${selectedTopics.length} đã chọn`
                : 'Chọn tối đa 3'
            }
            open={topicsExpanded}
            onToggle={(event) => setTopicsExpanded(event.currentTarget.open)}
          >
            <nav
              className="community-topics"
              aria-label="Lọc bảng tin theo chủ đề"
            >
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
                  className={
                    selectedTopics.includes(topic.code) ? 'is-active' : ''
                  }
                  aria-pressed={selectedTopics.includes(topic.code)}
                  disabled={
                    !selectedTopics.includes(topic.code) &&
                    selectedTopics.length >= 3
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
                Chưa có chủ đề đang hoạt động. Bạn vẫn có thể đọc bảng tin nhưng
                chưa thể lọc hoặc đăng bài mới.
              </p>
            ) : (
              <p className="community-topic-status" aria-live="polite">
                {selectedTopics.length === 0
                  ? 'Đang hiển thị tất cả bài viết mới nhất.'
                  : `Đang lọc theo ${selectedTopics.length} chủ đề.`}
              </p>
            )}
            {selectedTopics.length > 0 && (
              <button
                className="community-clear-topics"
                type="button"
                onClick={() => changeTopics(() => [])}
              >
                Xóa bộ lọc
              </button>
            )}
          </Disclosure>
        </aside>
      )}

      <div className="community-feed-content">
        {loading ? (
          <section className="community-state" role="status" aria-busy="true">
            <h2>
              {savedView ? 'Đang tải bài viết đã lưu…' : 'Đang tải câu chuyện…'}
            </h2>
            <p>
              {savedView
                ? 'Bộ sưu tập riêng của bạn đang được chuẩn bị.'
                : 'Những chia sẻ mới nhất đang được chuẩn bị.'}
            </p>
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
            <h2>
              {savedView
                ? 'Bạn chưa lưu bài viết nào'
                : 'Chưa có bài viết trong chủ đề này'}
            </h2>
            <p>
              {savedView
                ? 'Khi gặp một câu chuyện muốn đọc lại, hãy chọn Lưu bài viết.'
                : 'Bạn có thể chọn chủ đề khác để tiếp tục khám phá.'}
            </p>
            {savedView && (
              <Link className="community-profile-link" href="/community">
                Khám phá bảng tin
              </Link>
            )}
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
            <section
              className="community-feed"
              aria-label={
                savedView ? 'Bài viết bạn đã lưu' : 'Bài viết cộng đồng'
              }
            >
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
                  <CommunitySensitiveContent
                    warned={
                      post.sensitiveContentWarning === 'SENSITIVE_CONTENT'
                    }
                  >
                    <p className="community-card-copy">{post.contentPreview}</p>
                    <CommunityMedia media={post.media} />
                    <MediaNotice availability={post.mediaAvailability} />
                    {post.resourceAttachment && (
                      <CommunityResourceAttachment
                        resourceId={post.resourceAttachment.resourceId}
                      />
                    )}
                  </CommunitySensitiveContent>
                  <footer>
                    {post.viewerState ? (
                      <CommunityInteractions
                        postId={post.postId}
                        viewerState={post.viewerState}
                        reactionCount={post.counts.reactions}
                        onChange={(viewerState, reactions) => {
                          if (savedView && !viewerState.bookmarked) {
                            setItems((current) =>
                              current.filter(
                                (item) => item.postId !== post.postId,
                              ),
                            )
                            void load()
                            return
                          }
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
                        }}
                      />
                    ) : (
                      <span className="community-card-stat">
                        <FeedIcon name="heart" />
                        {post.counts.reactions} lượt đồng hành
                      </span>
                    )}
                    <Link
                      className="community-comment-link"
                      href={`/community/${post.postId}#comments-title`}
                      aria-label={`Bình luận bài viết của ${post.author.displayName}`}
                    >
                      <FeedIcon name="comment" />
                      {post.counts.comments} bình luận
                    </Link>
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
                {loadingMore
                  ? 'Đang tải…'
                  : savedView
                    ? 'Xem thêm bài đã lưu'
                    : 'Xem thêm câu chuyện'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

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
import CommunitySavedPost from './CommunitySavedPost'
import CommunityPostComposer from './CommunityPostComposer'
import CommunitySensitiveContent from './CommunitySensitiveContent'
import CommunityAvatar from './CommunityAvatar'
import CommunityAuthorLink from './CommunityAuthorLink'
import CommunityInteractions from './CommunityInteractions'
import CommunityResourceAttachment from './CommunityResourceAttachment'
import {
  CommunityHelpCard,
  CommunityMembers,
  CommunityMoments,
  CommunityPrompt,
} from './CommunityDiscovery'
import CommunitySafetyActions from './CommunitySafetyActions'
import CommunityCommentsDialog from './CommunityCommentsDialog'
import discussionStyles from './CommunityCommentsDialog.module.css'

type FeedPost = Omit<CommunityPostDetail, 'content'> & {
  contentPreview: string
}

type CommunityFeedProps = {
  view?: 'feed' | 'saved'
  search?: string
  openReels?: boolean
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

export default function CommunityFeed({
  view = 'feed',
  search = '',
  openReels = false,
}: CommunityFeedProps) {
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
  const [order, setOrder] = useState<'topics' | 'latest' | 'support'>('latest')
  const [suggestion, setSuggestion] = useState('')
  const [mediaComposeRequest, setMediaComposeRequest] = useState(0)
  const [discussion, setDiscussion] = useState<{
    postId: string
    authorName: string
  } | null>(null)
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const discussionTrigger = useRef<HTMLButtonElement | null>(null)
  const restoreDiscussionFocus = useCallback(
    () =>
      discussionTrigger.current?.isConnected
        ? discussionTrigger.current
        : document.querySelector<HTMLElement>(
            '.community-feed-toolbar button, a[href="/community"]',
          ),
    [],
  )

  function openDiscussion(post: FeedPost, trigger: HTMLButtonElement) {
    discussionTrigger.current = trigger
    setDiscussion({ postId: post.postId, authorName: post.author.displayName })
    setDiscussionOpen(true)
  }

  const syncDiscussionPost = useCallback(
    (post: CommunityPostDetail) => {
      setItems((current) =>
        savedView && post.viewerState && !post.viewerState.bookmarked
          ? current.filter((item) => item.postId !== post.postId)
          : current.map((item) =>
              item.postId === post.postId
                ? {
                    ...item,
                    viewerState: post.viewerState,
                    counts: post.counts,
                  }
                : item,
            ),
      )
    },
    [savedView],
  )

  function removeDiscussionPost(postId: string) {
    setDiscussionOpen(false)
    setItems((current) => current.filter((item) => item.postId !== postId))
  }

  function updateInteractions(
    postId: string,
    viewerState: NonNullable<CommunityPostDetail['viewerState']>,
    reactions: number,
  ) {
    if (savedView && !viewerState.bookmarked) {
      setItems((current) => current.filter((item) => item.postId !== postId))
      void load()
      return
    }
    setItems((current) =>
      current.map((item) =>
        item.postId === postId
          ? { ...item, viewerState, counts: { ...item.counts, reactions } }
          : item,
      ),
    )
  }
  const searchTerm = search
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
  const visibleItems = items.filter(
    (post) =>
      !searchTerm ||
      `${post.contentPreview} ${post.author.displayName}`
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLocaleLowerCase('vi-VN')
        .replace(/đ/g, 'd')
        .includes(searchTerm),
  )
  if (order === 'support')
    visibleItems.sort((a, b) => b.counts.reactions - a.counts.reactions)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const desktop = window.matchMedia('(min-width: 1101px)')
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
    <div
      className={`community-page ${savedView ? 'community-saved-page' : 'community-home-page'}`}
    >
      <div className="community-feed-intro">
        <header className="community-hero">
          <div>
            <h1>{savedView ? 'Bài viết đã lưu' : 'Cộng đồng MentalBridge'}</h1>
            <p>
              {savedView
                ? 'Tìm lại những câu chuyện bạn muốn đọc tiếp hoặc giữ bên mình.'
                : 'Cùng chia sẻ, lắng nghe và đi qua những ngày thường.'}
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

        {!savedView && (
          <>
            <CommunityMoments
              posts={items}
              openViewer={openReels}
              onCreate={() => setMediaComposeRequest((current) => current + 1)}
              loading={loading}
              loadingMore={loadingMore}
              onLoadMore={
                nextCursor ? () => void load(nextCursor, true) : undefined
              }
            />
            <CommunityPrompt
              onUse={(prompt) => {
                setSuggestion(prompt)
                document.getElementById('community-quick-content')?.focus()
              }}
            />
            <CommunityPostComposer
              topics={topics}
              suggestion={suggestion}
              mediaRequest={mediaComposeRequest}
            />
          </>
        )}
      </div>

      {!savedView && (
        <aside className="community-topic-dock" aria-label="Khám phá chủ đề">
          <CommunityHelpCard />
          <div className="community-topic-panel">
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
                  Chưa có chủ đề đang hoạt động. Bạn vẫn có thể đọc bảng tin
                  nhưng chưa thể lọc hoặc đăng bài mới.
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
          </div>
          <CommunityMembers />
        </aside>
      )}

      <div className="community-feed-content">
        {!savedView && (
          <div className="community-feed-toolbar">
            <div role="group" aria-label="Sắp xếp bảng tin">
              <button
                type="button"
                aria-pressed={order === 'topics'}
                onClick={() => {
                  setOrder('topics')
                  setTopicsExpanded(true)
                  document
                    .querySelector<HTMLElement>(
                      '.community-topic-disclosure > summary',
                    )
                    ?.focus()
                }}
              >
                Dành cho bạn
              </button>
              <button
                type="button"
                aria-pressed={order === 'latest'}
                onClick={() => setOrder('latest')}
              >
                Mới nhất
              </button>
              <button
                type="button"
                aria-pressed={order === 'support'}
                onClick={() => setOrder('support')}
              >
                Nhiều đồng hành
              </button>
            </div>
            <span>
              <FeedIcon name="lock" /> Không gian sẻ chia
            </span>
          </div>
        )}
        {order === 'topics' && !selectedTopics.length && (
          <p className="community-results-note">
            Chọn tối đa 3 chủ đề để xem những câu chuyện bạn quan tâm.
          </p>
        )}
        {(searchTerm || order === 'support') && (
          <p className="community-results-note" role="status">
            {searchTerm
              ? `${visibleItems.length} kết quả cho “${search}” trong ${items.length} bài đã tải.`
              : `Sắp xếp ${items.length} bài đã tải theo lượt đồng hành.`}{' '}
            {nextCursor && 'Tải thêm để khám phá những câu chuyện khác.'}{' '}
            {searchTerm && <Link href="/community">Xóa tìm kiếm</Link>}
          </p>
        )}
        {loading ? (
          <section
            className="community-feed-loading"
            role="status"
            aria-busy="true"
          >
            <span className="community-sr-only">
              {savedView ? 'Đang tải bài viết đã lưu…' : 'Đang tải câu chuyện…'}
            </span>
            {[0, 1].map((item) => (
              <div
                className="community-feed-skeleton"
                aria-hidden="true"
                key={item}
              >
                <span className="community-skeleton-author" />
                <span />
                <span />
                <span className="community-skeleton-media" />
              </div>
            ))}
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
              {visibleItems.map((post) =>
                savedView ? (
                  <CommunitySavedPost
                    key={post.postId}
                    post={post}
                    topics={topics}
                    onComment={(trigger) => openDiscussion(post, trigger)}
                    onChange={(state, reactions) =>
                      updateInteractions(post.postId, state, reactions)
                    }
                    onHidden={() =>
                      setItems((current) =>
                        current.filter((item) => item.postId !== post.postId),
                      )
                    }
                  />
                ) : (
                  <article className="community-card" key={post.postId}>
                    <header>
                      <CommunityAuthorLink author={post.author}>
                        <CommunityAvatar
                          displayName={post.author.displayName}
                          avatarPreset={post.author.avatarPreset}
                          avatarImage={post.author.avatarImage}
                          deleted={post.author.state === 'DELETED'}
                          anonymous={post.author.state === 'ANONYMOUS'}
                        />
                      </CommunityAuthorLink>
                      <div>
                        <strong>
                          <CommunityAuthorLink author={post.author} />
                        </strong>
                        <time dateTime={post.publishedAt}>
                          {communityTime(post.publishedAt)}
                        </time>
                      </div>
                      <CommunitySafetyActions
                        targetType="POST"
                        targetId={post.postId}
                        communityProfileId={post.author.communityProfileId}
                        onHidden={() =>
                          setItems((current) =>
                            current.filter(
                              (item) => item.postId !== post.postId,
                            ),
                          )
                        }
                      />
                    </header>
                    <div className="community-card-topics">
                      {post.topics.map((topic) => (
                        <span key={topic}>
                          {topics.find((value) => value.code === topic)
                            ?.label ?? topic}
                        </span>
                      ))}
                    </div>
                    <CommunitySensitiveContent
                      warned={
                        post.sensitiveContentWarning === 'SENSITIVE_CONTENT'
                      }
                    >
                      <p className="community-card-copy">
                        {post.contentPreview}
                      </p>
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
                          onChange={(viewerState, reactions) =>
                            updateInteractions(
                              post.postId,
                              viewerState,
                              reactions,
                            )
                          }
                        />
                      ) : (
                        <span className="community-card-stat">
                          <FeedIcon name="heart" />
                          {post.counts.reactions} lượt đồng hành
                        </span>
                      )}
                      <button
                        type="button"
                        className={`community-comment-link ${discussionStyles.commentButton}`}
                        aria-label={`Bình luận bài viết của ${post.author.displayName}`}
                        aria-haspopup="dialog"
                        onClick={(event) =>
                          openDiscussion(post, event.currentTarget)
                        }
                      >
                        <FeedIcon name="comment" />
                        {post.counts.comments} bình luận
                      </button>
                      <Link href={`/community/${post.postId}`}>
                        Đọc bài viết <span aria-hidden="true">→</span>
                      </Link>
                    </footer>
                    {!post.sensitiveContentWarning && (
                      <button
                        type="button"
                        className={discussionStyles.replyTrigger}
                        aria-label={`Viết bình luận cho bài viết của ${post.author.displayName}`}
                        aria-haspopup="dialog"
                        onClick={(event) =>
                          openDiscussion(post, event.currentTarget)
                        }
                      >
                        <span className={discussionStyles.replyMark}>
                          <FeedIcon name="comment" />
                        </span>
                        <span>Viết một bình luận tử tế…</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    )}
                  </article>
                ),
              )}
            </section>
            {visibleItems.length === 0 && searchTerm && (
              <section className="community-state">
                <h2>Chưa tìm thấy câu chuyện phù hợp</h2>
                <p>Thử một từ khóa khác hoặc tải thêm bài viết bên dưới.</p>
                <Link href="/community">Xem tất cả câu chuyện</Link>
              </section>
            )}
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
      {discussion && (
        <CommunityCommentsDialog
          key={discussion.postId}
          postId={discussion.postId}
          authorName={discussion.authorName}
          open={discussionOpen}
          onOpenChange={setDiscussionOpen}
          onPostChange={syncDiscussionPost}
          onUnavailable={() => removeDiscussionPost(discussion.postId)}
          restoreFocusTo={restoreDiscussionFocus}
        />
      )}
    </div>
  )
}

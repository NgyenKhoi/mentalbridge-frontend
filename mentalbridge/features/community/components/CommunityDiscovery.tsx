'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Headphones,
  Leaf,
  LifeBuoy,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wind,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { getResourceCatalogue } from '@/features/resources/api/browser-resources'
import type { CommunityPostDetail } from '../api/browser-community'
import CommunityReelsViewer from './CommunityReelsViewer'
import CommunityPresencePanel from '@/features/community-chat/components/CommunityPresencePanel'
import styles from './CommunityDiscovery.module.css'
import type { ReactNode } from 'react'

export function CommunityResourceShortcut({
  category,
  children,
}: {
  category: 'BREATHING' | 'MEDITATION'
  children: ReactNode
}) {
  const [href, setHref] = useState('/resources')
  useEffect(() => {
    const controller = new AbortController()
    void getResourceCatalogue(controller.signal, 'vi-VN')
      .then((catalogue) => {
        const resource = catalogue.items.find(
          (item) => item.category === category,
        )
        if (resource) setHref(`/resources/${resource.id}`)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [category])
  return <Link href={href}>{children}</Link>
}

type Story = Pick<
  CommunityPostDetail,
  'postId' | 'author' | 'media' | 'sensitiveContentWarning'
> & { contentPreview: string }

const prompts = [
  'Một điều nhỏ bé khiến bạn mỉm cười hoặc cảm thấy biết ơn hôm nay là gì?',
  'Có điều gì bạn muốn nhẹ nhàng đặt xuống sau hôm nay?',
  'Bạn đã dành cho bản thân một khoảng nghỉ như thế nào?',
  'Một bước nhỏ mà bạn muốn ghi nhận ở chính mình là gì?',
  'Nếu gửi một lời động viên cho mình lúc này, bạn sẽ nói gì?',
]

export function CommunityPrompt({
  onUse,
}: {
  onUse: (prompt: string) => void
}) {
  const [index, setIndex] = useState(0)
  return (
    <section className={styles.prompt} aria-labelledby="community-prompt-title">
      <header>
        <h2 id="community-prompt-title">
          <Headphones size={16} /> Chiếc hộp sẻ chia{' '}
          <span>· Gợi ý suy ngẫm hôm nay</span>
        </h2>
        <button
          type="button"
          onClick={() => setIndex((current) => (current + 1) % prompts.length)}
          aria-label="Đổi câu gợi ý"
        >
          <RefreshCw size={14} />
        </button>
      </header>
      <button
        className={styles.promptQuestion}
        type="button"
        onClick={() => onUse(prompts[index])}
      >
        <Leaf size={18} />
        <span>
          <em>“{prompts[index]}”</em>
          <small>Bấm để bắt đầu viết về điều này.</small>
        </span>
        <ArrowRight size={16} />
      </button>
    </section>
  )
}

export function CommunityMoments({
  posts,
  onCreate,
  loading = false,
  onLoadMore,
  loadingMore = false,
  openViewer = false,
}: Readonly<{
  posts: readonly Story[]
  onCreate: () => void
  loading?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
  openViewer?: boolean
}>) {
  const router = useRouter()
  const [allOpen, setAllOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(openViewer)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const videos = posts
    .filter((post) => !post.sensitiveContentWarning)
    .flatMap((post) =>
      post.media
        .filter((media) => media.type === 'VIDEO')
        .map((media) => ({ media, post })),
    )
  const activeIndex =
    activeVideoId === null
      ? videos.length > 0
        ? 0
        : -1
      : videos.findIndex(({ media }) => media.mediaId === activeVideoId)

  function closeViewer() {
    setViewerOpen(false)
    setActiveVideoId(null)
    if (openViewer) router.replace('/community', { scroll: false })
  }

  const cards = (expanded: boolean) => (
    <>
      {videos.slice(0, expanded ? videos.length : 8).map(({ media, post }) => (
        <button
          className={styles.moment}
          type="button"
          key={media.mediaId}
          aria-label={`Xem video của ${post.author.displayName}`}
          onClick={() => {
            setAllOpen(false)
            setActiveVideoId(media.mediaId)
            setViewerOpen(true)
          }}
        >
          <video
            src={media.url}
            preload="metadata"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              if (video.duration > 1) video.currentTime = 1
            }}
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
          />
          <span className={styles.play}>
            <Play size={14} fill="currentColor" />
          </span>
          <span className={styles.momentCopy}>
            <strong>{post.contentPreview}</strong>
            <small>{post.author.displayName}</small>
          </span>
        </button>
      ))}
    </>
  )

  return (
    <section
      id="community-moments"
      className={styles.moments}
      aria-labelledby="community-moments-title"
    >
      <header>
        <h2 id="community-moments-title">
          <Play size={16} /> Khoảnh khắc & Reels <span>Từ cộng đồng</span>
        </h2>
        <button type="button" onClick={() => setAllOpen(true)}>
          Xem tất cả <ArrowRight size={13} />
        </button>
      </header>
      <div className={styles.momentStrip}>
        <button
          className={styles.createMoment}
          type="button"
          onClick={onCreate}
        >
          <span>
            <Plus size={22} />
          </span>
          <strong>Tạo khoảnh khắc</strong>
          <small>Đăng video của bạn</small>
        </button>
        {cards(false)}
        {videos.length === 0 && (
          <div className={styles.momentEmpty} role="status">
            <strong>
              {loading
                ? 'Đang tải video cộng đồng…'
                : 'Chia sẻ một khoảnh khắc của bạn'}
            </strong>
            <p>
              {loading
                ? 'Những video đã đăng sẽ xuất hiện tại đây.'
                : 'Một cảnh thường ngày, một điều bạn muốn kể. Đăng video để cùng chia sẻ với mọi người.'}
            </p>
          </div>
        )}
      </div>
      <Dialog
        open={allOpen || (viewerOpen && activeIndex < 0)}
        onOpenChange={(open) => {
          setAllOpen(open)
          if (!open && viewerOpen) closeViewer()
        }}
        labelledBy="community-all-moments"
        className={styles.galleryDialog}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="community-all-moments">Khoảnh khắc & Reels</h2>
            <p>Video do thành viên chia sẻ trong các bài viết đã tải.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAllOpen(false)
              if (viewerOpen) closeViewer()
            }}
            aria-label="Đóng khoảnh khắc"
          >
            <X size={20} />
          </button>
        </header>
        {allOpen && <div className={styles.gallery}>{cards(true)}</div>}
        {videos.length === 0 && (
          <p className={styles.galleryEmpty}>
            {loading
              ? 'Đang tải video cộng đồng…'
              : 'Chưa thấy video trong các bài viết đã tải. Bạn có thể đăng video của mình hoặc khám phá thêm các bài viết khác.'}
          </p>
        )}
        <div className={styles.galleryActions}>
          <button
            type="button"
            onClick={() => {
              setAllOpen(false)
              if (viewerOpen) closeViewer()
              onCreate()
            }}
          >
            Đăng video của bạn
          </button>
          {onLoadMore && (
            <button type="button" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? 'Đang tải…' : 'Khám phá thêm'}
            </button>
          )}
        </div>
      </Dialog>
      <Dialog
        open={viewerOpen && activeIndex >= 0}
        onOpenChange={(open) => {
          if (!open) closeViewer()
        }}
        labelledBy="community-video-title"
        className={styles.videoDialog}
      >
        {viewerOpen && activeIndex >= 0 && (
          <CommunityReelsViewer
            key={activeVideoId}
            items={videos}
            initialIndex={activeIndex}
            onClose={closeViewer}
            onLoadMore={onLoadMore}
            loadingMore={loadingMore}
          />
        )}
      </Dialog>
    </section>
  )
}

export function CommunityHelpCard() {
  return (
    <section className={styles.helpCard} aria-labelledby="community-help-title">
      <h2 id="community-help-title">
        <LifeBuoy size={16} /> Khi bạn cần hỗ trợ ngay
      </h2>
      <p>
        Nếu bạn cảm thấy không an toàn, hãy tìm hỗ trợ phù hợp tại nơi bạn sống.
      </p>
      <Link href="/safety-directory">
        Mở danh bạ hỗ trợ <ArrowRight size={14} />
      </Link>
      <CommunityResourceShortcut category="BREATHING">
        Một khoảng nghỉ với hơi thở <Wind size={14} />
      </CommunityResourceShortcut>
    </section>
  )
}

export function CommunityMembers() {
  return (
    <>
      <CommunityPresencePanel />
      <section className={styles.culture}>
        <h2>
          <ShieldCheck size={16} /> Văn hóa MentalBridge
        </h2>
        <p>
          Lắng nghe không phán xét. Tôn trọng ranh giới, quyền riêng tư và nhịp
          điệu riêng của mỗi người.
        </p>
        <Link href="/terms">
          Cùng giữ một không gian tử tế <ArrowRight size={13} />
        </Link>
      </section>
    </>
  )
}

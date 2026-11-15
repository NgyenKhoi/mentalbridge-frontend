'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Play,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import type { CommunityPostDetail } from '../api/browser-community'
import CommunityAvatar from './CommunityAvatar'
import CommunityAuthorLink from './CommunityAuthorLink'
import { useCommunityVideoPlayback } from './useCommunityVideoPlayback'
import styles from './CommunityDiscovery.module.css'

type Reel = {
  media: CommunityPostDetail['media'][number]
  post: Pick<CommunityPostDetail, 'postId' | 'author'> & {
    contentPreview: string
  }
}

function ReelSlide({
  item,
  active,
  muted,
  onMutedChange,
  onClose,
  index,
  count,
  onLoadMore,
  loadingMore,
}: {
  item: Reel
  active: boolean
  muted: boolean
  onMutedChange: (muted: boolean) => void
  onClose: () => void
  index: number
  count: number
  onLoadMore?: () => void
  loadingMore: boolean
}) {
  const [failed, setFailed] = useState(false)
  const networkRetried = useRef(false)
  const videoRef = useCommunityVideoPlayback()

  return (
    <article
      className={styles.reelSlide}
      inert={!active}
      aria-label={`Video ${index + 1} của ${count}`}
    >
      <div className={styles.videoStage}>
        {failed ? (
          <div className={styles.videoUnavailable}>
            <VideoOff size={36} />
            <p>Chưa phát được video này.</p>
            <button
              type="button"
              onClick={() => {
                networkRetried.current = false
                setFailed(false)
              }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={item.media.url}
            className={styles.videoElement}
            muted={muted}
            loop
            controls={active}
            playsInline
            preload={active ? 'auto' : 'none'}
            tabIndex={active ? 0 : -1}
            aria-label={`Video của ${item.post.author.displayName}`}
            onError={(event) => {
              const video = event.currentTarget
              if (video.error?.code === 2 && !networkRetried.current) {
                networkRetried.current = true
                video.load()
                return
              }
              setFailed(true)
            }}
            onVolumeChange={(event) => {
              if (active) onMutedChange(event.currentTarget.muted)
            }}
          />
        )}
      </div>
      <footer className={styles.videoFooter}>
        <div className={styles.videoAuthorInfo}>
          <CommunityAvatar
            displayName={item.post.author.displayName}
            avatarPreset={item.post.author.avatarPreset}
            avatarImage={item.post.author.avatarImage}
          />
          <strong>
            <CommunityAuthorLink author={item.post.author} />
          </strong>
          <span className={styles.videoCounter}>
            {index + 1} / {count}
          </span>
        </div>
        {item.post.contentPreview && (
          <p className={styles.videoCaption}>{item.post.contentPreview}</p>
        )}
        <div className={styles.videoFooterActions}>
          <Link
            href={`/community/${item.post.postId}`}
            className={styles.videoPostLink}
            onClick={onClose}
          >
            <span>Đọc bài viết & Bình luận</span>
            <ArrowRight size={16} />
          </Link>
          {index === count - 1 && onLoadMore && (
            <button
              className={styles.reelsLoadMore}
              type="button"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? 'Đang tải…' : 'Khám phá thêm'}
            </button>
          )}
        </div>
      </footer>
    </article>
  )
}

export default function CommunityReelsViewer({
  items,
  initialIndex,
  onClose,
  onLoadMore,
  loadingMore = false,
}: {
  items: readonly Reel[]
  initialIndex: number
  onClose: () => void
  onLoadMore?: () => void
  loadingMore?: boolean
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const currentIndex = useRef(initialIndex)
  const aligned = useRef(false)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [muted, setMuted] = useState(true)
  const count = items.length

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    function alignVideo() {
      if (!element || !element.clientHeight) return
      currentIndex.current = Math.min(currentIndex.current, count - 1)
      element.scrollTop = currentIndex.current * element.clientHeight
      aligned.current = true
    }
    const frame = requestAnimationFrame(alignVideo)
    const observer = new ResizeObserver(alignVideo)
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [count])

  function moveVideo(direction: number) {
    const element = viewport.current
    if (!element) return
    const nextIndex = Math.max(
      0,
      Math.min(count - 1, currentIndex.current + direction),
    )
    element.scrollTo({
      top: nextIndex * element.clientHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing ||
      (event.target instanceof HTMLElement &&
        event.target.closest(
          'video, input, textarea, select, [contenteditable="true"]',
        ))
    )
      return
    const directions: Record<string, number> = {
      ArrowUp: -1,
      ArrowLeft: -1,
      PageUp: -1,
      ArrowDown: 1,
      ArrowRight: 1,
      PageDown: 1,
    }
    if (directions[event.key]) {
      event.preventDefault()
      moveVideo(directions[event.key])
    }
  }

  return (
    <div className={styles.videoPlayerContainer} onKeyDown={onKeyDown}>
      <header className={styles.videoHeader}>
        <div className={styles.videoAuthorInfo}>
          <Play size={20} />
          <div className={styles.videoAuthorMeta}>
            <strong id="community-video-title">Khoảnh khắc & Reels</strong>
            <span>Cuộn hoặc vuốt lên/xuống để xem tiếp</span>
          </div>
        </div>
        <div className={styles.reelsHeaderActions}>
          <button
            type="button"
            className={styles.videoCloseBtn}
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            aria-pressed={!muted}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            type="button"
            className={styles.videoCloseBtn}
            onClick={onClose}
            aria-label="Đóng Reels"
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <div className={styles.reelsBody}>
        <div
          ref={viewport}
          className={styles.reelsViewport}
          onScroll={(event) => {
            const element = event.currentTarget
            if (!aligned.current || !element.clientHeight) return
            const index = Math.max(
              0,
              Math.min(
                count - 1,
                Math.round(element.scrollTop / element.clientHeight),
              ),
            )
            currentIndex.current = index
            setActiveIndex(index)
          }}
        >
          {items.map((item, index) => (
            <ReelSlide
              key={`${item.media.mediaId}:${item.media.url}`}
              item={item}
              active={index === activeIndex}
              muted={muted}
              onMutedChange={setMuted}
              onClose={onClose}
              index={index}
              count={count}
              onLoadMore={onLoadMore}
              loadingMore={loadingMore}
            />
          ))}
        </div>
        {count > 1 && (
          <nav className={styles.reelsNavigation} aria-label="Chuyển Reels">
            <button
              type="button"
              className={styles.videoNavBtn}
              disabled={activeIndex === 0}
              onClick={() => moveVideo(-1)}
              aria-label="Video trước"
            >
              <ArrowUp size={20} />
            </button>
            <button
              type="button"
              className={styles.videoNavBtn}
              disabled={activeIndex >= count - 1}
              onClick={() => moveVideo(1)}
              aria-label="Video tiếp theo"
            >
              <ArrowDown size={20} />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}

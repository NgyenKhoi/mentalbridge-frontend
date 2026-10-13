'use client'

import { ArrowLeft, ArrowRight, Expand, ImageOff, Play, X } from 'lucide-react'
import Image from 'next/image'
import { useId, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import type { components } from '@/contracts/community.generated'

import styles from './CommunityMedia.module.css'

type Media = components['schemas']['CommunityMedia']
type MediaStyle = CSSProperties & { '--media-ratio': number }

const passthroughLoader = ({ src }: { src: string }) => src

function dimensions(item: Media) {
  if (
    item.width !== null &&
    item.height !== null &&
    Number.isFinite(item.width) &&
    Number.isFinite(item.height) &&
    item.width > 0 &&
    item.height > 0
  ) {
    return { width: item.width, height: item.height, known: true }
  }
  return { width: 1200, height: 900, known: false }
}

function MediaAsset({
  item,
  viewer = false,
}: {
  item: Media
  viewer?: boolean
}) {
  const size = dimensions(item)
  const [ratio, setRatio] = useState(size.width / size.height)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const alt =
    item.altText ||
    (item.type === 'IMAGE'
      ? 'Hình ảnh được chia sẻ trong cộng đồng'
      : 'Video được chia sẻ trong cộng đồng')

  function learnRatio(width: number, height: number) {
    if (!size.known && width > 0 && height > 0) setRatio(width / height)
  }
  const mediaStyle: MediaStyle = { '--media-ratio': ratio }

  return (
    <span
      className={[styles.asset, viewer ? styles.viewerAsset : ''].join(' ')}
      style={mediaStyle}
    >
      {failed ? (
        <span className={styles.unavailable}>
          <ImageOff size={24} aria-hidden="true" />
          <span>
            {item.type === 'IMAGE'
              ? 'Chưa tải được ảnh'
              : 'Chưa tải được video'}
          </span>
          {viewer ? (
            <button
              type="button"
              onClick={() => {
                setAttempt((current) => current + 1)
                setFailed(false)
              }}
            >
              Thử tải lại
            </button>
          ) : (
            <small>Mở để thử lại</small>
          )}
        </span>
      ) : item.type === 'IMAGE' ? (
        <Image
          key={attempt}
          className={styles.preview}
          loader={passthroughLoader}
          unoptimized
          src={item.url}
          alt={alt}
          width={size.width}
          height={size.height}
          sizes={viewer ? '95vw' : '(max-width: 760px) 100vw, 680px'}
          onLoad={(event) =>
            learnRatio(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
            )
          }
          onError={() => setFailed(true)}
        />
      ) : (
        <video
          key={attempt}
          className={styles.preview}
          preload="metadata"
          muted={!viewer}
          controls={viewer}
          playsInline
          aria-label={alt}
          onLoadedMetadata={(event) =>
            learnRatio(
              event.currentTarget.videoWidth,
              event.currentTarget.videoHeight,
            )
          }
          onError={() => setFailed(true)}
        >
          <source src={item.url} />
        </video>
      )}
    </span>
  )
}

export default function CommunityMedia({ media }: { media: readonly Media[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const viewerId = useId()
  const active = activeIndex === null ? undefined : media[activeIndex]

  function move(direction: number) {
    setActiveIndex((current) =>
      current === null
        ? null
        : (current + direction + media.length) % media.length,
    )
  }

  function onViewerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      media.length < 2 ||
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
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  if (media.length === 0) return null

  return (
    <>
      <div
        className={[
          'community-media',
          styles.media,
          media.length === 1 ? styles.single : styles.grid,
        ].join(' ')}
      >
        {media.slice(0, 4).map((item, index) => {
          const remaining = index === 3 ? media.length - 4 : 0
          return (
            <button
              className={styles.trigger}
              key={`${item.mediaId}:${item.url}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Mở nội dung đính kèm ${index + 1} trên ${media.length}${remaining > 0 ? `, còn ${remaining} nội dung khác` : ''}`}
            >
              <MediaAsset item={item} />
              {remaining > 0 ? (
                <span className={styles.remaining} aria-hidden="true">
                  +{remaining}
                </span>
              ) : (
                <span className={styles.openCue} aria-hidden="true">
                  {item.type === 'VIDEO' ? (
                    <Play size={14} />
                  ) : (
                    <Expand size={14} />
                  )}
                  {item.type === 'VIDEO' ? 'Xem video' : 'Xem ảnh'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Dialog
        open={active !== undefined}
        onOpenChange={(open) => {
          if (!open) setActiveIndex(null)
        }}
        labelledBy={`${viewerId}-title`}
        describedBy={`${viewerId}-help`}
        className={styles.dialog}
      >
        {active && activeIndex !== null && (
          <div className={styles.viewer} onKeyDown={onViewerKeyDown}>
            <header className={styles.viewerHeader}>
              <div>
                <strong id={`${viewerId}-title`} aria-live="polite">
                  Nội dung đính kèm {activeIndex + 1}/{media.length}
                </strong>
                <span id={`${viewerId}-help`}>
                  {media.length > 1
                    ? 'Dùng phím mũi tên trái, phải để chuyển nội dung.'
                    : 'Nhấn Escape hoặc nút đóng để trở lại bài viết.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                aria-label="Đóng trình xem"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className={styles.stage}>
              <MediaAsset
                key={`${active.mediaId}:${active.url}`}
                item={active}
                viewer
              />
            </div>
            {media.length > 1 && (
              <nav
                className={styles.navigation}
                aria-label="Chuyển nội dung đính kèm"
              >
                <button type="button" onClick={() => move(-1)}>
                  <ArrowLeft size={18} aria-hidden="true" /> Trước
                </button>
                <span aria-hidden="true">
                  {activeIndex + 1} / {media.length}
                </span>
                <button type="button" onClick={() => move(1)}>
                  Tiếp <ArrowRight size={18} aria-hidden="true" />
                </button>
              </nav>
            )}
          </div>
        )}
      </Dialog>
    </>
  )
}

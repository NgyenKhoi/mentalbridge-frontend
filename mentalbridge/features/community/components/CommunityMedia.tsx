'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import type { components } from '@/contracts/community.generated'

type Media = components['schemas']['CommunityMedia']

const passthroughLoader = ({ src }: { src: string }) => src

export default function CommunityMedia({ media }: { media: readonly Media[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    if (activeIndex === null || media.length < 2) return
    const navigate = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setActiveIndex((activeIndex - 1 + media.length) % media.length)
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((activeIndex + 1) % media.length)
      }
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [activeIndex, media.length])

  if (media.length === 0) return null
  const active = activeIndex === null ? null : media[activeIndex]

  return (
    <>
      <div
        className={`community-media community-media-${Math.min(media.length, 3)}`}
      >
        {media.map((item, index) => (
          <button
            className="community-media-trigger"
            key={item.mediaId}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Mở nội dung đính kèm ${index + 1} trên ${media.length}`}
          >
            {item.type === 'IMAGE' ? (
              <Image
                loader={passthroughLoader}
                unoptimized
                src={item.url}
                alt={item.altText || 'Hình ảnh được chia sẻ trong cộng đồng'}
                width={item.width ?? 1200}
                height={item.height ?? 800}
                sizes="(max-width: 760px) 100vw, 680px"
              />
            ) : (
              <video
                preload="metadata"
                muted
                aria-label={
                  item.altText || 'Video được chia sẻ trong cộng đồng'
                }
              >
                <source src={item.url} />
              </video>
            )}
            <span className="community-media-open-cue" aria-hidden="true">
              {item.type === 'VIDEO' ? 'Phát video' : 'Xem ảnh'}
            </span>
          </button>
        ))}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) setActiveIndex(null)
        }}
        labelledBy="community-media-viewer-title"
        describedBy="community-media-viewer-help"
        className="community-media-dialog"
      >
        {active && activeIndex !== null && (
          <div className="community-media-viewer">
            <header>
              <div>
                <strong id="community-media-viewer-title">
                  Nội dung đính kèm {activeIndex + 1}/{media.length}
                </strong>
                <span id="community-media-viewer-help">
                  Dùng phím mũi tên trái, phải để chuyển nội dung.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                aria-label="Đóng trình xem"
              >
                ×
              </button>
            </header>
            <div className="community-media-stage">
              {active.type === 'IMAGE' ? (
                <Image
                  loader={passthroughLoader}
                  unoptimized
                  src={active.url}
                  alt={
                    active.altText || 'Hình ảnh được chia sẻ trong cộng đồng'
                  }
                  width={active.width ?? 1600}
                  height={active.height ?? 1000}
                  sizes="95vw"
                />
              ) : (
                <video controls autoPlay preload="metadata">
                  <source src={active.url} />
                </video>
              )}
            </div>
            {media.length > 1 && (
              <nav aria-label="Chuyển nội dung đính kèm">
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex(
                      (activeIndex - 1 + media.length) % media.length,
                    )
                  }
                >
                  <span aria-hidden="true">←</span> Trước
                </button>
                <div aria-hidden="true">
                  {media.map((item, index) => (
                    <span
                      key={item.mediaId}
                      className={
                        index === activeIndex ? 'is-active' : undefined
                      }
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((activeIndex + 1) % media.length)
                  }
                >
                  Tiếp <span aria-hidden="true">→</span>
                </button>
              </nav>
            )}
          </div>
        )}
      </Dialog>
    </>
  )
}

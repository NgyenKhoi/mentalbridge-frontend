'use client'

import { useState } from 'react'

import type { PublicResourceSummary } from '../api/browser-resources'
import { resourcePresentation } from '../model/resource-experience'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'

type Props = Readonly<{
  resource: PublicResourceSummary
  featured?: boolean
}>

function youtubeId(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    const id =
      host === 'youtu.be'
        ? url.pathname.split('/')[1]
        : host === 'youtube.com' || host === 'm.youtube.com'
          ? url.searchParams.get('v')
          : null
    return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function ResourcePreview({ resource, featured = false }: Props) {
  const [playing, setPlaying] = useState(false)
  const videoId =
    resource.category === 'VIDEO' ? youtubeId(resource.externalUrl) : null
  const meta = resourcePresentation(resource)

  function startPreview() {
    if (
      videoId &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setPlaying(true)
    }
  }

  return (
    <div
      className={`resource-preview resource-preview-${resource.category.toLowerCase()}${featured ? ' is-featured' : ''}${playing ? ' is-playing' : ''}`}
      onMouseEnter={startPreview}
      onMouseLeave={() => setPlaying(false)}
    >
      {videoId ? (
        <img
          className="resource-preview-image"
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="resource-preview-art" aria-hidden="true">
          <span className="resource-preview-orbit" />
          <AnimatedResourceSticker variant={meta.sticker} size="large" />
        </div>
      )}
      {playing && videoId ? (
        <iframe
          className="resource-preview-player"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0`}
          title={`Xem trước video ${resource.title}`}
          loading="lazy"
          allow="autoplay; encrypted-media"
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : null}
      <div className="resource-preview-shade" aria-hidden="true" />
      <span className="resource-preview-type">
        {videoId
          ? 'Xem trước video'
          : resource.category === 'ARTICLE'
            ? 'Một đoạn để đọc'
            : 'Một nhịp để thử'}
      </span>
      <span className="resource-preview-time">{meta.minutes} phút</span>
      {!videoId && (
        <span className="resource-preview-excerpt">{resource.summary}</span>
      )}
      {videoId ? (
        <span className="resource-preview-play" aria-hidden="true">
          ▶
        </span>
      ) : null}
    </div>
  )
}

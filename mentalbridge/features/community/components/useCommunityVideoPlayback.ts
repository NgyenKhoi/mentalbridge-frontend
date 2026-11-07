'use client'

import { useEffect, useState } from 'react'

const visibleVideos = new Map<HTMLVideoElement, number>()

function updatePlayback() {
  const dialogs = document.querySelectorAll<HTMLDialogElement>(
    'dialog[open]:not([data-closing])',
  )
  const dialog = dialogs[dialogs.length - 1]
  let activeVideo: HTMLVideoElement | null = null
  let closestDistance = Infinity

  if (!document.hidden) {
    for (const [video, ratio] of visibleVideos) {
      if (
        ratio < 0.35 ||
        !video.isConnected ||
        video.error ||
        video.closest('[inert]') ||
        (dialog && !dialog.contains(video))
      )
        continue
      const bounds = video.getBoundingClientRect()
      const distance = Math.abs(
        bounds.top + bounds.height / 2 - window.innerHeight / 2,
      )
      if (distance < closestDistance) {
        activeVideo = video
        closestDistance = distance
      }
    }
  }

  for (const video of visibleVideos.keys()) {
    if (video === activeVideo) {
      if (video.paused) {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true
            void video.play().catch(() => undefined)
          })
        }
      }
    } else {
      video.pause()
    }
  }
}

export function useCommunityVideoPlayback() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!video || typeof IntersectionObserver === 'undefined') return
    visibleVideos.set(video, 0)
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleVideos.set(video, entry?.intersectionRatio ?? 0)
        updatePlayback()
      },
      { threshold: [0, 0.15, 0.35, 0.5, 0.7, 0.9, 1] },
    )
    const dialogs = new MutationObserver(updatePlayback)
    observer.observe(video)
    dialogs.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'data-closing', 'inert'],
    })

    const onScroll = () => {
      updatePlayback()
    }

    document.addEventListener('visibilitychange', updatePlayback)
    video.addEventListener('canplay', updatePlayback)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      dialogs.disconnect()
      document.removeEventListener('visibilitychange', updatePlayback)
      video.removeEventListener('canplay', updatePlayback)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      visibleVideos.delete(video)
      video.pause()
      updatePlayback()
    }
  }, [video])

  return setVideo
}

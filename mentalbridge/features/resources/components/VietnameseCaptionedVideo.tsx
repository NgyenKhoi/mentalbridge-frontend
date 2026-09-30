'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import styles from './resource-detail.module.css'
import type { VietnameseVideoCue } from '../model/vietnamese-video-cues'

type VideoSeekRequest = Readonly<{
  seconds: number
  key: number
}>

type Props = Readonly<{
  embedUrl: string
  title: string
  cues: readonly VietnameseVideoCue[]
  seekRequest?: VideoSeekRequest | null
}>

type YouTubePlayer = {
  destroy: () => void
  getCurrentTime: () => number
  playVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

type YouTubeNamespace = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      playerVars: Record<string, number | string>
      events: {
        onReady: () => void
        onError: () => void
      }
    },
  ) => YouTubePlayer
}

type YouTubeWindow = Window &
  typeof globalThis & {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  const youtubeWindow = window as YouTubeWindow
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      if (youtubeWindow.YT?.Player) resolve(youtubeWindow.YT)
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-mentalbridge-youtube-api], script[src="https://www.youtube.com/iframe_api"]',
    )
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.dataset.mentalbridgeYoutubeApi = 'true'
    script.onerror = () => {
      youtubeApiPromise = null
      reject(new Error('Không thể tải YouTube Player API.'))
    }
    document.head.appendChild(script)
  })

  return youtubeApiPromise
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${String(minutes)}:${String(remainder).padStart(2, '0')}`
}

function cueAtTime(cues: readonly VietnameseVideoCue[], seconds: number) {
  return cues.findIndex(
    (cue) => seconds >= cue.startSeconds && seconds < cue.endSeconds,
  )
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function VietnameseCaptionedVideo({
  embedUrl,
  title,
  cues,
  seekRequest,
}: Props) {
  const controlledByYouTube = embedUrl.startsWith(
    'https://www.youtube-nocookie.com/embed/',
  )
  const frameRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const transcriptRef = useRef<HTMLOListElement>(null)
  const cueRefs = useRef<Array<HTMLButtonElement | null>>([])
  const wordRefs = useRef<Array<Array<HTMLSpanElement | null>>>([])
  const activeCueIndexRef = useRef(-1)
  const animationFrameRef = useRef<number | null>(null)
  const manualScrollUntilRef = useRef(0)
  const [activeCueIndex, setActiveCueIndex] = useState(-1)
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const updateWordProgress = useCallback(
    (index: number, seconds: number) => {
      if (index < 0) return
      const cue = cues[index]
      if (!cue) return
      const duration = Math.max(cue.endSeconds - cue.startSeconds, 0.1)
      const progress = Math.min(
        1,
        Math.max(0, (seconds - cue.startSeconds) / duration),
      )
      const words = wordRefs.current[index] ?? []
      const shownCount = Math.ceil(progress * words.length)
      words.forEach((word, wordIndex) => {
        if (word) word.style.opacity = wordIndex < shownCount ? '1' : '0.4'
      })
    },
    [cues],
  )

  const resetWordProgress = useCallback((index: number) => {
    if (index < 0) return
    ;(wordRefs.current[index] ?? []).forEach((word) => {
      if (word) word.style.opacity = '1'
    })
  }, [])

  const syncToTime = useCallback(
    (seconds: number) => {
      const nextIndex = cueAtTime(cues, seconds)
      if (nextIndex !== activeCueIndexRef.current) {
        resetWordProgress(activeCueIndexRef.current)
        activeCueIndexRef.current = nextIndex
        setActiveCueIndex(nextIndex)
      }
      updateWordProgress(nextIndex, seconds)
    },
    [cues, resetWordProgress, updateWordProgress],
  )

  useEffect(() => {
    if (!controlledByYouTube) return
    let disposed = false

    void loadYouTubeApi()
      .then((youtube) => {
        if (disposed || !frameRef.current) return
        playerRef.current = new youtube.Player(frameRef.current, {
          playerVars: {
            cc_load_policy: 0,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (!disposed) setLoaded(true)
            },
            onError: () => {
              if (!disposed) setLoadFailed(true)
            },
          },
        })
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true)
      })

    return () => {
      disposed = true
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [controlledByYouTube, embedUrl])

  useEffect(() => {
    if (!loaded || cues.length === 0) return

    const tick = () => {
      const seconds = playerRef.current?.getCurrentTime()
      if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        syncToTime(seconds)
      }
      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [cues.length, loaded, syncToTime])

  const seekToSeconds = useCallback(
    (seconds: number) => {
      const player = playerRef.current
      if (!player) return
      player.seekTo(seconds, true)
      player.playVideo()
      syncToTime(seconds)
    },
    [syncToTime],
  )

  useEffect(() => {
    if (!loaded || !seekRequest) return
    seekToSeconds(seekRequest.seconds)
  }, [loaded, seekRequest, seekToSeconds])

  useEffect(() => {
    if (activeCueIndex < 0 || Date.now() < manualScrollUntilRef.current) return
    const container = transcriptRef.current
    const activeCue = cueRefs.current[activeCueIndex]
    if (!container || !activeCue || typeof container.scrollTo !== 'function') {
      return
    }

    const targetTop =
      activeCue.offsetTop -
      container.clientHeight / 2 +
      activeCue.offsetHeight / 2
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [activeCueIndex])

  const pauseAutoScroll = useCallback(() => {
    manualScrollUntilRef.current = Date.now() + 3_000
  }, [])

  return (
    <div className={styles.videoExperience}>
      <div className={styles.videoPlayerColumn}>
        <div className={styles.videoFrame}>
          {!loaded && !loadFailed && (
            <div className={styles.videoLoading} role="status">
              <span aria-hidden="true" />
              Đang tải video…
            </div>
          )}
          {loadFailed && (
            <div className={styles.videoLoading} role="alert">
              Không thể kết nối trình phát. Bạn có thể tải lại trang để thử lại.
            </div>
          )}
          <iframe
            ref={frameRef}
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              if (!controlledByYouTube) setLoaded(true)
            }}
          />
        </div>
      </div>

      {cues.length > 0 && (
        <aside className={styles.contextTranscript} aria-label="Nội dung video">
          <header>
            <h3>Nội dung video</h3>
            <p>Bấm vào một câu để tua video đến đúng thời điểm.</p>
          </header>
          <ol
            ref={transcriptRef}
            onWheel={pauseAutoScroll}
            onTouchStart={pauseAutoScroll}
            onPointerDown={pauseAutoScroll}
          >
            {cues.map((cue, index) => {
              const words = cue.text.split(/\s+/)
              return (
                <li key={`${String(cue.startSeconds)}-${cue.text}`}>
                  <button
                    ref={(node) => {
                      cueRefs.current[index] = node
                    }}
                    type="button"
                    data-past={index < activeCueIndex ? 'true' : undefined}
                    aria-current={index === activeCueIndex ? 'true' : undefined}
                    aria-label={`${formatTimestamp(cue.startSeconds)} ${cue.text}`}
                    onClick={() => seekToSeconds(cue.startSeconds)}
                  >
                    <time>{formatTimestamp(cue.startSeconds)}</time>
                    <span className={styles.cueText}>
                      {words.map((word, wordIndex) => (
                        <span
                          key={`${word}-${String(wordIndex)}`}
                          ref={(node) => {
                            wordRefs.current[index] ??= []
                            wordRefs.current[index][wordIndex] = node
                          }}
                          className={styles.cueWord}
                        >
                          {word}{' '}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>
      )}
    </div>
  )
}

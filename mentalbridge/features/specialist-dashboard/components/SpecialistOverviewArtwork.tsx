'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import TiltCard from '@/components/motion/TiltCard'
import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'
import type { OverviewScene } from './create-overview-scene'
import styles from './SpecialistOverviewArtwork.module.css'

export default function SpecialistOverviewArtwork() {
  const reduceMotion = useReactiveReducedMotion()
  // A disposed WebGL context must not be reused after forceContextLoss.
  // A preference change creates a fresh canvas and readiness state.
  return (
    <ArtworkCanvas
      key={reduceMotion ? 'still' : 'animated'}
      reduceMotion={reduceMotion}
    />
  )
}

function ArtworkCanvas({ reduceMotion }: { reduceMotion: boolean }) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<OverviewScene | null>(null)
  const interactive = ready && !reduceMotion && !failed

  useEffect(() => {
    const canvas = canvasRef.current
    const device = navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }
    if (
      !canvas ||
      reduceMotion ||
      failed ||
      !('WebGL2RenderingContext' in window) ||
      device.connection?.saveData ||
      (device.deviceMemory !== undefined && device.deviceMemory < 4)
    )
      return
    let active = true
    let localScene: OverviewScene | null = null
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      // The 3D engine is a separate chunk, loaded only for visible artwork.
      void import('./create-overview-scene')
        .then(({ createOverviewScene }) => {
          if (!active) return
          const tokens = getComputedStyle(document.documentElement)
          localScene = createOverviewScene(
            canvas,
            {
              cream: tokens.getPropertyValue('--surface-soft').trim(),
              green: tokens.getPropertyValue('--teal').trim(),
              pale: tokens.getPropertyValue('--teal-pale').trim(),
              amber: tokens.getPropertyValue('--amber').trim(),
              ink: tokens.getPropertyValue('--ink').trim(),
            },
            () => {
              if (active) setFailed(true)
            },
          )
          sceneRef.current = localScene
          setReady(true)
        })
        .catch(() => {
          if (active) setFailed(true)
        })
    })
    observer.observe(canvas)
    return () => {
      active = false
      observer.disconnect()
      localScene?.dispose()
      if (sceneRef.current === localScene) sceneRef.current = null
    }
  }, [failed, reduceMotion])

  return (
    <div
      className={styles.artwork}
      data-overview-artwork={interactive ? '3d' : 'image'}
    >
      <TiltCard
        wrapperClassName={styles.tilt}
        className={styles.depth}
        disabled={interactive}
        maxTilt={7}
        hoverY={-2}
        hoverScale={1.015}
      >
        <span className={styles.halo} aria-hidden="true" />
        <button
          type="button"
          className={styles.play}
          aria-label="Xoay minh hoạ 3D"
          title={interactive ? 'Bấm để xoay đồng hồ cát' : undefined}
          disabled={!interactive}
          onClick={() => sceneRef.current?.play()}
          onPointerMove={(event) => {
            if (
              !interactive ||
              event.pointerType === 'touch' ||
              !window.matchMedia('(hover: hover) and (pointer: fine)').matches
            )
              return
            const bounds = event.currentTarget.getBoundingClientRect()
            sceneRef.current?.point(
              ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
              ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
            )
          }}
          onPointerLeave={() => sceneRef.current?.reset()}
          onFocus={() => sceneRef.current?.reset()}
          onBlur={() => sceneRef.current?.reset()}
        >
          <span
            className={styles.image + (interactive ? ' ' + styles.hidden : '')}
            aria-hidden="true"
          >
            <Image
              src="/illustrations/specialist/time-and-care.jpg"
              alt=""
              width={512}
              height={512}
              sizes="(max-width: 480px) 168px, (max-width: 980px) 240px, 260px"
              loading="eager"
            />
          </span>
          <canvas
            ref={canvasRef}
            className={
              styles.canvas + (!interactive ? ' ' + styles.hidden : '')
            }
            aria-hidden="true"
          />
        </button>
        {interactive && (
          <span className={styles.hint} aria-hidden="true">
            Bấm để xoay
          </span>
        )}
      </TiltCard>
    </div>
  )
}

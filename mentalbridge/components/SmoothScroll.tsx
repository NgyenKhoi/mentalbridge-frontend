'use client'

import { useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type Lenis from 'lenis'
import { useLenis } from '@/hooks/useLenis'
import { PUBLIC_SMOOTH_ROUTES } from '@/lib/animations/config'
import 'lenis/dist/lenis.css'

export default function SmoothScroll() {
  const pathname = usePathname()
  const progressRef = useRef<HTMLDivElement>(null)
  const smoothScrollEnabled = PUBLIC_SMOOTH_ROUTES.has(pathname)

  const updateProgress = useCallback((lenis: Lenis) => {
    const progress = Number.isFinite(lenis.progress)
      ? Math.min(1, Math.max(0, lenis.progress))
      : 0
    if (progressRef.current) {
      progressRef.current.style.transform = `scaleX(${progress})`
    }
  }, [])

  useLenis({
    enabled: smoothScrollEnabled,
    onScroll: updateProgress,
    refreshKey: pathname,
  })

  if (!smoothScrollEnabled) return null

  return <div className="motion-progress" ref={progressRef} aria-hidden="true" />
}

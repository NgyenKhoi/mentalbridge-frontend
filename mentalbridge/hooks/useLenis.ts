'use client'

import { useEffect, useRef } from 'react'
import type Lenis from 'lenis'
import { LENIS_OPTIONS } from '@/lib/animations/config'

type UseLenisOptions = {
  enabled: boolean
  onScroll?: (lenis: Lenis) => void
  refreshKey?: string
}

export function useLenis({ enabled, onScroll, refreshKey }: UseLenisOptions) {
  const lenisRef = useRef<Lenis | null>(null)
  const onScrollRef = useRef(onScroll)
  const requestRefreshRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    onScrollRef.current = onScroll
  }, [onScroll])

  useEffect(() => {
    if (enabled) requestRefreshRef.current?.()
  }, [enabled, refreshKey])

  useEffect(() => {
    if (!enabled) return

    let disposed = false
    let preloaderFinished = false
    let requestRefresh: (() => void) | undefined
    let destroy: (() => void) | undefined

    const handlePreloaderFinished = () => {
      preloaderFinished = true
      requestRefresh?.()
    }

    window.addEventListener(
      'mentalbridge:preloader-finished',
      handlePreloaderFinished,
    )

    const initialize = async () => {
      const [
        { default: LenisConstructor },
        { default: gsap },
        { ScrollTrigger },
      ] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])

      if (disposed) return

      gsap.registerPlugin(ScrollTrigger)

      const lenis = new LenisConstructor({
        ...LENIS_OPTIONS,
        prevent: node => node.hasAttribute('data-lenis-prevent'),
      })
      lenisRef.current = lenis

      const handleScroll = (instance: Lenis) => {
        ScrollTrigger.update()
        onScrollRef.current?.(instance)
      }
      const tick = (time: number) => lenis.raf(time * 1000)

      let refreshFrame: number | null = null
      const refresh = () => {
        if (disposed) return
        ScrollTrigger.refresh()
        lenis.resize()
        onScrollRef.current?.(lenis)
      }
      const scheduleRefresh = () => {
        if (refreshFrame !== null) {
          window.cancelAnimationFrame(refreshFrame)
        }

        refreshFrame = window.requestAnimationFrame(() => {
          refreshFrame = window.requestAnimationFrame(() => {
            refreshFrame = null
            refresh()
          })
        })
      }
      requestRefresh = scheduleRefresh
      requestRefreshRef.current = scheduleRefresh

      lenis.on('scroll', handleScroll)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      onScrollRef.current?.(lenis)

      scheduleRefresh()
      if (preloaderFinished) scheduleRefresh()
      void document.fonts.ready.then(() => {
        if (!disposed) scheduleRefresh()
      })

      destroy = () => {
        requestRefresh = undefined
        if (requestRefreshRef.current === scheduleRefresh) {
          requestRefreshRef.current = null
        }
        if (refreshFrame !== null) {
          window.cancelAnimationFrame(refreshFrame)
        }
        lenis.off('scroll', handleScroll)
        gsap.ticker.remove(tick)
        gsap.ticker.lagSmoothing(500, 33)
        lenis.destroy()
        if (lenisRef.current === lenis) lenisRef.current = null
      }
    }

    void initialize()

    return () => {
      disposed = true
      window.removeEventListener(
        'mentalbridge:preloader-finished',
        handlePreloaderFinished,
      )
      destroy?.()
    }
  }, [enabled])

  return lenisRef
}

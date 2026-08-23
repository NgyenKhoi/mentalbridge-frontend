'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from 'framer-motion'
import { MOTION_SPRINGS } from '@/lib/animations/config'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const DEFAULT_INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[data-cursor-interactive]',
].join(',')

function subscribeToFinePointer(onStoreChange: () => void) {
  const media = window.matchMedia(FINE_POINTER_QUERY)
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

function getFinePointerSnapshot() {
  return window.matchMedia(FINE_POINTER_QUERY).matches
}

function getServerFinePointerSnapshot() {
  return false
}

export type CursorFollowerProps = Omit<
  HTMLMotionProps<'div'>,
  'children' | 'initial' | 'animate' | 'exit'
> & {
  size?: number
  lerp?: number
  interactiveScale?: number
  interactiveSelector?: string
}

/** Decorative pointer follower; it never hides or replaces the native cursor. */
export default function CursorFollower({
  size = 18,
  lerp = 0.16,
  interactiveScale = 1.75,
  interactiveSelector = DEFAULT_INTERACTIVE_SELECTOR,
  style,
  ...props
}: CursorFollowerProps) {
  const reducedMotion = useReducedMotion()
  const finePointer = useSyncExternalStore(
    subscribeToFinePointer,
    getFinePointerSnapshot,
    getServerFinePointerSnapshot,
  )
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const opacity = useMotionValue(0)
  const scaleTarget = useMotionValue(0)
  const scale = useSpring(scaleTarget, MOTION_SPRINGS.cursor)
  const enabled = finePointer && !reducedMotion

  useEffect(() => {
    if (!enabled) {
      opacity.set(0)
      scaleTarget.set(0)
      return
    }

    let frame = 0
    let positioned = false
    let interactive = false
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    const amount = Math.max(0.01, Math.min(1, lerp))

    const isInteractive = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      try {
        return Boolean(target.closest(interactiveSelector))
      } catch {
        return false
      }
    }

    const draw = () => {
      const deltaX = targetX - currentX
      const deltaY = targetY - currentY
      currentX += deltaX * amount
      currentY += deltaY * amount
      x.set(currentX)
      y.set(currentY)

      if (Math.abs(deltaX) > 0.05 || Math.abs(deltaY) > 0.05) {
        frame = window.requestAnimationFrame(draw)
      } else {
        currentX = targetX
        currentY = targetY
        x.set(currentX)
        y.set(currentY)
        frame = 0
      }
    }

    const requestDraw = () => {
      if (!frame) frame = window.requestAnimationFrame(draw)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      targetX = event.clientX - size / 2
      targetY = event.clientY - size / 2
      interactive = isInteractive(event.target)

      if (!positioned) {
        positioned = true
        currentX = targetX
        currentY = targetY
        x.set(currentX)
        y.set(currentY)
      } else {
        requestDraw()
      }

      opacity.set(1)
      scaleTarget.set(interactive ? interactiveScale : 1)
    }

    const updateInteractiveTarget = (target: EventTarget | null) => {
      interactive = isInteractive(target)
      if (positioned) scaleTarget.set(interactive ? interactiveScale : 1)
    }

    const hide = () => {
      opacity.set(0)
      scaleTarget.set(0)
    }

    const handlePointerOver = (event: PointerEvent) => updateInteractiveTarget(event.target)
    const handlePointerOut = (event: PointerEvent) => updateInteractiveTarget(event.relatedTarget)

    const root = document.documentElement
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('pointerover', handlePointerOver, { passive: true })
    document.addEventListener('pointerout', handlePointerOut, { passive: true })
    root.addEventListener('pointerleave', hide, { passive: true })
    window.addEventListener('blur', hide)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('pointerout', handlePointerOut)
      root.removeEventListener('pointerleave', hide)
      window.removeEventListener('blur', hide)
      opacity.set(0)
      scaleTarget.set(0)
    }
  }, [enabled, interactiveScale, interactiveSelector, lerp, opacity, scaleTarget, size, x, y])

  if (!enabled) return null

  return (
    <motion.div
      {...props}
      aria-hidden="true"
      data-cursor-follower=""
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 230,
        width: size,
        height: size,
        border: '1px solid currentColor',
        borderRadius: '50%',
        boxSizing: 'border-box',
        color: 'var(--teal-deep, #1e4a43)',
        ...style,
        x,
        y,
        scale,
        opacity,
        pointerEvents: 'none',
        willChange: 'transform, opacity',
      }}
    />
  )
}

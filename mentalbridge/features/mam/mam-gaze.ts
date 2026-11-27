'use client'

import { useEffect, useState, type RefObject } from 'react'

import type { MamGazeSource } from './MamCharacter'

// MB-818 goal 1: the pointer within this distance of the dock turns Mầm's eyes.
export const GAZE_RADIUS_PX = 320
// A pointer this far to one side turns the eyes all the way (clamped -1…1).
const GAZE_FULL_PX = 160
export const GAZE_RESET_MS = 2000
const GAZE_EASE = 0.28
const GAZE_SNAP = 0.01

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Horizontal gaze for a pointer offset from the dock centre; 0 beyond the radius. */
export const gazeTarget = (dx: number, dy: number) =>
  Math.hypot(dx, dy) > GAZE_RADIUS_PX ? 0 : clamp(dx / GAZE_FULL_PX, -1, 1)

/** A text field has focus: the user is typing, and Mầm keeps still. */
export function isTypingTarget(element: Element | null) {
  return (
    element instanceof HTMLElement &&
    (element.isContentEditable ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      (element instanceof HTMLInputElement &&
        !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(
          element.type,
        )))
  )
}

export type MamGaze = MamGazeSource & {
  /** Where the dock centre is, read once per animation frame while the eyes move. */
  bind(center: () => { x: number; y: number } | null): void
  move(x: number, y: number): void
  /** Back to the centre: eased after 2 s without moves, at once (`snap`) on disable. */
  reset(snap?: boolean): void
  dispose(): void
}

/**
 * Eased pointer gaze. It runs one animation frame per change and none at rest:
 * a move only stores the point, the next frame reads the dock and eases.
 */
export function createMamGaze(
  initialCenter: () => { x: number; y: number } | null = () => null,
): MamGaze {
  let center = initialCenter
  const listeners = new Set<() => void>()
  let value = 0
  let target = 0
  let point: { x: number; y: number } | null = null
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const step = () => {
    frame = 0
    if (point) {
      const c = center()
      target = c ? gazeTarget(point.x - c.x, point.y - c.y) : 0
      point = null
    }
    const next =
      Math.abs(target - value) < GAZE_SNAP
        ? target
        : value + (target - value) * GAZE_EASE
    if (next !== value) {
      value = next
      listeners.forEach((listener) => listener())
    }
    if (value !== target) frame = requestAnimationFrame(step)
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(step)
  }
  const reset = (snap = false) => {
    clearTimeout(timer)
    point = null
    target = 0
    if (!snap) return schedule()
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (value !== 0) {
      value = 0
      listeners.forEach((listener) => listener())
    }
  }

  return {
    get: () => value,
    bind(next) {
      center = next
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    move(x, y) {
      point = { x, y }
      clearTimeout(timer)
      timer = setTimeout(() => reset(), GAZE_RESET_MS)
      schedule()
    },
    reset,
    dispose() {
      clearTimeout(timer)
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      listeners.clear()
    },
  }
}

/**
 * One passive `pointermove` listener while `enabled`; the gaze source for
 * `MamCharacter`. Touch never gazes, and typing resets it.
 */
export function useMamGaze(
  enabled: boolean,
  dockRef: RefObject<HTMLElement | null>,
) {
  const [gaze] = useState(() => createMamGaze())
  useEffect(() => {
    gaze.bind(() => {
      const rect = dockRef.current?.getBoundingClientRect()
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null
    })
  }, [gaze, dockRef])
  useEffect(() => () => gaze.dispose(), [gaze])
  useEffect(() => {
    if (!enabled) return
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      if (isTypingTarget(document.activeElement)) gaze.reset()
      else gaze.move(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      gaze.reset(true)
    }
  }, [enabled, gaze])
  return gaze
}

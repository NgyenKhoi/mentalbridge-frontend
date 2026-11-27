'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'

import { mamDropTargetAt } from './use-mam-summon'

/**
 * The drop ring (MB-819): while Mầm is carried, the registered card under the pointer
 * carries one `data-mam-drop` marker (a visual cue only, apart from `data-mam-active`).
 * It follows the pointer once per frame and goes when the drag ends, the gate falls or
 * the host unmounts. `root` is the dock, which the hit test looks through.
 */
export function useMamDropRing(
  active: boolean,
  root: RefObject<Element | null>,
) {
  const ringed = useRef<Element | null>(null)
  const frame = useRef<number | null>(null)
  const point = useRef<{ x: number; y: number } | null>(null)

  const mark = useCallback((next: Element | null) => {
    if (ringed.current === next) return
    ringed.current?.removeAttribute('data-mam-drop')
    next?.setAttribute('data-mam-drop', '')
    ringed.current = next
  }, [])
  const scan = useCallback(() => {
    frame.current = null
    const at = point.current
    mark(
      at ? (mamDropTargetAt(at.x, at.y, root.current)?.element ?? null) : null,
    )
  }, [mark, root])
  const schedule = useCallback(() => {
    frame.current ??= requestAnimationFrame(scan)
  }, [scan])
  const clear = useCallback(() => {
    point.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    mark(null)
  }, [mark])
  const track = useCallback(
    (x: number, y: number) => {
      point.current = { x, y }
      schedule()
    },
    [schedule],
  )

  useEffect(() => {
    if (!active) {
      clear()
      return
    }
    // The page may scroll under a still pointer.
    window.addEventListener('scroll', schedule, {
      capture: true,
      passive: true,
    })
    return () => {
      window.removeEventListener('scroll', schedule, true)
      clear()
    }
  }, [active, clear, schedule])

  return { track, clear }
}

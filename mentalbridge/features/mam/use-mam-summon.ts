'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import type { MamLoopingBehavior } from './mam-contract'
import { runMamRequest } from './mam-requests'
import {
  mamFallbackText,
  mamReviewedAnswer,
  type MamAnswer,
  type MamIntent,
  type MamTarget,
} from './mam-targets'
import {
  findMamTarget,
  findMamTargetElement,
  getMamPageTarget,
  isMamTargetMounted,
  subscribeMamTargets,
} from './use-mam-target'

// ADR "Summon": right-click, ContextMenu or Shift+F10, a 500 ms touch press.
const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP_PX = 10
// The native menu stays on these, and on a text selection inside the target.
const NATIVE_MENU =
  'a[href], input, textarea, select, [contenteditable]:not([contenteditable="false"])'
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

export type MamAnchor =
  | Readonly<{ kind: 'dock' }>
  | Readonly<{
      kind: 'point'
      x: number
      y: number
      /** Page y of the target's top edge; the bubble flips above it. */
      clear?: number
    }>

// A target fully on screen keeps its own actions clear: the bubble opens below
// it, or above it when there is no room. Taller targets open at the point.
function pointAt(element: Element, x: number, y: number): MamAnchor {
  const rect = element.getBoundingClientRect()
  if (rect.top < 0 || rect.bottom > window.innerHeight)
    return { kind: 'point', x, y }
  return {
    kind: 'point',
    x,
    y: rect.bottom + window.scrollY,
    clear: rect.top + window.scrollY,
  }
}

export type MamSummon = Readonly<{
  pathname: string
  target: MamTarget
  /** The registered element; null for the page target. */
  element: Element | null
  anchor: MamAnchor
  returnFocus: HTMLElement | null
  phase: 'menu' | 'pending' | 'answer'
  intent?: MamIntent
  answer?: MamAnswer
  failed?: boolean
}>

const hasSelectionIn = (element: Element) => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return false
  // Any selected range touching the target counts, even one that starts outside.
  for (let index = 0; index < selection.rangeCount; index += 1)
    if (selection.getRangeAt(index).intersectsNode(element)) return true
  return false
}

const focusInside = (element: Element) => {
  const active = document.activeElement
  return active instanceof HTMLElement && element.contains(active)
    ? active
    : null
}

export function useMamSummon({
  pathname,
  enabled,
  reducedMotion,
  dockRef,
  bubbleRef,
}: Readonly<{
  pathname: string
  enabled: boolean
  reducedMotion: boolean
  dockRef: RefObject<HTMLElement | null>
  bubbleRef: RefObject<HTMLElement | null>
}>) {
  const [summon, setSummon] = useState<MamSummon | null>(null)
  const request = useRef<AbortController | null>(null)
  const latest = useRef(summon)
  useEffect(() => {
    latest.current = summon
  })

  const cancelRequest = () => {
    request.current?.abort()
    request.current = null
  }

  const close = useCallback((restoreFocus: boolean) => {
    cancelRequest()
    const returnFocus = latest.current?.returnFocus
    latest.current = null
    setSummon(null)
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus()
  }, [])

  // A new route, a hidden Mầm or a modal discards the bubble and any request.
  const [closedFor, setClosedFor] = useState({ pathname, enabled })
  if (closedFor.pathname !== pathname || closedFor.enabled !== enabled) {
    setClosedFor({ pathname, enabled })
    if (summon) setSummon(null)
  }
  useEffect(cancelRequest, [pathname, enabled])
  useEffect(() => cancelRequest, [])

  const open = useCallback(
    (
      target: MamTarget,
      element: Element | null,
      anchor: MamAnchor,
      returnFocus: HTMLElement | null,
    ) => {
      // One bubble at a time; summoning the same target again keeps its state.
      const current = latest.current
      if (current && current.target === target && current.element === element)
        return
      cancelRequest()
      const next: MamSummon = {
        pathname,
        target,
        element,
        anchor,
        returnFocus,
        phase: 'menu',
      }
      latest.current = next
      setSummon(next)
    },
    [pathname],
  )

  const summonPage = useCallback(() => {
    const target = getMamPageTarget()
    if (target) open(target, null, { kind: 'dock' }, dockRef.current)
  }, [dockRef, open])

  const choose = useCallback(
    (intent: MamIntent) => {
      if (!summon) return
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      const { target } = summon
      setSummon({ ...summon, phase: 'pending', intent })
      void runMamRequest(
        intent,
        async () =>
          mamReviewedAnswer(
            target,
            intent,
            (kind) => findMamTargetElement(kind) !== null,
          ),
        controller.signal,
      ).then((result) => {
        if (result.status === 'aborted' || request.current !== controller)
          return
        request.current = null
        setSummon((current) =>
          current && current.target === target
            ? {
                ...current,
                phase: 'answer',
                answer:
                  result.status === 'failed'
                    ? { text: mamFallbackText(target, intent) }
                    : result.answer,
                failed: result.status === 'failed',
              }
            : current,
        )
      })
    },
    [summon],
  )

  /** Takes the user to the card an answer points at. */
  const go = useCallback(() => {
    const kind = summon?.answer?.focusKind
    const element = kind ? findMamTargetElement(kind) : null
    close(false)
    if (!(element instanceof HTMLElement)) return
    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    })
    const focusable = element.querySelector<HTMLElement>(
      'a[href], button:not([disabled])',
    )
    if (focusable) focusable.focus({ preventScroll: true })
    else {
      element.setAttribute('tabindex', '-1')
      element.focus({ preventScroll: true })
    }
  }, [close, reducedMotion, summon])

  // Summon gestures on registered targets.
  useEffect(() => {
    if (!enabled) return
    let press: {
      timer: ReturnType<typeof setTimeout>
      x: number
      y: number
      pointerId: number
    } | null = null
    // Infinity while the finger that summoned is still down; then a short
    // window for the click its release produces.
    let swallowClickUntil = 0

    const cancelPress = () => {
      if (press) clearTimeout(press.timer)
      press = null
    }
    const onPointerUp = () => {
      cancelPress()
      if (swallowClickUntil === Infinity) swallowClickUntil = Date.now() + 400
    }
    const summonable = (node: EventTarget | null, nativeSelector: string) => {
      const found = findMamTarget(node)
      if (!found) return null
      if (node instanceof Element && node.closest(nativeSelector)) return null
      if (hasSelectionIn(found.element)) return null
      return found
    }

    const onContextMenu = (event: MouseEvent) => {
      const found = summonable(event.target, NATIVE_MENU)
      if (!found) return
      event.preventDefault()
      cancelPress()
      open(
        found.target,
        found.element,
        pointAt(found.element, event.pageX, event.pageY),
        focusInside(found.element),
      )
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'ContextMenu' &&
        !(event.shiftKey && event.key === 'F10')
      )
        return
      const found = summonable(document.activeElement, EDITABLE)
      if (!found) return
      event.preventDefault()
      const source = (
        document.activeElement ?? found.element
      ).getBoundingClientRect()
      open(
        found.target,
        found.element,
        pointAt(
          found.element,
          source.left + window.scrollX,
          source.bottom + window.scrollY,
        ),
        focusInside(found.element),
      )
    }
    const onPointerDown = (event: PointerEvent) => {
      cancelPress()
      // A new touch is a new gesture: its click (a starter tap) must go through.
      swallowClickUntil = 0
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      const found = summonable(event.target, NATIVE_MENU)
      if (!found) return
      const { pageX, pageY, clientX, clientY, pointerId } = event
      press = {
        x: clientX,
        y: clientY,
        pointerId,
        timer: setTimeout(() => {
          press = null
          if (
            !isMamTargetMounted(found.element) ||
            hasSelectionIn(found.element)
          )
            return
          swallowClickUntil = Infinity
          open(
            found.target,
            found.element,
            pointAt(found.element, pageX, pageY),
            null,
          )
        }, LONG_PRESS_MS),
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (
        press &&
        event.pointerId === press.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >
          LONG_PRESS_SLOP_PX
      )
        cancelPress()
    }
    // The finger lifting after a long-press must not also press a button.
    const onClick = (event: MouseEvent) => {
      if (Date.now() > swallowClickUntil) return
      swallowClickUntil = 0
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', cancelPress, true)
    document.addEventListener('selectionchange', cancelPress)
    document.addEventListener('click', onClick, true)
    return () => {
      cancelPress()
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', cancelPress, true)
      document.removeEventListener('selectionchange', cancelPress)
      document.removeEventListener('click', onClick, true)
    }
  }, [enabled, open])

  // Esc, an outside press or the target leaving the page closes the bubble.
  const isOpen = summon !== null
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      close(true)
    }
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (bubbleRef.current?.contains(node) || dockRef.current?.contains(node))
        return
      // A repeat summon (right button or touch) on the same target starts with
      // a pointerdown; it must share the open bubble, not cancel it.
      const element = latest.current?.element
      if (
        element?.contains(node) &&
        (event.button === 2 || event.pointerType !== 'mouse')
      )
        return
      close(false)
    }
    const unsubscribe = subscribeMamTargets(() => {
      const current = latest.current
      if (!current) return
      const gone = current.element
        ? !isMamTargetMounted(current.element)
        : getMamPageTarget() !== current.target
      if (gone) close(false)
    })
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      unsubscribe()
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [bubbleRef, close, dockRef, isOpen])

  const visible =
    summon && summon.pathname === pathname && enabled ? summon : null
  const behavior: MamLoopingBehavior | null = !visible
    ? null
    : visible.phase === 'menu'
      ? 'curious'
      : visible.phase === 'pending'
        ? 'thinking'
        : visible.failed
          ? 'gentle'
          : 'explaining'

  return { summon: visible, summonPage, choose, go, close, behavior }
}

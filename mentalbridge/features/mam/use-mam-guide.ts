'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { mamEventName } from './mam-events'
import {
  MAM_GUIDE_EVENT,
  actGuide,
  parseMamGuideEvent,
  readGuide,
  reduceGuide,
  sequenceFor,
  startGuideSession,
  writeGuide,
  type MamBubbleSpec,
  type MamGuideAction,
  type MamGuideMotion,
  type MamGuideState,
} from './mam-guide'

const CONSENT_MOTION: MamGuideMotion = { loop: 'gentle' }

const sessionKey = (accountId: string) => `mb:mam-guide:session:${accountId}`
const indexKey = (accountId: string) => `mb:mam-guide:index:${accountId}`

function storedIndex(accountId: string) {
  try {
    return Number(sessionStorage.getItem(indexKey(accountId)) ?? 0) || 0
  } catch {
    return 0
  }
}

function storeIndex(accountId: string, index: number) {
  try {
    if (index > 0) sessionStorage.setItem(indexKey(accountId), String(index))
    else sessionStorage.removeItem(indexKey(accountId))
  } catch {
    // Storage blocked: a reload starts the sequence again.
  }
}

export interface MamGuideView {
  bubble: MamBubbleSpec | null
  /** For the dock's data attribute: no guide, nothing pending, or a sequence waiting. */
  status: 'none' | 'idle' | 'pending'
  /** The bubble's place in its sequence; keys the in-place text swap. */
  step: number
  /** Whether Mầm may say what she read: L2 granted, so the story can use its context line. */
  context: boolean
  /** Where the bubble sits in its sequence, for the progress dots. */
  progress: Readonly<{ at: number; total: number }>
  /** What Mầm does while the bubble is up (the consent bubble: a gentle look). */
  motion: MamGuideMotion | null
  /** Stable per bubble: the dock plays its one-shot once. */
  key: string
  next(): void
  act(action: MamGuideAction): void
  consented(result: { l1: boolean; l2: boolean } | 'later'): void
  close(): void
}

/**
 * The guide for the signed-in account: listens to guide events (and the verified `resource-done`), keeps
 * the state in storage and walks the pending sequence one bubble at a time. `allowed` false (Mầm away,
 * hidden, a modal, the safety page) holds the sequence where it is; it resumes when Mầm is back.
 */
export function useMamGuide(
  accountId: string | null,
  allowed: boolean,
): MamGuideView {
  const [state, setState] = useState<MamGuideState | null>(null)
  const [index, setIndex] = useState(0)
  const [context, setContext] = useState(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const save = useCallback(
    (next: MamGuideState | null) => {
      if (!accountId || !next || next === stateRef.current) return
      writeGuide(accountId, next)
      setState(next)
    },
    [accountId],
  )

  // Storage is read after mount (it differs from the server render), like the other Mầm state.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!accountId) {
        setState(null)
        return
      }
      let loaded = readGuide(accountId)
      try {
        if (loaded && !sessionStorage.getItem(sessionKey(accountId))) {
          sessionStorage.setItem(sessionKey(accountId), '1')
          const session = startGuideSession(loaded)
          if (session !== loaded) writeGuide(accountId, (loaded = session))
        }
      } catch {
        // Storage blocked: no reoffer this session.
      }
      setState(loaded)
      setIndex(storedIndex(accountId))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [accountId])

  useEffect(() => {
    if (!accountId) return
    const now = () => new Date().toISOString()
    const onGuide = (event: Event) => {
      const parsed = parseMamGuideEvent(
        (event as CustomEvent).detail,
        accountId,
      )
      if (!parsed) return
      const current = stateRef.current ?? readGuide(accountId)
      const next = reduceGuide(current, parsed, now())
      if (next && next.pending !== current?.pending) {
        setIndex(0)
        storeIndex(accountId, 0)
      }
      if (next && next !== current) {
        writeGuide(accountId, next)
        setState(next)
      }
    }
    const onResource = () =>
      onGuide(
        new CustomEvent(MAM_GUIDE_EVENT, {
          detail: { type: 'resource-done', accountId },
        }),
      )
    window.addEventListener(MAM_GUIDE_EVENT, onGuide)
    const resourceEvent = mamEventName('resource-done')
    window.addEventListener(resourceEvent, onResource)
    return () => {
      window.removeEventListener(MAM_GUIDE_EVENT, onGuide)
      window.removeEventListener(resourceEvent, onResource)
    }
  }, [accountId])

  const bubbles = useMemo(
    () =>
      state?.pending && !state.graduatedAt
        ? sequenceFor(state.pending, state)
        : [],
    [state],
  )
  const bubble = allowed ? (bubbles[index] ?? null) : null

  const finish = useCallback(
    (next: MamGuideState) => {
      if (!accountId) return
      setIndex(0)
      storeIndex(accountId, 0)
      save(next)
    },
    [accountId, save],
  )

  const next = useCallback(() => {
    if (!accountId || !stateRef.current) return
    const at = index + 1
    if (at >= bubbles.length) {
      finish({ ...stateRef.current, pending: null })
      return
    }
    setIndex(at)
    storeIndex(accountId, at)
  }, [accountId, bubbles.length, finish, index])

  const act = useCallback(
    (action: MamGuideAction) => {
      const current = stateRef.current
      if (!current) return
      // Navigating actions are links: the bubble's Link moves the page, this records the answer.
      finish(actGuide(current, action.go, new Date().toISOString()))
    },
    [finish],
  )

  const consented = useCallback(
    (result: { l1: boolean; l2: boolean } | 'later') => {
      setContext(result !== 'later' && result.l2)
      next()
    },
    [next],
  )

  /** The close button: "Để sau đi" for the step on offer; Mầm offers it again once, next session. */
  const close = useCallback(() => {
    const current = stateRef.current
    if (!current) return
    finish(actGuide(current, 'decline', new Date().toISOString()))
  }, [finish])

  const status = !state
    ? 'none'
    : state.pending && !state.graduatedAt
      ? 'pending'
      : 'idle'
  return {
    bubble,
    status,
    step: index,
    context,
    progress: { at: index, total: bubbles.length },
    motion: !bubble
      ? null
      : bubble.kind === 'consent'
        ? CONSENT_MOTION
        : (bubble.motion ?? null),
    key: `${state?.pending?.after ?? ''}:${index}`,
    next,
    act,
    consented,
    close,
  }
}

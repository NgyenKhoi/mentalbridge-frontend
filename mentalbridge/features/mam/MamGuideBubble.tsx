'use client'

import { ChevronRight, Leaf, X } from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'

import bubble from './MamBubble.module.css'
import styles from './MamGuideBubble.module.css'
import {
  MamGuideConsent,
  readAiConsent,
  type AiConsent,
} from './MamGuideConsent'
import {
  guideHoldMs,
  guideHref,
  type MamBubbleSpec,
  type MamGuideAction,
} from './mam-guide'

const ease = [0.22, 1, 0.36, 1] as const

function ConsentStep({
  onConsented,
}: Readonly<{ onConsented: (result: AiConsent | 'later') => void }>) {
  const [l1, setL1] = useState<boolean | null>(null)
  // The host passes a new callback on every render; read it once, when the answer arrives.
  const done = useRef(onConsented)
  useEffect(() => {
    done.current = onConsented
  })
  useEffect(() => {
    let live = true
    readAiConsent()
      .then((current) => {
        if (!live) return
        // Both levels already on: no question, Mầm goes straight on.
        if (current.l1 && current.l2) done.current(current)
        else setL1(current.l1)
      })
      .catch(() => live && setL1(false))
    return () => {
      live = false
    }
  }, [])
  if (l1 === null)
    return <div className={styles.waiting}>Mầm đang chuẩn bị…</div>
  return <MamGuideConsent l1Granted={l1} onDone={(r) => done.current(r)} />
}

/**
 * One bubble of the Mầm guide, on the dock. A story holds 4–9 s by its length and moves on by itself (paused
 * while the pointer or focus is on it, or after a click elsewhere), or on "Tiếp"; an ask waits for the user.
 * The close button counts as "Để sau đi".
 */
export function MamGuideBubble({
  spec,
  step,
  context,
  reduced,
  bubbleRef,
  dockRef,
  progress,
  onNext,
  onAct,
  onConsented,
  onClose,
}: Readonly<{
  spec: MamBubbleSpec
  /** Changes with every bubble, so the text swaps in place. */
  step: number
  context: boolean
  reduced: boolean
  bubbleRef: RefObject<HTMLDivElement | null>
  dockRef: RefObject<HTMLElement | null>
  progress: Readonly<{ at: number; total: number }>
  onNext: () => void
  onAct: (action: MamGuideAction) => void
  onConsented: (result: AiConsent | 'later') => void
  onClose: () => void
}>) {
  const titleId = useId()
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const story = spec.kind === 'story'
  const advance = useRef(onNext)
  useEffect(() => {
    advance.current = onNext
  })
  const text = story
    ? context && spec.withContext
      ? spec.withContext
      : spec.text
    : spec.kind === 'ask'
      ? spec.text
      : ''

  // A click elsewhere pauses the story; a click on the bubble resumes it. No key closes the guide: a stray
  // keystroke (Escape included) must not lose the first-run walk (owner 2026-11-26); only the close button does.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (bubbleRef.current?.contains(node)) setPaused(false)
      else if (!dockRef.current?.contains(node)) setPaused(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [bubbleRef, dockRef])

  useEffect(() => {
    if (!story || paused || held) return
    const timer = window.setTimeout(() => advance.current(), guideHoldMs(text))
    return () => window.clearTimeout(timer)
  }, [story, paused, held, text, step])

  // The button that moved the bubble on is gone after the swap: keep keyboard focus in the bubble.
  const focusInside = useRef(false)
  useEffect(() => {
    const root = bubbleRef.current
    if (!focusInside.current || !root) return
    const frame = window.requestAnimationFrame(() => {
      if (!root.contains(document.activeElement))
        root.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [bubbleRef, step])

  const travel = reduced ? 0 : 6
  return (
    <motion.div
      ref={bubbleRef}
      className={`${bubble.bubble} ${styles.guide}`}
      role="group"
      aria-labelledby={titleId}
      data-mam-bubble="guide"
      data-anchor="dock"
      tabIndex={-1}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => {
        focusInside.current = true
        setHeld(true)
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        if (next === null) return // the focused button was removed; the effect above takes it back
        if (!event.currentTarget.contains(next)) {
          focusInside.current = false
          setHeld(false)
        }
      }}
      initial={{ opacity: 0, y: travel, scale: reduced ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: travel / 2, transition: { duration: 0.14, ease } }}
      transition={{ duration: 0.22, ease }}
    >
      <div className={bubble.head}>
        <Leaf
          className={bubble.mark}
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <div id={titleId} className={bubble.title}>
          Mầm
        </div>
        <button
          type="button"
          className={bubble.close}
          aria-label="Đóng, để sau"
          onClick={onClose}
        >
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      {/* Stories change by themselves, so they are announced from one region that outlives the step swap. */}
      <div className={styles.live} aria-live="polite">
        {story ? text : ''}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className={styles.body}
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease } }}
          transition={{ duration: 0.2, ease }}
        >
          {spec.kind === 'consent' ? (
            <ConsentStep onConsented={onConsented} />
          ) : (
            // A story is read from the live region above; an ask waits and is read on focus.
            <div
              className={`${bubble.answer} ${story ? styles.line : ''}`}
              aria-hidden={story || undefined}
            >
              {text}
            </div>
          )}
          {spec.kind === 'ask' ? (
            // The question reads first; the choices follow a beat later.
            <motion.div
              className={styles.choices}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: reduced ? 0 : 0.08, ease }}
            >
              {spec.actions.map((action) => {
                // One column, one width, one inset: the main step filled, the others quiet, "later" as text.
                const className =
                  action.tone === 'primary'
                    ? `${styles.act} ${styles.main}`
                    : action.go === 'decline'
                      ? `${styles.act} ${styles.later}`
                      : styles.act
                const href = guideHref(action.go)
                return href ? (
                  <Link
                    key={action.label}
                    href={href}
                    className={className}
                    onClick={() => onAct(action)}
                  >
                    {action.label}
                  </Link>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    className={className}
                    onClick={() => onAct(action)}
                  >
                    {action.label}
                  </button>
                )
              })}
            </motion.div>
          ) : null}
          {story ? (
            <div className={styles.storyFoot}>
              {progress.total > 1 ? (
                <span className={styles.dots} aria-hidden="true">
                  {Array.from({ length: progress.total }, (_, at) => (
                    <span key={at} data-on={at <= progress.at || undefined} />
                  ))}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                className={styles.next}
                aria-label={`Tiếp, câu ${progress.at + 1} trên ${progress.total}`}
                onClick={onNext}
              >
                Tiếp
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

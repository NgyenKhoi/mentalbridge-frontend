'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Leaf, X } from 'lucide-react'

import styles from './MamBubble.module.css'
import { MAM_INTENT_LABELS, type MamIntent } from './mam-targets'
import type { MamSummon } from './use-mam-summon'

const GUTTER = 16
const WIDTH = 320
const OFFSET = 8
const ease = [0.16, 1, 0.3, 1] as const

/**
 * Starter menu and answer for one summon. A dock summon opens above the dock;
 * a target summon opens at the pointer or the focused element, in page
 * coordinates so it scrolls with the card it explains.
 */
export function MamBubble({
  summon,
  reduced,
  bubbleRef,
  onChoose,
  onGo,
  onClose,
}: Readonly<{
  summon: MamSummon
  reduced: boolean
  bubbleRef: RefObject<HTMLDivElement | null>
  onChoose: (intent: MamIntent) => void
  onGo: () => void
  onClose: () => void
}>) {
  const titleId = useId()
  const firstAction = useRef<HTMLButtonElement | null>(null)
  const { anchor, phase, answer, intent, target } = summon

  // Opens below the point unless that would leave the viewport.
  const [placement, setPlacement] = useState<{
    left: number
    top: number
    above: boolean
  } | null>(null)
  const [resized, setResized] = useState(0)
  useEffect(() => {
    if (anchor.kind !== 'point') return
    const onResize = () => setResized((value) => value + 1)
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [anchor.kind])
  useLayoutEffect(() => {
    if (anchor.kind !== 'point') return
    const viewport = document.documentElement.clientWidth
    const width =
      bubbleRef.current?.offsetWidth || Math.min(WIDTH, viewport - GUTTER * 2)
    const minLeft = window.scrollX + GUTTER
    const maxLeft = window.scrollX + viewport - GUTTER - width
    const height = bubbleRef.current?.offsetHeight ?? 0
    const viewTop = window.scrollY + GUTTER
    const viewBottom = window.scrollY + window.innerHeight - GUTTER
    const above =
      anchor.y + OFFSET + height > viewBottom &&
      anchor.y - viewTop > viewBottom - anchor.y
    const top = above ? anchor.y - OFFSET - height : anchor.y + OFFSET
    // An answer is taller than the menu; keep the whole bubble on screen.
    setPlacement({
      left: Math.max(minLeft, Math.min(anchor.x, maxLeft)),
      top: Math.max(viewTop, Math.min(top, viewBottom - height)),
      above,
    })
  }, [anchor, bubbleRef, phase, resized])

  // Each phase moves focus to its first control, so the keyboard stays inside.
  // A point bubble is measured hidden first, and hidden controls cannot take focus.
  const placed = anchor.kind === 'dock' || placement !== null
  useEffect(() => {
    if (placed && phase !== 'pending')
      firstAction.current?.focus({ preventScroll: true })
  }, [phase, placed])

  const travel = reduced ? 0 : 6
  const others = target.intents.filter((value) => value !== intent)

  const bubble = (
    <motion.div
      ref={bubbleRef}
      className={styles.bubble}
      role="dialog"
      aria-labelledby={titleId}
      data-mam-bubble={phase}
      data-anchor={anchor.kind}
      style={
        anchor.kind === 'point'
          ? {
              left: placement?.left ?? anchor.x,
              top: placement?.top ?? anchor.y,
              visibility: placement ? 'visible' : 'hidden',
            }
          : undefined
      }
      data-above={placement?.above || undefined}
      initial={{ opacity: 0, y: travel, scale: reduced ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: travel / 2, transition: { duration: 0.14, ease } }}
      transition={{ duration: 0.22, ease }}
    >
      <div className={styles.head}>
        <Leaf
          className={styles.mark}
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <div id={titleId} className={styles.title}>
          Mầm
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Đóng Mầm"
          onClick={onClose}
        >
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.live} role="status" aria-live="polite">
        {phase === 'pending' ? (
          <div className={styles.thinking}>Mầm đang nghĩ…</div>
        ) : phase === 'answer' && answer ? (
          <motion.div
            key={intent}
            className={styles.answer}
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease }}
          >
            {answer.text}
          </motion.div>
        ) : null}
      </div>

      {phase === 'menu' ? (
        <div
          className={styles.starters}
          role="group"
          aria-label="Bạn muốn Mầm giúp gì?"
        >
          {target.intents.map((value, index) => (
            <button
              key={value}
              ref={index === 0 ? firstAction : undefined}
              type="button"
              className={styles.starter}
              onClick={() => onChoose(value)}
            >
              {MAM_INTENT_LABELS[value]}
            </button>
          ))}
        </div>
      ) : phase === 'answer' ? (
        <div className={styles.actions}>
          {answer?.focusKind ? (
            <button
              ref={firstAction}
              type="button"
              className={styles.primary}
              onClick={onGo}
            >
              Đưa mình tới đó
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
          {others.map((value, index) => (
            <button
              key={value}
              ref={!answer?.focusKind && index === 0 ? firstAction : undefined}
              type="button"
              className={styles.starter}
              onClick={() => onChoose(value)}
            >
              {MAM_INTENT_LABELS[value]}
            </button>
          ))}
          {!answer?.focusKind && others.length === 0 ? (
            <button
              ref={firstAction}
              type="button"
              className={styles.done}
              onClick={onClose}
            >
              Cảm ơn Mầm
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )

  return anchor.kind === 'point' ? createPortal(bubble, document.body) : bubble
}

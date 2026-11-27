'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import {
  deleteCommunityBookmark,
  deleteCommunityReaction,
  putCommunityBookmark,
  putCommunityReaction,
  type SupportiveReaction,
} from '@/features/community/api/browser-community'
import type { CommunityViewerState } from '@/lib/community/community-validation'
import CommunityReactors from './CommunityReactors'
import { REACTIONS } from './community-reactions'
import styles from './CommunityInteractions.module.css'

// Like mobile: a tap sets or clears SUPPORT; hover, a long press or ArrowUp opens the seven-emoji tray.

function BookmarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 4.5h11v15L12 16.1l-5.5 3.4v-15Z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z" />
    </svg>
  )
}

type Props = Readonly<{
  postId: string
  viewerState: CommunityViewerState
  reactionCount: number
  onChange?: (state: CommunityViewerState, reactionCount: number) => void
  /** `bar`: counts row on top, then reaction / comment / save as three equal buttons (feed card). */
  layout?: 'inline' | 'bar'
  /** Bar layout: shown at the end of the counts row (the comment count). */
  meta?: ReactNode
  /** Bar layout: opens the comments; the middle of the three action buttons. */
  onComment?: (trigger: HTMLButtonElement) => void
}>

export default function CommunityInteractions(props: Props) {
  return <CommunityInteractionState key={props.postId} {...props} />
}

function CommunityInteractionState({
  postId,
  viewerState,
  reactionCount,
  onChange,
  layout = 'inline',
  meta,
  onComment,
}: Props) {
  const [state, setState] = useState(viewerState)
  const [count, setCount] = useState(reactionCount)
  const [pending, setPending] = useState<'reaction' | 'bookmark'>()
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<SupportiveReaction>()
  const [tray, setTray] = useState<{ below: boolean; focus: boolean } | null>(
    null,
  )
  const [showWho, setShowWho] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const whoRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressed = useRef(false)
  const refocus = useRef(false)
  const hintId = useId()
  const reduceMotion = useReducedMotion()
  useEffect(() => () => clearTimeout(timer.current), [])
  // `disabled` while pending drops focus to <body>; put it back on the button.
  useEffect(() => {
    if (!pending && refocus.current) {
      refocus.current = false
      mainRef.current?.focus()
    }
  }, [pending])
  // Touch taps elsewhere may not blur (iOS buttons take no focus): close on any outside press.
  useEffect(() => {
    if (!tray) return
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        clearTimeout(timer.current)
        setTray(null)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [tray])
  const [lastInput, setLastInput] = useState({
    reaction: viewerState.reaction,
    bookmarked: viewerState.bookmarked,
    reactionCount,
  })

  // Reconcile real refreshes, not a new object identity or an onChange echo.
  if (
    lastInput.reaction !== viewerState.reaction ||
    lastInput.bookmarked !== viewerState.bookmarked ||
    lastInput.reactionCount !== reactionCount
  ) {
    setLastInput({
      reaction: viewerState.reaction,
      bookmarked: viewerState.bookmarked,
      reactionCount,
    })
    if (
      state.reaction !== viewerState.reaction ||
      state.bookmarked !== viewerState.bookmarked ||
      count !== reactionCount
    ) {
      setState(viewerState)
      setCount(reactionCount)
      setFeedback(undefined)
    }
  }

  function commit(next: CommunityViewerState, nextCount: number) {
    setState(next)
    setCount(nextCount)
    onChange?.(next, nextCount)
  }

  async function chooseReaction(reaction: SupportiveReaction) {
    if (pending) return
    setPending('reaction')
    setError('')
    setFeedback(undefined)
    try {
      if (state.reaction === reaction) {
        await deleteCommunityReaction(postId)
        commit({ ...state, reaction: null }, Math.max(0, count - 1))
      } else {
        const result = await putCommunityReaction(postId, reaction)
        commit(
          { ...state, reaction: result.reaction },
          state.reaction === null ? count + 1 : count,
        )
        setFeedback(result.reaction)
      }
    } catch {
      setError('Chưa thể gửi lời đồng hành. Bạn có thể thử lại.')
    } finally {
      setPending(undefined)
    }
  }

  async function toggleBookmark() {
    if (pending) return
    setPending('bookmark')
    setError('')
    try {
      if (state.bookmarked) {
        await deleteCommunityBookmark(postId)
      } else {
        await putCommunityBookmark(postId)
      }
      commit({ ...state, bookmarked: !state.bookmarked }, count)
    } catch {
      setError('Chưa thể cập nhật bài đã lưu. Bạn có thể thử lại.')
    } finally {
      setPending(undefined)
    }
  }

  function openTray(focus: boolean) {
    clearTimeout(timer.current)
    const top = rootRef.current?.getBoundingClientRect().top ?? 999
    // No room under the sticky header: open below the button.
    setTray({ below: top < 150, focus })
  }

  function closeTray(returnFocus = false) {
    clearTimeout(timer.current)
    setTray(null)
    if (returnFocus) mainRef.current?.focus()
  }

  function later(action: () => void, ms: number) {
    clearTimeout(timer.current)
    timer.current = setTimeout(action, ms)
  }

  function pick(reaction: SupportiveReaction) {
    closeTray(true)
    if (reaction !== state.reaction) {
      refocus.current = true
      void chooseReaction(reaction)
    }
  }

  function trayKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
    )
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'ArrowRight'
        ? at + 1
        : event.key === 'ArrowLeft'
          ? at - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : null
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeTray(true)
    } else if (next !== null) {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
  }

  const chosen = REACTIONS.find((item) => item.value === state.reaction)
  const shown = chosen ?? {
    value: 'SUPPORT' as const,
    emoji: '🤍', // taste-skill-ignore: reactions are emoji by product design
    label: 'Thương',
  }

  const reactionControl = (
    <div
      ref={rootRef}
      className={styles.reactions}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && !pending)
          later(() => openTray(false), tray ? 0 : 450)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') later(() => closeTray(), 320)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeTray()
      }}
    >
      <button
        ref={mainRef}
        type="button"
        className={`${styles.main} ${chosen ? styles.selected : ''}`}
        aria-pressed={chosen !== undefined}
        aria-describedby={hintId}
        disabled={pending !== undefined}
        data-reaction-feedback={feedback ? 'committed' : undefined}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false
            return
          }
          closeTray()
          refocus.current = document.activeElement === mainRef.current
          void chooseReaction(state.reaction ?? 'SUPPORT')
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            // Already open from hover: autoFocus will not run again, so move focus in.
            const item = rootRef.current?.querySelector<HTMLButtonElement>(
              '[role="group"] button[tabindex="0"]',
            )
            if (tray && item) item.focus()
            else openTray(true)
          } else if (event.key === 'Escape' && tray) {
            event.stopPropagation()
            closeTray()
          }
        }}
        onPointerDown={(event) => {
          longPressed.current = false
          if (event.pointerType !== 'mouse')
            later(() => {
              longPressed.current = true
              openTray(false)
            }, 420)
        }}
        onPointerUp={() => {
          if (!longPressed.current) clearTimeout(timer.current)
        }}
        onPointerCancel={() => clearTimeout(timer.current)}
        onContextMenu={(event) => {
          if (longPressed.current || tray) event.preventDefault()
        }}
      >
        <span
          className={`${styles.icon} ${feedback ? styles.celebrating : ''}`}
          aria-hidden="true"
          onAnimationEnd={() => setFeedback(undefined)}
        >
          <span className={`${styles.emoji} ${chosen ? '' : styles.empty}`}>
            {shown.emoji}
          </span>
          {feedback && (
            <svg className={styles.sparkles} viewBox="0 0 32 32">
              <path d="M5 6v4M3 8h4M26 3v4M24 5h4" />
              <circle cx="29" cy="18" r="1" />
              <circle cx="6" cy="26" r="1" />
            </svg>
          )}
        </span>
        {shown.label}
      </button>
      <span id={hintId} hidden>
        Giữ nút hoặc nhấn mũi tên lên để chọn cảm xúc khác.
      </span>
      <AnimatePresence>
        {tray && (
          <motion.div
            key="tray"
            role="group"
            aria-label="Chọn cảm xúc"
            className={`${styles.tray} ${tray.below ? styles.below : ''}`}
            initial={{ opacity: 0, scale: 0.6, y: tray.below ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={trayKeys}
          >
            {REACTIONS.map((reaction, index) => (
              <motion.div
                key={reaction.value}
                className={styles.item}
                initial={{ opacity: 0, y: 10, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.03,
                  duration: 0.24,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
              >
                <button
                  type="button"
                  aria-label={reaction.label}
                  aria-pressed={state.reaction === reaction.value}
                  className={
                    state.reaction === reaction.value
                      ? styles.current
                      : undefined
                  }
                  // Roving focus: Tab enters and leaves the tray at one item; arrows move inside.
                  tabIndex={
                    reaction.value === (state.reaction ?? 'LIKE') ? 0 : -1
                  }
                  autoFocus={
                    tray.focus && reaction.value === (state.reaction ?? 'LIKE')
                  }
                  onClick={() => pick(reaction.value)}
                >
                  <span className={styles.trayEmoji} aria-hidden="true">
                    {reaction.emoji}
                  </span>
                </button>
                <div className={styles.tip} aria-hidden="true">
                  {reaction.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
  const whoControl = (
    <span
      className={styles.who}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setShowWho(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && showWho) {
          event.stopPropagation()
          setShowWho(false)
          whoRef.current?.focus()
        }
      }}
    >
      {count > 0 ? (
        <button
          ref={whoRef}
          type="button"
          className={styles.countButton}
          aria-haspopup="dialog"
          aria-expanded={showWho}
          aria-label={`Xem ai đã bày tỏ cảm xúc, ${count} lượt`}
          onClick={() => setShowWho((open) => !open)}
        >
          {count} lượt
        </button>
      ) : (
        <span className={styles.count} aria-live="polite">
          0 lượt
        </span>
      )}
      <AnimatePresence>
        {showWho && (
          <CommunityReactors
            key={`${postId}:${count}`}
            postId={postId}
            onClose={() => {
              setShowWho(false)
              whoRef.current?.focus()
            }}
          />
        )}
      </AnimatePresence>
    </span>
  )
  const bookmarkControl = (
    <button
      type="button"
      className={`${styles.bookmark} ${state.bookmarked ? styles.selected : ''}`}
      aria-pressed={state.bookmarked}
      disabled={pending !== undefined}
      onClick={() => void toggleBookmark()}
    >
      <BookmarkIcon />
      {state.bookmarked ? 'Đã lưu' : 'Lưu bài'}
    </button>
  )
  const feedbackLines = (
    <>
      {pending && (
        <p className={styles.status} role="status">
          {pending === 'reaction'
            ? 'Đang gửi lời đồng hành…'
            : 'Đang lưu thay đổi…'}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  )

  if (layout === 'bar')
    return (
      <div className={`${styles.root} ${styles.bar}`}>
        <div className={styles.stats}>
          <span className={styles.statsReactions}>
            <span className={styles.statsMark} aria-hidden="true">
              {/* taste-skill-ignore: the reaction set is emoji by product design (community-reactions.ts) */}
              {chosen?.emoji ?? '❤️'}
            </span>
            {whoControl}
          </span>
          {meta}
        </div>
        <div className={styles.actions}>
          {reactionControl}
          {onComment && (
            <button
              type="button"
              className={styles.commentAction}
              onClick={(event) => onComment(event.currentTarget)}
            >
              <CommentIcon />
              Bình luận
            </button>
          )}
          {bookmarkControl}
        </div>
        {feedbackLines}
      </div>
    )

  return (
    <div className={styles.root}>
      {reactionControl}
      {whoControl}
      {bookmarkControl}
      {feedbackLines}
    </div>
  )
}

'use client'

import { useState } from 'react'

import {
  deleteCommunityBookmark,
  deleteCommunityReaction,
  putCommunityBookmark,
  putCommunityReaction,
  type SupportiveReaction,
} from '@/features/community/api/browser-community'
import type { CommunityViewerState } from '@/lib/community/community-validation'
import styles from './CommunityInteractions.module.css'

// Same kinds, order, emoji and labels as the mobile tray (mobile/src/community/community-reactions.ts).
const REACTIONS: ReadonlyArray<{
  value: SupportiveReaction
  emoji: string
  label: string
}> = [
  { value: 'LIKE', emoji: '👍', label: 'Thích' },
  { value: 'SUPPORT', emoji: '❤️', label: 'Thương' },
  { value: 'THANK_YOU', emoji: '🥰', label: 'Cảm ơn' },
  { value: 'RELATE', emoji: '🤗', label: 'Ôm' },
  { value: 'EMPATHY', emoji: '😢', label: 'Đồng cảm' },
  { value: 'CHEER', emoji: '💪', label: 'Cố lên' },
  { value: 'GROWTH', emoji: '🌱', label: 'Đang lớn lên' },
]

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

type Props = Readonly<{
  postId: string
  viewerState: CommunityViewerState
  reactionCount: number
  onChange?: (state: CommunityViewerState, reactionCount: number) => void
}>

export default function CommunityInteractions(props: Props) {
  return <CommunityInteractionState key={props.postId} {...props} />
}

function CommunityInteractionState({
  postId,
  viewerState,
  reactionCount,
  onChange,
}: Props) {
  const [state, setState] = useState(viewerState)
  const [count, setCount] = useState(reactionCount)
  const [pending, setPending] = useState<'reaction' | 'bookmark'>()
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<SupportiveReaction>()
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

  return (
    <div className={styles.root}>
      <div
        className={styles.reactions}
        role="group"
        aria-label={`Gửi lời đồng hành. Hiện có ${count} lượt`}
      >
        {REACTIONS.map((reaction) => (
          <button
            key={reaction.value}
            type="button"
            className={
              state.reaction === reaction.value ? styles.selected : undefined
            }
            aria-pressed={state.reaction === reaction.value}
            disabled={pending !== undefined}
            onClick={() => void chooseReaction(reaction.value)}
            aria-label={reaction.label}
            title={reaction.label}
            data-reaction-feedback={
              feedback === reaction.value ? 'committed' : undefined
            }
          >
            <span
              className={`${styles.icon} ${feedback === reaction.value ? styles.celebrating : ''}`}
              aria-hidden="true"
              onAnimationEnd={() => setFeedback(undefined)}
            >
              <span className={styles.emoji}>{reaction.emoji}</span>
              {feedback === reaction.value && (
                <svg className={styles.sparkles} viewBox="0 0 32 32">
                  <path d="M5 6v4M3 8h4M26 3v4M24 5h4" />
                  <circle cx="29" cy="18" r="1" />
                  <circle cx="6" cy="26" r="1" />
                </svg>
              )}
            </span>
            <span className={styles.label}>{reaction.label}</span>
          </button>
        ))}
      </div>
      <span className={styles.count} aria-live="polite">
        {count} lượt
      </span>
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
    </div>
  )
}

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

const REACTIONS: ReadonlyArray<{
  value: SupportiveReaction
  label: string
  mobileLabel: string
  icon: 'support' | 'relate' | 'thanks'
}> = [
  {
    value: 'SUPPORT',
    label: 'Đồng hành',
    mobileLabel: 'Đồng hành',
    icon: 'support',
  },
  {
    value: 'RELATE',
    label: 'Mình cũng vậy',
    mobileLabel: 'Đồng cảm',
    icon: 'relate',
  },
  {
    value: 'THANK_YOU',
    label: 'Cảm ơn bạn',
    mobileLabel: 'Cảm ơn',
    icon: 'thanks',
  },
]

function InteractionIcon({
  name,
}: Readonly<{
  name: 'support' | 'relate' | 'thanks' | 'bookmark'
}>) {
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
      {name === 'support' && (
        <>
          <path d="m8.2 12.5 2.1 2.1a2 2 0 0 0 2.8 0l3.6-3.6" />
          <path d="m3.5 10.5 3.2-3.2 3 1 2.3-1.8 2.2 1.6 3.1-.8 3.2 3.2-5.8 7.2a3.5 3.5 0 0 1-5.4.1L3.5 10.5Z" />
        </>
      )}
      {name === 'relate' && (
        <>
          <path d="M12 20V8" />
          <path d="M12 13c-4.2 0-6.5-2.2-6.5-6.5 4.3 0 6.5 2.2 6.5 6.5ZM12 16c4.2 0 6.5-2.2 6.5-6.5-4.3 0-6.5 2.2-6.5 6.5Z" />
        </>
      )}
      {name === 'thanks' && (
        <path d="M20.5 9.4c0 4.4-5.2 8-8.5 10.1C8.7 17.4 3.5 13.8 3.5 9.4A4.4 4.4 0 0 1 12 7.8a4.4 4.4 0 0 1 8.5 1.6Z" />
      )}
      {name === 'bookmark' && <path d="M6.5 4.5h11v15L12 16.1l-5.5 3.4v-15Z" />}
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
            data-reaction-feedback={
              feedback === reaction.value ? 'committed' : undefined
            }
          >
            <span
              className={`${styles.icon} ${feedback === reaction.value ? styles.celebrating : ''}`}
              aria-hidden="true"
              onAnimationEnd={() => setFeedback(undefined)}
            >
              <InteractionIcon name={reaction.icon} />
              {feedback === reaction.value && (
                <svg className={styles.sparkles} viewBox="0 0 32 32">
                  <path d="M5 6v4M3 8h4M26 3v4M24 5h4" />
                  <circle cx="29" cy="18" r="1" />
                  <circle cx="6" cy="26" r="1" />
                </svg>
              )}
            </span>
            <span className={styles.desktopLabel}>{reaction.label}</span>
            <span className={styles.mobileLabel}>{reaction.mobileLabel}</span>
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
        <InteractionIcon name="bookmark" />
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

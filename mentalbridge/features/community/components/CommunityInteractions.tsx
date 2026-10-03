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
  icon: string
}> = [
  { value: 'SUPPORT', label: 'Đồng hành', icon: '🤝' },
  { value: 'RELATE', label: 'Mình cũng vậy', icon: '🌿' },
  { value: 'THANK_YOU', label: 'Cảm ơn bạn', icon: '💛' },
]

type Props = Readonly<{
  postId: string
  viewerState: CommunityViewerState
  reactionCount: number
  onChange?: (state: CommunityViewerState, reactionCount: number) => void
}>

export default function CommunityInteractions({
  postId,
  viewerState,
  reactionCount,
  onChange,
}: Props) {
  const [state, setState] = useState(viewerState)
  const [count, setCount] = useState(reactionCount)
  const [pending, setPending] = useState<'reaction' | 'bookmark'>()
  const [error, setError] = useState('')

  function commit(next: CommunityViewerState, nextCount: number) {
    setState(next)
    setCount(nextCount)
    onChange?.(next, nextCount)
  }

  async function chooseReaction(reaction: SupportiveReaction) {
    if (pending) return
    setPending('reaction')
    setError('')
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
          >
            <span aria-hidden="true">{reaction.icon}</span>
            <span>{reaction.label}</span>
          </button>
        ))}
        <span className={styles.count} aria-live="polite">
          {count} lượt
        </span>
      </div>
      <button
        type="button"
        className={`${styles.bookmark} ${state.bookmarked ? styles.selected : ''}`}
        aria-pressed={state.bookmarked}
        disabled={pending !== undefined}
        onClick={() => void toggleBookmark()}
      >
        <span aria-hidden="true">{state.bookmarked ? '🔖' : '♡'}</span>
        {state.bookmarked ? 'Đã lưu' : 'Lưu bài'}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

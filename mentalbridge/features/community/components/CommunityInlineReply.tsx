'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUp, Sprout } from 'lucide-react'
import { createCommunityComment } from '../api/browser-community'
import styles from './CommunityDiscovery.module.css'

export default function CommunityInlineReply({
  postId,
  authorName,
  avatar,
  onCreated,
}: {
  postId: string
  authorName: string
  /** The viewer's own avatar; a sprout mark when they have none. */
  avatar?: ReactNode
  onCreated: () => void
}) {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const lock = useRef(false)
  const command = useRef<{ content: string; key: string } | null>(null)
  async function submit() {
    if (lock.current) return
    const text = content.trim()
    if (!text || [...text].length > 2000) {
      setError('Viết lời nhắn từ 1 đến 2.000 ký tự.')
      return
    }
    if (command.current?.content !== text)
      command.current = { content: text, key: crypto.randomUUID() }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await createCommunityComment(
        postId,
        { content: text, parentCommentId: null },
        command.current.key,
      )
      command.current = null
      setContent('')
      setSent(true)
      onCreated()
    } catch {
      setError(
        'Chưa gửi được lời nhắn. Nội dung của bạn vẫn được giữ; hãy thử lại.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className={styles.quickReply}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <span className={styles.quickReplyAvatar} aria-hidden="true">
        {avatar ?? <Sprout size={16} />}
      </span>
      <label className={styles.srOnly} htmlFor={`reply-${postId}`}>
        Gửi lời nhắn cho bài viết của {authorName}
      </label>
      <span className={styles.quickReplyField}>
        <input
          id={`reply-${postId}`}
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            setSent(false)
            setError('')
          }}
          placeholder="Viết một bình luận tử tế…"
          maxLength={4000}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `reply-error-${postId}` : undefined}
        />
        <button
          type="submit"
          disabled={busy || !content.trim()}
          aria-label={`Gửi bình luận cho ${authorName}`}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
      </span>
      {error && (
        <p id={`reply-error-${postId}`} role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p role="status">
          Đã gửi lời nhắn.{' '}
          <Link href={`/community/${postId}#comments-title`}>
            Xem bình luận
          </Link>
        </p>
      )}
    </form>
  )
}

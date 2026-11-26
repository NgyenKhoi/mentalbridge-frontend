'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { AI_L1, grantAiLevel } from '@/features/mam/MamGuideConsent'

import styles from './AiConsentCard.module.css'

/**
 * Shown in place of the error when a send stopped for missing AI consent (L1). The user reads the current
 * notice, ticks, and the chat sends the waiting message once the decision is saved.
 */
export default function AiConsentCard({
  onGranted,
}: Readonly<{ onGranted: () => void }>) {
  const tickId = useId()
  const [notice, setNotice] = useState('')
  const [ticked, setTicked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const key = useRef(crypto.randomUUID())
  const card = useRef<HTMLElement | null>(null)
  // The send stopped here: keyboard and screen-reader users land on the reason and the way on.
  useEffect(() => {
    card.current?.focus({ preventScroll: false })
  }, [])

  useEffect(() => {
    let live = true
    fetch('/api/care/ai-processing-disclosure', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((value: { content?: string } | null) => {
        if (live && value?.content) setNotice(value.content)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const agree = async () => {
    if (!ticked || saving || !notice) return
    setSaving(true)
    setError('')
    try {
      await grantAiLevel(AI_L1, key.current)
      onGranted()
    } catch {
      setError('Chưa lưu được lựa chọn. Bạn thử lại nhé, tin nhắn vẫn còn đó.')
      setSaving(false)
    }
  }

  return (
    <section
      ref={card}
      tabIndex={-1}
      className={styles.card}
      aria-labelledby={`${tickId}-title`}
    >
      <h3 id={`${tickId}-title`} className={styles.title}>
        Đồng ý để Mầm trả lời bằng AI
      </h3>
      <div className={styles.lead}>
        Mầm cần bạn đồng ý xử lý AI trước khi trả lời. Tin nhắn bạn vừa gõ vẫn
        được giữ lại.
      </div>
      {notice ? (
        <details className={styles.notice}>
          <summary>Đọc thông tin xử lý AI</summary>
          <div>{notice}</div>
        </details>
      ) : (
        <div className={styles.lead}>
          Chưa tải được thông tin xử lý AI. Bạn thử lại sau nhé.
        </div>
      )}
      <div className={styles.tick}>
        <input
          id={tickId}
          type="checkbox"
          checked={ticked}
          disabled={saving}
          onChange={(event) => setTicked(event.target.checked)}
        />
        <label htmlFor={tickId}>
          Tôi đã đọc và đồng ý cho AI xử lý nội dung trò chuyện.
        </label>
      </div>
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="button"
        className={styles.primary}
        disabled={!ticked || saving || !notice}
        onClick={() => void agree()}
      >
        {saving ? 'Đang lưu…' : 'Đồng ý và gửi'}
      </button>
    </section>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { parseConsentCollection } from '@/lib/care/care-validation'

import bubble from './MamBubble.module.css'
import styles from './MamGuideBubble.module.css'

export const AI_L1 = {
  consentType: 'AI_PROCESSING',
  policyVersion: 'ai-processing-capstone-v2',
} as const
export const AI_L2 = {
  consentType: 'AI_CONTEXT_PROCESSING',
  policyVersion: 'ai-context-processing-capstone-v1',
} as const

type Level = typeof AI_L1 | typeof AI_L2
export type AiConsent = Readonly<{ l1: boolean; l2: boolean }>

/** The effective levels from the current decisions: granted on the current policy version. */
export async function readAiConsent(): Promise<AiConsent> {
  const response = await fetch('/api/care/consents', { cache: 'no-store' })
  const collection = response.ok
    ? parseConsentCollection(await response.json())
    : null
  if (!collection) throw new Error('CONSENT_UNAVAILABLE')
  const granted = (level: Level) =>
    collection.decisions.some(
      (decision) =>
        decision.consentType === level.consentType &&
        decision.policyVersion === level.policyVersion &&
        decision.granted,
    )
  return { l1: granted(AI_L1), l2: granted(AI_L2) }
}

/** Records one granted level (one decision record per level, ADR 0050). */
export async function grantAiLevel(level: Level, key: string) {
  const response = await fetch('/api/care/consent-decisions', {
    method: 'POST',
    signal: AbortSignal.timeout(12_000),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ ...level, granted: true }),
  })
  if (!response.ok) throw new Error('CONSENT_FAILED')
}

type Notice = Readonly<{ title: string; content: string }>

function useNotice(path: string, wanted: boolean) {
  const [notice, setNotice] = useState<Notice | null>(null)
  useEffect(() => {
    if (!wanted) return
    let live = true
    fetch(path, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((value: Notice | null) => {
        if (live && value?.content) setNotice(value)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [path, wanted])
  return notice
}

/**
 * The guide's consent bubble (design §11): one bubble, two independent ticks, one button. L1 is needed to
 * use AI at all; L2 lets Mầm read the journal. Only ticked levels are recorded; an unticked L2 writes nothing.
 */
export function MamGuideConsent({
  l1Granted,
  onDone,
}: Readonly<{
  l1Granted: boolean
  onDone: (result: AiConsent | 'later') => void
}>) {
  const ids = { l1: useId(), l2: useId(), hint: useId() }
  const [tickL1, setTickL1] = useState(false)
  const [tickL2, setTickL2] = useState(false)
  const [savedL1, setSavedL1] = useState(l1Granted)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const keys = useRef({ l1: crypto.randomUUID(), l2: crypto.randomUUID() })
  const l1Notice = useNotice('/api/care/ai-processing-disclosure', !l1Granted)
  const l2Notice = useNotice('/api/care/ai-context-processing-disclosure', true)
  const ready = (savedL1 || (tickL1 && !!l1Notice)) && (!tickL2 || !!l2Notice)

  const agree = async () => {
    if (!ready || saving) return
    setSaving(true)
    setError('')
    let l1 = savedL1
    try {
      if (!l1) {
        await grantAiLevel(AI_L1, keys.current.l1)
        l1 = true
        setSavedL1(true)
      }
      if (tickL2) await grantAiLevel(AI_L2, keys.current.l2)
      onDone({ l1, l2: tickL2 })
    } catch {
      setError(
        l1
          ? 'Mầm chưa lưu được ô thứ hai. Bạn thử lại nhé, ô đầu đã được lưu.'
          : 'Mầm chưa lưu được lựa chọn. Bạn thử lại nhé.',
      )
      setSaving(false)
    }
  }

  return (
    <div className={styles.consent}>
      <div className={bubble.answer}>
        Để Mầm dẫn bạn đi đúng hơn, Mầm cần bạn đồng ý{' '}
        {savedL1 ? 'việc này' : '2 việc này'} nhé. Bạn tick cái nào thì Mầm chỉ
        dùng cái đó.
      </div>
      {savedL1 ? null : (
        <div className={styles.tick}>
          <input
            id={ids.l1}
            type="checkbox"
            checked={tickL1}
            disabled={saving}
            aria-describedby={ids.hint}
            onChange={(event) => setTickL1(event.target.checked)}
          />
          <div>
            <label htmlFor={ids.l1}>
              Cho AI xử lý nội dung bạn vừa viết để trả lời
            </label>
            <div className={styles.note}>
              Không có cái này thì Mầm không dùng AI được.
            </div>
            {l1Notice ? (
              <details className={styles.notice}>
                <summary>Đọc thông tin xử lý AI</summary>
                <div>{l1Notice.content}</div>
              </details>
            ) : (
              <div className={styles.note}>
                Chưa tải được thông tin xử lý AI. Bạn thử lại sau nhé.
              </div>
            )}
          </div>
        </div>
      )}
      <div className={styles.tick}>
        <input
          id={ids.l2}
          type="checkbox"
          checked={tickL2}
          disabled={saving}
          onChange={(event) => setTickL2(event.target.checked)}
        />
        <div>
          <label htmlFor={ids.l2}>
            Cho Mầm đọc nhật ký của bạn để dẫn bạn đi đúng hơn
          </label>
          <div className={styles.note}>
            Nếu bạn không tick, Mầm vẫn dẫn bạn đi, nhưng chỉ nói chung chung,
            không nhắc lại chuyện trong nhật ký.
          </div>
          {l2Notice ? (
            <details className={styles.notice}>
              <summary>Đọc thông tin AI dùng bối cảnh</summary>
              <div>{l2Notice.content}</div>
            </details>
          ) : (
            <div className={styles.note}>
              Chưa tải được thông tin AI dùng bối cảnh. Bạn thử lại sau nhé.
            </div>
          )}
        </div>
      </div>
      <div
        id={ids.hint}
        className={styles.hint}
        data-hidden={savedL1 || tickL1 || undefined}
        aria-hidden={savedL1 || tickL1 || undefined}
      >
        Bạn cần tick ô đầu tiên để dùng AI nhé.
      </div>
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      <div className={bubble.actions}>
        <button
          type="button"
          className={`${bubble.primary} ${styles.agree}`}
          disabled={!ready || saving}
          aria-describedby={savedL1 || tickL1 ? undefined : ids.hint}
          onClick={() => void agree()}
        >
          {saving ? 'Đang lưu…' : 'Đồng ý'}
        </button>
        <button
          type="button"
          className={bubble.done}
          disabled={saving}
          onClick={() => onDone('later')}
        >
          Để sau đi
        </button>
      </div>
    </div>
  )
}

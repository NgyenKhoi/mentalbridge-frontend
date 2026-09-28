'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInValue,
} from '@/lib/emotion-check-in/contract'
import {
  createEmotionCheckIn,
  getEmotionCheckIn,
  updateEmotionCheckIn,
} from './api/browser-emotion-check-in'
import styles from './DailyEmotionCheckIn.module.css'

const emotions: ReadonlyArray<{
  value: Emotion
  emoji: string
  label: string
}> = [
  { value: 'GREAT', emoji: '😄', label: 'Rất tốt' },
  { value: 'GOOD', emoji: '😊', label: 'Tốt' },
  { value: 'OKAY', emoji: '😌', label: 'Bình thường' },
  { value: 'LOW', emoji: '🥱', label: 'Không tốt' },
  { value: 'VERY_LOW', emoji: '😟', label: 'Rất không tốt' },
]

type Draft = Readonly<{
  emotion: Emotion | null
  intensity: number | null
}>
type Phase = 'loading' | 'empty' | 'ready' | 'saving' | 'saved' | 'error'
type RetryKind = 'load' | 'save'

const emptyDraft: Draft = { emotion: null, intensity: null }

export function localDateInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function commandKey() {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `emotion-check-in-${id}`
}

function messageFor(error: unknown, saving: boolean) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
  return saving
    ? 'Chưa thể lưu ghi nhận. Lựa chọn của bạn vẫn được giữ để thử lại.'
    : 'Ghi nhận cảm xúc hôm nay tạm thời chưa tải được.'
}

export function DailyEmotionCheckIn({
  onPersisted,
}: Readonly<{ onPersisted?: () => void }>) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [localDate, setLocalDate] = useState(() =>
    localDateInTimeZone(new Date(), timezone),
  )
  const [persisted, setPersisted] = useState<EmotionCheckIn | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [phase, setPhase] = useState<Phase>('loading')
  const [retryKind, setRetryKind] = useState<RetryKind>('load')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const activeDate = useRef(localDate)
  const mutation = useRef<{ fingerprint: string; key: string } | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const checkIn = await getEmotionCheckIn(localDate)
        if (!active) return
        setPersisted(checkIn)
        setDraft({ emotion: checkIn.emotion, intensity: checkIn.intensity })
        setPhase('ready')
        setMessage('Đã tải ghi nhận tự báo cáo hôm nay.')
      } catch (error) {
        if (!active) return
        if (error instanceof ApiError && error.status === 404) {
          setPersisted(null)
          setDraft(emptyDraft)
          setPhase('empty')
          setMessage('Hôm nay bạn chưa ghi nhận cảm xúc.')
          return
        }
        setPersisted(null)
        setDraft(emptyDraft)
        setPhase('error')
        setRetryKind('load')
        setMessage(messageFor(error, false))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [localDate, reload])

  useEffect(() => {
    const checkDay = () => {
      const nextDate = localDateInTimeZone(new Date(), timezone)
      if (activeDate.current === nextDate) return
      activeDate.current = nextDate
      setPhase('loading')
      setMessage('Đang tải ghi nhận hôm nay…')
      setLocalDate(nextDate)
    }
    const interval = window.setInterval(checkDay, 60_000)
    window.addEventListener('focus', checkDay)
    document.addEventListener('visibilitychange', checkDay)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkDay)
      document.removeEventListener('visibilitychange', checkDay)
    }
  }, [timezone])

  // Nút Lưu ghi nhận: Khi user đã chọn đủ cảm xúc + mức độ thì nút sáng rõ, cho phép bấm
  const isComplete = draft.emotion !== null && draft.intensity !== null
  const isSubmitting = phase === 'saving'
  const loadBlocked = phase === 'error' && retryKind === 'load'
  const isDisabled = !isComplete || isSubmitting || loadBlocked

  const save = async () => {
    if (!draft.emotion || !draft.intensity) return
    const value: EmotionCheckInValue = {
      emotion: draft.emotion,
      intensity: draft.intensity,
      note: null,
    }
    const existing = persisted

    // Nếu giá trị đã trùng với bản đã lưu, thông báo thành công và không cần request lại
    if (
      existing &&
      existing.emotion === draft.emotion &&
      existing.intensity === draft.intensity
    ) {
      setMessage('Đã cập nhật ghi nhận hôm nay.')
      setPhase('saved')
      return
    }

    const fingerprint = JSON.stringify({
      localDate,
      revision: existing?.revision ?? 0,
      ...value,
    })
    if (mutation.current?.fingerprint !== fingerprint)
      mutation.current = { fingerprint, key: commandKey() }
    const key = mutation.current.key
    setPhase('saving')
    setMessage(existing ? 'Đang cập nhật ghi nhận…' : 'Đang lưu ghi nhận…')
    try {
      const saved = existing
        ? await updateEmotionCheckIn(localDate, existing.revision, value, key)
        : await createEmotionCheckIn({ ...value, localDate, timezone }, key)
      setPersisted(saved)
      setDraft({ emotion: saved.emotion, intensity: saved.intensity })
      mutation.current = null
      setPhase('saved')
      onPersisted?.()
      setMessage(
        existing ? 'Đã cập nhật ghi nhận hôm nay.' : 'Đã lưu ghi nhận hôm nay.',
      )
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        try {
          const latest = await getEmotionCheckIn(localDate)
          setPersisted(latest)
          setMessage(
            'Ghi nhận đã thay đổi ở nơi khác. Bản mới nhất đã được tải; lựa chọn của bạn chưa được lưu.',
          )
        } catch {
          setMessage(
            'Ghi nhận đã thay đổi ở nơi khác và chưa thể tải bản mới nhất. Lựa chọn của bạn chưa được lưu.',
          )
        }
      } else {
        setMessage(messageFor(error, true))
      }
      setPhase('error')
      setRetryKind('save')
    }
  }

  const retry = () => {
    if (retryKind === 'save') void save()
    else {
      setPhase('loading')
      setMessage('Đang tải ghi nhận hôm nay…')
      setReload((value) => value + 1)
    }
  }

  return (
    <div
      className={styles.card}
      aria-busy={phase === 'loading' || phase === 'saving'}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Cảm xúc hôm nay</h2>
        <p className={styles.subtitle}>Tự chọn cảm xúc phù hợp nhất với bạn</p>
      </header>

      {phase === 'loading' ? (
        <p className={styles.status} role="status">
          Đang tải ghi nhận hôm nay…
        </p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <fieldset className={styles.emotions} disabled={loadBlocked}>
            <legend className={styles.srOnly}>Cảm xúc hôm nay</legend>
            {emotions.map((item) => {
              const isSelected = draft.emotion === item.value
              return (
                <label
                  key={item.value}
                  className={`${styles.emotionLabel} ${isSelected ? styles.selected : ''}`}
                >
                  <input
                    type="radio"
                    name="emotion"
                    value={item.value}
                    checked={isSelected}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        emotion: item.value,
                      }))
                    }
                  />
                  <span className={styles.emojiIcon} aria-hidden="true">
                    {item.emoji}
                  </span>
                  <small className={styles.emotionText}>{item.label}</small>
                </label>
              )
            })}
          </fieldset>

          <fieldset className={styles.intensity} disabled={loadBlocked}>
            <legend>Mức độ cảm nhận</legend>
            <p className={styles.intensityNote}>
              1 là nhẹ, 5 là mạnh — không phải điểm sức khỏe.
            </p>
            <div className={styles.intensityRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isChecked = draft.intensity === value
                return (
                  <label
                    key={value}
                    className={`${styles.intensityBtn} ${isChecked ? styles.intensitySelected : ''}`}
                  >
                    <input
                      type="radio"
                      name="intensity"
                      value={value}
                      checked={isChecked}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          intensity: value,
                        }))
                      }
                    />
                    <span>{value}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={isDisabled}
            >
              {phase === 'saving'
                ? 'Đang lưu…'
                : persisted
                  ? 'Cập nhật ghi nhận'
                  : 'Lưu ghi nhận'}
            </button>
            <Link href="/journal" className={styles.journalLink}>
              Viết thêm →
            </Link>
          </div>
        </form>
      )}

      {phase !== 'loading' ? (
        <div
          className={`${styles.feedback} ${phase === 'error' ? styles.error : ''}`}
          role={phase === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{message}</span>
          {phase === 'error' ? (
            <button type="button" onClick={retry}>
              Thử lại
            </button>
          ) : null}
        </div>
      ) : null}
      <p className={styles.disclaimer}>
        Đây là ghi nhận do bạn tự chọn, không phải chẩn đoán hay đánh giá an
        toàn.
      </p>
    </div>
  )
}

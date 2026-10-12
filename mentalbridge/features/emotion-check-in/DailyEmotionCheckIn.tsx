'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  Emotion,
  EmotionCheckIn,
  EmotionInfluenceFactor,
  EmotionCheckInValue,
} from '@/lib/emotion-check-in/contract'
import {
  emotionInfluenceOptions,
  emotionOptions,
  emotionPresentation,
  localDateInTimeZone,
} from '@/lib/emotion-check-in/presentation'
import {
  createEmotionCheckIn,
  deleteEmotionCheckIn,
  getEmotionCheckIn,
  listEmotionCheckIns,
  updateEmotionCheckIn,
} from './api/browser-emotion-check-in'
import styles from './DailyEmotionCheckIn.module.css'

export { localDateInTimeZone } from '@/lib/emotion-check-in/presentation'

type Draft = Readonly<{
  emotion: Emotion | null
  intensity: number | null
  factors: readonly EmotionInfluenceFactor[]
  note: string
}>
type Phase =
  'loading' | 'empty' | 'ready' | 'saving' | 'deleting' | 'saved' | 'error'
type RetryKind = 'load' | 'save' | 'delete'
const emptyDraft: Draft = {
  emotion: null,
  intensity: null,
  factors: [],
  note: '',
}

const savedDraft = (checkIn: EmotionCheckIn): Draft => ({
  emotion: checkIn.emotion,
  intensity: checkIn.intensity,
  factors: checkIn.factors,
  note: checkIn.note ?? '',
})

function commandKey() {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `emotion-check-in-${id}`
}

function messageFor(error: unknown, mutation: boolean) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
  return mutation
    ? 'Chưa thể lưu thay đổi. Lựa chọn của bạn vẫn được giữ để thử lại.'
    : 'Ghi nhận cảm xúc hôm nay tạm thời chưa tải được.'
}

function announceChange() {
  window.dispatchEvent(new CustomEvent('mb:emotion-check-in-updated'))
}

export function DailyEmotionCheckIn({
  onPersisted,
}: Readonly<{ onPersisted?: () => void }>) {
  const { confirm } = useFeedback()
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [localDate, setLocalDate] = useState(() =>
    localDateInTimeZone(new Date(), timezone),
  )
  const [persisted, setPersisted] = useState<EmotionCheckIn | null>(null)
  const [yesterdayCheckIn, setYesterdayCheckIn] =
    useState<EmotionCheckIn | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [phase, setPhase] = useState<Phase>('loading')
  const [retryKind, setRetryKind] = useState<RetryKind>('load')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const activeDate = useRef(localDate)
  const mutation = useRef<{ fingerprint: string; key: string } | null>(null)

  useEffect(() => {
    let active = true
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = localDateInTimeZone(yesterday, timezone)
    void listEmotionCheckIns(10)
      .then((result) => {
        if (active)
          setYesterdayCheckIn(
            result.items.find((item) => item.localDate === yesterdayDate) ??
              null,
          )
      })
      .catch(() => {
        if (active) setYesterdayCheckIn(null)
      })
    return () => {
      active = false
    }
  }, [timezone, reload])

  useEffect(() => {
    let active = true
    void getEmotionCheckIn(localDate)
      .then((checkIn) => {
        if (!active) return
        setPersisted(checkIn)
        setDraft(savedDraft(checkIn))
        setPhase('ready')
        setMessage('Đã tải ghi nhận tự báo cáo hôm nay.')
      })
      .catch((error: unknown) => {
        if (!active) return
        setPersisted(null)
        setDraft(emptyDraft)
        if (error instanceof ApiError && error.status === 404) {
          setPhase('empty')
          setMessage('Hôm nay bạn chưa ghi nhận cảm xúc.')
          return
        }
        setPhase('error')
        setRetryKind('load')
        setMessage(messageFor(error, false))
      })
    return () => {
      active = false
    }
  }, [localDate, reload])

  useEffect(() => {
    const checkDay = () => {
      const nextDate = localDateInTimeZone(new Date(), timezone)
      if (activeDate.current === nextDate) return
      activeDate.current = nextDate
      mutation.current = null
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

  const draftChanged =
    draft.emotion !== (persisted?.emotion ?? null) ||
    draft.intensity !== (persisted?.intensity ?? null) ||
    draft.note.trim() !== (persisted?.note ?? '') ||
    draft.factors.join(',') !== (persisted?.factors ?? []).join(',')
  const isComplete = draft.emotion !== null && draft.intensity !== null
  const isSubmitting = phase === 'saving' || phase === 'deleting'
  const loadBlocked = phase === 'error' && retryKind === 'load'

  const save = async () => {
    if (!draft.emotion || !draft.intensity) return
    const value: EmotionCheckInValue = {
      emotion: draft.emotion,
      intensity: draft.intensity,
      factors: [...draft.factors],
      note: draft.note.trim() || null,
    }
    const existing = persisted
    if (
      existing &&
      existing.emotion === draft.emotion &&
      existing.intensity === draft.intensity &&
      existing.note === value.note &&
      existing.factors.join(',') === value.factors?.join(',')
    ) {
      setMessage('Ghi nhận hôm nay không có thay đổi.')
      setPhase('saved')
      return
    }
    const fingerprint = JSON.stringify({
      action: 'save',
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
      setDraft(savedDraft(saved))
      mutation.current = null
      setPhase('saved')
      setMessage(
        existing ? 'Đã cập nhật ghi nhận hôm nay.' : 'Đã lưu ghi nhận hôm nay.',
      )
      onPersisted?.()
      announceChange()
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
      } else setMessage(messageFor(error, true))
      setPhase('error')
      setRetryKind('save')
    }
  }

  const remove = async (ask = true) => {
    if (!persisted) return
    if (
      ask &&
      !(await confirm({
        title: 'Xóa ghi nhận hôm nay?',
        description:
          'Cảm xúc đã lưu sẽ bị xóa khỏi lịch sử và các thống kê liên quan.',
        confirmLabel: 'Xóa ghi nhận',
        cancelLabel: 'Giữ lại',
        tone: 'danger',
      }))
    )
      return
    const fingerprint = JSON.stringify({ action: 'delete', localDate })
    if (mutation.current?.fingerprint !== fingerprint)
      mutation.current = { fingerprint, key: commandKey() }
    const key = mutation.current.key
    setPhase('deleting')
    setMessage('Đang xóa ghi nhận…')
    try {
      await deleteEmotionCheckIn(localDate, key)
      setPersisted(null)
      setDraft(emptyDraft)
      mutation.current = null
      setPhase('empty')
      setMessage('Đã xóa ghi nhận cảm xúc hôm nay.')
      onPersisted?.()
      announceChange()
    } catch (error) {
      setPhase('error')
      if (error instanceof ApiError && error.status === 404) {
        setRetryKind('load')
        setMessage(
          'Ghi nhận không còn tồn tại. Hãy tải lại trạng thái mới nhất.',
        )
      } else {
        setRetryKind('delete')
        setMessage('Chưa thể xóa ghi nhận. Trạng thái đã lưu vẫn được giữ.')
      }
    }
  }

  const retry = () => {
    if (retryKind === 'save') void save()
    else if (retryKind === 'delete') void remove(false)
    else {
      setPhase('loading')
      setMessage('Đang tải ghi nhận hôm nay…')
      setReload((value) => value + 1)
    }
  }

  return (
    <div
      className={styles.card}
      aria-busy={phase === 'loading' || isSubmitting}
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
          <fieldset
            className={styles.emotions}
            disabled={loadBlocked || isSubmitting}
          >
            <legend className={styles.srOnly}>Cảm xúc hôm nay</legend>
            {emotionOptions.map((item) => (
              <label
                key={item.value}
                className={`${styles.emotionLabel} ${draft.emotion === item.value ? styles.selected : ''}`}
              >
                <input
                  type="radio"
                  name="emotion"
                  value={item.value}
                  checked={draft.emotion === item.value}
                  onChange={() =>
                    setDraft((current) => ({ ...current, emotion: item.value }))
                  }
                />
                <span className={styles.emotionIcon} aria-hidden="true">
                  {item.emoji}
                </span>
                <small className={styles.emotionText}>{item.label}</small>
              </label>
            ))}
          </fieldset>
          <fieldset
            className={styles.intensity}
            disabled={loadBlocked || isSubmitting}
          >
            <legend>Mức độ cảm nhận</legend>
            <p className={styles.intensityNote}>
              1 là nhẹ, 5 là mạnh — không phải điểm sức khỏe.
            </p>
            <div className={styles.intensityRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className={`${styles.intensityBtn} ${draft.intensity === value ? styles.intensitySelected : ''}`}
                >
                  <input
                    type="radio"
                    name="intensity"
                    value={value}
                    checked={draft.intensity === value}
                    onChange={() =>
                      setDraft((current) => ({ ...current, intensity: value }))
                    }
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <details className={styles.contextDisclosure}>
            <summary>Thêm bối cảnh riêng tư (không bắt buộc)</summary>
            <div className={styles.contextBody}>
              <p className={styles.contextPrivacy}>
                Chỉ lưu khi bạn chọn “Lưu ghi nhận”. Nội dung này giúp bạn xem
                lại và không tự động gửi cho AI, kế hoạch hỗ trợ hay phân tích.
              </p>
              <fieldset
                className={styles.factorFieldset}
                disabled={loadBlocked || isSubmitting}
              >
                <legend>Điều gì có thể ảnh hưởng đến cảm xúc này?</legend>
                <p className={styles.factorHint}>Có thể chọn tối đa 3 mục.</p>
                <div className={styles.factorGrid}>
                  {emotionInfluenceOptions.map((factor) => {
                    const selected = draft.factors.includes(factor.value)
                    const disabled = !selected && draft.factors.length >= 3
                    return (
                      <label
                        key={factor.value}
                        className={`${styles.factorChip} ${selected ? styles.factorSelected : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              factors: selected
                                ? current.factors.filter(
                                    (value) => value !== factor.value,
                                  )
                                : emotionInfluenceOptions
                                    .filter(
                                      ({ value }) =>
                                        current.factors.includes(value) ||
                                        value === factor.value,
                                    )
                                    .map(({ value }) => value),
                            }))
                          }
                        />
                        <span>{factor.label}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <label className={styles.noteField}>
                <span>Ghi chú riêng (không bắt buộc)</span>
                <textarea
                  aria-label="Ghi chú riêng (không bắt buộc)"
                  value={draft.note}
                  maxLength={500}
                  rows={3}
                  disabled={loadBlocked || isSubmitting}
                  placeholder="Bạn có thể để trống"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
                <small>{draft.note.length}/500</small>
              </label>
            </div>
          </details>
          {draftChanged && isComplete ? (
            <p className={styles.unsaved} role="status">
              Lựa chọn này chưa được lưu.
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={!isComplete || isSubmitting || loadBlocked}
            >
              {phase === 'saving'
                ? 'Đang lưu…'
                : persisted
                  ? 'Cập nhật ghi nhận'
                  : 'Lưu ghi nhận'}
            </button>
            {persisted ? (
              <button
                type="button"
                className={styles.deleteBtn}
                disabled={isSubmitting}
                onClick={() => void remove()}
              >
                {phase === 'deleting' ? 'Đang xóa…' : 'Xóa ghi nhận'}
              </button>
            ) : null}
            <Link href="/journal" className={styles.journalLink}>
              Viết thêm →
            </Link>
          </div>
        </form>
      )}

      {phase !== 'loading' ? (
        <>
          <div className={styles.divider} aria-hidden="true" />
          <div
            className={`${styles.feedback} ${phase === 'error' ? styles.error : ''}`}
            role={phase === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <span>{message}</span>
            {phase === 'error' ? (
              <button type="button" className={styles.retryBtn} onClick={retry}>
                Thử lại
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className={styles.comparisonSection}>
        <h3 className={styles.comparisonTitle}>Hôm qua và hôm nay</h3>
        <div className={styles.comparisonBoxes}>
          <div className={styles.boxYesterday}>
            <span className={styles.boxDate}>Hôm qua</span>
            {yesterdayCheckIn ? (
              <>
                <span className={styles.boxMood}>
                  <span aria-hidden="true">
                    {emotionPresentation[yesterdayCheckIn.emotion].emoji}
                  </span>
                  <strong>
                    {emotionPresentation[yesterdayCheckIn.emotion].label}
                  </strong>
                </span>
                <span className={styles.boxIntensity}>
                  Mức cảm nhận {yesterdayCheckIn.intensity}/5
                </span>
              </>
            ) : (
              <span className={styles.boxEmptyText}>Chưa có ghi nhận</span>
            )}
          </div>
          <span className={styles.boxArrow} aria-hidden="true">
            →
          </span>
          <div className={styles.boxToday}>
            <span className={styles.boxTodayDate}>Hôm nay · đã lưu</span>
            {persisted ? (
              <>
                <span className={styles.boxTodayMood}>
                  <span aria-hidden="true">
                    {emotionPresentation[persisted.emotion].emoji}
                  </span>
                  <strong>
                    {emotionPresentation[persisted.emotion].label}
                  </strong>
                </span>
                <span className={styles.boxTodayIntensity}>
                  Mức cảm nhận {persisted.intensity}/5
                </span>
              </>
            ) : (
              <span className={styles.boxEmptyText}>Chưa có ghi nhận</span>
            )}
          </div>
        </div>
      </div>
      <p className={styles.disclaimer}>
        Đây là ghi nhận do bạn tự chọn, không phải chẩn đoán hay đánh giá an
        toàn.
      </p>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MoodFace } from './MoodFace'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import { MamCardButton } from '@/features/mam/MamCardButton'
import { useMamDockSlotted } from '@/features/mam/MamDockSlot'
import { useMamSuppress } from '@/features/mam/mam-suppression'
import { useMamTarget } from '@/features/mam/use-mam-target'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
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
  updateEmotionCheckIn,
} from './api/browser-emotion-check-in'
import styles from './DailyEmotionCheckIn.module.css'
import {
  emotionPlanHref,
  type ResolvedEmotionPlanOrigin,
} from '@/features/support-plan/emotion-plan-origin'

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
  creationTimezone,
  planOrigin,
}: Readonly<{
  onPersisted?: () => void
  creationTimezone?: string
  planOrigin?: ResolvedEmotionPlanOrigin
}>) {
  const { confirm } = useFeedback()
  const reducedMotion = useReducedMotion()
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const timezone = creationTimezone ?? browserTimezone
  const planHeading = useRef<HTMLParagraphElement>(null)
  const [localDate, setLocalDate] = useState(() =>
    localDateInTimeZone(new Date(), timezone),
  )
  const [persisted, setPersisted] = useState<EmotionCheckIn | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [phase, setPhase] = useState<Phase>('loading')
  const [retryKind, setRetryKind] = useState<RetryKind>('load')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const [focusInForm, setFocusInForm] = useState(false)
  const activeDate = useRef(localDate)
  const mounted = useRef(true)
  const mutation = useRef<{ fingerprint: string; key: string } | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const checkDay = useCallback(() => {
    const nextDate = localDateInTimeZone(new Date(), timezone)
    if (activeDate.current === nextDate) return false
    activeDate.current = nextDate
    mutation.current = null
    setPhase('loading')
    setMessage('Đang tải ghi nhận hôm nay…')
    setLocalDate(nextDate)
    return true
  }, [timezone])

  useEffect(() => {
    if (!planOrigin) return
    planHeading.current?.focus({ preventScroll: true })
    document
      .getElementById('emotion-check-in')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [planOrigin])

  useEffect(() => {
    let active = true
    void getEmotionCheckIn(localDate)
      .then((checkIn) => {
        if (!active || activeDate.current !== localDate) return
        setPersisted(checkIn)
        setDraft(savedDraft(checkIn))
        setPhase('ready')
        setMessage('Đã tải ghi nhận tự báo cáo hôm nay.')
      })
      .catch((error: unknown) => {
        if (!active || activeDate.current !== localDate) return
        setPersisted(null)
        setDraft(emptyDraft)
        if (error instanceof ApiError && error.status === 404) {
          setPhase('empty')
          setMessage('')
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
    const interval = window.setInterval(checkDay, 60_000)
    window.addEventListener('focus', checkDay)
    document.addEventListener('visibilitychange', checkDay)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkDay)
      document.removeEventListener('visibilitychange', checkDay)
    }
  }, [checkDay])

  const draftChanged =
    draft.emotion !== (persisted?.emotion ?? null) ||
    draft.intensity !== (persisted?.intensity ?? null) ||
    draft.note.trim() !== (persisted?.note ?? '') ||
    draft.factors.join(',') !== (persisted?.factors ?? []).join(',')
  useUnsavedChangesGuard(
    Boolean(planOrigin && draftChanged),
    'Lựa chọn cảm xúc chưa được xác nhận lưu. Nếu rời trang, hãy kiểm tra lại ghi nhận khi quay lại; kế hoạch không tự thay đổi.',
  )
  const isComplete = draft.emotion !== null && draft.intensity !== null
  const isSubmitting = phase === 'saving' || phase === 'deleting'
  const originDayChanged = Boolean(
    planOrigin && localDate !== planOrigin.localDate,
  )
  const loadBlocked =
    (phase === 'error' && retryKind === 'load') || originDayChanged
  const showsForm = phase !== 'loading' && !(phase === 'saved' && persisted)
  // An unmounted form fires no blur, so focus cannot outlive it.
  if (focusInForm && !showsForm) setFocusInForm(false)
  // Emotion entry is a no-interrupt zone (ADR): a draft or focus in the form
  // stills Mầm; the record itself never leaves this component.
  useMamSuppress(draftChanged || focusInForm)
  // One explicit Mầm entry, only for a clean saved record and with the flag on
  // (the dock slot mounts only then). Nothing from the check-in is passed on.
  const mamSlotted = useMamDockSlotted()
  const mamEligible =
    mamSlotted &&
    persisted !== null &&
    (phase === 'ready' || phase === 'saved') &&
    !draftChanged &&
    !focusInForm &&
    !planOrigin
  const mamTarget = useMamTarget(mamEligible ? { kind: 'home.emotion' } : null)

  const save = async () => {
    if (checkDay()) return
    if (!draft.emotion || !draft.intensity || loadBlocked || isSubmitting)
      return
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
      if (!mounted.current || activeDate.current !== localDate) return
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
      if (!mounted.current || activeDate.current !== localDate) return
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        try {
          const latest = await getEmotionCheckIn(localDate)
          if (!mounted.current || activeDate.current !== localDate) return
          setPersisted(latest)
          setMessage(
            'Ghi nhận đã thay đổi ở nơi khác. Bản mới nhất đã được tải; lựa chọn của bạn chưa được lưu.',
          )
        } catch {
          if (!mounted.current || activeDate.current !== localDate) return
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
    if (checkDay() || !persisted || loadBlocked || isSubmitting) return
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
    if (!mounted.current || activeDate.current !== localDate || checkDay())
      return
    const fingerprint = JSON.stringify({ action: 'delete', localDate })
    if (mutation.current?.fingerprint !== fingerprint)
      mutation.current = { fingerprint, key: commandKey() }
    const key = mutation.current.key
    setPhase('deleting')
    setMessage('Đang xóa ghi nhận…')
    try {
      await deleteEmotionCheckIn(localDate, key)
      if (!mounted.current || activeDate.current !== localDate) return
      setPersisted(null)
      setDraft(emptyDraft)
      mutation.current = null
      setPhase('empty')
      setMessage('Đã xóa ghi nhận cảm xúc hôm nay.')
      onPersisted?.()
      announceChange()
    } catch (error) {
      if (!mounted.current || activeDate.current !== localDate) return
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
    <motion.div
      id="emotion-check-in"
      ref={mamTarget}
      // The header keeps the button's room while editing, so the title never reflows.
      className={`${styles.card} ${mamSlotted && persisted && !planOrigin ? styles.mamCard : ''}`}
      aria-busy={phase === 'loading' || isSubmitting}
      layout={!reducedMotion}
      initial={false}
      transition={{ layout: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
    >
      {mamSlotted && persisted && !planOrigin && (
        // Stays mounted so the button fades instead of popping; `visibility`
        // takes it out of focus and the a11y tree while not eligible.
        <div
          className={styles.mamSlot}
          data-off={!mamEligible || undefined}
          inert={!mamEligible}
          aria-hidden={!mamEligible || undefined}
        >
          <MamCardButton label="Mầm giải thích: Cảm xúc hôm nay" />
        </div>
      )}
      {planOrigin && (
        <aside
          className={styles.planContext}
          aria-label="Hoạt động từ kế hoạch hỗ trợ"
        >
          <p ref={planHeading} tabIndex={-1}>
            <strong>{planOrigin.title}</strong> · {planOrigin.localDate}
          </p>
          <p>
            Lưu cảm xúc không tự đánh dấu hoàn thành kế hoạch. Quay lại đúng
            hoạt động và chọn “Kiểm tra ghi nhận”.
          </p>
          {originDayChanged && (
            <p role="alert">
              Ngày đã thay đổi. Hãy quay lại kế hoạch để mở hoạt động của hôm
              nay; ghi nhận mới không thay cho hoạt động của ngày trước.
            </p>
          )}
          {persisted &&
            (persisted.timezone !== timezone ||
              Date.parse(persisted.createdAt) <
                Date.parse(planOrigin.activatedAt)) && (
              <p>
                Ghi nhận đã có dùng múi giờ khác hoặc được tạo trước khi hoạt
                động bắt đầu, nên có thể không được tính cho lần thực hiện này.
                Nội dung đã lưu vẫn được giữ nguyên.
              </p>
            )}
          <Link
            className={styles.planReturn}
            href={emotionPlanHref(planOrigin, '/support-plan')}
          >
            Quay lại hoạt động trong kế hoạch
          </Link>
        </aside>
      )}
      {phase !== 'saved' && (
        <header className={styles.header}>
          <h2 className={styles.title}>Cảm xúc hôm nay</h2>
          <p className={styles.subtitle}>
            Chọn cảm xúc gần nhất với bạn lúc này
          </p>
        </header>
      )}

      {phase === 'loading' ? (
        <div
          className={`${styles.form} ${styles.loadingForm}`}
          role="status"
          aria-label="Đang tải ghi nhận hôm nay"
        >
          <span className={styles.srOnly}>Đang tải ghi nhận hôm nay…</span>
          <div className={styles.emotions} aria-hidden="true">
            {emotionOptions.map((item) => (
              <div key={item.value} className={styles.emotionLabel}>
                <div className={styles.loadingFace} />
                <small className={styles.emotionText}>{item.label}</small>
              </div>
            ))}
          </div>
          <div className={styles.actions} aria-hidden="true">
            <div className={`${styles.saveBtn} ${styles.loadingButton}`}>
              <span>Lưu ghi nhận</span>
            </div>
            <p className={styles.idleHint}>
              Chọn xong sẽ hiện mức độ và ghi chú riêng.
            </p>
          </div>
        </div>
      ) : phase === 'saved' && persisted ? (
        <div className={styles.saved} data-testid="emotion-saved">
          <div className={styles.savedTick}>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--teal-deep)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path className={styles.tick} d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <h2 className={styles.savedTitle}>
            Đã ghi nhận: {emotionPresentation[persisted.emotion].label}
          </h2>
          <p>Cảm ơn bạn đã dành chút thời gian cho mình.</p>
          <Link href="/journal" className={styles.journalLink}>
            Viết thêm vào nhật ký →
          </Link>
          <button
            className={styles.editBtn}
            type="button"
            onClick={() => setPhase('ready')}
          >
            Chỉnh sửa ghi nhận
          </button>
        </div>
      ) : (
        <form
          className={styles.form}
          onFocus={() => setFocusInForm(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocusInForm(false)
          }}
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
                className={`${styles.emotionLabel} ${draft.emotion === item.value ? styles.selected : draft.emotion ? styles.dimmed : ''}`}
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
                  <MoodFace emotion={item.value} />
                </span>
                <small className={styles.emotionText}>{item.label}</small>
              </label>
            ))}
          </fieldset>
          <AnimatePresence initial={false}>
            {draft.emotion ? (
              <motion.div
                key="emotion-context"
                className={styles.revealed}
                initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reducedMotion ? 0.16 : 0.22,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
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
                            setDraft((current) => ({
                              ...current,
                              intensity: value,
                            }))
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
                      Chỉ lưu khi bạn chọn “Lưu ghi nhận”. Nội dung này giúp bạn
                      xem lại và không tự động gửi cho AI, kế hoạch hỗ trợ hay
                      phân tích.
                    </p>
                    <fieldset
                      className={styles.factorFieldset}
                      disabled={loadBlocked || isSubmitting}
                    >
                      <legend>Điều gì có thể ảnh hưởng đến cảm xúc này?</legend>
                      <p className={styles.factorHint}>
                        Có thể chọn tối đa 3 mục.
                      </p>
                      <div className={styles.factorGrid}>
                        {emotionInfluenceOptions.map((factor) => {
                          const selected = draft.factors.includes(factor.value)
                          const disabled =
                            !selected && draft.factors.length >= 3
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
              </motion.div>
            ) : null}
          </AnimatePresence>
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
                disabled={isSubmitting || loadBlocked}
                onClick={() => void remove()}
              >
                {phase === 'deleting' ? 'Đang xóa…' : 'Xóa ghi nhận'}
              </button>
            ) : null}
            {!draft.emotion && (
              <p className={styles.idleHint}>
                Chọn xong sẽ hiện mức độ và ghi chú riêng.
              </p>
            )}
          </div>
        </form>
      )}

      {phase !== 'loading' && message ? (
        <>
          <div
            className={`${styles.feedback} ${phase === 'error' ? styles.error : ''}`}
            role={phase === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            aria-atomic="true"
          >
            {phase === 'saved' && persisted && (
              <span className={styles.srOnly}>
                Đã ghi nhận: {emotionPresentation[persisted.emotion].label}
                .{' '}
              </span>
            )}
            <span>{message}</span>
            {phase === 'error' ? (
              <button type="button" className={styles.retryBtn} onClick={retry}>
                Thử lại
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <p className={styles.disclaimer}>
        Đây là ghi nhận do bạn tự chọn, không phải chẩn đoán hay đánh giá an
        toàn.
      </p>
    </motion.div>
  )
}

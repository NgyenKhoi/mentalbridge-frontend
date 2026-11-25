'use client'

import { ClipboardPlus } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import type {
  AgreedNextStepState,
  SessionSummary,
} from '@/lib/consultation/session-summary-validation'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import styles from './EarlierSessionSummaries.module.css'

const STATE_LABELS: Record<AgreedNextStepState, string> = {
  PENDING: 'Chưa thực hiện',
  COMPLETED: 'Đã hoàn thành',
  SKIPPED: 'Bỏ qua',
}

type Item = { appointment: Appointment; summary: SessionSummary }

const sessionDate = (appointment: Appointment) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: appointment.timezone || 'Asia/Ho_Chi_Minh',
  }).format(new Date(appointment.scheduledStartAt))

/** What "Đưa vào tóm tắt" adds to the brief: only text the specialist published for the user. */
export function earlierSummaryText({ appointment, summary }: Item) {
  const steps = summary.agreedNextSteps.filter((step) => !step.hidden)
  const lines = [
    `Từ buổi ${sessionDate(appointment)} với ${appointment.specialistDisplayName}:`,
    ...(summary.specialistNoteForUser ? [summary.specialistNoteForUser] : []),
    ...steps.map(
      (step) =>
        `- ${step.title}${step.state ? ` (${STATE_LABELS[step.state].toLowerCase()})` : ''}`,
    ),
  ]
  return lines.join('\n')
}

/**
 * The user's own published summaries from their latest earlier sessions, so the prep can build on them.
 * Reuse consent stays per summary, exactly as in SessionSummaryPanel.
 */
export function EarlierSessionSummaries({
  appointments,
  disabled,
  onUse,
}: Readonly<{
  appointments: readonly Appointment[]
  disabled: boolean
  onUse: (text: string) => void
}>) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState<string | null>(null)
  const [consentError, setConsentError] = useState('')
  const headingId = useId()
  const ids = appointments.map((appointment) => appointment.id).join(',')

  useEffect(() => {
    let active = true
    if (!ids) return
    void Promise.all(
      appointments.map(async (appointment) => {
        const list = await sessionSummaryBrowserClient.list(
          appointment.id,
          'USER',
        )
        const summary = list.items[0]
        return summary ? { appointment, summary } : null
      }),
    )
      .then((loaded) => {
        if (!active) return
        setFailed(false)
        setItems(loaded.filter((item): item is Item => item !== null))
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
    // appointments is re-derived on every parent render; ids carries its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, attempt])

  if (!ids) return null

  async function updateConsent(item: Item, approved: boolean) {
    setPending(item.summary.id)
    setConsentError('')
    try {
      const updated = await sessionSummaryBrowserClient.updateConsent(
        item.summary.id,
        approved,
        item.summary.reuseConsent?.version ?? 0,
      )
      setItems((current) =>
        (current ?? []).map((entry) =>
          entry.summary.id === updated.id
            ? { ...entry, summary: updated }
            : entry,
        ),
      )
    } catch {
      setConsentError('Chưa lưu được lựa chọn chia sẻ. Bạn thử lại nhé.')
    } finally {
      setPending(null)
    }
  }

  if (failed)
    return (
      <div className={styles.region}>
        <p className={styles.state} role="alert">
          Chưa tải được tóm tắt các buổi trước.
        </p>
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            setFailed(false)
            setItems(null)
            setAttempt((value) => value + 1)
          }}
        >
          Thử lại
        </button>
      </div>
    )

  if (items === null)
    return (
      <p className={styles.state} role="status" aria-busy="true">
        Đang tải tóm tắt các buổi trước…
      </p>
    )

  if (items.length === 0) return null

  return (
    <section className={styles.region} aria-labelledby={headingId}>
      <h5 id={headingId}>Từ các buổi trước</h5>
      <ul className={styles.list}>
        {items.map((item) => {
          const steps = item.summary.agreedNextSteps.filter(
            (step) => !step.hidden,
          )
          const note =
            item.summary.specialistNoteForUser || item.summary.progressSummary
          const approved = item.summary.reuseConsent?.approved ?? false
          return (
            <li key={item.summary.id} className={styles.item}>
              <div className={styles.itemHead}>
                <strong>{sessionDate(item.appointment)}</strong>
                <span>{item.appointment.specialistDisplayName}</span>
              </div>
              {note && <p className={styles.note}>{note}</p>}
              {steps.length > 0 && (
                <ul className={styles.steps}>
                  {steps.map((step) => (
                    <li key={step.id}>
                      <span>{step.title}</span>
                      {step.state && (
                        <small data-state={step.state}>
                          {STATE_LABELS[step.state]}
                        </small>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.itemActions}>
                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    checked={approved}
                    disabled={pending === item.summary.id}
                    onChange={(event) =>
                      void updateConsent(item, event.target.checked)
                    }
                  />
                  <span>Cho chuyên gia buổi sau xem lại</span>
                </label>
                <button
                  type="button"
                  className={styles.use}
                  disabled={disabled}
                  onClick={() => onUse(earlierSummaryText(item))}
                >
                  <ClipboardPlus size={15} aria-hidden="true" />
                  Đưa vào tóm tắt
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {consentError && (
        <p className={styles.state} role="alert">
          {consentError}
        </p>
      )}
    </section>
  )
}

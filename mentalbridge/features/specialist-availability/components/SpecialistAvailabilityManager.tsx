'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AvailabilityBrowserError,
  browserAvailability,
} from '../api/browser-client'
import type {
  AvailabilityModality,
  AvailabilitySlot,
} from '@/lib/consultation/consultation-validation'
import styles from './SpecialistAvailabilityManager.module.css'

type FormState = Readonly<{
  date: string
  startTime: string
  timezone: string
  modality: AvailabilityModality
}>

const READINESS_LABELS = {
  AVAILABLE: 'Có thể đặt',
  STARTED: 'Đã bắt đầu',
  WITHDRAWN: 'Đã rút',
  VIDEO_DISABLED: 'Video đang tắt',
} as const

function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function partsAt(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function localSlotToUtc(date: string, time: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !timeMatch) throw new Error('Ngày hoặc giờ không hợp lệ.')
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  )
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = partsAt(new Date(candidate), timezone)
    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    candidate += desired - represented
  }
  const verified = partsAt(new Date(candidate), timezone)
  if (
    verified.year !== match[1] ||
    verified.month !== match[2] ||
    verified.day !== match[3] ||
    verified.hour !== timeMatch[1] ||
    verified.minute !== timeMatch[2]
  ) {
    throw new Error('Giờ đã chọn không tồn tại trong múi giờ này.')
  }
  const startAt = new Date(candidate)
  return {
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
  }
}

function displaySlot(slot: AvailabilitySlot) {
  const format = new Intl.DateTimeFormat('vi-VN', {
    timeZone: slot.timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: slot.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${format.format(new Date(slot.startAt))}–${end.format(new Date(slot.endAt))}`
}

function friendlyError(error: unknown) {
  if (error instanceof AvailabilityBrowserError) {
    if (error.status === 409 || error.status === 412)
      return 'Khung giờ đã thay đổi. Danh sách mới nhất đã được tải lại.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.'
}

export default function SpecialistAvailabilityManager() {
  const [form, setForm] = useState<FormState>({
    date: '',
    startTime: '',
    timezone: defaultTimezone(),
    modality: 'IN_APP_CHAT',
  })
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const idempotencyKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await browserAvailability.list()
      setSlots(data.items)
      setVideoEnabled(data.videoPublishingEnabled)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    browserAvailability
      .list()
      .then(({ data }) => {
        setSlots(data.items)
        setVideoEnabled(data.videoPublishingEnabled)
      })
      .catch((caught: unknown) => setError(friendlyError(caught)))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(
    () => ({
      available: slots.filter((slot) => slot.readiness === 'AVAILABLE').length,
      withdrawn: slots.filter((slot) => slot.status === 'WITHDRAWN').length,
    }),
    [slots],
  )

  const updateForm = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    idempotencyKey.current = null
    setForm((current) => ({ ...current, [key]: value }))
  }

  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const range = localSlotToUtc(form.date, form.startTime, form.timezone)
      const key = idempotencyKey.current ?? crypto.randomUUID()
      idempotencyKey.current = key
      const { data } = await browserAvailability.publish(
        { ...range, timezone: form.timezone, modality: form.modality },
        key,
      )
      setSlots((current) => [
        data,
        ...current.filter((slot) => slot.id !== data.id),
      ])
      idempotencyKey.current = null
      setForm((current) => ({ ...current, date: '', startTime: '' }))
      setNotice('Đã xuất bản khung giờ tư vấn trực tuyến 60 phút.')
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setSaving(false)
    }
  }

  const withdraw = async (slot: AvailabilitySlot) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data } = await browserAvailability.withdraw(slot.id, slot.version)
      setSlots((current) =>
        current.map((item) => (item.id === data.id ? data : item)),
      )
      setNotice('Đã rút khung giờ khỏi lịch khả dụng.')
    } catch (caught) {
      setError(friendlyError(caught))
      if (
        caught instanceof AvailabilityBrowserError &&
        (caught.status === 409 || caught.status === 412)
      )
        await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.manager} aria-labelledby="availability-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Không gian chuyên gia</span>
          <h1 id="availability-title">Lịch khả dụng trực tuyến</h1>
          <p>Xuất bản từng khung 60 phút cho chat hoặc video trong ứng dụng.</p>
        </div>
        <div className={styles.summary} aria-label="Tổng quan lịch khả dụng">
          <span>
            <strong>{counts.available}</strong> có thể đặt
          </span>
          <span>
            <strong>{counts.withdrawn}</strong> đã rút
          </span>
        </div>
      </header>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={publish}>
          <h2>Thêm khung giờ</h2>
          <label>
            Ngày
            <input
              type="date"
              min={today()}
              required
              value={form.date}
              onChange={(event) => updateForm('date', event.target.value)}
            />
          </label>
          <label>
            Giờ bắt đầu
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(event) => updateForm('startTime', event.target.value)}
            />
          </label>
          <label>
            Múi giờ hiển thị
            <input
              required
              maxLength={64}
              value={form.timezone}
              onChange={(event) => updateForm('timezone', event.target.value)}
              aria-describedby="timezone-help"
            />
          </label>
          <small id="timezone-help">Tên IANA, ví dụ Asia/Ho_Chi_Minh.</small>
          <fieldset>
            <legend>Hình thức</legend>
            <label className={styles.radio}>
              <input
                type="radio"
                name="modality"
                checked={form.modality === 'IN_APP_CHAT'}
                onChange={() => updateForm('modality', 'IN_APP_CHAT')}
              />
              Chat trong ứng dụng
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="modality"
                checked={form.modality === 'IN_APP_VIDEO'}
                disabled={!videoEnabled}
                onChange={() => updateForm('modality', 'IN_APP_VIDEO')}
              />
              Video trong ứng dụng
            </label>
          </fieldset>
          {!videoEnabled && (
            <p className={styles.info} role="note">
              Video chưa sẵn sàng. Bạn vẫn có thể xuất bản lịch chat.
            </p>
          )}
          <p className={styles.duration}>
            <strong>Thời lượng:</strong> 60 phút
          </p>
          <button type="submit" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Xuất bản khung giờ'}
          </button>
        </form>

        <div className={styles.list}>
          <div className={styles.listHeading}>
            <h2>Khung giờ đã lưu</h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              Tải lại
            </button>
          </div>
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
          </div>
          {loading ? (
            <p className={styles.state}>Đang tải lịch khả dụng…</p>
          ) : slots.length === 0 ? (
            <p className={styles.state}>Chưa có khung giờ nào được xuất bản.</p>
          ) : (
            <ul className={styles.slots}>
              {slots.map((slot) => (
                <li key={slot.id} className={styles.slot}>
                  <div>
                    <strong>{displaySlot(slot)}</strong>
                    <span>
                      {slot.modality === 'IN_APP_CHAT'
                        ? 'Chat trong ứng dụng'
                        : 'Video trong ứng dụng'}
                      {' · '}
                      {slot.timezone}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <span data-readiness={slot.readiness}>
                      {READINESS_LABELS[slot.readiness]}
                    </span>
                    {slot.status === 'ACTIVE' &&
                      slot.readiness !== 'STARTED' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void withdraw(slot)}
                        >
                          Rút khung giờ
                        </button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

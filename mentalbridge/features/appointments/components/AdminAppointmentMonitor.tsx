'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type {
  AdminAppointmentItem,
  AppointmentModality,
  AppointmentStatus,
} from '@/lib/consultation/consultation-validation'
import {
  browserAdminAppointments,
  type AdminAppointmentSearch,
} from '../api/browser-admin-appointments'
import styles from './AdminAppointmentMonitor.module.css'

const statuses: AppointmentStatus[] = [
  'REQUESTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'SESSION_ENDED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function initialRange() {
  const now = Date.now()
  return {
    from: localDateTime(new Date(now - 30 * 24 * 60 * 60 * 1000)),
    to: localDateTime(new Date(now + 30 * 24 * 60 * 60 * 1000)),
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Bạn không có quyền xem vận hành lịch hẹn.'
    if (error.status === 400)
      return 'Bộ lọc không hợp lệ. Khoảng thời gian tối đa là 180 ngày.'
  }
  return 'Nguồn Consultation đang không khả dụng. Không có dữ liệu cũ nào được hiển thị.'
}

function optionalTime(value: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function AdminAppointmentMonitor() {
  const initialized = useRef(false)
  const range = initialRange()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [status, setStatus] = useState('')
  const [modality, setModality] = useState('')
  const [userAccountId, setUserAccountId] = useState('')
  const [specialistAccountId, setSpecialistAccountId] = useState('')
  const [items, setItems] = useState<AdminAppointmentItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>()
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [dataState, setDataState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const query = useCallback(
    (cursor?: string): AdminAppointmentSearch => ({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      ...(status ? { status: status as AppointmentStatus } : {}),
      ...(modality ? { modality: modality as AppointmentModality } : {}),
      ...(userAccountId.trim() ? { userAccountId: userAccountId.trim() } : {}),
      ...(specialistAccountId.trim()
        ? { specialistAccountId: specialistAccountId.trim() }
        : {}),
      ...(cursor ? { cursor } : {}),
      limit: 20,
    }),
    [from, modality, specialistAccountId, status, to, userAccountId],
  )

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError('')
      try {
        const page = await browserAdminAppointments.search(query(cursor))
        setItems(page.items)
        setNextCursor(page.nextCursor)
        setGeneratedAt(page.generatedAt)
        setDataState(page.dataState)
        setCurrentCursor(cursor)
      } catch (cause) {
        setItems([])
        setNextCursor(null)
        setGeneratedAt(null)
        setDataState(null)
        setError(errorMessage(cause))
      } finally {
        setLoading(false)
      }
    },
    [query],
  )

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void load()
  }, [load])

  function submit(event: FormEvent) {
    event.preventDefault()
    setCursorHistory([])
    void load()
  }

  function nextPage() {
    if (!nextCursor) return
    setCursorHistory((history) => [...history, currentCursor ?? ''])
    void load(nextCursor)
  }

  function previousPage() {
    const previous = cursorHistory.at(-1)
    if (previous === undefined) return
    setCursorHistory((history) => history.slice(0, -1))
    void load(previous || undefined)
  }

  return (
    <section className={styles.workspace}>
      <header>
        <span>VẬN HÀNH LỊCH HẸN</span>
        <h1>Giám sát vòng đời lịch hẹn</h1>
        <p>
          Dữ liệu chỉ đọc từ Consultation, giới hạn theo khoảng thời gian và
          không bao gồm brief, tổng kết, tin nhắn, nhật ký hay câu trả lời đánh
          giá.
        </p>
      </header>

      <form className={styles.filters} onSubmit={submit}>
        <label>
          Từ
          <input
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
          />
        </label>
        <label>
          Đến
          <input
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
        </label>
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả</option>
            {statuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Hình thức
          <select
            value={modality}
            onChange={(event) => setModality(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="IN_APP_CHAT">Chat trong ứng dụng</option>
            <option value="IN_APP_VIDEO">Video trong ứng dụng</option>
          </select>
        </label>
        <label>
          User ID
          <input
            value={userAccountId}
            onChange={(event) => setUserAccountId(event.target.value)}
            placeholder="UUID chính xác"
          />
        </label>
        <label>
          Specialist ID
          <input
            value={specialistAccountId}
            onChange={(event) => setSpecialistAccountId(event.target.value)}
            placeholder="UUID chính xác"
          />
        </label>
        <button type="submit" disabled={loading}>
          Áp dụng bộ lọc
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.freshness}>
        <strong>Nguồn: Consultation · {dataState ?? 'UNAVAILABLE'}</strong>
        <span>
          {generatedAt
            ? `Cập nhật ${new Date(generatedAt).toLocaleString('vi-VN')}`
            : 'Trạng thái nguồn chưa xác định'}
        </span>
      </div>

      {loading ? (
        <p className={styles.state}>Đang tải dữ liệu authoritative…</p>
      ) : !error && items.length === 0 ? (
        <p className={styles.state}>Không có lịch hẹn phù hợp với bộ lọc.</p>
      ) : !error ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Lịch hẹn</th>
                <th>Phiên</th>
                <th>Vòng đời</th>
                <th>Quyết toán</th>
                <th>Lý do vận hành</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.appointmentId}>
                  <td>
                    <strong>#{item.appointmentId.slice(0, 8)}</strong>
                    <small>
                      User {item.userAccountId.slice(0, 8)} · Specialist{' '}
                      {item.specialistAccountId.slice(0, 8)}
                    </small>
                  </td>
                  <td>
                    <strong>
                      {new Date(item.scheduledStartAt).toLocaleString('vi-VN')}
                    </strong>
                    <small>
                      {item.modality} · {item.timezone}
                    </small>
                  </td>
                  <td>
                    <strong>{item.status}</strong>
                    <small>
                      Yêu cầu {optionalTime(item.requestedAt)} · quyết định{' '}
                      {optionalTime(item.decidedAt)} · kết thúc{' '}
                      {optionalTime(item.sessionEndedAt)}
                    </small>
                  </td>
                  <td>
                    <strong>{item.settlementState}</strong>
                    <small>
                      Settled {optionalTime(item.sessionSettledAt)} ·{' '}
                      {item.cancellationCreditOutcome ?? '—'}
                    </small>
                  </td>
                  <td>
                    <strong>{item.sessionOutcome ?? '—'}</strong>
                    <small>
                      {item.sessionOutcomeReasonCode ??
                        item.cancellationReasonCode ??
                        item.decisionReasonCode ??
                        'Không có mã lý do'}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={styles.pagination}>
        <button
          disabled={cursorHistory.length === 0 || loading}
          onClick={previousPage}
        >
          Trang trước
        </button>
        <button disabled={!nextCursor || loading} onClick={nextPage}>
          Trang sau
        </button>
      </div>
    </section>
  )
}

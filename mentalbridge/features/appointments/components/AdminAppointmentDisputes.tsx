'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type {
  AppointmentDispute,
  ResolveAppointmentDisputeInput,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import styles from './AdminAppointmentDisputes.module.css'

const OPEN_REASONS: Record<AppointmentDispute['reasonCode'], string> = {
  OUTCOME_INCORRECT: 'Kết quả phiên chưa đúng',
  PARTICIPATION_EVIDENCE_INCORRECT: 'Thông tin tham gia chưa đúng',
  SESSION_DELIVERY_NOT_RECOGNIZED: 'Không nhận ra phiên tư vấn',
  TECHNICAL_FAILURE: 'Sự cố kỹ thuật',
}

function format(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function outcomeCopy(item: AppointmentDispute) {
  return item.resolutionOutcome === 'RELEASE_USER_CREDIT'
    ? 'Đã trả lại lượt tư vấn'
    : 'Đã giữ nguyên kết quả phiên'
}

export default function AdminAppointmentDisputes() {
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN')
  const [items, setItems] = useState<AppointmentDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<
    Record<string, ResolveAppointmentDisputeInput>
  >({})
  const commands = useRef(new Map<string, { signature: string; key: string }>())

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await appointmentBrowserClient.disputes(status)
      setItems(result.items)
    } catch {
      setMessage('Chưa thể tải hàng đợi xem xét. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    const initialLoad = async () => {
      await Promise.resolve()
      await load()
    }
    void initialLoad()
  }, [load])

  function draft(item: AppointmentDispute): ResolveAppointmentDisputeInput {
    return (
      drafts[item.id] ?? {
        outcome: 'UPHOLD_RECORDED_OUTCOME',
        reasonCode: 'EVIDENCE_SUPPORTS_RECORDED_OUTCOME',
      }
    )
  }

  function chooseOutcome(
    item: AppointmentDispute,
    outcome: ResolveAppointmentDisputeInput['outcome'],
  ) {
    setDrafts((current) => ({
      ...current,
      [item.id]:
        outcome === 'UPHOLD_RECORDED_OUTCOME'
          ? { outcome, reasonCode: 'EVIDENCE_SUPPORTS_RECORDED_OUTCOME' }
          : { outcome, reasonCode: 'EVIDENCE_INCONCLUSIVE_RELEASED' },
    }))
    setMessage('')
  }

  async function resolve(item: AppointmentDispute) {
    const input = draft(item)
    const signature = JSON.stringify(input)
    const current = commands.current.get(item.id)
    if (!current || current.signature !== signature)
      commands.current.set(item.id, { signature, key: crypto.randomUUID() })
    setBusyId(item.id)
    setMessage('')
    try {
      await appointmentBrowserClient.resolveDispute(
        item.id,
        input,
        item.version,
        commands.current.get(item.id)!.key,
      )
      commands.current.delete(item.id)
      setItems((values) => values.filter((value) => value.id !== item.id))
      setMessage(
        'Quyết định đã được ghi nhận cùng lịch sử điều chỉnh liên quan.',
      )
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        [
          'APPOINTMENT_DISPUTE_ALREADY_RESOLVED',
          'APPOINTMENT_DISPUTE_VERSION_MISMATCH',
        ].includes(caught.code)
      )
        void load()
      setMessage(
        'Chưa thể ghi quyết định. Lựa chọn được giữ nguyên để bạn thử lại an toàn.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section
      className={styles.root}
      aria-labelledby="appointment-disputes-title"
    >
      <span className={styles.eyebrow}>Vận hành lịch tư vấn</span>
      <h1 id="appointment-disputes-title">Xem xét kết quả phiên</h1>
      <p>
        Xử lý bằng lý do và kết quả đã được duyệt. Khu vực này không dùng để ghi
        nhận nội dung sức khỏe hay đưa ra kết luận lâm sàng.
      </p>

      <div
        className={styles.toolbar}
        role="group"
        aria-label="Lọc yêu cầu xem xét"
      >
        <button
          type="button"
          aria-pressed={status === 'OPEN'}
          onClick={() => setStatus('OPEN')}
        >
          Đang chờ xử lý
        </button>
        <button
          type="button"
          aria-pressed={status === 'RESOLVED'}
          onClick={() => setStatus('RESOLVED')}
        >
          Đã xử lý
        </button>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      {loading ? (
        <p role="status">Đang tải hàng đợi…</p>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          {status === 'OPEN'
            ? 'Không có yêu cầu nào đang chờ xử lý.'
            : 'Chưa có yêu cầu đã xử lý trong danh sách này.'}
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => {
            const input = draft(item)
            return (
              <article key={item.id} className={styles.card}>
                <header>
                  <div>
                    <span>
                      {item.openedByRole === 'USER'
                        ? 'Người dùng'
                        : 'Chuyên gia'}
                    </span>
                    <h2>{OPEN_REASONS[item.reasonCode]}</h2>
                  </div>
                  <strong data-state={item.status}>
                    {item.status === 'OPEN' ? 'Đang xem xét' : 'Đã xử lý'}
                  </strong>
                </header>
                <dl>
                  <div>
                    <dt>Thời điểm gửi</dt>
                    <dd>{format(item.openedAt)}</dd>
                  </div>
                  <div>
                    <dt>Thông tin kèm theo</dt>
                    <dd>
                      {item.evidenceType
                        ? 'Có dữ liệu vận hành tối thiểu'
                        : 'Không có'}
                    </dd>
                  </div>
                </dl>

                {item.status === 'OPEN' ? (
                  <div className={styles.decision}>
                    <label>
                      Kết quả xử lý
                      <select
                        value={input.outcome}
                        disabled={busyId !== null}
                        onChange={(event) =>
                          chooseOutcome(
                            item,
                            event.target
                              .value as ResolveAppointmentDisputeInput['outcome'],
                          )
                        }
                      >
                        <option value="UPHOLD_RECORDED_OUTCOME">
                          Giữ nguyên kết quả đã ghi nhận
                        </option>
                        <option value="RELEASE_USER_CREDIT">
                          Trả lại lượt tư vấn
                        </option>
                      </select>
                    </label>
                    {input.outcome === 'RELEASE_USER_CREDIT' && (
                      <label>
                        Lý do
                        <select
                          value={input.reasonCode}
                          disabled={busyId !== null}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                outcome: 'RELEASE_USER_CREDIT',
                                reasonCode: event.target.value as
                                  | 'EVIDENCE_INCONCLUSIVE_RELEASED'
                                  | 'TECHNICAL_FAILURE_CONFIRMED',
                              },
                            }))
                          }
                        >
                          <option value="EVIDENCE_INCONCLUSIVE_RELEASED">
                            Chưa đủ căn cứ để giữ nguyên
                          </option>
                          <option value="TECHNICAL_FAILURE_CONFIRMED">
                            Đã xác nhận sự cố kỹ thuật
                          </option>
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void resolve(item)}
                    >
                      {busyId === item.id
                        ? 'Đang ghi nhận…'
                        : 'Ghi nhận quyết định'}
                    </button>
                  </div>
                ) : (
                  <p className={styles.outcome}>
                    <strong>{outcomeCopy(item)}</strong>
                    {item.resolvedAt && <span>{format(item.resolvedAt)}</span>}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

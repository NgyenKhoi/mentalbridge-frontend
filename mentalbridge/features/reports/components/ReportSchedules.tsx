'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  PlatformReportSchedule,
  PlatformReportScheduleRequest,
} from '@/features/auth/api/identity-contract'
import {
  parseReportSchedule,
  parseReportSchedules,
} from '@/lib/auth/report-schedule-validation'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import styles from './ReportSchedules.module.css'

const CADENCES = {
  DAILY: 'Hằng ngày',
  WEEKLY: 'Hằng tuần · thứ Hai',
  MONTHLY: 'Hằng tháng · ngày 1',
}
const initial: PlatformReportScheduleRequest = {
  reportType: 'ACCOUNT_ACTIVITY',
  cadence: 'WEEKLY',
  timezone: 'Asia/Ho_Chi_Minh',
  localTime: '08:00',
  periodDays: 7,
  recipientGroup: 'ADMIN',
  deliveryTarget: 'ADMIN_REPORT_HISTORY',
  enabled: true,
}

function scope(
  schedule: PlatformReportSchedule,
): PlatformReportScheduleRequest {
  return {
    reportType: schedule.reportType,
    cadence: schedule.cadence,
    timezone: schedule.timezone,
    localTime: schedule.localTime,
    periodDays: schedule.periodDays,
    recipientGroup: schedule.recipientGroup,
    deliveryTarget: schedule.deliveryTarget,
    enabled: schedule.status === 'ACTIVE',
  }
}

export function ReportSchedules({
  onNotice,
  onRefreshReports,
}: {
  onNotice: (message: string) => void
  onRefreshReports: () => void
}) {
  const [items, setItems] = useState<PlatformReportSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(initial)
  const [editing, setEditing] = useState<PlatformReportSchedule | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { confirm } = useFeedback()

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/platform-report-schedules', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error()
      const parsed = parseReportSchedules(await response.json())
      if (!parsed) throw new Error()
      setItems(parsed)
      setError(null)
      setNeedsReload(false)
      return true
    } catch {
      setError('Không thể tải lịch báo cáo. Hãy tải lại để tiếp tục.')
      setNeedsReload(true)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function mutate(
    method: 'POST' | 'PUT' | 'DELETE',
    body?: PlatformReportScheduleRequest,
    selected?: PlatformReportSchedule,
  ) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const suffix = selected
        ? `/${selected.scheduleId}?expectedVersion=${selected.version}`
        : ''
      const response = await fetch(
        `/api/admin/platform-report-schedules${suffix}`,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      )
      if (response.status === 412) {
        await load()
        throw new Error(
          'Lịch đã thay đổi. Hãy chọn lại lịch mới nhất trước khi lưu.',
        )
      }
      if (!response.ok)
        throw new Error(
          'Không thể lưu lịch báo cáo. Hãy kiểm tra kết nối và tải lại danh sách.',
        )
      if (method === 'DELETE') {
        if (!selected) throw new Error('Không thể xác nhận lịch cần xóa.')
        setItems((current) =>
          current.filter((item) => item.scheduleId !== selected.scheduleId),
        )
      } else {
        const saved = parseReportSchedule(await response.json())
        if (!saved) {
          setNeedsReload(true)
          throw new Error(
            'Thay đổi đã được tiếp nhận nhưng chưa thể xác nhận. Hãy tải lại danh sách trước khi thao tác tiếp.',
          )
        }
        setItems((current) => {
          const remaining = current.filter(
            (item) => item.scheduleId !== saved.scheduleId,
          )
          return method === 'POST'
            ? [saved, ...remaining]
            : current.some((item) => item.scheduleId === saved.scheduleId)
              ? current.map((item) =>
                  item.scheduleId === saved.scheduleId ? saved : item,
                )
              : [saved, ...current]
        })
      }
      setEditing(null)
      setDraft(initial)
      const message =
        method === 'DELETE'
          ? 'Đã xóa lịch. Các báo cáo đã tạo vẫn được giữ lại.'
          : 'Đã lưu lịch báo cáo.'
      setNotice(message)
      onNotice(message)
      if (!(await load())) {
        setError(
          method === 'DELETE'
            ? 'Đã xóa lịch, nhưng danh sách chưa được cập nhật đầy đủ. Hãy tải lại trước khi thao tác tiếp.'
            : 'Đã lưu lịch, nhưng danh sách chưa được cập nhật đầy đủ. Hãy tải lại trước khi thao tác tiếp.',
        )
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể lưu lịch báo cáo.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: PlatformReportSchedule) {
    if (
      await confirm({
        title: 'Xóa lịch báo cáo?',
        description:
          'Lịch này sẽ ngừng tạo báo cáo mới. Các báo cáo đã tạo vẫn được giữ lại.',
        confirmLabel: 'Xóa lịch',
      })
    ) {
      await mutate('DELETE', undefined, item)
    }
  }

  return (
    <section
      className={styles.section}
      aria-labelledby="report-schedules-title"
    >
      <header className={styles.header}>
        <div>
          <h2 id="report-schedules-title">Lịch báo cáo định kỳ</h2>
          <p>
            Tự tạo báo cáo hoạt động tài khoản cho nhóm quản trị. Báo cáo xuất
            hiện trong kho bên dưới.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void load()
            onRefreshReports()
          }}
          disabled={busy}
        >
          Tải lại
        </button>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          void mutate(editing ? 'PUT' : 'POST', draft, editing ?? undefined)
        }}
        aria-label={editing ? 'Sửa lịch báo cáo' : 'Tạo lịch báo cáo'}
      >
        <label>
          Loại báo cáo
          <select defaultValue={draft.reportType} disabled={busy}>
            <option value="ACCOUNT_ACTIVITY">Hoạt động tài khoản</option>
          </select>
        </label>
        <label>
          Tần suất
          <select
            value={draft.cadence}
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                cadence: event.target
                  .value as PlatformReportScheduleRequest['cadence'],
              })
            }
          >
            {Object.entries(CADENCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Giờ tạo
          <input
            type="time"
            step={60}
            required
            value={draft.localTime.slice(0, 5)}
            disabled={busy}
            onChange={(event) =>
              setDraft({ ...draft, localTime: event.target.value })
            }
          />
        </label>
        <label>
          Múi giờ
          <input
            required
            maxLength={64}
            value={draft.timezone}
            disabled={busy}
            onChange={(event) =>
              setDraft({ ...draft, timezone: event.target.value })
            }
            aria-describedby="schedule-timezone-help"
          />
        </label>
        <label>
          Số ngày tổng hợp
          <input
            type="number"
            required
            min={1}
            max={366}
            value={draft.periodDays}
            disabled={busy}
            onChange={(event) =>
              setDraft({ ...draft, periodDays: Number(event.target.value) })
            }
          />
        </label>
        <div className={styles.actions}>
          <button
            className="btn-primary"
            disabled={
              busy || needsReload || loading || (!editing && items.length >= 50)
            }
          >
            {busy ? 'Đang lưu…' : editing ? 'Lưu lịch' : 'Tạo lịch'}
          </button>
          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null)
                setDraft(initial)
              }}
            >
              Hủy sửa
            </button>
          )}
        </div>
      </form>
      <p id="schedule-timezone-help" className={styles.help}>
        Múi giờ dạng Asia/Ho_Chi_Minh. Tổng hợp 1–366 ngày UTC đã kết thúc trước
        ngày chạy. Khi tiếp tục, lịch bắt đầu từ lần chạy sắp tới.
      </p>
      <p className={styles.help}>
        Nhóm nhận: quản trị viên · Nơi nhận: kho báo cáo quản trị.
      </p>
      {loading ? (
        <p role="status">Đang tải lịch…</p>
      ) : !items.length ? (
        <p>Chưa có lịch báo cáo. Chọn tần suất và giờ để tạo lịch đầu tiên.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.scheduleId}>
              <div>
                <strong>
                  {CADENCES[item.cadence]} · {item.localTime.slice(0, 5)}
                </strong>
                <p>
                  {item.timezone} · {item.periodDays} ngày ·{' '}
                  {item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm dừng'}
                </p>
                {item.status === 'ACTIVE' && (
                  <p>
                    Lần tới:{' '}
                    {new Intl.DateTimeFormat('vi-VN', {
                      timeZone: item.timezone,
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(item.nextRunAt))}
                  </p>
                )}
                {item.lastFailureCode && (
                  <p role="status">
                    Lịch đã dừng vì tài khoản quản trị không còn quyền truy cập.
                  </p>
                )}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={busy || needsReload}
                  onClick={() => {
                    setEditing(item)
                    setDraft(scope(item))
                    setError(null)
                  }}
                  aria-label={`Sửa lịch ${CADENCES[item.cadence]} ${item.localTime.slice(0, 5)}`}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  disabled={busy || needsReload}
                  onClick={() =>
                    void mutate(
                      'PUT',
                      { ...scope(item), enabled: item.status !== 'ACTIVE' },
                      item,
                    )
                  }
                  aria-label={`${item.status === 'ACTIVE' ? 'Tạm dừng' : 'Tiếp tục'} lịch ${CADENCES[item.cadence]} ${item.localTime.slice(0, 5)}`}
                >
                  {item.status === 'ACTIVE' ? 'Tạm dừng' : 'Tiếp tục'}
                </button>
                <button
                  type="button"
                  disabled={busy || needsReload}
                  onClick={() => void remove(item)}
                  aria-label={`Xóa lịch ${CADENCES[item.cadence]} ${item.localTime.slice(0, 5)}`}
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

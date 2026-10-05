'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type { AdministrationAuditEvent } from '@/features/auth/api/identity-contract'
import { browserAdminAudit, type AuditSearch } from '../api/browser-admin-audit'
import styles from './AdminAuditLog.module.css'

const actionLabels: Record<string, string> = {
  ACCOUNT_DISABLED: 'Tạm ngưng tài khoản',
  ACCOUNT_RESTORED: 'Khôi phục tài khoản',
  UNKNOWN_EVENT: 'Sự kiện không xác định',
}

const resultLabels = {
  SUCCEEDED: 'Thành công',
  DENIED: 'Bị từ chối',
  FAILED: 'Thất bại',
} as const

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Bạn không có quyền xem nhật ký kiểm toán.'
    if (error.status === 400) {
      return 'Bộ lọc không hợp lệ. Khoảng thời gian tối đa là 90 ngày và phải nằm trong 365 ngày gần nhất.'
    }
  }
  return 'Không thể tải nhật ký lúc này. Hãy thử lại.'
}

function inputToIso(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

function technicalIdentifier(value: string) {
  return value.startsWith('tombstone:')
    ? `Đối tượng đã xóa · ${value.slice(-12)}`
    : value
}

export default function AdminAuditLog() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actorType, setActorType] = useState('')
  const [action, setAction] = useState('')
  const [result, setResult] = useState('')
  const [targetIdentifier, setTargetIdentifier] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<AuditSearch>({})
  const [items, setItems] = useState<AdministrationAuditEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [currentCursor, setCurrentCursor] = useState<string | undefined>()
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [effectiveRange, setEffectiveRange] = useState<{
    from: string
    to: string
    retention: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (filters: AuditSearch, cursor?: string) => {
    setLoading(true)
    setError('')
    try {
      const page = await browserAdminAudit.browse({
        ...filters,
        ...(cursor ? { cursor } : {}),
        limit: 50,
      })
      setItems(page.items)
      setNextCursor(page.nextCursor ?? null)
      setCurrentCursor(cursor)
      setEffectiveRange({
        from: page.effectiveFrom,
        to: page.effectiveTo,
        retention: page.retentionCutoff,
      })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    browserAdminAudit
      .browse({ limit: 50 })
      .then((page) => {
        if (!active) return
        setItems(page.items)
        setNextCursor(page.nextCursor ?? null)
        setEffectiveRange({
          from: page.effectiveFrom,
          to: page.effectiveTo,
          retention: page.retentionCutoff,
        })
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    const filters: AuditSearch = {
      ...(inputToIso(from) ? { from: inputToIso(from) } : {}),
      ...(inputToIso(to) ? { to: inputToIso(to) } : {}),
      sourceService: 'IDENTITY',
      domain: 'ACCOUNT_ADMINISTRATION',
      ...(actorType ? { actorType: actorType as 'ADMIN' | 'SYSTEM' } : {}),
      ...(action ? { action } : {}),
      ...(result
        ? { result: result as 'SUCCEEDED' | 'DENIED' | 'FAILED' }
        : {}),
      ...(targetIdentifier.trim()
        ? { targetIdentifier: targetIdentifier.trim() }
        : {}),
    }
    setAppliedFilters(filters)
    setCursorHistory([])
    void load(filters)
  }

  function reset() {
    setFrom('')
    setTo('')
    setActorType('')
    setAction('')
    setResult('')
    setTargetIdentifier('')
    setAppliedFilters({})
    setCursorHistory([])
    void load({})
  }

  function nextPage() {
    if (!nextCursor) return
    setCursorHistory((history) => [...history, currentCursor ?? ''])
    void load(appliedFilters, nextCursor)
  }

  function previousPage() {
    const previous = cursorHistory.at(-1)
    if (previous === undefined) return
    setCursorHistory((history) => history.slice(0, -1))
    void load(appliedFilters, previous || undefined)
  }

  async function exportCsv() {
    setExporting(true)
    setError('')
    try {
      const filters = { ...appliedFilters }
      delete filters.cursor
      delete filters.limit
      await browserAdminAudit.exportCsv(filters)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span>NHẬT KÝ KIỂM TOÁN</span>
          <h1>Theo dõi hoạt động quản trị</h1>
          <p>
            Tra cứu dấu vết vận hành đã được tối thiểu hóa. Nhật ký không chứa
            nội dung nhật ký cá nhân, câu trả lời sàng lọc, tin nhắn hay thông
            tin xác thực.
          </p>
        </div>
        <button
          onClick={() => void exportCsv()}
          disabled={loading || exporting}
        >
          {exporting ? 'Đang xuất…' : 'Xuất CSV theo bộ lọc'}
        </button>
      </header>

      <form className={styles.filters} onSubmit={submit}>
        <label>
          Từ thời điểm
          <input
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Đến thời điểm
          <input
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label>
          Dịch vụ
          <select disabled value="IDENTITY">
            <option value="IDENTITY">Định danh &amp; tài khoản</option>
          </select>
        </label>
        <label>
          Phạm vi
          <select disabled value="ACCOUNT_ADMINISTRATION">
            <option value="ACCOUNT_ADMINISTRATION">Quản trị tài khoản</option>
          </select>
        </label>
        <label>
          Loại tác nhân
          <select
            value={actorType}
            onChange={(event) => setActorType(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="ADMIN">Quản trị viên</option>
            <option value="SYSTEM">Hệ thống</option>
          </select>
        </label>
        <label>
          Hành động
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="ACCOUNT_DISABLED">Tạm ngưng tài khoản</option>
            <option value="ACCOUNT_RESTORED">Khôi phục tài khoản</option>
          </select>
        </label>
        <label>
          Kết quả
          <select
            value={result}
            onChange={(event) => setResult(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="SUCCEEDED">Thành công</option>
            <option value="DENIED">Bị từ chối</option>
            <option value="FAILED">Thất bại</option>
          </select>
        </label>
        <label className={styles.target}>
          Mã đối tượng an toàn
          <input
            value={targetIdentifier}
            onChange={(event) => setTargetIdentifier(event.target.value)}
            placeholder="account:… hoặc tombstone:…"
          />
        </label>
        <div className={styles.filterActions}>
          <button type="submit" disabled={loading}>
            Áp dụng bộ lọc
          </button>
          <button type="button" onClick={reset} disabled={loading}>
            Xóa bộ lọc
          </button>
        </div>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.summary} role="status">
        <strong>
          {loading ? 'Đang tải…' : `${items.length} sự kiện trên trang này`}
        </strong>
        {effectiveRange && (
          <span>
            {new Date(effectiveRange.from).toLocaleString('vi-VN')} –{' '}
            {new Date(effectiveRange.to).toLocaleString('vi-VN')}
          </span>
        )}
      </div>

      {!loading && items.length === 0 ? (
        <div className={styles.empty}>
          <h2>Không có sự kiện phù hợp</h2>
          <p>Thử đổi khoảng thời gian hoặc xóa bớt bộ lọc.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Hành động</th>
                <th>Kết quả</th>
                <th>Tác nhân</th>
                <th>Đối tượng</th>
                <th>Correlation ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => (
                <tr key={event.eventId}>
                  <td>{new Date(event.occurredAt).toLocaleString('vi-VN')}</td>
                  <td>
                    <strong>
                      {actionLabels[event.action] ?? event.action}
                    </strong>
                    <small>Định danh &amp; tài khoản</small>
                  </td>
                  <td>
                    <span data-result={event.result}>
                      {resultLabels[event.result]}
                    </span>
                  </td>
                  <td>
                    {event.actorType === 'ADMIN' ? 'Quản trị viên' : 'Hệ thống'}
                  </td>
                  <td>
                    <code>{technicalIdentifier(event.targetIdentifier)}</code>
                  </td>
                  <td>
                    <code>{event.correlationId}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pagination}>
        <button
          disabled={loading || cursorHistory.length === 0}
          onClick={previousPage}
        >
          Trang trước
        </button>
        <button disabled={loading || !nextCursor} onClick={nextPage}>
          Trang sau
        </button>
      </div>

      {effectiveRange && (
        <p className={styles.retention}>
          Dữ liệu trước{' '}
          {new Date(effectiveRange.retention).toLocaleDateString('vi-VN')} không
          nằm trong phạm vi tra cứu. Mỗi lần tìm kiếm tối đa 90 ngày; tệp xuất
          tối đa 5.000 dòng và 5 MiB.
        </p>
      )}
    </section>
  )
}

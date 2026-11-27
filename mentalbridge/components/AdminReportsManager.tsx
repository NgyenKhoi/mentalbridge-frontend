'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  PlatformReport,
  PlatformReportRequest,
  PlatformReportType,
} from '@/features/auth/api/identity-contract'
import './admin-reports-manager.css'
import { ReportSchedules } from '@/features/reports/components/ReportSchedules'

type ReportPage = Readonly<{
  items: PlatformReport[]
  nextCursor: string | null
}>
const STATUS_LABELS: Record<PlatformReport['status'], string> = {
  QUEUED: 'Đang chờ',
  RUNNING: 'Đang tạo',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  STALE: 'Nguồn đã cũ',
}

function localDate(daysAgo: number) {
  const value = new Date()
  value.setDate(value.getDate() - daysAgo)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function readProblem(response: Response) {
  try {
    const body = (await response.json()) as { title?: unknown }
    return typeof body.title === 'string' ? body.title : null
  } catch {
    return null
  }
}

export default function AdminReportsManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  const [catalogue, setCatalogue] = useState<PlatformReportType[]>([])
  const [reports, setReports] = useState<PlatformReport[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [periodStart, setPeriodStart] = useState(() => localDate(29))
  const [periodEnd, setPeriodEnd] = useState(() => localDate(0))
  const [reportType, setReportType] = useState<
    PlatformReportRequest['reportType'] | ''
  >('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const createKey = useRef<{ fingerprint: string; key: string } | null>(null)
  const retryKeys = useRef(new Map<string, string>())

  const load = useCallback(async (cursor?: string, quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [catalogueResponse, historyResponse] = await Promise.all([
        fetch('/api/admin/platform-reports/catalogue', { cache: 'no-store' }),
        fetch(
          `/api/admin/platform-reports?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          { cache: 'no-store' },
        ),
      ])
      if (!catalogueResponse.ok || !historyResponse.ok) {
        throw new Error(
          (await readProblem(
            catalogueResponse.ok ? historyResponse : catalogueResponse,
          )) ?? 'Không thể tải kho báo cáo.',
        )
      }
      const [types, page] = (await Promise.all([
        catalogueResponse.json(),
        historyResponse.json(),
      ])) as [PlatformReportType[], ReportPage]
      setCatalogue(types)
      setReportType((current) =>
        types.some((item) => item.reportType === current)
          ? current
          : (types[0]?.reportType ?? ''),
      )
      setReports((current) =>
        cursor ? [...current, ...page.items] : page.items,
      )
      setNextCursor(page.nextCursor)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể tải kho báo cáo.',
      )
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (
      !reports.some(
        (report) => report.status === 'QUEUED' || report.status === 'RUNNING',
      )
    )
      return
    const timer = window.setInterval(() => void load(undefined, true), 3000)
    return () => window.clearInterval(timer)
  }, [load, reports])

  const visibleReports = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    if (!keyword) return reports
    return reports.filter((report) => {
      const type = catalogue.find(
        (item) => item.reportType === report.reportType,
      )
      return `${type?.label ?? report.reportType} ${report.status} ${report.periodStart} ${report.periodEnd}`
        .toLocaleLowerCase('vi')
        .includes(keyword)
    })
  }, [catalogue, query, reports])
  const selectedType = useMemo(
    () => catalogue.find((item) => item.reportType === reportType),
    [catalogue, reportType],
  )

  async function createReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reportType) return
    setSubmitting(true)
    const request = { reportType, periodStart, periodEnd }
    const fingerprint = JSON.stringify(request)
    if (createKey.current?.fingerprint !== fingerprint) {
      createKey.current = {
        fingerprint,
        key: `platform-report-${crypto.randomUUID()}`,
      }
    }
    try {
      const response = await fetch('/api/admin/platform-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': createKey.current.key,
        },
        body: fingerprint,
      })
      if (!response.ok)
        throw new Error(
          (await readProblem(response)) ?? 'Không thể tạo báo cáo.',
        )
      const report = (await response.json()) as PlatformReport
      setReports((current) => [
        report,
        ...current.filter((item) => item.reportId !== report.reportId),
      ])
      createKey.current = null
      setError(null)
      onNotice('Báo cáo đã được đưa vào hàng đợi.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể tạo báo cáo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function retry(reportId: string) {
    if (retrying.has(reportId)) return
    setRetrying((current) => new Set(current).add(reportId))
    const idempotencyKey =
      retryKeys.current.get(reportId) ??
      `platform-report-retry-${crypto.randomUUID()}`
    retryKeys.current.set(reportId, idempotencyKey)
    try {
      const response = await fetch(
        `/api/admin/platform-reports/${reportId}/retries`,
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      if (!response.ok)
        throw new Error(
          (await readProblem(response)) ?? 'Không thể thử lại báo cáo.',
        )
      const report = (await response.json()) as PlatformReport
      setReports((current) => [report, ...current])
      retryKeys.current.delete(reportId)
      onNotice('Đã tạo lượt thử lại an toàn.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể thử lại báo cáo.',
      )
    } finally {
      setRetrying((current) => {
        const next = new Set(current)
        next.delete(reportId)
        return next
      })
    }
  }

  async function download(report: PlatformReport) {
    try {
      const response = await fetch(
        `/api/admin/platform-reports/${report.reportId}/artifact`,
        { cache: 'no-store' },
      )
      if (!response.ok)
        throw new Error(
          (await readProblem(response)) ?? 'Không thể tải báo cáo.',
        )
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        report.fileName ?? `platform-report-${report.reportId}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      onNotice('Đã tải artifact báo cáo.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể tải báo cáo.',
      )
    }
  }

  return (
    <div className="admin-reports-manager">
      <div className="role-heading arm-heading">
        <div>
          <span className="eyebrow">Quản trị nền tảng</span>
          <h1>Báo cáo tổng hợp</h1>
          <p>Lên lịch, tạo và tải báo cáo tổng hợp hoạt động tài khoản.</p>
        </div>
        <span className="arm-live">
          <i />
          Chỉ dành cho quản trị viên
        </span>
      </div>

      <ReportSchedules
        onNotice={onNotice}
        onRefreshReports={() => void load()}
      />

      <section className="arm-create" aria-labelledby="create-report-title">
        <header>
          <span>TẠO BÁO CÁO</span>
          <h2 id="create-report-title">Chọn phạm vi tổng hợp</h2>
          <p>
            Tối đa {selectedType?.maximumPeriodDays ?? '…'} ngày; ngày kết thúc
            không được nằm trong tương lai.
          </p>
        </header>
        <form onSubmit={createReport}>
          <label>
            <span>Loại báo cáo</span>
            <select
              value={reportType}
              onChange={(event) =>
                setReportType(
                  event.target.value as PlatformReportRequest['reportType'],
                )
              }
              disabled={!catalogue.length}
            >
              {catalogue.map((item) => (
                <option key={item.reportType} value={item.reportType}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Từ ngày</span>
            <input
              type="date"
              value={periodStart}
              max={periodEnd}
              onChange={(event) => setPeriodStart(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Đến ngày</span>
            <input
              type="date"
              value={periodEnd}
              min={periodStart}
              max={localDate(0)}
              onChange={(event) => setPeriodEnd(event.target.value)}
              required
            />
          </label>
          <button
            className="btn-secondary"
            disabled={submitting || !catalogue.length}
          >
            {submitting ? 'Đang gửi…' : '+ Tạo báo cáo'}
          </button>
        </form>
        {selectedType && (
          <aside>
            <strong>{selectedType.label}</strong>
            <span>{selectedType.description}</span>
            <details>
              <summary>Thông tin kỹ thuật</summary>
              <code>{selectedType.scopeVersion}</code>
            </details>
          </aside>
        )}
      </section>

      <section className="arm-reports" aria-labelledby="report-history-title">
        <header>
          <div>
            <span>LỊCH SỬ BẤT BIẾN</span>
            <h2 id="report-history-title">Kho báo cáo</h2>
            <p>
              Chỉ artifact hoàn tất và còn trong thời hạn lưu mới có thể tải
              xuống.
            </p>
          </div>
          <label>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo loại, trạng thái hoặc ngày…"
            />
          </label>
        </header>
        {error && (
          <div className="arm-error" role="alert">
            <strong>Không thể hoàn tất yêu cầu</strong>
            <span>{error}</span>
            <button onClick={() => void load()}>Thử lại</button>
          </div>
        )}
        {loading && (
          <div className="arm-empty">
            <span>◌</span>
            <strong>Đang tải báo cáo…</strong>
          </div>
        )}
        {!loading && !visibleReports.length && (
          <div className="arm-empty">
            <span>▤</span>
            <strong>Chưa có báo cáo</strong>
            <small>
              Chọn loại và khoảng thời gian để tạo báo cáo đầu tiên.
            </small>
          </div>
        )}
        <div className="arm-report-list">
          {visibleReports.map((report) => {
            const type = catalogue.find(
              (item) => item.reportType === report.reportType,
            )
            const retryable =
              report.status === 'FAILED' || report.status === 'STALE'
            return (
              <article key={report.reportId}>
                <span className="arm-report-icon">▤</span>
                <div>
                  <strong>{type?.label ?? report.reportType}</strong>
                  <small>
                    {report.periodStart} → {report.periodEnd}
                  </small>
                  <em>
                    {report.reportId} · yêu cầu{' '}
                    {new Date(report.requestedAt).toLocaleString('vi-VN')}
                  </em>
                </div>
                <div className="arm-provenance">
                  <small>Phiên bản phạm vi</small>
                  <code>{report.scopeVersion}</code>
                  <small>
                    Nguồn: {Object.values(report.sourceVersions).join(', ')}
                  </small>
                </div>
                <b className={`status-${report.status.toLowerCase()}`}>
                  <i />
                  {STATUS_LABELS[report.status]}
                </b>
                <div className="arm-report-actions">
                  {report.downloadable && (
                    <button onClick={() => void download(report)}>
                      Tải xuống
                    </button>
                  )}
                  {retryable && (
                    <button
                      disabled={retrying.has(report.reportId)}
                      onClick={() => void retry(report.reportId)}
                    >
                      {retrying.has(report.reportId)
                        ? 'Đang thử lại…'
                        : 'Thử lại'}
                    </button>
                  )}
                  {!report.downloadable && !retryable && (
                    <span>
                      {report.status === 'COMPLETED'
                        ? 'Đã hết hạn'
                        : 'Chưa có artifact'}
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        {nextCursor && !query && (
          <footer>
            <button onClick={() => void load(nextCursor)}>Tải thêm</button>
          </footer>
        )}
      </section>

      <aside className="arm-privacy">
        <i>i</i>
        <p>
          <strong>Giới hạn quyền riêng tư</strong>
          <span>
            Artifact chỉ chứa số liệu tổng hợp; không có nhật ký, câu trả lời
            đánh giá, nội dung chat, ghi chú riêng hay payload AI.
          </span>
        </p>
      </aside>
    </div>
  )
}

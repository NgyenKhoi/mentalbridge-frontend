'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

import { adminPayoutsBrowserClient } from '@/features/specialist-earnings/api/browser-client'
import {
  adminFailureLines,
  adminPayoutStatusLabel,
  maskedHint,
  payoutProviderName,
  resolveSpecialistName,
  getSpecialistInitials,
} from '@/features/specialist-earnings/payout-labels'
import { ApiError } from '@/lib/api/api-error'
import type {
  AdminPayoutDestinationDetail,
  AdminPayoutDestinationList,
  AdminPayoutList,
} from '@/lib/consultation/consultation-validation'
import { Dialog } from './ui/Dialog'
import { useFeedback } from './ui/FeedbackProvider'
import { Skeleton } from './ui/Skeleton'
import AdminPayoutDetailPanel from './AdminPayoutDetailPanel'
import './admin-payouts-manager.css'

type Item = AdminPayoutList['items'][number]
type Tab = 'queue' | 'ledger' | 'history'
type CheckError = 'conflict' | 'gone' | 'failed' | null
type StatusFilter = 'ALL' | 'NEEDS_REVIEW' | Item['status']

const TABS: readonly Tab[] = ['queue', 'ledger', 'history']
const PAGE_SIZE = 6

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function date(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

const collapse = (reduced: boolean | null) => ({
  opacity: 0,
  height: 0,
  marginTop: -16,
  paddingTop: 0,
  paddingBottom: 0,
  overflow: 'hidden',
  transition: { duration: reduced ? 0 : 0.2 },
})

const groupDigits = (value: string) => value.replace(/(\d{4})(?=\d)/g, '$1 ')

function useFetch<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const run = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setData(await fetcher())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void run()
    })
    return () => {
      active = false
    }
  }, [run])

  return { data, setData, loading, failed, reload: run }
}

const fetchLedger = () => adminPayoutsBrowserClient.get()
const fetchQueue = () => adminPayoutsBrowserClient.pendingDestinations()

function exportPayouts(items: Item[]) {
  const rows = [
    [
      'Mã chi trả',
      'Chuyên gia',
      'Cổng',
      'Nơi nhận',
      'Số tiền (VND)',
      'Trạng thái',
      'Khoản thu',
      'Yêu cầu lúc (GMT+7)',
    ],
    ...items.map((item) => [
      item.payoutId,
      resolveSpecialistName(item.specialistAccountId),
      payoutProviderName[item.provider],
      maskedHint(item.destinationHint),
      String(item.amountVnd),
      adminPayoutStatusLabel(
        item.status,
        item.reconciliationStatus,
        item.closedAt,
      ),
      String(item.earningCount),
      date(item.requestedAt),
    ]),
  ]
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value)
            ? `'${value}`
            : value
          return `"${safe.replaceAll('"', '""')}"`
        })
        .join(','),
    )
    .join('\r\n')
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'bang-ke-chi-tra-chuyen-gia.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function AdminPayoutsManager({
  onNotice,
}: {
  onNotice?: (message: string) => void
}) {
  const { showActionToast, confirm } = useFeedback()
  const reduced = useReducedMotion()
  const ledger = useFetch<AdminPayoutList>(fetchLedger)
  const queue = useFetch<AdminPayoutDestinationList>(fetchQueue)
  const [chosenTab, setChosenTab] = useState<Tab | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [provider, setProvider] = useState<Item['provider'] | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [busy, setBusy] = useState<{
    id: string
    kind: 'retry' | 'close'
    sending: boolean
  } | null>(null)

  const rowRefs = useRef(new Map<string, HTMLElement>())
  const retryKeys = useRef(new Map<string, string>())
  const closeKeys = useRef(new Map<string, string>())
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    queue: null,
    ledger: null,
    history: null,
  })

  // Check dialog: the full account is held only while it is open.
  const [checkId, setCheckId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminPayoutDestinationDetail | null>(
    null,
  )
  const [detailFailed, setDetailFailed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [sending, setSending] = useState(false)
  const [checkError, setCheckError] = useState<CheckError>(null)
  const [copied, setCopied] = useState(false)
  const confirmKey = useRef('')
  const detailRequest = useRef(0)
  const sendingRef = useRef(false)
  const clearTimer = useRef<number | undefined>(undefined)

  const queueCount = queue.data?.items.length ?? 0
  const tab: Tab =
    chosenTab ??
    (!queue.loading && !queue.failed && queueCount === 0 ? 'ledger' : 'queue')

  const items = useMemo(
    () =>
      ledger.data?.items.filter(
        (item) =>
          (provider === 'ALL' || item.provider === provider) &&
          (filter === 'ALL'
            ? true
            : filter === 'NEEDS_REVIEW'
              ? item.reconciliationStatus === 'NEEDS_REVIEW'
              : item.status === filter),
      ) ?? [],
    [ledger.data, filter, provider],
  )

  const total =
    ledger.data?.items.reduce((sum, item) => sum + item.amountVnd, 0) ?? 0
  const processing =
    ledger.data?.items
      .filter((item) =>
        ['PENDING', 'PROCESSING', 'UNKNOWN'].includes(item.status),
      )
      .reduce((sum, item) => sum + item.amountVnd, 0) ?? 0
  const paid =
    ledger.data?.items
      .filter((item) => item.status === 'SUCCEEDED')
      .reduce((sum, item) => sum + item.amountVnd, 0) ?? 0

  const allItems = ledger.data?.items ?? []
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageItems = items.slice(pageStart, pageStart + PAGE_SIZE)
  const selectedPayout = pageItems.find((item) => item.payoutId === selectedId)

  const reviewCount = allItems.filter(
    (item) => item.reconciliationStatus === 'NEEDS_REVIEW' && !item.closedAt,
  ).length
  const paidCount = allItems.filter(
    (item) => item.status === 'SUCCEEDED',
  ).length

  // MoMo & PayOS specific metric breakdowns
  const momoItems = allItems.filter((item) => item.provider === 'MOMO')
  const momoPaid = momoItems.filter((item) => item.status === 'SUCCEEDED')
  const momoAmount = momoPaid.reduce((sum, item) => sum + item.amountVnd, 0)
  const momoCount = momoPaid.length
  const momoShare = paid > 0 ? ((momoAmount / paid) * 100).toFixed(2) : '0'

  const payosItems = allItems.filter((item) => item.provider === 'PAYOS')
  const payosPaid = payosItems.filter((item) => item.status === 'SUCCEEDED')
  const payosAmount = payosPaid.reduce((sum, item) => sum + item.amountVnd, 0)
  const payosCount = payosPaid.length
  const payosShare = paid > 0 ? ((payosAmount / paid) * 100).toFixed(2) : '0'

  function onTabKeyDown(event: KeyboardEvent, current: Tab) {
    const index = TABS.indexOf(current)
    const next =
      event.key === 'ArrowRight'
        ? TABS[(index + 1) % TABS.length]
        : event.key === 'ArrowLeft'
          ? TABS[(index + TABS.length - 1) % TABS.length]
          : event.key === 'Home'
            ? TABS[0]
            : event.key === 'End'
              ? TABS[TABS.length - 1]
              : null
    if (!next) return
    event.preventDefault()
    setChosenTab(next)
    tabRefs.current[next]?.focus()
  }

  const loadDetail = useCallback(async (destinationId: string) => {
    const request = ++detailRequest.current
    setDetail(null)
    setDetailFailed(false)
    try {
      const response =
        await adminPayoutsBrowserClient.destinationDetail(destinationId)
      if (request === detailRequest.current) setDetail(response)
    } catch {
      if (request === detailRequest.current) setDetailFailed(true)
    }
  }, [])

  function openCheck(destinationId: string) {
    window.clearTimeout(clearTimer.current)
    setCheckId(destinationId)
    setAcknowledged(false)
    setCheckError(null)
    setCopied(false)
    confirmKey.current = crypto.randomUUID()
    void loadDetail(destinationId)
  }

  function closeCheck() {
    if (sendingRef.current) return
    setCheckId(null)
    detailRequest.current += 1
    clearTimer.current = window.setTimeout(() => {
      setDetail(null)
      setAcknowledged(false)
      setCheckError(null)
    }, 200)
  }

  function reloadCheck() {
    closeCheck()
    void queue.reload()
  }

  async function confirmAccount() {
    if (!detail || !acknowledged || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setCheckError(null)
    try {
      await adminPayoutsBrowserClient.confirmDestination(
        detail.destination.id,
        detail.destination.version ?? 0,
        confirmKey.current,
      )
      queue.setData((current) =>
        current
          ? {
              ...current,
              count: Math.max(0, current.count - 1),
              items: current.items.filter(
                (item) => item.destination.id !== detail.destination.id,
              ),
            }
          : current,
      )
      sendingRef.current = false
      setSending(false)
      closeCheck()
      showActionToast({ title: 'Đã xác nhận tài khoản' })
      return
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : ''
      setCheckError(
        code === 'PAYOUT_DESTINATION_VERSION_CONFLICT'
          ? 'conflict'
          : caught instanceof ApiError && caught.status === 404
            ? 'gone'
            : 'failed',
      )
      if (caught instanceof ApiError && caught.status === 404)
        void queue.reload()
    }
    sendingRef.current = false
    setSending(false)
  }

  async function copyAccount() {
    if (!detail) return
    try {
      await navigator.clipboard.writeText(detail.accountReference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard fallback
    }
  }

  function keepFocusInRow(payoutId: string) {
    if (document.activeElement === document.body || !document.activeElement)
      rowRefs.current.get(payoutId)?.focus()
  }

  async function latestAttempt(item: Item) {
    const payout = await adminPayoutsBrowserClient.detail(item.payoutId)
    const latest = [...payout.attempts].sort(
      (a, b) => b.attemptNumber - a.attemptNumber,
    )[0]
    if (!latest) throw new Error('missing attempt')
    return latest
  }

  function replaceRow(payout: Item) {
    ledger.setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((row) =>
              row.payoutId === payout.payoutId ? payout : row,
            ),
          }
        : current,
    )
    setDetailRefresh((current) => current + 1)
  }

  async function closePayout(item: Item) {
    if (busy) return
    setBusy({ id: item.payoutId, kind: 'close', sending: false })
    try {
      const latest = await latestAttempt(item)
      const accepted = await confirm({
        title: `Đóng yêu cầu ${money(item.amountVnd)}?`,
        description: `Chỉ dùng khi tài khoản ${maskedHint(item.destinationHint)} không nhận được tiền và chuyên gia đã có tài khoản mới. Hệ thống không chuyển tiền; số tiền trở lại số dư để chuyên gia rút về tài khoản đã xác nhận.`,
        confirmLabel: 'Đóng yêu cầu',
        tone: 'warning',
      })
      if (!accepted) return
      setBusy((current) => current && { ...current, sending: true })
      const key = closeKeys.current.get(latest.attemptId) ?? crypto.randomUUID()
      closeKeys.current.set(latest.attemptId, key)
      const result = await adminPayoutsBrowserClient.closeFailed(
        item.payoutId,
        latest.attemptId,
        key,
      )
      replaceRow(result.payout)
      showActionToast({
        title: 'Đã đóng yêu cầu',
        description: 'Số tiền đã trở lại số dư của chuyên gia.',
      })
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : undefined
      showActionToast({
        title:
          status === 409
            ? 'Không thể đóng yêu cầu này'
            : 'Chưa thể đóng yêu cầu. Thử lại sau.',
        tone: 'error',
      })
      if (status === 409) void ledger.reload()
    } finally {
      setBusy(null)
    }
  }

  async function retryPayout(item: Item) {
    if (busy) return
    setBusy({ id: item.payoutId, kind: 'retry', sending: false })
    try {
      const latest = await latestAttempt(item)
      const lastFailure =
        adminFailureLines[latest.failureCode ?? item.failureCode ?? ''] ??
        'Chưa rõ nguyên nhân.'
      const accepted = await confirm({
        title: `Chuyển lại ${money(item.amountVnd)}?`,
        description: `Tới ${maskedHint(item.destinationHint)}. Lần trước: ${lastFailure} Hệ thống tạo một lần chuyển mới cho cùng yêu cầu.`,
        confirmLabel: 'Chuyển lại',
        tone: 'warning',
      })
      if (!accepted) return
      const key = retryKeys.current.get(latest.attemptId) ?? crypto.randomUUID()
      retryKeys.current.set(latest.attemptId, key)
      const result = await adminPayoutsBrowserClient.retry(
        item.payoutId,
        latest.attemptId,
        key,
      )
      replaceRow(result.payout)
      showActionToast({
        title: 'Đã tạo lần chuyển mới',
        description: 'Yêu cầu đang được xử lý.',
      })
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : undefined
      showActionToast({
        title:
          status === 409
            ? 'Không thể chuyển lại yêu cầu này'
            : status === 503
              ? 'PayOS đang không sẵn sàng. Thử lại sau.'
              : 'Chưa thể chuyển lại. Thử lại sau.',
        tone: 'error',
      })
      if (status === 409) void ledger.reload()
    } finally {
      setBusy(null)
    }
  }

  const enter = {
    initial: reduced ? (false as const) : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.24 },
  }

  const checkLoading = Boolean(checkId) && !detail && !detailFailed

  return (
    <div className="admin-payouts-manager">
      {/* Page Heading */}
      <header className="apo-heading">
        <div>
          <span>QUẢN TRỊ NỀN TẢNG &amp; TÀI CHÍNH Y TẾ</span>
          <h1>Đối soát chuyên gia</h1>
          <p>
            Bố cục phân luồng cổng chi trả &amp; kiểm tra tự động các giao dịch
            thù lao khám trực tuyến đã đủ điều kiện thanh quyết toán.
          </p>
        </div>
        <div className="apo-heading-actions">
          <button
            type="button"
            disabled={ledger.loading || queue.loading}
            onClick={() => {
              void ledger.reload()
              void queue.reload()
              setDetailRefresh((current) => current + 1)
              onNotice?.('Đang làm mới dữ liệu chi trả.')
            }}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Làm mới
          </button>
          <button
            type="button"
            className="apo-primary"
            disabled={!items.length || ledger.loading || ledger.failed}
            onClick={() => exportPayouts(items)}
          >
            <Download size={15} aria-hidden="true" />
            Xuất bảng kê Payout
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="apo-navigation">
        <div
          className="apo-tabs"
          role="tablist"
          aria-label="Chi trả chuyên gia"
        >
          {TABS.map((id) => (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node
              }}
              type="button"
              role="tab"
              id={`apo-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`apo-tabbody-${id}`}
              tabIndex={tab === id ? 0 : -1}
              className="apo-tab"
              onClick={() => setChosenTab(id)}
              onKeyDown={(event) => onTabKeyDown(event, id)}
            >
              {id === 'queue'
                ? 'Tài khoản chờ xác nhận'
                : id === 'ledger'
                  ? 'Yêu cầu chi trả'
                  : 'Nhật ký Payout API'}
              {id === 'queue' && queue.data && (
                <b className="apo-count" aria-label={`${queueCount} tài khoản`}>
                  {queueCount}
                </b>
              )}
              {tab === id && (
                <motion.span
                  layoutId="apo-tab-indicator"
                  className="apo-tab-line"
                  aria-hidden="true"
                  transition={{ duration: reduced ? 0 : 0.24 }}
                />
              )}
            </button>
          ))}
        </div>
        <span className="apo-limit">
          Giới hạn hiển thị: Tối đa 200 yêu cầu gần nhất
        </span>
      </div>

      {/* Tab: Queue (Tài khoản chờ xác nhận) */}
      {tab === 'queue' && (
        <section
          id="apo-tabbody-queue"
          role="tabpanel"
          aria-labelledby="apo-tab-queue"
          className="apo-queue"
        >
          {queue.loading && !queue.data ? (
            <div
              className="apo-loading"
              role="status"
              aria-label="Đang tải hàng chờ"
            >
              <Skeleton height={64} width="100%" />
              <Skeleton height={64} width="100%" />
              <Skeleton height={64} width="100%" />
            </div>
          ) : queue.failed && !queue.data ? (
            <div className="apo-state" role="alert">
              <h2>Chưa thể tải hàng chờ xác nhận</h2>
              <p>Không có tài khoản nào bị thay đổi.</p>
              <button type="button" onClick={() => void queue.reload()}>
                Thử lại
              </button>
            </div>
          ) : queueCount === 0 ? (
            <div className="apo-empty">
              <h2>Không có tài khoản nào chờ xác nhận.</h2>
            </div>
          ) : (
            <ul className="apo-queue-list">
              <AnimatePresence initial={false}>
                {queue.data?.items.map(
                  ({ destination, specialistAccountId }) => (
                    <motion.li
                      key={destination.id}
                      layout={reduced ? false : 'position'}
                      exit={{ opacity: 0 }}
                      {...enter}
                    >
                      <div>
                        <strong>{destination.bankName ?? 'Ngân hàng'}</strong>
                        <small>{maskedHint(destination.displayHint)}</small>
                      </div>
                      <span title={specialistAccountId}>
                        {resolveSpecialistName(specialistAccountId)}
                      </span>
                      {destination.updatedAt && (
                        <time dateTime={destination.updatedAt}>
                          Gửi lúc {date(destination.updatedAt)}
                        </time>
                      )}
                      <button
                        type="button"
                        className="apo-link"
                        data-apo-check
                        onClick={() => openCheck(destination.id)}
                      >
                        Kiểm tra
                      </button>
                    </motion.li>
                  ),
                )}
              </AnimatePresence>
            </ul>
          )}
        </section>
      )}

      {/* Tab: Ledger & History */}
      {(tab === 'ledger' || tab === 'history') && (
        <section
          id={`apo-tabbody-${tab}`}
          role="tabpanel"
          aria-labelledby={`apo-tab-${tab}`}
          className="apo-tabbody"
        >
          {ledger.loading && !ledger.data ? (
            <div className="apo-loading" aria-busy="true">
              <Skeleton height={130} width="100%" />
              <Skeleton height={320} width="100%" />
            </div>
          ) : ledger.failed && !ledger.data ? (
            <div className="apo-state" role="alert">
              <h2>Chưa thể tải dữ liệu chi trả</h2>
              <p>Không có thao tác tài chính nào được thực hiện.</p>
              <button type="button" onClick={() => void ledger.reload()}>
                Thử lại
              </button>
            </div>
          ) : (
            ledger.data && (
              <>
                {ledger.data.items.some((item) => item.provider === 'FAKE') && (
                  <p role="note" className="apo-fake-note">
                    Có giao dịch mô phỏng trong danh sách. Những giao dịch này
                    không chuyển tiền thật.
                  </p>
                )}

                {/* 4 KPI Metrics Cards */}
                <section className="apo-metrics" aria-label="Tổng quan chi trả">
                  {/* Card 1: Ví MoMo Enterprise */}
                  <article
                    className="apo-gateway-card apo-card-momo"
                    data-provider="MOMO"
                  >
                    <header>
                      <div className="apo-card-brand">
                        <span className="apo-momo-tag">MoMo</span>
                        <div>
                          <h2>MoMo</h2>
                          <p>Chi trả chuyên gia</p>
                        </div>
                      </div>
                      <span className="apo-pill-status apo-pill-ready">
                        {momoItems.length} yêu cầu
                      </span>
                    </header>
                    <div className="apo-card-amount">
                      <strong>{money(momoAmount)}</strong>
                    </div>
                    <footer>
                      <span>{momoCount} giao dịch thành công</span>
                      <span className="apo-stat-share">
                        {momoShare}% tổng đợt
                      </span>
                    </footer>
                  </article>

                  {/* Card 2: PayOS Napas247 */}
                  <article
                    className="apo-gateway-card apo-card-payos"
                    data-provider="PAYOS"
                  >
                    <header>
                      <div className="apo-card-brand">
                        <span className="apo-payos-tag">PayOS</span>
                        <div>
                          <h2>PayOS</h2>
                          <p>Chi trả chuyên gia</p>
                        </div>
                      </div>
                      <span className="apo-pill-status apo-pill-open">
                        {payosItems.length} yêu cầu
                      </span>
                    </header>
                    <div className="apo-card-amount">
                      <strong>{money(payosAmount)}</strong>
                    </div>
                    <footer>
                      <span>{payosCount} giao dịch thành công</span>
                      <span className="apo-stat-share">{payosShare}%</span>
                    </footer>
                  </article>

                  {/* Card 3: TỔNG GIÁ TRỊ ĐỐI SOÁT */}
                  <article className="apo-total-card">
                    <header>
                      <small>TỔNG GIÁ TRỊ ĐỐI SOÁT</small>
                    </header>
                    <div className="apo-card-amount">
                      <strong>{money(total)}</strong>
                    </div>
                    <footer>
                      <span>Yêu cầu đã thanh toán</span>
                      <span className="apo-total-verified">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {allItems.length
                          ? `${new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 }).format(paidCount / allItems.length)} (${paidCount}/${allItems.length})`
                          : 'Chưa có yêu cầu'}
                      </span>
                    </footer>
                  </article>

                  {/* Card 4: TỰ ĐỘNG HÓA ĐỐI SOÁT */}
                  <article className="apo-reconciliation-card">
                    <header>
                      <small>THEO DÕI ĐỐI SOÁT</small>
                      <ShieldCheck size={18} aria-hidden="true" />
                    </header>
                    <h2>
                      {reviewCount > 0
                        ? `${reviewCount} yêu cầu cần kiểm tra`
                        : 'Theo dõi kết quả chi trả'}
                    </h2>
                    <p>
                      Trạng thái được ghi nhận theo từng yêu cầu và lần chuyển
                      tiền.
                    </p>
                    <footer>
                      <span>Chờ xử lý: {money(processing)}</span>
                      <button
                        type="button"
                        onClick={() => setChosenTab('history')}
                      >
                        Kiểm tra log cổng
                      </button>
                    </footer>
                  </article>
                </section>

                {/* Main 2-Column Workspace */}
                <div className="apo-workspace" data-history={tab === 'history'}>
                  {/* Left Column: Sổ đối soát lệnh */}
                  <section className="apo-ledger">
                    <header>
                      <div className="apo-ledger-title">
                        <span>Sổ đối soát</span>
                        <h2>Yêu cầu chi trả</h2>
                        <b className="apo-pill-count">
                          {items.length} đợt chi trả
                        </b>
                      </div>
                      <div className="apo-ledger-filters">
                        <label>
                          <span className="apo-sr-only">Lọc trạng thái</span>
                          <select
                            value={filter}
                            onChange={(event) => {
                              setFilter(event.target.value as StatusFilter)
                              setPage(1)
                            }}
                          >
                            <option value="ALL">Tất cả trạng thái</option>
                            <option value="NEEDS_REVIEW">Cần kiểm tra</option>
                            <option value="PENDING">Đang tiếp nhận</option>
                            <option value="PROCESSING">Đang xử lý</option>
                            <option value="SUCCEEDED">Đã thanh toán</option>
                            <option value="FAILED">Chưa thành công</option>
                            <option value="UNKNOWN">Cần đối soát</option>
                          </select>
                        </label>
                        <label>
                          <span className="apo-sr-only">Lọc cổng chi trả</span>
                          <select
                            value={provider}
                            onChange={(event) => {
                              setProvider(
                                event.target.value as Item['provider'] | 'ALL',
                              )
                              setPage(1)
                            }}
                          >
                            <option value="ALL">Cả MoMo &amp; PayOS</option>
                            <option value="MOMO">Chỉ MoMo</option>
                            <option value="PAYOS">Chỉ PayOS</option>
                          </select>
                        </label>
                      </div>
                    </header>

                    {items.length ? (
                      <div className="apo-table">
                        {pageItems.map((item) => {
                          const review =
                            item.reconciliationStatus === 'NEEDS_REVIEW'
                          const canRetry =
                            item.status === 'FAILED' &&
                            item.reconciliationStatus === 'COMPLETE' &&
                            !item.closedAt
                          const isSelected =
                            selectedPayout?.payoutId === item.payoutId
                          const isItemSucceeded = item.status === 'SUCCEEDED'

                          return (
                            <article
                              key={item.payoutId}
                              tabIndex={-1}
                              data-selected={isSelected}
                              ref={(node) => {
                                if (node)
                                  rowRefs.current.set(item.payoutId, node)
                                else rowRefs.current.delete(item.payoutId)
                              }}
                            >
                              <button
                                type="button"
                                className="apo-select-payout"
                                aria-pressed={isSelected}
                                aria-controls="apo-payout-detail"
                                onClick={() => setSelectedId(item.payoutId)}
                              >
                                <span
                                  className="apo-specialist-avatar"
                                  aria-hidden="true"
                                >
                                  {getSpecialistInitials(
                                    item.specialistAccountId,
                                  )}
                                </span>
                                <span className="apo-row-identity">
                                  <span className="apo-row-title">
                                    <strong title={item.specialistAccountId}>
                                      {resolveSpecialistName(
                                        item.specialistAccountId,
                                      )}
                                    </strong>
                                    <span
                                      className="apo-provider-badge"
                                      data-provider={item.provider}
                                    >
                                      {item.provider === 'PAYOS'
                                        ? 'PayOS'
                                        : item.provider === 'MOMO'
                                          ? 'MoMo'
                                          : 'Fake'}
                                    </span>
                                    <small>
                                      {maskedHint(item.destinationHint)}
                                    </small>
                                  </span>
                                  <span className="apo-row-meta">
                                    <span>
                                      Lệnh: {item.payoutId.slice(0, 8)}
                                    </span>
                                    <span>
                                      {item.earningCount} khoản đủ điều kiện
                                    </span>
                                    <time dateTime={item.requestedAt}>
                                      {date(item.requestedAt)}
                                    </time>
                                  </span>
                                </span>
                              </button>

                              <div className="apo-row-right">
                                <b>{money(item.amountVnd)}</b>
                                <span
                                  className={`apo-status is-${item.closedAt ? 'closed' : review ? 'needs_review' : item.status.toLowerCase()}`}
                                >
                                  <span>
                                    {isItemSucceeded ? (
                                      <>
                                        <CheckCircle2
                                          size={12}
                                          aria-hidden="true"
                                          style={{
                                            display: 'inline',
                                            marginRight: '4px',
                                          }}
                                        />
                                        Đã thanh toán
                                      </>
                                    ) : (
                                      adminPayoutStatusLabel(
                                        item.status,
                                        item.reconciliationStatus,
                                        item.closedAt,
                                      )
                                    )}
                                  </span>
                                </span>
                              </div>

                              {item.closedAt && (
                                <p role="status" className="apo-note-closed">
                                  Đóng lúc {date(item.closedAt)}
                                </p>
                              )}

                              <AnimatePresence initial={false}>
                                {item.failureCode && !item.closedAt && (
                                  <motion.p
                                    key="failure"
                                    role="status"
                                    exit={collapse(reduced)}
                                  >
                                    {adminFailureLines[item.failureCode] ??
                                      'Yêu cầu cần được đối soát lại trước khi tiếp tục.'}
                                  </motion.p>
                                )}
                              </AnimatePresence>

                              {review && item.reviewRequiredAt && (
                                <p role="status">
                                  Cần kiểm tra từ {date(item.reviewRequiredAt)}.
                                </p>
                              )}

                              <AnimatePresence
                                initial={false}
                                onExitComplete={() =>
                                  keepFocusInRow(item.payoutId)
                                }
                              >
                                {canRetry && (
                                  <motion.div
                                    key="actions"
                                    className="apo-row-actions"
                                    exit={collapse(reduced)}
                                  >
                                    <button
                                      type="button"
                                      className="apo-link"
                                      disabled={busy !== null}
                                      onClick={() => void retryPayout(item)}
                                    >
                                      {busy?.id === item.payoutId &&
                                      busy.kind === 'retry'
                                        ? 'Đang tải…'
                                        : 'Chuyển lại'}
                                    </button>
                                    <button
                                      type="button"
                                      className="apo-link apo-close"
                                      disabled={busy !== null}
                                      onClick={() => void closePayout(item)}
                                    >
                                      {busy?.id === item.payoutId &&
                                      busy.kind === 'close'
                                        ? busy.sending
                                          ? 'Đang đóng…'
                                          : 'Đang tải…'
                                        : 'Đóng yêu cầu'}
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </article>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="apo-empty">
                        <span>◇</span>
                        <h3>Không có yêu cầu phù hợp</h3>
                        <p>Thử chọn trạng thái khác hoặc làm mới dữ liệu.</p>
                      </div>
                    )}

                    <footer className="apo-pagination">
                      <p role="status">
                        Đang xem {pageItems.length} trên tổng số {items.length}{' '}
                        yêu cầu
                      </p>
                      <nav aria-label="Phân trang chi trả">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          Trang trước
                        </button>
                        <span aria-current="page">{currentPage}</span>
                        <button
                          type="button"
                          disabled={currentPage === pageCount}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          Trang sau
                        </button>
                      </nav>
                    </footer>
                  </section>

                  {/* Right Column: Chi tiết đối soát thời gian thực */}
                  <AdminPayoutDetailPanel
                    key={selectedPayout?.payoutId ?? 'empty'}
                    payout={selectedPayout}
                    history={tab === 'history'}
                    refresh={detailRefresh}
                  />
                </div>
              </>
            )
          )}
        </section>
      )}

      {/* Account Verification Dialog */}
      <Dialog
        open={checkId !== null}
        onOpenChange={(open) => {
          if (!open) closeCheck()
        }}
        labelledBy="apo-check-title"
        describedBy="apo-check-description"
        className="apo-dialog"
        restoreFocusTo={() =>
          document.querySelector<HTMLElement>('[data-apo-check]') ??
          tabRefs.current.queue
        }
      >
        <div className="apo-check">
          <header>
            <h2 id="apo-check-title">Kiểm tra tài khoản nhận tiền</h2>
            <p id="apo-check-description">
              Đối chiếu tên chủ tài khoản với ngân hàng trước khi xác nhận. Mỗi
              tài khoản chỉ cần xác nhận một lần.
            </p>
          </header>
          <div className="apo-check-body">
            {checkLoading && (
              <div
                className="apo-loading"
                role="status"
                aria-label="Đang tải thông tin tài khoản"
              >
                <Skeleton height={20} width="60%" />
                <Skeleton height={80} width="100%" />
                <Skeleton height={50} width="50%" />
              </div>
            )}
            {detailFailed && (
              <div className="apo-check-error" role="alert">
                <div>Chưa tải được thông tin tài khoản.</div>
                <button
                  type="button"
                  className="apo-link"
                  onClick={() => checkId && void loadDetail(checkId)}
                >
                  Thử lại
                </button>
              </div>
            )}
            {detail && (
              <dl className="apo-check-detail">
                <div>
                  <dt>Ngân hàng</dt>
                  <dd>
                    {detail.destination.bankName ?? 'Chưa rõ'}
                    {detail.destination.bankCode &&
                      ` (BIN ${detail.destination.bankCode})`}
                  </dd>
                </div>
                <div>
                  <dt>Số tài khoản</dt>
                  <dd className="apo-account">
                    <span>{groupDigits(detail.accountReference)}</span>
                    <button
                      type="button"
                      className="apo-link"
                      aria-label="Sao chép số tài khoản"
                      onClick={() => void copyAccount()}
                    >
                      {copied ? 'Đã sao chép' : 'Sao chép'}
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Tên chủ tài khoản</dt>
                  <dd>{detail.accountHolderName}</dd>
                </div>
                <div>
                  <dt>Chuyên gia</dt>
                  <dd className="apo-id">{detail.specialistAccountId}</dd>
                </div>
                {detail.destination.updatedAt && (
                  <div>
                    <dt>Gửi lúc</dt>
                    <dd>{date(detail.destination.updatedAt)}</dd>
                  </div>
                )}
              </dl>
            )}
            {detail && (
              <label className="apo-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={sending}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  Tôi đã kiểm tra tên chủ tài khoản khớp với số tài khoản.
                </span>
              </label>
            )}
            {checkError && (
              <div className="apo-check-error" role="alert">
                <div>
                  {checkError === 'conflict'
                    ? 'Chuyên gia vừa đổi tài khoản. Tải lại để kiểm tra thông tin mới.'
                    : checkError === 'gone'
                      ? 'Tài khoản này không còn trong hàng chờ.'
                      : 'Chưa thể xác nhận tài khoản. Bạn có thể thử lại.'}
                </div>
                {checkError === 'conflict' && (
                  <button
                    type="button"
                    className="apo-link"
                    onClick={reloadCheck}
                  >
                    Tải lại danh sách
                  </button>
                )}
              </div>
            )}
          </div>
          <footer>
            <button type="button" disabled={sending} onClick={closeCheck}>
              {checkError === 'gone' ? 'Đóng' : 'Hủy'}
            </button>
            {checkError !== 'gone' && (
              <button
                type="button"
                className="apo-primary"
                disabled={
                  !detail ||
                  !acknowledged ||
                  sending ||
                  checkError === 'conflict'
                }
                onClick={() => void confirmAccount()}
              >
                {sending ? 'Đang xác nhận…' : 'Xác nhận tài khoản'}
              </button>
            )}
          </footer>
        </div>
      </Dialog>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { specialistEarningsBrowserClient } from '@/features/specialist-earnings/api/browser-client'
import type {
  SavePayoutDestinationInput,
  SpecialistEarnings,
} from '@/lib/consultation/consultation-validation'
import { Dialog } from './ui/Dialog'
import { useFeedback } from './ui/FeedbackProvider'
import { Skeleton } from './ui/Skeleton'
import './specialist-earnings-manager.css'

type DialogName = 'destination' | 'withdraw' | null

const earningLabels: Record<
  SpecialistEarnings['earnings'][number]['status'],
  string
> = {
  PENDING_SETTLEMENT: 'Đang trong thời gian chờ',
  AVAILABLE: 'Có thể rút',
  PROCESSING: 'Đang chi trả',
  PAID: 'Đã thanh toán',
  REVERSED: 'Đã điều chỉnh',
}
const payoutLabels: Record<
  SpecialistEarnings['payouts'][number]['status'],
  string
> = {
  PENDING: 'Đang tiếp nhận',
  PROCESSING: 'Đang xử lý',
  SUCCEEDED: 'Đã thanh toán',
  FAILED: 'Chưa thành công',
  UNKNOWN: 'Cần đối soát',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}
function formatAmount(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
function newIdempotencyKey() {
  return `payout-${crypto.randomUUID()}`
}

function Icon({ name }: { name: 'wallet' | 'clock' | 'paid' | 'bank' | 'eye' | 'eyeOff' | 'arrow' | 'refresh' | 'close' | 'hourglass' | 'shield' | 'plus' }) {
  const content = {
    wallet: (
      <>
        <path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12v4" />
        <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    paid: (
      <>
        <path d="M20 7 9 18l-5-5" />
        <path d="M12 3a9 9 0 1 0 9 9" />
      </>
    ),
    bank: (
      <>
        <path d="m3 9 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18" />
      </>
    ),
    eye: <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 6.1A11 11 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6M6.3 6.3C3.5 8 2 12 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4.2-.9" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
    arrow: <><path d="M7 17 17 7M8 7h9v9" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 1M4 17l2 1a7 7 0 0 0 12.5-3" /></>,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    hourglass: <><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9S7 16 7 21M17 3c0 5-10 5-10 9s10 4 10 9" /></>,
  }[name]
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {content}
    </svg>
  )
}

export default function SpecialistEarningsManager() {
  const { showActionToast } = useFeedback()
  const [data, setData] = useState<SpecialistEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dialog, setDialog] = useState<DialogName>(null)
  const [destinationType, setDestinationType] =
    useState<SavePayoutDestinationInput['destinationType']>('MOMO_WALLET')
  const [accountReference, setAccountReference] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)
  const confirmWithdrawRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await specialistEarningsBrowserClient.get())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    let active = true
    specialistEarningsBrowserClient.get().then(
      (response) => {
        if (active) {
          setData(response)
          setLoading(false)
        }
      },
      () => {
        if (active) {
          setError(true)
          setLoading(false)
        }
      },
    )
    return () => {
      active = false
    }
  }, [])

  const canWithdraw = Boolean(
    data?.destination?.status === 'VERIFIED' &&
    data.balance.availableVnd >= data.minimumWithdrawalVnd &&
    data.balance.processingVnd === 0,
  )
  const sortedEarnings = useMemo(
    () =>
      [...(data?.earnings ?? [])].sort(
        (a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt),
      ),
    [data],
  )
  const shownMoney = (value: number) => hideBalance ? '••••••' : formatCurrency(value)
  const unlocksToday = data?.earnings.filter((earning) =>
    earning.status === 'PENDING_SETTLEMENT' &&
    new Date(earning.settlementAvailableAt).toDateString() === new Date().toDateString(),
  ).length ?? 0
  const pendingEarnings = data?.earnings.filter((earning) => earning.status === 'PENDING_SETTLEMENT') ?? []
  const settlementProgress = pendingEarnings.length
    ? Math.round(pendingEarnings.reduce((total, earning) => {
        const start = Date.parse(earning.earnedAt)
        const end = Date.parse(earning.settlementAvailableAt)
        return total + (end > start ? Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100)) : 0)
      }, 0) / pendingEarnings.length)
    : 0
  useEffect(() => {
    if (dialog !== 'withdraw') return
    const frame = window.requestAnimationFrame(() => confirmWithdrawRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [dialog])

  function openDestinationDialog() {
    setDestinationType(data?.destination?.destinationType ?? 'MOMO_WALLET')
    setAccountReference('')
    setAccountHolderName('')
    setBankCode('')
    setFormError('')
    setDialog('destination')
  }

  async function saveDestination() {
    if (!/^\d{6,32}$/.test(accountReference)) {
      setFormError(
        'Nhập từ 6 đến 32 chữ số, không có khoảng trắng hoặc ký tự đặc biệt.',
      )
      return
    }
    if (!accountHolderName.trim()) {
      setFormError('Nhập đúng tên chủ tài khoản hoặc chủ ví.')
      return
    }
    if (destinationType === 'BANK_ACCOUNT' && !bankCode.trim()) {
      setFormError('Nhập mã ngân hàng để tiếp tục.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const destination = await specialistEarningsBrowserClient.saveDestination(
        {
          destinationType,
          accountReference,
          accountHolderName: accountHolderName.trim(),
          bankCode:
            destinationType === 'BANK_ACCOUNT' ? bankCode.trim() : undefined,
        },
      )
      setData((current) => (current ? { ...current, destination } : current))
      setAccountReference('')
      setAccountHolderName('')
      setBankCode('')
      setDialog(null)
      showActionToast({
        title: 'Đã lưu nơi nhận tiền',
        description: 'Thông tin nhạy cảm chỉ được hiển thị dưới dạng che bớt.',
      })
    } catch {
      setFormError('Chưa thể lưu nơi nhận tiền. Vui lòng kiểm tra và thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  async function createPayout() {
    if (!data?.destination || !canWithdraw) return
    setSubmitting(true)
    setFormError('')
    try {
      setData(
        await specialistEarningsBrowserClient.createPayout(
          data.destination.id,
          newIdempotencyKey(),
        ),
      )
      setDialog(null)
      showActionToast({
        title: 'Đã gửi yêu cầu rút tiền',
        description: 'Bạn có thể theo dõi trạng thái ngay trên trang này.',
      })
    } catch {
      setFormError(
        'Chưa thể gửi yêu cầu. Vui lòng tải lại dữ liệu rồi thử lại.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="earnings-manager earnings-loading" aria-busy="true">
        <Skeleton height={38} width="42%" />
        <Skeleton height={150} width="100%" />
        <Skeleton height={320} width="100%" />
      </div>
    )
  if (error || !data)
    return (
      <div className="earnings-manager">
        <section className="earnings-state" role="alert">
          <Icon name="refresh" />
          <h1>Chưa thể tải thu nhập</h1>
          <p>Dữ liệu của bạn vẫn được giữ nguyên. Hãy thử kết nối lại.</p>
          <button type="button" data-earnings-ui onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      </div>
    )

  return (
    <div className="earnings-manager" data-earnings-ui>
      <header className="earnings-header">
        <div>
          <span className="earnings-eyebrow">Không gian chuyên gia</span>
          <h1>Thu nhập & thanh toán</h1>
          <p>
            Theo dõi khoản thu từ các phiên đã hoàn thành và chủ động yêu cầu
            chi trả.
          </p>
        </div>
        <div className="earnings-header-actions">
          <button type="button" data-earnings-ui className="earnings-refresh" onClick={() => setHideBalance((current) => !current)} aria-pressed={hideBalance}>
            <Icon name={hideBalance ? 'eyeOff' : 'eye'} />
            {hideBalance ? 'Hiện số dư' : 'Ẩn số dư'}
          </button>
          <button type="button" data-earnings-ui className="earnings-refresh" onClick={() => void load()}>
            <Icon name="refresh" />
            Làm mới
          </button>
        </div>
      </header>

      <section className="earnings-summary" aria-label="Số dư thu nhập">
        <article className="earnings-balance">
          <div className="earnings-stat-head">
            <span className="earnings-chip is-green"><Icon name="wallet" />Có thể rút</span>
          <small title={`Mức tối thiểu ${shownMoney(data.minimumWithdrawalVnd)}`}>Mức tối thiểu {shownMoney(data.minimumWithdrawalVnd)}</small>
          </div>
          <strong className="earnings-amount">{hideBalance ? '••••••' : formatAmount(data.balance.availableVnd)}{!hideBalance && <sup>₫</sup>}</strong>
          <p className="earnings-stat-note"><Icon name="paid" />{data.destination?.status === 'VERIFIED' ? 'Có thể chuyển đến nơi nhận tiền đã xác minh' : 'Thiết lập nơi nhận tiền để yêu cầu chi trả'}</p>
          <div className="earnings-stat-footer">
            <button type="button" data-earnings-ui className="earnings-primary" disabled={data.balance.availableVnd < data.minimumWithdrawalVnd || data.balance.processingVnd > 0} onClick={() => { if (data.destination?.status === 'VERIFIED') { setFormError(''); setDialog('withdraw') } else openDestinationDialog() }}>
              <Icon name="arrow" />
              {data.destination?.status === 'VERIFIED' ? 'Rút toàn bộ số dư' : 'Thiết lập nơi nhận'}
            </button>
          </div>
        </article>
        <article>
          <div className="earnings-stat-head">
            <span className="earnings-chip is-amber"><Icon name="clock" />Đang chờ đủ điều kiện</span>
            <small>Khả dụng sau {data.settlementHoldDays} ngày</small>
          </div>
          <strong className="earnings-amount">{hideBalance ? '••••••' : formatAmount(data.balance.pendingSettlementVnd)}{!hideBalance && <sup>₫</sup>}</strong>
          <p className="earnings-stat-note"><Icon name="hourglass" />Khoản thu đang được đối soát</p>
          <div className="earnings-stat-footer earnings-progress-footer">
            <div className="earnings-progress-caption"><span>Tiến trình mở khóa</span><b>{unlocksToday} phiên mở khóa hôm nay</b></div>
            <div className="earnings-progress-track" role="progressbar" aria-label="Tiến trình mở khóa" aria-valuenow={settlementProgress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${settlementProgress}%` }} /></div>
          </div>
        </article>
        <article>
          <div className="earnings-stat-head">
            <span className="earnings-chip is-green"><Icon name="paid" />Đã thanh toán</span>
            <small title={data.balance.processingVnd > 0 ? `${shownMoney(data.balance.processingVnd)} đang xử lý` : 'Không có khoản đang xử lý'}>
              {data.balance.processingVnd > 0 ? `${shownMoney(data.balance.processingVnd)} đang xử lý` : 'Không có khoản đang xử lý'}
            </small>
          </div>
          <strong className="earnings-amount">{hideBalance ? '••••••' : formatAmount(data.balance.paidVnd)}{!hideBalance && <sup>₫</sup>}</strong>
          <p className="earnings-stat-note"><Icon name="paid" />Các khoản đã chi trả thành công</p>
          <div className="earnings-stat-footer"><span>{data.payouts.filter((payout) => payout.status === 'SUCCEEDED').length} yêu cầu</span><a href="#earnings-payout-history">Yêu cầu gần đây <Icon name="arrow" /></a></div>
        </article>
      </section>

      {!data.destination && (
        <section className="earnings-callout">
          <Icon name="bank" />
          <div>
            <strong>Thêm nơi nhận tiền để sẵn sàng rút thu nhập</strong>
            <p>
              Số tài khoản hoặc ví sẽ được mã hóa; sau khi lưu chỉ hiển thị dạng
              che bớt.
            </p>
          </div>
          <button type="button" data-earnings-ui onClick={openDestinationDialog}>
            Thiết lập
          </button>
        </section>
      )}

      <div className="earnings-content">
        <div className="earnings-main-column">
        <section className="earnings-panel">
          <header>
            <div>
              <span>Các phiên đủ bằng chứng</span>
              <h2>Thu nhập đã ghi nhận</h2>
            </div>
            <b>{data.earnings.length} khoản</b>
          </header>
          {sortedEarnings.length ? (
            <div className="earnings-list">
              {sortedEarnings.map((earning) => (
                <article key={earning.id}>
                  <span className={`earnings-item-icon is-${earning.status.toLowerCase()}`}><Icon name={earning.status === 'PENDING_SETTLEMENT' ? 'hourglass' : 'paid'} /></span>
                  <div className="earnings-item-copy">
                    <strong>
                      Phiên hoàn thành ngày {formatDate(earning.earnedAt)}
                    </strong>
                    <small>
                      {earning.status === 'PENDING_SETTLEMENT'
                        ? `Có thể rút từ ${formatDate(earning.settlementAvailableAt)}`
                        : earningLabels[earning.status]}
                    </small>
                  </div>
                  <div className="earnings-item-right">
                    <b>{shownMoney(earning.earningAmountVnd)}</b>
                    <span className={`earnings-status is-${earning.status.toLowerCase()}`}>{earningLabels[earning.status]}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="earnings-empty">
              <Icon name="wallet" />
              <h3>Chưa có thu nhập được ghi nhận</h3>
              <p>
                Khoản thu sẽ xuất hiện khi một phiên đủ bằng chứng đã hoàn thành
                và credit được sử dụng.
              </p>
            </div>
          )}
        </section>
        <section className="earnings-panel earnings-payouts" id="earnings-payout-history">
          <header>
            <div>
              <span>Lịch sử chi trả</span>
              <h2>Yêu cầu gần đây</h2>
            </div>
            <b>{data.payouts.length} yêu cầu</b>
          </header>
          {data.payouts.length ? (
            <div className="earnings-payout-list">
              {data.payouts.map((payout) => (
                <article key={payout.id}>
                  <span className={`earnings-item-icon is-${payout.status.toLowerCase()}`}><Icon name={payout.status === 'SUCCEEDED' ? 'paid' : 'clock'} /></span>
                  <div className="earnings-item-copy">
                    <strong>{shownMoney(payout.amountVnd)}</strong>
                    <small>Gửi lúc {formatDate(payout.requestedAt)}</small>
                  </div>
                  <div className="earnings-item-right">
                    <span className={`earnings-status is-${payout.status.toLowerCase()}`}>{payoutLabels[payout.status]}</span>
                    <small>{payout.completedAt ? `Hoàn tất ${formatDate(payout.completedAt)}` : 'Đang được hệ thống theo dõi'}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="earnings-empty is-compact"><p>Chưa có yêu cầu rút tiền nào.</p></div>
          )}
        </section>
        </div>
        <aside className="earnings-side">
          <section className="earnings-destination">
            <div className="earnings-destination-heading">
              <div>
                <span>Nơi nhận tiền</span>
                <h2>Tài khoản thụ hưởng</h2>
              </div>
              {data.destination?.status === 'VERIFIED' && (
                <span className="earnings-destination-verified"><Icon name="shield" /> Đã xác minh</span>
              )}
            </div>
            {data.destination ? (
              <>
                <div className="earnings-account-card">
                  <div className="earnings-account-main">
                    <span className={`earnings-provider-logo ${data.destination.destinationType === 'MOMO_WALLET' ? 'is-momo' : ''}`}>
                      {data.destination.destinationType === 'MOMO_WALLET' ? 'momo' : <Icon name="bank" />}
                    </span>
                    <div className="earnings-account-details">
                      <div className="earnings-account-title">
                        <h3>{data.destination.destinationType === 'MOMO_WALLET' ? 'Ví MoMo' : 'Tài khoản ngân hàng'}</h3>
                        <span>{data.destination.status === 'VERIFIED' ? 'Đang sử dụng' : 'Tạm ngưng'}</span>
                      </div>
                      <strong>{data.destination.destinationType === 'MOMO_WALLET' ? data.destination.displayHint.replace(/^MoMo\s*·\s*/, '') : data.destination.displayHint}</strong>
                      <small>Xác minh lúc {formatDate(data.destination.verifiedAt)}</small>
                    </div>
                  </div>
                </div>
                <button className="earnings-destination-action" type="button" data-earnings-ui onClick={openDestinationDialog}>
                  <Icon name="plus" /> Cập nhật phương thức nhận
                </button>
              </>
            ) : (
              <>
                <p className="earnings-destination-empty">Thêm ví MoMo hoặc tài khoản ngân hàng để yêu cầu chi trả.</p>
                <button className="earnings-destination-action" type="button" data-earnings-ui onClick={openDestinationDialog}>
                  <Icon name="plus" /> Thêm phương thức nhận
                </button>
              </>
            )}
          </section>
          <section className="earnings-policy">
            <strong>Cách tính khoản thu</strong>
            <p>
              Mỗi credit đã sử dụng cho một phiên đủ điều kiện tạo khoản thu{' '}
              <b>{shownMoney(210000)}</b>. Đây không phải tỷ lệ trên giá gói
              đăng ký.
            </p>
          </section>
        </aside>
      </div>

      <Dialog
        open={dialog === 'destination'}
        onOpenChange={(open) => !open && setDialog(null)}
        labelledBy="destination-title"
        describedBy="destination-description"
        className="earnings-dialog earnings-destination-dialog"
      >
        <header className="earnings-dialog-header">
          <div>
            <span>Nơi nhận tiền</span>
            <h2 id="destination-title">
              {data.destination
                ? 'Cập nhật thông tin nhận'
                : 'Thiết lập thông tin nhận'}
            </h2>
            <p id="destination-description">
              Thông tin đầy đủ được mã hóa và không hiển thị lại sau khi lưu.
            </p>
          </div>
          <button
            type="button"
            data-earnings-ui
            aria-label="Đóng"
            onClick={() => setDialog(null)}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="earnings-dialog-body">
          <fieldset>
            <legend>Hình thức nhận</legend>
            <label>
              <input
                type="radio"
                name="destination"
                checked={destinationType === 'MOMO_WALLET'}
                onChange={() => setDestinationType('MOMO_WALLET')}
              />
              <span>
                <strong>Ví MoMo</strong>
                <small>Số điện thoại đăng ký ví</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="destination"
                checked={destinationType === 'BANK_ACCOUNT'}
                onChange={() => setDestinationType('BANK_ACCOUNT')}
              />
              <span>
                <strong>Tài khoản ngân hàng</strong>
                <small>Số tài khoản nội địa</small>
              </span>
            </label>
          </fieldset>
          <label className="earnings-account">
            <span>Tên chủ tài khoản hoặc chủ ví</span>
            <input
              autoComplete="name"
              value={accountHolderName}
              maxLength={100}
              onChange={(event) => setAccountHolderName(event.target.value)}
              placeholder="Nhập đúng tên đã đăng ký"
            />
          </label>
          {destinationType === 'BANK_ACCOUNT' && (
            <label className="earnings-account">
              <span>Mã ngân hàng</span>
              <input
                autoComplete="off"
                value={bankCode}
                maxLength={32}
                onChange={(event) =>
                  setBankCode(event.target.value.toUpperCase())
                }
                placeholder="Ví dụ: VCB"
              />
            </label>
          )}
          <label className="earnings-account">
            <span>
              {destinationType === 'MOMO_WALLET'
                ? 'Số điện thoại MoMo'
                : 'Số tài khoản'}
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={accountReference}
              onChange={(event) =>
                setAccountReference(
                  event.target.value.replace(/\D/g, '').slice(0, 32),
                )
              }
              placeholder="Chỉ nhập chữ số"
            />
          </label>
          {formError && (
            <p className="earnings-form-error" role="alert">
              {formError}
            </p>
          )}
          <p className="earnings-destination-notice">
            <Icon name="shield" />
            <span>Thông tin tài khoản được bảo vệ và chỉ hiển thị dạng che bớt sau khi lưu.</span>
          </p>
        </div>
        <footer className="earnings-dialog-footer">
          <button type="button" data-earnings-ui onClick={() => setDialog(null)}>
            Hủy
          </button>
          <button
            type="button"
            data-earnings-ui
            disabled={submitting}
            onClick={() => void saveDestination()}
          >
            {submitting ? 'Đang lưu…' : 'Lưu an toàn'}
          </button>
        </footer>
      </Dialog>

      <Dialog
        open={dialog === 'withdraw'}
        onOpenChange={(open) => !open && setDialog(null)}
        labelledBy="withdraw-title"
        describedBy="withdraw-description"
        className="earnings-dialog"
      >
        <header className="earnings-dialog-header">
          <div>
            <span>Xác nhận yêu cầu</span>
            <h2 id="withdraw-title">Rút toàn bộ số dư khả dụng</h2>
            <p id="withdraw-description">
              Hệ thống tự tính số tiền từ các khoản đủ điều kiện; bạn không cần
              nhập số tiền.
            </p>
          </div>
          <button
            type="button"
            data-earnings-ui
            aria-label="Đóng"
            onClick={() => setDialog(null)}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="earnings-dialog-body">
          <div className="earnings-withdraw-total">
            <span>Số tiền yêu cầu</span>
            <strong>{shownMoney(data.balance.availableVnd)}</strong>
          </div>
          <div className="earnings-withdraw-destination">
            <Icon name="bank" />
            <div>
              <small>Chuyển đến</small>
              <strong>
                {data.destination?.destinationType === 'MOMO_WALLET'
                  ? `Ví ${data.destination?.displayHint}`
                  : `Tài khoản ngân hàng · ${data.destination?.displayHint}`}
              </strong>
            </div>
          </div>
          <p className="earnings-notice">
            Mỗi chuyên gia chỉ có thể tạo tối đa một yêu cầu trong ngày. Trạng
            thái sẽ được cập nhật trên trang này.
          </p>
          {formError && (
            <p className="earnings-form-error" role="alert">
              {formError}
            </p>
          )}
        </div>
        <footer className="earnings-dialog-footer">
          <button type="button" data-earnings-ui onClick={() => setDialog(null)}>
            Quay lại
          </button>
          <button
            type="button"
            data-earnings-ui
            ref={confirmWithdrawRef}
            disabled={submitting}
            onClick={() => void createPayout()}
          >
            {submitting ? 'Đang gửi…' : 'Xác nhận rút tiền'}
          </button>
        </footer>
      </Dialog>
    </div>
  )
}

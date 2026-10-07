'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

function Icon({ name }: { name: 'wallet' | 'clock' | 'paid' | 'bank' }) {
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
  }[name]
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
          <span aria-hidden="true">↻</span>
          <h1>Chưa thể tải thu nhập</h1>
          <p>Dữ liệu của bạn vẫn được giữ nguyên. Hãy thử kết nối lại.</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      </div>
    )

  return (
    <div className="earnings-manager">
      <header className="earnings-header">
        <div>
          <span className="earnings-eyebrow">Không gian chuyên gia</span>
          <h1>Thu nhập & thanh toán</h1>
          <p>
            Theo dõi khoản thu từ các phiên đã hoàn thành và chủ động yêu cầu
            chi trả.
          </p>
        </div>
        <button
          type="button"
          className="earnings-refresh"
          onClick={() => void load()}
        >
          Làm mới
        </button>
      </header>

      <section className="earnings-summary" aria-label="Số dư thu nhập">
        <article className="earnings-balance">
          <span className="earnings-summary-icon">
            <Icon name="wallet" />
          </span>
          <div>
            <small>Có thể rút</small>
            <strong>{formatCurrency(data.balance.availableVnd)}</strong>
            <p>Mức tối thiểu {formatCurrency(data.minimumWithdrawalVnd)}</p>
          </div>
          <button
            type="button"
            disabled={
              data.balance.availableVnd < data.minimumWithdrawalVnd ||
              data.balance.processingVnd > 0
            }
            onClick={() =>
              setDialog(data.destination ? 'withdraw' : 'destination')
            }
          >
            {data.destination ? 'Rút toàn bộ số dư' : 'Thiết lập nơi nhận'}
          </button>
        </article>
        <article>
          <span className="earnings-summary-icon">
            <Icon name="clock" />
          </span>
          <div>
            <small>Đang chờ đủ điều kiện</small>
            <strong>{formatCurrency(data.balance.pendingSettlementVnd)}</strong>
            <p>Khả dụng sau {data.settlementHoldDays} ngày</p>
          </div>
        </article>
        <article>
          <span className="earnings-summary-icon">
            <Icon name="paid" />
          </span>
          <div>
            <small>Đã thanh toán</small>
            <strong>{formatCurrency(data.balance.paidVnd)}</strong>
            <p>
              {data.balance.processingVnd > 0
                ? `${formatCurrency(data.balance.processingVnd)} đang xử lý`
                : 'Không có khoản đang xử lý'}
            </p>
          </div>
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
          <button type="button" onClick={() => setDialog('destination')}>
            Thiết lập
          </button>
        </section>
      )}

      <div className="earnings-content">
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
                  <span
                    className={`earnings-dot is-${earning.status.toLowerCase()}`}
                  />
                  <div>
                    <strong>
                      Phiên hoàn thành ngày {formatDate(earning.earnedAt)}
                    </strong>
                    <small>
                      {earning.status === 'PENDING_SETTLEMENT'
                        ? `Có thể rút từ ${formatDate(earning.settlementAvailableAt)}`
                        : earningLabels[earning.status]}
                    </small>
                  </div>
                  <span
                    className={`earnings-status is-${earning.status.toLowerCase()}`}
                  >
                    {earningLabels[earning.status]}
                  </span>
                  <b>{formatCurrency(earning.earningAmountVnd)}</b>
                </article>
              ))}
            </div>
          ) : (
            <div className="earnings-empty">
              <span aria-hidden="true">◇</span>
              <h3>Chưa có thu nhập được ghi nhận</h3>
              <p>
                Khoản thu sẽ xuất hiện khi một phiên đủ bằng chứng đã hoàn thành
                và credit được sử dụng.
              </p>
            </div>
          )}
        </section>
        <aside className="earnings-side">
          <section className="earnings-destination">
            <span>Nơi nhận tiền</span>
            {data.destination ? (
              <>
                <h2>
                  {data.destination.destinationType === 'MOMO_WALLET'
                    ? 'Ví MoMo'
                    : 'Tài khoản ngân hàng'}
                </h2>
                <strong>{data.destination.displayHint}</strong>
                <p>Đã xác minh · {formatDate(data.destination.verifiedAt)}</p>
                <button type="button" onClick={() => setDialog('destination')}>
                  Cập nhật
                </button>
              </>
            ) : (
              <>
                <h2>Chưa thiết lập</h2>
                <p>Thêm ví MoMo hoặc tài khoản ngân hàng để yêu cầu chi trả.</p>
                <button type="button" onClick={() => setDialog('destination')}>
                  Thiết lập
                </button>
              </>
            )}
          </section>
          <section className="earnings-policy">
            <strong>Cách tính khoản thu</strong>
            <p>
              Mỗi credit đã sử dụng cho một phiên đủ điều kiện tạo khoản thu{' '}
              <b>{formatCurrency(210000)}</b>. Đây không phải tỷ lệ trên giá gói
              đăng ký.
            </p>
          </section>
        </aside>
      </div>

      <section className="earnings-panel earnings-payouts">
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
                <div>
                  <strong>{formatCurrency(payout.amountVnd)}</strong>
                  <small>Gửi lúc {formatDate(payout.requestedAt)}</small>
                </div>
                <span
                  className={`earnings-status is-${payout.status.toLowerCase()}`}
                >
                  {payoutLabels[payout.status]}
                </span>
                <p>
                  {payout.completedAt
                    ? `Hoàn tất ${formatDate(payout.completedAt)}`
                    : 'Đang được hệ thống theo dõi'}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="earnings-empty is-compact">
            <p>Chưa có yêu cầu rút tiền nào.</p>
          </div>
        )}
      </section>

      <Dialog
        open={dialog === 'destination'}
        onOpenChange={(open) => !open && setDialog(null)}
        labelledBy="destination-title"
        describedBy="destination-description"
        className="earnings-dialog"
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
            aria-label="Đóng"
            onClick={() => setDialog(null)}
          >
            ×
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
        </div>
        <footer className="earnings-dialog-footer">
          <button type="button" onClick={() => setDialog(null)}>
            Hủy
          </button>
          <button
            type="button"
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
            aria-label="Đóng"
            onClick={() => setDialog(null)}
          >
            ×
          </button>
        </header>
        <div className="earnings-dialog-body">
          <div className="earnings-withdraw-total">
            <span>Số tiền yêu cầu</span>
            <strong>{formatCurrency(data.balance.availableVnd)}</strong>
          </div>
          <div className="earnings-withdraw-destination">
            <Icon name="bank" />
            <div>
              <small>Chuyển đến</small>
              <strong>
                {data.destination?.destinationType === 'MOMO_WALLET'
                  ? 'Ví MoMo'
                  : 'Tài khoản ngân hàng'}{' '}
                · {data.destination?.displayHint}
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
          <button type="button" onClick={() => setDialog(null)}>
            Quay lại
          </button>
          <button
            type="button"
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

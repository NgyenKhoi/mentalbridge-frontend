'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, CircleAlert, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PlanPayment } from '@/lib/consultation/billing-validation'
import { usePaymentStatus } from '../usePaymentStatus'
import './payment-panel.css'

// Common VietQR bank identifiers; an unknown BIN is shown as the BIN itself.
const BANKS: Record<string, string> = {
  '970403': 'Sacombank',
  '970405': 'Agribank',
  '970407': 'Techcombank',
  '970415': 'VietinBank',
  '970416': 'ACB',
  '970418': 'BIDV',
  '970422': 'MB Bank',
  '970423': 'TPBank',
  '970426': 'MSB',
  '970429': 'SCB',
  '970431': 'Eximbank',
  '970432': 'VPBank',
  '970436': 'Vietcombank',
  '970437': 'HDBank',
  '970441': 'VIB',
  '970443': 'SHB',
  '970448': 'OCB',
}

const RING = 2 * Math.PI * 28

function vnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`
}

// `focus` is false when the panel opened already in this view, so a reopened
// pending payment never pulls focus on page load.
function StateHeading({
  children,
  focus,
}: Readonly<{ children: string; focus: boolean }>) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focus) ref.current?.focus({ preventScroll: true })
  }, [focus])
  return (
    <h3 ref={ref} tabIndex={-1} className="pay-state-title">
      {children}
    </h3>
  )
}

type Props = Readonly<{
  payment: PlanPayment
  planName: string
  busy: boolean
  /** Move focus to the heading and scroll the panel into view (after checkout). */
  focusOnOpen: boolean
  onPayment: (payment: PlanPayment) => void
  onBack: () => void
  onRenew: () => void
  onActivated: () => void
}>

export default function PayosPaymentPanel({
  payment: initial,
  planName,
  busy,
  focusOnOpen,
  onPayment,
  onBack,
  onRenew,
  onActivated,
}: Props) {
  const reduce = useReducedMotion()
  const { payment, retrying, remainingSeconds, totalSeconds, expired } =
    usePaymentStatus(initial)
  const [copied, setCopied] = useState<{ label: string; ok: boolean } | null>(
    null,
  )
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!focusOnOpen) return
    root.current?.scrollIntoView?.({
      block: 'start',
      behavior: reduce ? 'auto' : 'smooth',
    })
    title.current?.focus({ preventScroll: true })
  }, [focusOnOpen, reduce])

  useEffect(() => {
    // Report only a server read that settled a pending payment, never a stale local copy.
    if (initial.status === 'PENDING' && payment.status !== 'PENDING')
      onPayment(payment)
  }, [payment, initial, onPayment])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 2_000)
    return () => clearTimeout(timer)
  }, [copied])

  const view =
    payment.status === 'SUCCEEDED'
      ? 'paid'
      : expired
        ? 'expired'
        : payment.status === 'PENDING'
          ? 'waiting'
          : 'failed'
  const [openedIn] = useState(view)
  const changed = view !== openedIn
  // Keep the header ring until the waiting view has finished leaving.
  const [ring, setRing] = useState(view === 'waiting')
  if (view === 'waiting' && !ring) setRing(true)
  // The exiting view is still mounted here: hold its height so the card does not collapse mid-swap.
  const prevView = useRef(view)
  useLayoutEffect(() => {
    const el = stage.current
    if (el && prevView.current !== view) {
      el.style.minHeight =
        view === 'waiting' ? '' : `${Math.min(el.offsetHeight, 360)}px`
    }
    prevView.current = view
  }, [view])
  const amount = payment.amount ?? payment.amountVnd
  const heading = `${payment.purpose === 'UPGRADE' ? 'Nâng cấp lên' : 'Đăng ký'} Gói ${planName} · ${vnd(amount)}`
  const bank = payment.bin ? (BANKS[payment.bin] ?? `BIN ${payment.bin}`) : null

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied({ label, ok: true })
    } catch {
      setCopied({ label, ok: false })
    }
  }

  const rows: Array<{ label: string; value: string; copy?: string }> = [
    ...(bank ? [{ label: 'Ngân hàng', value: bank }] : []),
    ...(payment.accountNumber
      ? [
          {
            label: 'Số tài khoản',
            value: payment.accountNumber,
            copy: payment.accountNumber,
          },
        ]
      : []),
    ...(payment.accountName
      ? [{ label: 'Chủ tài khoản', value: payment.accountName }]
      : []),
    { label: 'Số tiền', value: vnd(amount), copy: String(amount) },
    ...(payment.description
      ? [
          {
            label: 'Nội dung',
            value: payment.description,
            copy: payment.description,
          },
        ]
      : []),
  ]

  const steps = [
    'Đã tạo mã thanh toán',
    'Mở app ngân hàng, quét mã QR',
    'Chờ ngân hàng xác nhận',
    `Gói ${planName} được kích hoạt`,
  ]
  const copiedFailed = copied !== null && !copied.ok
  const live = retrying
    ? 'Mất kết nối, đang thử lại…'
    : remainingSeconds <= 60
      ? 'Mã sắp hết hạn. Đang chờ ngân hàng xác nhận…'
      : 'Đang chờ ngân hàng xác nhận…'
  const move = reduce
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.22 },
      }

  return (
    <div className="pay pay-rise" ref={root}>
      <div className="pay-head">
        <h3 ref={title} tabIndex={-1} className="pay-title">
          {heading}
        </h3>
        {ring && (
          <div
            className="pay-ring"
            role="timer"
            aria-label={`Mã còn hiệu lực ${clock(remainingSeconds)}`}
          >
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle className="pay-ring-track" cx="32" cy="32" r="28" />
              <circle
                className="pay-ring-fill"
                cx="32"
                cy="32"
                r="28"
                strokeDasharray={RING}
                strokeDashoffset={
                  RING * (1 - Math.min(1, remainingSeconds / totalSeconds))
                }
              />
            </svg>
            <div className="pay-ring-time" aria-hidden="true">
              {clock(remainingSeconds)}
            </div>
          </div>
        )}
      </div>

      <div ref={stage} className="pay-stage">
        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={() => {
            if (view !== 'waiting') setRing(false)
          }}
        >
          {view === 'waiting' && (
            <motion.div key="waiting" className="pay-grid" {...move}>
              <div className="pay-qr-col">
                <div
                  className="pay-qr"
                  role="img"
                  aria-label={`Mã QR chuyển khoản ${vnd(amount)}`}
                >
                  <QRCodeSVG
                    value={payment.qrCode ?? ''}
                    size={256}
                    level="M"
                    marginSize={4}
                  />
                </div>
                <p className="pay-hint">Quét bằng app ngân hàng bất kỳ</p>
              </div>
              <div className="pay-info">
                <ol className="pay-steps">
                  {steps.map((step, index) => (
                    <li
                      key={step}
                      className={
                        index === 0 ? 'is-done' : index === 1 ? 'is-now' : ''
                      }
                      aria-current={index === 1 ? 'step' : undefined}
                    >
                      <div className="pay-dot" aria-hidden="true">
                        {index === 0 ? <Check size={14} /> : index + 1}
                      </div>
                      <div className="pay-step-text">
                        {step}
                        {index === 0 && (
                          <span className="pay-sr"> (đã xong)</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <dl className="pay-kv">
                  {rows.map((row) => (
                    <div key={row.label} className="pay-kv-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                      {row.copy ? (
                        <button
                          type="button"
                          className="pay-copy"
                          onClick={() => void copy(row.label, row.copy ?? '')}
                        >
                          {copied?.ok && copied.label === row.label ? (
                            <Check size={14} aria-hidden="true" />
                          ) : (
                            <Copy size={14} aria-hidden="true" />
                          )}
                          {copied?.ok && copied.label === row.label
                            ? 'Đã sao chép'
                            : 'Sao chép'}
                          <span className="pay-sr">
                            {' '}
                            {row.label.toLowerCase()}
                          </span>
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </dl>
                <div className="pay-ack">
                  <span role="status">
                    {copied?.ok
                      ? `Đã sao chép ${copied.label.toLowerCase()}`
                      : ''}
                  </span>
                  {copiedFailed && (
                    <span role="alert" className="pay-ack-error">
                      <CircleAlert size={16} aria-hidden="true" />
                      Không sao chép được, hãy chọn và sao chép thủ công.
                    </span>
                  )}
                </div>
                <div className="pay-live" role="status">
                  <i className="pay-pulse" aria-hidden="true" />
                  {live}
                </div>
                {payment.provider === 'FAKE' && (
                  <p className="pay-test">
                    Thanh toán thử (không trừ tiền thật)
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {view === 'paid' && (
            <motion.div key="paid" className="pay-result" {...move}>
              <div className="pay-check" aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 30 30">
                  <path d="M7 15.5l5.5 5.5L23 10" />
                </svg>
              </div>
              <StateHeading focus={changed}>Đã nhận thanh toán</StateHeading>
              <p>Gói {planName} đã được kích hoạt cho tài khoản của bạn.</p>
              <button
                type="button"
                className="pay-primary"
                onClick={onActivated}
              >
                Xem quyền lợi gói {planName}
              </button>
            </motion.div>
          )}

          {view === 'expired' && (
            <motion.div key="expired" className="pay-result" {...move}>
              <StateHeading focus={changed}>
                Mã thanh toán đã hết hạn
              </StateHeading>
              <p>Chưa có khoản nào được ghi nhận.</p>
              <button
                type="button"
                className="pay-primary"
                disabled={busy}
                aria-busy={busy}
                onClick={onRenew}
              >
                {busy ? 'Đang tạo mã…' : 'Tạo mã mới'}
              </button>
            </motion.div>
          )}

          {view === 'failed' && (
            <motion.div key="failed" className="pay-result" {...move}>
              <StateHeading focus={changed}>
                {payment.status === 'CHARGEBACK'
                  ? 'Giao dịch cần được đối soát'
                  : payment.terminalReason === 'CANCELLED'
                    ? 'Giao dịch đã được hủy'
                    : 'Thanh toán chưa thành công'}
              </StateHeading>
              <p>
                {payment.status === 'CHARGEBACK'
                  ? 'Chúng tôi đang đối soát lại giao dịch này.'
                  : 'Quyền lợi chưa được kích hoạt từ giao dịch này.'}
              </p>
              {payment.status !== 'CHARGEBACK' && (
                <button type="button" className="pay-primary" onClick={onBack}>
                  Chọn lại gói
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* A failed view already offers "Chọn lại gói" with the same action. */}
      {view !== 'paid' &&
        !(view === 'failed' && payment.status !== 'CHARGEBACK') && (
          <button type="button" className="pay-back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại các gói
          </button>
        )}
    </div>
  )
}

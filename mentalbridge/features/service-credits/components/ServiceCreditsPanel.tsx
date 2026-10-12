'use client'

import {
  CalendarCheck2,
  CalendarX2,
  CircleCheck,
  History,
  Hourglass,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'
import {
  browserServiceCredits,
  ServiceCreditsBrowserError,
} from '../api/browser-client'
import styles from './ServiceCreditsPanel.module.css'

const PACKAGE_LABELS = {
  FREE: 'Miễn phí',
  PLUS: 'Plus',
  PREMIUM: 'Premium',
} as const
const EVENT_LABELS = {
  PROVISIONED: 'Đã cấp',
  HELD: 'Đã dành cho lịch hẹn',
  CONSUMED: 'Đã sử dụng',
  RELEASED: 'Đã hoàn lại',
  FORFEITED: 'Đã hết hiệu lực',
  ADJUSTED_RELEASED: 'Đã trả lại sau xem xét',
} as const

function formatInstant(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Không áp dụng'
}

function friendlyError(error: unknown) {
  if (error instanceof ServiceCreditsBrowserError) {
    if (error.code === 'SUBSCRIPTION_DOWNGRADE_NOT_SUPPORTED')
      return 'Không thể hạ gói trong kỳ hiện tại. Số lượt tư vấn hiện có không bị thay đổi.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (
      error.code === 'CONSULTATION_UNAVAILABLE' ||
      error.code === 'CONSULTATION_TIMEOUT'
    )
      return 'Chưa thể tải lượt tư vấn lúc này. Số lượt hiện có không bị thay đổi; vui lòng thử lại.'
    return error.message
  }
  return 'Không thể tải số lượt tư vấn. Vui lòng thử lại.'
}

export default function ServiceCreditsPanel() {
  const [account, setAccount] = useState<ServiceCreditAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAccount(await browserServiceCredits.get())
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    browserServiceCredits
      .get()
      .then(setAccount)
      .catch((caught: unknown) => setError(friendlyError(caught)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <section
        className={`${styles.panel} ${styles.feedback}`}
        aria-busy="true"
      >
        <p>Đang tải lượt tư vấn…</p>
      </section>
    )
  if (error)
    return (
      <section className={`${styles.panel} ${styles.feedback}`}>
        <p role="alert" className={styles.error}>
          {error}
        </p>
        <button type="button" onClick={() => void load()}>
          Thử lại
        </button>
      </section>
    )
  if (!account) return null

  const paid = account.source === 'PAID'
  const demo = account.source === 'DEMO'
  const balance = [
    { label: 'Còn lại', value: account.balance.available, Icon: Hourglass },
    {
      label: 'Đang giữ lịch',
      value: account.balance.held,
      Icon: CalendarCheck2,
    },
    { label: 'Đã sử dụng', value: account.balance.consumed, Icon: CircleCheck },
    {
      label: 'Hết hiệu lực',
      value: account.balance.forfeited,
      Icon: CalendarX2,
    },
  ]
  return (
    <section className={styles.panel} aria-labelledby="credit-title">
      <header className={styles.status}>
        <span className={styles.statusIcon} aria-hidden="true">
          <ShieldCheck size={20} />
        </span>
        <div className={styles.statusCopy}>
          <span className={styles.eyebrow}>Tài khoản hoạt động</span>
          <p>
            Bạn đang sử dụng{' '}
            <strong id="credit-title">
              Gói {PACKAGE_LABELS[account.packageCode]}
              {demo ? ' dùng thử' : ''}
            </strong>
            .{' '}
            {account.reservationCapacity.active === 0
              ? 'Hiện tại chưa có lịch hẹn tư vấn nào đang chờ.'
              : `Bạn đang giữ ${account.reservationCapacity.active} lịch hẹn tư vấn.`}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => setShowDetails((visible) => !visible)}
            aria-expanded={showDetails}
            aria-controls="service-credit-details"
          >
            <History size={16} aria-hidden="true" /> Lịch sử lượt tư vấn
          </button>
          <button type="button" onClick={() => void load()}>
            <RotateCw size={16} aria-hidden="true" /> Tải lại
          </button>
        </div>
      </header>

      <div className={styles.balance} aria-label="Số lượt tư vấn">
        {balance.map(({ label, value, Icon }) => (
          <div key={label} className={styles.metric}>
            <span>{label}</span>
            <strong>
              {value}
              <small> buổi</small>
            </strong>
            <span className={styles.metricIcon} aria-hidden="true">
              <Icon size={18} />
            </span>
          </div>
        ))}
      </div>

      <div
        id="service-credit-details"
        className={styles.details}
        hidden={!showDetails}
      >
        <section className={styles.capacity} aria-labelledby="capacity-title">
          <div>
            <span className={styles.eyebrow}>Giới hạn lịch đang giữ</span>
            <h2 id="capacity-title">
              {account.reservationCapacity.active}/
              {account.reservationCapacity.maximum} lịch
            </h2>
          </div>
          <p>
            {account.reservationCapacity.maximum === 0
              ? 'Gói hiện tại chưa thể giữ lịch tư vấn.'
              : account.reservationCapacity.remaining === 0
                ? 'Bạn đã đạt giới hạn lịch đang chờ, đã xác nhận hoặc đang diễn ra. Lượt tư vấn còn lại không làm tăng giới hạn này.'
                : `Bạn có thể giữ thêm ${account.reservationCapacity.remaining} lịch. Đây là giới hạn riêng, không phải số lượt tư vấn còn lại.`}
          </p>
        </section>

        <dl className={styles.period}>
          <div>
            <dt>Bắt đầu kỳ</dt>
            <dd>{formatInstant(account.periodStart)}</dd>
          </div>
          <div>
            <dt>Kết thúc kỳ</dt>
            <dd>{formatInstant(account.periodEnd)}</dd>
          </div>
          <div>
            <dt>Nguồn</dt>
            <dd>
              {demo ? 'Demo' : paid ? 'Đã thanh toán' : 'Mặc định miễn phí'}
            </dd>
          </div>
        </dl>

        <div className={styles.upgrade}>
          {account.packageCode === 'FREE' && (
            <p>
              Có thể nâng cấp lên Plus hoặc Premium khi luồng thanh toán được
              mở.
            </p>
          )}
          {account.packageCode === 'PLUS' && (
            <p>
              Có thể nâng cấp lên Premium; hệ thống chỉ cấp thêm phần chênh lệch
              của kỳ hiện tại.
            </p>
          )}
          {account.packageCode === 'PREMIUM' && (
            <p>
              Đây là gói cao nhất. Không có thao tác hạ gói hoặc hoàn tiền trong
              luồng này.
            </p>
          )}
        </div>

        <div className={styles.history}>
          <h2>Lịch sử lượt tư vấn</h2>
          {account.history.length === 0 ? (
            <p>Chưa có thay đổi nào về lượt tư vấn.</p>
          ) : (
            <ul>
              {account.history.map((event) => (
                <li key={event.eventId}>
                  <span>{EVENT_LABELS[event.eventType]}</span>
                  <small>
                    {event.source === 'DEMO' ? 'Demo' : 'Đã thanh toán'} ·{' '}
                    {formatInstant(event.occurredAt)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

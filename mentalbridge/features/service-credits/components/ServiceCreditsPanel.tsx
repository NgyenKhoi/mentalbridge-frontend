'use client'

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
      <section className={styles.panel} aria-busy="true">
        <p>Đang tải lượt tư vấn…</p>
      </section>
    )
  if (error)
    return (
      <section className={styles.panel}>
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
  return (
    <section className={styles.panel} aria-labelledby="credit-title">
      <header>
        <div>
          <span className={styles.eyebrow}>Gói hiện tại</span>
          <h1 id="credit-title">{PACKAGE_LABELS[account.packageCode]}</h1>
          <p>
            {demo
              ? 'Lượt tư vấn dùng thử — không phải quyền lợi đã thanh toán.'
              : paid
                ? 'Lượt tư vấn thuộc kỳ dịch vụ đã thanh toán.'
                : 'Gói miễn phí không bao gồm lượt tư vấn.'}
          </p>
        </div>
        <button type="button" onClick={() => void load()}>
          Tải lại
        </button>
      </header>

      <div className={styles.balance} aria-label="Số lượt tư vấn">
        <div className={styles.primary}>
          <strong>{account.balance.available}</strong>
          <span>Còn lại</span>
        </div>
        <div>
          <strong>{account.balance.held}</strong>
          <span>Đã dành cho lịch hẹn</span>
        </div>
        <div>
          <strong>{account.balance.consumed}</strong>
          <span>Đã sử dụng</span>
        </div>
        <div>
          <strong>{account.balance.forfeited}</strong>
          <span>Đã hết hiệu lực</span>
        </div>
      </div>

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
              ? 'Bạn đã đạt giới hạn lịch đang chờ hoặc đã xác nhận. Lượt tư vấn còn lại không làm tăng giới hạn này.'
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
            Có thể nâng cấp lên Plus hoặc Premium khi luồng thanh toán được mở.
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
    </section>
  )
}

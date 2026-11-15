'use client'

import { CalendarClock, CircleCheck, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { OwnSubscription } from '@/lib/consultation/billing-validation'
import {
  browserSubscription,
  SubscriptionBrowserError,
} from '../api/browser-client'
import styles from './SubscriptionCancellationPanel.module.css'

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : ''

function errorCopy(error: unknown) {
  if (error instanceof SubscriptionBrowserError) {
    if (error.code === 'SUBSCRIPTION_CANCELLATION_INVALID_STATE')
      return 'Gói này vừa thay đổi trạng thái. Hãy tải lại thông tin trước khi tiếp tục.'
    if (error.code === 'SUBSCRIPTION_NOT_FOUND')
      return 'Không tìm thấy gói thuộc tài khoản này. Hãy tải lại trang để kiểm tra.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }
  return 'Chưa thể hủy gói lúc này. Quyền lợi hiện tại chưa thay đổi; bạn có thể thử lại.'
}

export default function SubscriptionCancellationPanel() {
  const [subscription, setSubscription] = useState<OwnSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const pendingKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSubscription(await browserSubscription.current())
    } catch (caught) {
      setError(errorCopy(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void browserSubscription
      .current()
      .then((result) => {
        if (active) setSubscription(result)
      })
      .catch((caught) => {
        if (active) setError(errorCopy(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function cancel() {
    if (!subscription?.subscriptionId || subscription.status !== 'ACTIVE')
      return
    const key =
      pendingKey.current ?? `subscription-cancel-${crypto.randomUUID()}`
    pendingKey.current = key
    setPending(true)
    setError('')
    try {
      await browserSubscription.cancel(subscription.subscriptionId, key)
      setSubscription(await browserSubscription.current())
      pendingKey.current = null
    } catch (caught) {
      setError(errorCopy(caught))
    } finally {
      setPending(false)
    }
  }

  if (loading)
    return (
      <section className={styles.panel} aria-busy="true">
        <p>Đang tải trạng thái gói…</p>
      </section>
    )

  if (error && !subscription)
    return (
      <section className={styles.panel} role="alert">
        <p>{error}</p>
        <button type="button" className={styles.secondary} onClick={load}>
          <RefreshCw size={16} aria-hidden="true" /> Thử lại
        </button>
      </section>
    )

  if (
    !subscription ||
    ['NONE', 'PENDING_PAYMENT', 'ENDED'].includes(subscription.status)
  )
    return null

  const cancelled = subscription.status === 'CANCELLED'
  const finishing = subscription.status === 'CANCEL_PENDING_SESSION_END'

  return (
    <section
      className={styles.panel}
      aria-labelledby="current-subscription-title"
    >
      <div className={styles.heading}>
        <div>
          <span>GÓI HIỆN TẠI</span>
          <h2 id="current-subscription-title">{subscription.planCode}</h2>
        </div>
        <strong data-state={subscription.status}>
          {cancelled
            ? 'Đã hủy'
            : finishing
              ? 'Đang kết thúc'
              : 'Đang hoạt động'}
        </strong>
      </div>

      {subscription.status === 'ACTIVE' && (
        <>
          <p>
            Gói có hiệu lực đến {date(subscription.currentPeriodEnd)}. Bạn có
            thể hủy ngay; hệ thống không hoàn tiền và các lượt chưa dùng sẽ
            không còn hiệu lực.
          </p>
          <button
            type="button"
            className={styles.cancel}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {pending ? 'Đang hủy gói…' : 'Hủy gói hiện tại'}
          </button>
        </>
      )}

      {finishing && (
        <div className={styles.result} role="status">
          <CalendarClock size={20} aria-hidden="true" />
          <p>
            Quyền lợi trả phí đã kết thúc. Phiên tư vấn đang diễn ra vẫn được
            tiếp tục đến {date(subscription.liveSessionEndsAt)}.
          </p>
        </div>
      )}

      {cancelled && (
        <div className={styles.result} role="status">
          <CircleCheck size={20} aria-hidden="true" />
          <p>
            Gói đã được hủy từ {date(subscription.paidAccessEndedAt)}. Không có
            khoản hoàn tiền hoặc hạ gói được tạo.
          </p>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        request={
          confirming
            ? {
                title: 'Hủy gói hiện tại?',
                description:
                  'Quyền lợi trả phí sẽ kết thúc ngay. Lịch tư vấn tương lai và lượt chưa dùng sẽ bị hủy; giao dịch này không hoàn tiền.',
                confirmLabel: 'Xác nhận hủy gói',
                cancelLabel: 'Giữ gói',
              }
            : null
        }
        onResolve={(confirmed) => {
          setConfirming(false)
          if (confirmed) void cancel()
        }}
      />
    </section>
  )
}

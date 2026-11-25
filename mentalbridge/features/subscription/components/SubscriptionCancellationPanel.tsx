'use client'

import { CalendarClock, CircleCheck, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type {
  OwnSubscription,
  SubscriptionCancellation,
} from '@/lib/consultation/billing-validation'
import { SERVICE_PACKAGE_LABELS } from '@/lib/consultation/consultation-validation'
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

function definitiveErrorCopy(error: unknown) {
  if (error instanceof SubscriptionBrowserError) {
    if (error.code === 'SUBSCRIPTION_CANCELLATION_INVALID_STATE')
      return 'Gói này vừa thay đổi trạng thái. Hãy tải lại thông tin trước khi tiếp tục.'
    if (error.code === 'SUBSCRIPTION_NOT_FOUND')
      return 'Không tìm thấy gói thuộc tài khoản này. Hãy tải lại trang để kiểm tra.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }
  return 'Yêu cầu hủy gói đã bị từ chối. Hãy kiểm tra lại trạng thái trước khi tiếp tục.'
}

function loadErrorCopy(error: unknown) {
  if (
    error instanceof SubscriptionBrowserError &&
    error.code === 'UNAUTHENTICATED'
  )
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  return 'Chưa thể tải trạng thái gói từ máy chủ. Vui lòng thử kiểm tra lại.'
}

function isDefinitiveFailure(error: unknown) {
  return (
    error instanceof SubscriptionBrowserError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 429].includes(error.status)
  )
}

function receiptState(
  receipt: SubscriptionCancellation,
  current: OwnSubscription,
): OwnSubscription | null {
  if (
    receipt.subscriptionId !== current.subscriptionId ||
    !['CANCEL_PENDING_SESSION_END', 'CANCELLED'].includes(receipt.status)
  )
    return null
  return {
    subscriptionId: receipt.subscriptionId,
    planCode: receipt.planCode,
    status: receipt.status,
    currentPeriodStart: current.currentPeriodStart,
    currentPeriodEnd: receipt.currentPeriodEnd,
    cancellationRequestedAt: receipt.cancellationRequestedAt,
    paidAccessEndedAt: receipt.paidAccessEndedAt,
    liveAppointmentId: receipt.liveAppointmentId,
    liveSessionEndsAt: receipt.liveSessionEndsAt,
    generatedAt: receipt.generatedAt,
  }
}

type Props = Readonly<{ onConfirmedCancellation?: () => void }>

export default function SubscriptionCancellationPanel({
  onConfirmedCancellation,
}: Props) {
  const [subscription, setSubscription] = useState<OwnSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [reconciliationRequired, setReconciliationRequired] = useState(false)
  const pendingKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const latest = await browserSubscription.current()
      setSubscription(latest)
      setReconciliationRequired(false)
      if (
        latest.status === 'CANCELLED' ||
        latest.status === 'CANCEL_PENDING_SESSION_END'
      ) {
        pendingKey.current = null
        onConfirmedCancellation?.()
      }
    } catch (caught) {
      setError(loadErrorCopy(caught))
    } finally {
      setLoading(false)
    }
  }, [onConfirmedCancellation])

  useEffect(() => {
    let active = true
    void browserSubscription
      .current()
      .then((result) => {
        if (active) setSubscription(result)
      })
      .catch((caught) => {
        if (active) setError(loadErrorCopy(caught))
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
    const expectedSubscriptionId = subscription.subscriptionId
    try {
      const receipt = await browserSubscription.cancel(
        expectedSubscriptionId,
        key,
      )
      const accepted = receiptState(receipt, subscription)
      if (!accepted) {
        setReconciliationRequired(true)
        setError(
          'Máy chủ trả về biên nhận không khớp. Trạng thái chưa được xác minh; hãy kiểm tra lại trước khi thao tác tiếp.',
        )
        return
      }

      setSubscription(accepted)
      pendingKey.current = null
      setReconciliationRequired(false)
      onConfirmedCancellation?.()
      try {
        const refreshed = await browserSubscription.current()
        if (
          refreshed.subscriptionId !== expectedSubscriptionId ||
          !['CANCEL_PENDING_SESSION_END', 'CANCELLED'].includes(
            refreshed.status,
          )
        ) {
          throw new Error('subscription reconciliation mismatch')
        }
        setSubscription(refreshed)
      } catch {
        setError(
          'Gói đã được máy chủ xác nhận hủy, nhưng chưa thể làm mới toàn bộ thông tin. Hãy kiểm tra lại sau.',
        )
      }
    } catch (caught) {
      if (isDefinitiveFailure(caught)) {
        pendingKey.current = null
        setReconciliationRequired(
          caught instanceof SubscriptionBrowserError &&
            [
              'SUBSCRIPTION_CANCELLATION_INVALID_STATE',
              'SUBSCRIPTION_NOT_FOUND',
            ].includes(caught.code),
        )
        setError(definitiveErrorCopy(caught))
      } else {
        setReconciliationRequired(true)
        setError(
          'Kết quả yêu cầu chưa xác định vì kết nối bị gián đoạn. Không gửi yêu cầu mới; hãy kiểm tra trạng thái máy chủ.',
        )
        try {
          const reconciled = await browserSubscription.current()
          if (
            reconciled.subscriptionId === expectedSubscriptionId &&
            ['CANCEL_PENDING_SESSION_END', 'CANCELLED'].includes(
              reconciled.status,
            )
          ) {
            setSubscription(reconciled)
            pendingKey.current = null
            setReconciliationRequired(false)
            setError('')
            onConfirmedCancellation?.()
          }
        } catch {
          // The retained key and explicit recheck keep this ambiguous command safe.
        }
      }
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
          <h2 id="current-subscription-title">
            {SERVICE_PACKAGE_LABELS[subscription.planCode]}
          </h2>
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
            disabled={pending || reconciliationRequired}
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
        <div className={styles.error} role="alert">
          <p>{error}</p>
          {reconciliationRequired && (
            <button type="button" className={styles.secondary} onClick={load}>
              <RefreshCw size={16} aria-hidden="true" /> Kiểm tra trạng thái
            </button>
          )}
        </div>
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

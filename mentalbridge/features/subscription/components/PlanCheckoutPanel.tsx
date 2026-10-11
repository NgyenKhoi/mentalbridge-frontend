'use client'

import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { browserServiceCredits } from '@/features/service-credits/api/browser-client'
import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'
import type {
  PlanCode,
  ServicePlanCatalogue,
  ServicePlanVersion,
} from '@/lib/consultation/billing-validation'
import {
  browserSubscription,
  SubscriptionBrowserError,
} from '../api/browser-client'

const PLAN_COPY: Record<
  PlanCode,
  Readonly<{ eyebrow: string; description: string }>
> = {
  FREE: {
    eyebrow: 'CƠ BẢN',
    description:
      'Duy trì các công cụ tự chăm sóc thiết yếu và 5 phản hồi AI được gửi thành công mỗi ngày.',
  },
  PLUS: {
    eyebrow: 'ĐỒNG HÀNH',
    description:
      'Thêm kế hoạch hỗ trợ cá nhân và 4 lượt tư vấn trong mỗi kỳ dịch vụ.',
  },
  PREMIUM: {
    eyebrow: 'TOÀN DIỆN',
    description:
      'Mở rộng hỗ trợ chuyên sâu với 10 lượt tư vấn và đề xuất nâng cao trong mỗi kỳ.',
  },
}

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function friendlyError(error: unknown) {
  if (error instanceof SubscriptionBrowserError) {
    if (error.code === 'PAYMENT_CHECKOUT_DISABLED')
      return 'Thanh toán MoMo chưa được mở. Thông tin gói vẫn có thể xem bình thường.'
    if (
      error.code === 'SUBSCRIPTION_PAYMENT_PENDING' ||
      error.code === 'SUBSCRIPTION_UPGRADE_PENDING'
    )
      return 'Bạn đang có một giao dịch chờ xử lý. Vui lòng hoàn tất giao dịch hiện tại trước.'
    if (error.code === 'SUBSCRIPTION_DOWNGRADE_NOT_SUPPORTED')
      return 'Gói hiện tại không hỗ trợ thay đổi theo hướng này.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    return error.message
  }
  return 'Không thể tải thông tin gói lúc này. Vui lòng thử lại.'
}

async function fetchSubscriptionData() {
  const [catalogue, account] = await Promise.all([
    browserSubscription.catalogue(),
    browserServiceCredits.get(),
  ])
  return { catalogue, account }
}

function actionFor(
  plan: ServicePlanVersion,
  current: PlanCode,
  enabled: boolean,
  managed: boolean,
) {
  if (plan.planCode === 'FREE')
    return {
      label: current === 'FREE' ? 'Gói hiện tại' : 'Gói cơ bản',
      available: false,
    }
  if (plan.planCode === current)
    return { label: 'Gói hiện tại', available: false }
  if (current === 'PREMIUM' || (current === 'PLUS' && plan.planCode === 'PLUS'))
    return { label: 'Không áp dụng', available: false }
  if (!managed) return { label: 'Không áp dụng', available: false }
  if (!enabled) return { label: 'MoMo chưa mở', available: false }
  return {
    label:
      current === 'PLUS'
        ? 'Nâng cấp qua MoMo'
        : `Chọn ${plan.displayName} qua MoMo`,
    available: true,
  }
}

export default function PlanCheckoutPanel() {
  const [catalogue, setCatalogue] = useState<ServicePlanCatalogue | null>(null)
  const [account, setAccount] = useState<ServiceCreditAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<PlanCode | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchSubscriptionData()
      setCatalogue(result.catalogue)
      setAccount(result.account)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void fetchSubscriptionData()
      .then((result) => {
        if (!active) return
        setCatalogue(result.catalogue)
        setAccount(result.account)
      })
      .catch((caught) => {
        if (active) setError(friendlyError(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function checkout(plan: ServicePlanVersion) {
    setSubmitting(plan.planCode)
    setError('')
    try {
      const payment = await browserSubscription.checkout(
        plan.planVersionId,
        `subscription-${crypto.randomUUID()}`,
      )
      window.location.assign(payment.checkoutUrl)
    } catch (caught) {
      setError(friendlyError(caught))
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <section
        className="svc-comparison"
        aria-busy="true"
        aria-label="Đang tải các gói dịch vụ"
      >
        <div className="svc-tier-loading">
          Đang tải giá và quyền lợi từ hệ thống…
        </div>
      </section>
    )
  }

  if (!catalogue || !account) {
    return (
      <section className="svc-comparison svc-load-error">
        <p role="alert">{error}</p>
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden="true" /> Thử lại
        </button>
      </section>
    )
  }

  return (
    <section
      id="subscription-plans"
      className="svc-comparison"
      aria-labelledby="subscription-plans-title"
    >
      <div className="svc-section-heading">
        <span className="svc-kicker">
          <ShieldCheck size={14} aria-hidden="true" /> GIÁ VÀ QUYỀN LỢI TỪ HỆ
          THỐNG
        </span>
        <h2 id="subscription-plans-title">Chọn mức đồng hành phù hợp</h2>
        <p>
          Mỗi gói có giá VND, số lượt tư vấn và giới hạn lịch đang giữ riêng.
          MoMo là phương thức thanh toán duy nhất của luồng này.
        </p>
      </div>

      {error && (
        <p className="svc-checkout-error" role="alert">
          {error}
        </p>
      )}

      <div className="svc-tiers">
        {catalogue.plans.map((plan) => {
          const action = actionFor(
            plan,
            account.packageCode,
            catalogue.checkoutEnabled,
            account.packageCode === 'FREE' || account.source === 'PAID',
          )
          const busy = submitting === plan.planCode
          return (
            <article
              key={plan.planVersionId}
              className={`svc-tier svc-tier-${plan.planCode.toLowerCase()}`}
            >
              {plan.planCode === 'PLUS' && (
                <span className="svc-popular">PHỔ BIẾN</span>
              )}
              <div className="svc-tier-top">
                <span>{PLAN_COPY[plan.planCode].eyebrow}</span>
                <small>{plan.consultationCredits} lượt / kỳ</small>
              </div>
              <h3>{plan.displayName}</h3>
              <p>{PLAN_COPY[plan.planCode].description}</p>
              <div className="svc-tier-price">
                <strong>{formatVnd(plan.priceVnd)}</strong>
                <span>
                  / {plan.planCode === 'FREE' ? 'không thời hạn' : 'tháng'}
                </span>
              </div>
              <ul className="svc-tier-facts">
                <li>
                  <CheckCircle2 size={17} aria-hidden="true" />{' '}
                  <span>
                    <strong>{plan.consultationCredits} lượt tư vấn</strong>{' '}
                    trong mỗi kỳ, không cộng dồn
                  </span>
                </li>
                <li>
                  <CheckCircle2 size={17} aria-hidden="true" />{' '}
                  <span>
                    Giữ tối đa{' '}
                    <strong>{plan.maxActiveReservations} lịch</strong> cùng lúc
                  </span>
                </li>
                <li>
                  <CheckCircle2 size={17} aria-hidden="true" />{' '}
                  <span>
                    {plan.supportPlanEnabled
                      ? 'Có kế hoạch hỗ trợ cá nhân'
                      : 'Công cụ tự chăm sóc cơ bản'}
                  </span>
                </li>
              </ul>
              <button
                type="button"
                disabled={!action.available || submitting !== null}
                aria-busy={busy}
                onClick={() => void checkout(plan)}
              >
                {busy ? 'Đang tạo giao dịch…' : action.label}
                {action.available && !busy && (
                  <ExternalLink size={15} aria-hidden="true" />
                )}
              </button>
            </article>
          )
        })}
      </div>

      <p className="svc-price-note">
        Giá và quyền lợi do máy chủ xác nhận theo đúng phiên bản gói. Giao dịch
        chỉ kích hoạt sau khi MoMo xác nhận thành công; lượt tư vấn hết hạn cùng
        kỳ và không chuyển sang kỳ sau.
      </p>
    </section>
  )
}

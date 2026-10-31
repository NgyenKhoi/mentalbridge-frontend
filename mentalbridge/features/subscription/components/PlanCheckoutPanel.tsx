'use client'

import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { browserServiceCredits } from '@/features/service-credits/api/browser-client'
import PlanUpgradeContinue from '@/features/support-plan-access/PlanUpgradeContinue'
import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'
import type {
  PaymentProvider,
  PlanCode,
  PlanPayment,
  ServicePlanCatalogue,
  ServicePlanVersion,
} from '@/lib/consultation/billing-validation'
import {
  browserSubscription,
  SubscriptionBrowserError,
} from '../api/browser-client'
import PayosPaymentPanel from './PayosPaymentPanel'

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

const PROVIDER_LINE: Record<PaymentProvider, string> = {
  PAYOS: 'Thanh toán qua chuyển khoản ngân hàng (payOS).',
  MOMO: 'Thanh toán qua MoMo.',
  FAKE: 'Thanh toán thử, không trừ tiền thật.',
}

const PROVIDER_NAME: Record<PaymentProvider, string> = {
  PAYOS: 'payOS',
  MOMO: 'MoMo',
  FAKE: 'thanh toán thử',
}

// A pending payment the user can pay in the app: the server confirmed the QR.
const payableInApp = (payment: PlanPayment | null) =>
  payment?.status === 'PENDING' && !!payment.qrCode

function friendlyError(error: unknown) {
  if (error instanceof SubscriptionBrowserError) {
    if (error.code === 'PAYMENT_CHECKOUT_DISABLED')
      return 'Thanh toán chưa được mở. Thông tin gói vẫn có thể xem bình thường.'
    if (
      error.code === 'SUBSCRIPTION_PAYMENT_PENDING' ||
      error.code === 'SUBSCRIPTION_UPGRADE_PENDING'
    )
      return 'Bạn đang có một giao dịch chờ xử lý. Vui lòng hoàn tất giao dịch hiện tại trước.'
    if (error.code === 'SUBSCRIPTION_DOWNGRADE_NOT_SUPPORTED')
      return 'Gói hiện tại không hỗ trợ thay đổi theo hướng này.'
    if (error.code === 'SUBSCRIPTION_PRICING_POLICY_MISMATCH')
      return 'Gói hiện tại không thể chuyển sang gói thử nghiệm. Quyền lợi cũ vẫn được giữ nguyên.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    return 'Chưa thể xác nhận giao dịch. Hãy kiểm tra lại trạng thái trước khi thử tiếp.'
  }
  return 'Không thể tải thông tin gói lúc này. Vui lòng thử lại.'
}

async function fetchSubscriptionData() {
  const [catalogue, account, history] = await Promise.all([
    browserSubscription.catalogue(),
    browserServiceCredits.get(),
    browserSubscription.history(),
  ])
  return {
    catalogue,
    account,
    payment:
      history.items.find((item) => item.status === 'PENDING') ??
      history.items[0] ??
      null,
  }
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
  if (!enabled) return { label: 'Thanh toán chưa mở', available: false }
  return {
    label:
      current === 'PLUS'
        ? `Nâng cấp lên ${plan.displayName}`
        : `Chọn ${plan.displayName}`,
    available: true,
  }
}

export default function PlanCheckoutPanel() {
  const [catalogue, setCatalogue] = useState<ServicePlanCatalogue | null>(null)
  const [account, setAccount] = useState<ServiceCreditAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<PlanCode | null>(null)
  const [error, setError] = useState('')
  const [payment, setPayment] = useState<PlanPayment | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payFocus, setPayFocus] = useState(false)
  const checkoutIntent = useRef<{ planVersionId: string; key: string } | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchSubscriptionData()
      setCatalogue(result.catalogue)
      setAccount(result.account)
      setPayment(result.payment)
      setPayOpen(payableInApp(result.payment))
      setPayFocus(false)
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
        setPayment(result.payment)
        setPayOpen(payableInApp(result.payment))
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
      const intent =
        checkoutIntent.current?.planVersionId === plan.planVersionId
          ? checkoutIntent.current
          : {
              planVersionId: plan.planVersionId,
              key: `subscription-${crypto.randomUUID()}`,
            }
      checkoutIntent.current = intent
      const payment = await browserSubscription.checkout(
        plan.planVersionId,
        intent.key,
      )
      setPayment(payment)
      checkoutIntent.current = null
      setPayOpen(payableInApp(payment))
      setPayFocus(true)
      setSubmitting(null)
    } catch (caught) {
      setError(friendlyError(caught))
      setSubmitting(null)
    }
  }

  // An expired code is replaced: close it on the server first, then create a fresh one.
  async function renew() {
    const plan = catalogue?.plans.find(
      (item) => item.planVersionId === payment?.planVersionId,
    )
    if (!plan || !payment) return
    setSubmitting(plan.planCode)
    setError('')
    try {
      const latest =
        payment.status === 'PENDING'
          ? await browserSubscription.payment(payment.paymentId)
          : payment
      // A FAILED re-read is not shown: the fresh checkout below replaces it without flashing a failure.
      if (latest.status !== 'FAILED') setPayment(latest)
      if (latest.status === 'PENDING') {
        setError('Mã cũ đang được đóng. Vui lòng thử lại sau ít giây.')
        setSubmitting(null)
        return
      }
      // Only a confirmed FAILED payment may be replaced; success/chargeback stay as the server says.
      if (latest.status !== 'FAILED') {
        setSubmitting(null)
        return
      }
    } catch (caught) {
      setError(friendlyError(caught))
      setSubmitting(null)
      return
    }
    await checkout(plan)
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
          Mỗi gói có giá VND, số lượt tư vấn và giới hạn lịch đang giữ riêng.{' '}
          {PROVIDER_LINE[catalogue.paymentProvider]}
        </p>
      </div>

      {catalogue.plans.some(
        (plan) => plan.pricingPolicyVersion === 'sandbox-full-price-v1',
      ) && (
        <p className="svc-price-note svc-checkout-feedback">
          Gói thử nghiệm: giá và lượt tư vấn chỉ dùng để kiểm tra luồng dịch vụ.
          Nâng Plus lên Premium thu đủ giá Premium, không khấu trừ giá trị lượt
          còn lại. Lượt chưa dùng của Plus được thay thế sau khi xác nhận thành
          công; lịch đã giữ không thay đổi.
        </p>
      )}

      {payment && !payOpen && (
        <div className="svc-price-note svc-checkout-feedback">
          <p role="status">
            {payment.status === 'SUCCEEDED'
              ? 'Giao dịch đã được xác nhận thành công.'
              : payment.status === 'FAILED'
                ? 'Giao dịch chưa thành công. Quyền lợi không được kích hoạt từ giao dịch này.'
                : payment.status === 'CHARGEBACK'
                  ? 'Giao dịch cần được đối soát lại.'
                  : payableInApp(payment)
                    ? 'Bạn có một thanh toán đang chờ.'
                    : 'Giao dịch đang chờ xác nhận. Chưa kích hoạt quyền lợi mới.'}
          </p>
          {payableInApp(payment) ? (
            <button
              type="button"
              onClick={() => {
                setPayFocus(true)
                setPayOpen(true)
              }}
            >
              Tiếp tục thanh toán
            </button>
          ) : (
            payment.status === 'PENDING' && (
              <>
                <button
                  type="button"
                  disabled={loading || submitting !== null}
                  onClick={() => void load()}
                >
                  Kiểm tra trạng thái
                </button>
                {payment.checkoutUrl && (
                  <a href={payment.checkoutUrl} rel="noopener noreferrer">
                    Mở trang thanh toán của {PROVIDER_NAME[payment.provider]}
                  </a>
                )}
              </>
            )
          )}
        </div>
      )}

      <PlanUpgradeContinue account={account} />

      {error && (
        <p className="svc-checkout-error" role="alert">
          {error}
        </p>
      )}

      {payOpen && payment ? (
        <PayosPaymentPanel
          key={payment.paymentId}
          payment={payment}
          planName={
            catalogue.plans.find(
              (item) => item.planVersionId === payment.planVersionId,
            )?.displayName ?? payment.planCode
          }
          busy={submitting !== null}
          focusOnOpen={payFocus}
          onPayment={(next) => {
            setError('')
            setPayment(next)
          }}
          onBack={() => setPayOpen(false)}
          onRenew={() => void renew()}
          onActivated={() => window.location.reload()}
        />
      ) : (
        <>
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
                        <strong>{plan.maxActiveReservations} lịch</strong> cùng
                        lúc
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
                    disabled={
                      !action.available ||
                      submitting !== null ||
                      payment?.status === 'PENDING'
                    }
                    aria-busy={busy}
                    onClick={() => void checkout(plan)}
                  >
                    {busy ? 'Đang tạo giao dịch…' : action.label}
                    {action.available && !busy && (
                      <ArrowRight size={15} aria-hidden="true" />
                    )}
                  </button>
                </article>
              )
            })}
          </div>

          <p className="svc-price-note">
            Giá và quyền lợi do máy chủ xác nhận theo đúng phiên bản gói; lượt
            tư vấn hết hạn cùng kỳ và không chuyển sang kỳ sau.
          </p>
        </>
      )}
    </section>
  )
}

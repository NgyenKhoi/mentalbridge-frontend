import type {
  PlanPayment,
  AdminPaymentList,
  PlanPaymentHistory,
  ServicePlanCatalogue,
} from '@/lib/consultation/billing-validation'

export class SubscriptionBrowserError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function responseJson<T>(response: Response) {
  const value = (await response.json()) as T & { code?: string; title?: string }
  if (!response.ok) {
    throw new SubscriptionBrowserError(
      response.status,
      value.code ?? 'CONSULTATION_DEPENDENCY_FAILED',
      value.title ?? 'Không thể xử lý yêu cầu gói dịch vụ.',
    )
  }
  return value
}

export const browserSubscription = {
  async history() {
    return responseJson<PlanPaymentHistory>(
      await fetch('/api/consultation/payments', { cache: 'no-store' }),
    )
  },
  async payment(paymentId: string) {
    return responseJson<PlanPayment>(
      await fetch(
        `/api/consultation/payments/${encodeURIComponent(paymentId)}`,
        { cache: 'no-store' },
      ),
    )
  },
  async adminPayments() {
    return responseJson<AdminPaymentList>(
      await fetch('/api/consultation/admin/payments', { cache: 'no-store' }),
    )
  },
  async catalogue() {
    return responseJson<ServicePlanCatalogue>(
      await fetch('/api/consultation/service-plans', {
        cache: 'no-store',
        headers: { Accept: 'application/json, application/problem+json' },
      }),
    )
  },
  async checkout(planVersionId: string, idempotencyKey: string) {
    return responseJson<PlanPayment>(
      await fetch('/api/consultation/subscriptions/checkout', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json, application/problem+json',
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ planVersionId }),
      }),
    )
  },
}

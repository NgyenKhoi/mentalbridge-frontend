import type {
  PlanPayment,
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

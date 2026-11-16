import type { AxiosInstance } from 'axios'
import type { z } from 'zod'

import { ApiError } from '@/api/api-error'
import { commandKeySchema } from '@/appointments/appointment-contract'

import {
  paymentHistorySchema,
  planPaymentSchema,
  servicePlanCatalogueSchema,
  type PlanPayment,
  type ServicePlanCatalogue,
} from './subscription-contract'

export interface SubscriptionApi {
  catalogue(): Promise<ServicePlanCatalogue>
  payments(): Promise<z.infer<typeof paymentHistorySchema>>
  payment(paymentId: string): Promise<PlanPayment>
  checkout(planVersionId: string, key: string): Promise<PlanPayment>
}

function mismatch(): never {
  throw new ApiError({
    code: 'SUBSCRIPTION_CONTRACT_MISMATCH',
    status: 502,
    message: 'Subscription response identity mismatch.',
  })
}

export function createSubscriptionApi(client: AxiosInstance): SubscriptionApi {
  return {
    async catalogue() {
      return servicePlanCatalogueSchema.parse(
        (await client.get('/api/v1/service-plans')).data,
      )
    },
    async payments() {
      return paymentHistorySchema.parse(
        (await client.get('/api/v1/payments')).data,
      )
    },
    async payment(paymentId) {
      const value = planPaymentSchema.parse(
        (await client.get(`/api/v1/payments/${encodeURIComponent(paymentId)}`))
          .data,
      )
      if (value.paymentId !== paymentId) mismatch()
      return value
    },
    async checkout(planVersionId, key) {
      const value = planPaymentSchema.parse(
        (
          await client.post(
            '/api/v1/subscriptions/checkout',
            { planVersionId },
            { headers: { 'Idempotency-Key': commandKeySchema.parse(key) } },
          )
        ).data,
      )
      if (value.planVersionId !== planVersionId) mismatch()
      return value
    },
  }
}

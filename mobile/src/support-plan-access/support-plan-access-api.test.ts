import type { AxiosInstance } from 'axios'

import { ApiError } from '@/api/api-error'

import { createSupportPlanAccessApi } from './support-plan-access-api'
import {
  PAYMENT_ID_1,
  PLUS_PLAN_VERSION_ID,
  USER_A_SUBJECT,
  USER_B_SUBJECT,
  makeCatalogue,
  makeEntitlement,
  makePayment,
} from './support-plan-access-test-fixtures'

function makeAxiosMock() {
  return {
    get: jest.fn(),
    post: jest.fn(),
  } as unknown as AxiosInstance & { get: jest.Mock; post: jest.Mock }
}

describe('createSupportPlanAccessApi', () => {
  it('fetches Consultation entitlement and enforces matching authenticated subject', async () => {
    const client = makeAxiosMock()
    const api = createSupportPlanAccessApi(client, USER_A_SUBJECT)

    client.get.mockResolvedValueOnce({
      data: makeEntitlement({ accountId: USER_A_SUBJECT }),
    })
    const entitlement = await api.getEntitlement()
    expect(client.get).toHaveBeenCalledWith('/api/v1/service-credits')
    expect(entitlement.accountId).toBe(USER_A_SUBJECT)

    client.get.mockResolvedValueOnce({
      data: makeEntitlement({ accountId: USER_B_SUBJECT }),
    })
    await expect(api.getEntitlement()).rejects.toMatchObject({
      code: 'ENTITLEMENT_SUBJECT_MISMATCH',
    })
  })

  it('throws typed contract error when service-credits payload is malformed and preserves HTTP errors', async () => {
    const client = makeAxiosMock()
    const api = createSupportPlanAccessApi(client, USER_A_SUBJECT)

    client.get.mockResolvedValueOnce({ data: { packageCode: 'UNKNOWN' } })
    await expect(api.getEntitlement()).rejects.toMatchObject({
      code: 'ENTITLEMENT_CONTRACT_MISMATCH',
    })

    client.get.mockRejectedValueOnce(
      new ApiError({
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Consultation down',
      }),
    )
    await expect(api.getEntitlement()).rejects.toMatchObject({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    })
  })

  it('calls /api/v1/service-plans, starts PayOS checkout with Idempotency-Key, and reconciles payment identity', async () => {
    const client = makeAxiosMock()
    const api = createSupportPlanAccessApi(client, USER_A_SUBJECT)
    const idempotencyKey = '1234567890abcdef1234567890abcdef'

    client.get.mockResolvedValueOnce({ data: makeCatalogue() })
    const catalogue = await api.getServicePlans()
    expect(client.get).toHaveBeenCalledWith('/api/v1/service-plans')
    expect(catalogue.paymentProvider).toBe('PAYOS')

    client.post.mockResolvedValueOnce({ data: makePayment() })
    const payment = await api.startCheckout(
      PLUS_PLAN_VERSION_ID,
      idempotencyKey,
    )
    expect(client.post).toHaveBeenCalledWith(
      '/api/v1/subscriptions/checkout',
      { planVersionId: PLUS_PLAN_VERSION_ID },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
    expect(payment.paymentId).toBe(PAYMENT_ID_1)

    client.get.mockResolvedValueOnce({
      data: makePayment({ paymentId: '77777777-7777-4777-8777-777777777777' }),
    })
    await expect(api.getPayment(PAYMENT_ID_1)).rejects.toMatchObject({
      code: 'PAYMENT_IDENTITY_MISMATCH',
    })
  })
})

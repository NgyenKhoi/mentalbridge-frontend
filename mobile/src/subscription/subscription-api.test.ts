import { create } from 'axios'

import { createSubscriptionApi } from './subscription-api'

const planVersionId = '10000000-0000-4000-8000-000000000001'
const paymentId = '20000000-0000-4000-8000-000000000002'
const payment = {
  paymentId,
  subscriptionId: '30000000-0000-4000-8000-000000000003',
  planVersionId,
  planCode: 'PLUS' as const,
  planVersion: 'plus-v1',
  purpose: 'PURCHASE' as const,
  provider: 'PAYOS' as const,
  status: 'PENDING' as const,
  terminalReason: null,
  amountVnd: 5000,
  currency: 'VND' as const,
  expiresAt: '2026-11-16T02:00:00Z',
  createdAt: '2026-11-16T01:00:00Z',
  paidAt: null,
  failedAt: null,
}

describe('MB-711 subscription authority API', () => {
  it('preserves the command key and reconciles by authoritative payment id', async () => {
    const client = create()
    const post = jest.spyOn(client, 'post').mockResolvedValue({ data: payment })
    const get = jest.spyOn(client, 'get').mockResolvedValue({ data: payment })
    const api = createSubscriptionApi(client)
    await api.checkout(
      planVersionId,
      'subscription-11111111-1111-4111-8111-111111111111',
    )
    expect(post).toHaveBeenCalledWith(
      '/api/v1/subscriptions/checkout',
      { planVersionId },
      {
        headers: {
          'Idempotency-Key':
            'subscription-11111111-1111-4111-8111-111111111111',
        },
      },
    )
    await api.payment(paymentId)
    expect(get).toHaveBeenCalledWith(`/api/v1/payments/${paymentId}`)
  })

  it('rejects a mismatched payment receipt', async () => {
    const client = create()
    jest
      .spyOn(client, 'post')
      .mockResolvedValue({ data: { ...payment, planVersionId: paymentId } })
    await expect(
      createSubscriptionApi(client).checkout(
        planVersionId,
        'subscription-11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_CONTRACT_MISMATCH' })
  })
})

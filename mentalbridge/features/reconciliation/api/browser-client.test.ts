import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserCommercialReconciliation } from './browser-client'

afterEach(() => vi.unstubAllGlobals())

describe('commercial reconciliation browser client', () => {
  it('reads the direct DTO returned by every consultation BFF route', async () => {
    const body = { count: 1, items: [{ payoutId: 'owner-payout' }] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    )

    const reads = [
      () => browserCommercialReconciliation.getDiscrepancies(),
      () =>
        browserCommercialReconciliation.getProvenance({
          payoutId: 'owner-payout',
        }),
      () => browserCommercialReconciliation.getPayments({ limit: '51' }),
      () => browserCommercialReconciliation.getPayouts({ limit: '51' }),
      () => browserCommercialReconciliation.getPayoutDetail('owner-payout'),
      () =>
        browserCommercialReconciliation.getSubscriptionDetail(
          'owner-subscription',
        ),
    ]
    for (const read of reads) {
      await expect(read()).resolves.toEqual(body)
    }
  })
})

import { browserApiClient } from '@/lib/api/browser-client'
import type {
  AdminPayoutList,
  PayoutDestination,
  SavePayoutDestinationInput,
  SpecialistEarnings,
} from '@/lib/consultation/consultation-validation'

export const specialistEarningsBrowserClient = {
  async get() {
    return (
      await browserApiClient.get<SpecialistEarnings>(
        '/consultation/specialist/earnings',
      )
    ).data
  },
  async saveDestination(input: SavePayoutDestinationInput) {
    return (
      await browserApiClient.put<PayoutDestination>(
        '/consultation/specialist/payout-destination',
        input,
      )
    ).data
  },
  async createPayout(destinationId: string, idempotencyKey: string) {
    return (
      await browserApiClient.post<SpecialistEarnings>(
        '/consultation/specialist/payouts',
        { destinationId },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    ).data
  },
}

export const adminPayoutsBrowserClient = {
  async get() {
    return (
      await browserApiClient.get<AdminPayoutList>('/consultation/admin/payouts')
    ).data
  },
}

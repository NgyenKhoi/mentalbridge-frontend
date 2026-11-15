import { browserApiClient } from '@/lib/api/browser-client'
import type {
  AdminPayoutDestinationDetail,
  AdminPayoutDestinationList,
  AdminPayoutList,
  PayoutBankList,
  PayoutDestination,
  SavePayoutDestinationInput,
  SpecialistEarnings,
} from '@/lib/consultation/consultation-validation'
import type { AdminPayoutDetail } from '@/lib/consultation/reconciliation-validation'

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
  async banks() {
    return (
      await browserApiClient.get<PayoutBankList>(
        '/consultation/specialist/payout-banks',
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
  async detail(payoutId: string) {
    return (
      await browserApiClient.get<AdminPayoutDetail>(
        `/consultation/admin/payouts/${encodeURIComponent(payoutId)}`,
      )
    ).data
  },
  async retry(
    payoutId: string,
    expectedAttemptId: string,
    idempotencyKey: string,
  ) {
    return (
      await browserApiClient.post<AdminPayoutDetail>(
        `/consultation/admin/payouts/${encodeURIComponent(payoutId)}/retry`,
        { expectedAttemptId },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    ).data
  },
  async closeFailed(
    payoutId: string,
    expectedAttemptId: string,
    idempotencyKey: string,
  ) {
    return (
      await browserApiClient.post<AdminPayoutDetail>(
        `/consultation/admin/payouts/${encodeURIComponent(payoutId)}/close-failed`,
        { expectedAttemptId, reasonCode: 'DESTINATION_UNUSABLE' },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    ).data
  },
  async pendingDestinations() {
    return (
      await browserApiClient.get<AdminPayoutDestinationList>(
        '/consultation/admin/payout-destinations?status=PENDING_CONFIRMATION&limit=50',
      )
    ).data
  },
  async destinationDetail(destinationId: string) {
    return (
      await browserApiClient.get<AdminPayoutDestinationDetail>(
        `/consultation/admin/payout-destinations/${encodeURIComponent(destinationId)}`,
      )
    ).data
  },
  async confirmDestination(
    destinationId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ) {
    return (
      await browserApiClient.post<PayoutDestination>(
        `/consultation/admin/payout-destinations/${encodeURIComponent(destinationId)}/confirm`,
        { expectedVersion, reasonCode: 'ACCOUNT_HOLDER_CHECKED' },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    ).data
  },
}

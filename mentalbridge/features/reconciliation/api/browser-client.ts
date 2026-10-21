import type {
  AdminCommercialDiscrepancyReport,
  AdminCommercialProvenance,
  AdminPayoutDetail,
  AdminSubscriptionDetail,
} from '@/lib/consultation/reconciliation-validation'
import type { AdminPaymentList } from '@/lib/consultation/billing-validation'
import type { AdminPayoutList } from '@/lib/consultation/consultation-validation'

export const browserCommercialReconciliation = {
  async getDiscrepancies(): Promise<AdminCommercialDiscrepancyReport> {
    const response = await fetch(
      '/api/consultation/admin/commercial/discrepancies',
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch discrepancies: HTTP ${response.status}`)
    }
    const result = await response.json()
    return result.data
  },

  async getProvenance(
    query: Record<string, string>,
  ): Promise<AdminCommercialProvenance> {
    const params = new URLSearchParams(query).toString()
    const response = await fetch(
      `/api/consultation/admin/commercial/provenance?${params}`,
    )
    if (!response.ok) {
      throw new Error(`Failed to trace provenance: HTTP ${response.status}`)
    }
    const result = await response.json()
    return result.data
  },

  async getPayments(query?: Record<string, string>): Promise<AdminPaymentList> {
    const params = query ? `?${new URLSearchParams(query).toString()}` : ''
    const response = await fetch(`/api/consultation/admin/payments${params}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch payments: HTTP ${response.status}`)
    }
    const result = await response.json()
    return result.data
  },

  async getPayouts(query?: Record<string, string>): Promise<AdminPayoutList> {
    const params = query ? `?${new URLSearchParams(query).toString()}` : ''
    const response = await fetch(`/api/consultation/admin/payouts${params}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch payouts: HTTP ${response.status}`)
    }
    const result = await response.json()
    return result.data
  },

  async getPayoutDetail(payoutId: string): Promise<AdminPayoutDetail> {
    const response = await fetch(
      `/api/consultation/admin/payouts/${encodeURIComponent(payoutId)}`,
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch payout detail: HTTP ${response.status}`)
    }
    const result = await response.json()
    return result.data
  },

  async getSubscriptionDetail(
    subscriptionId: string,
  ): Promise<AdminSubscriptionDetail> {
    const response = await fetch(
      `/api/consultation/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
    )
    if (!response.ok) {
      throw new Error(
        `Failed to fetch subscription detail: HTTP ${response.status}`,
      )
    }
    const result = await response.json()
    return result.data
  },
}


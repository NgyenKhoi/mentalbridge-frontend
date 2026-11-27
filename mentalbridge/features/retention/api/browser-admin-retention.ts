import { browserApiClient } from '@/lib/api/browser-client'
import type {
  ApplyHoldRequest,
  DeletionRequest,
  DeletionRequestPage,
  RetentionExecutionRecord,
  RetentionPolicy,
} from '@/features/auth/api/identity-contract'

export const browserAdminRetention = {
  async getPolicies() {
    const response = await browserApiClient.get<RetentionPolicy[]>(
      '/admin/retention/policies',
    )
    return response.data
  },

  async triggerSweep(policyId: string) {
    const response = await browserApiClient.post<RetentionExecutionRecord>(
      `/admin/retention/policies/${encodeURIComponent(policyId)}/sweep`,
    )
    return response.data
  },

  async getDeletions(params?: {
    status?: string
    holdType?: string
    limit?: number
    page?: number
  }) {
    const response = await browserApiClient.get<DeletionRequestPage>(
      '/admin/retention/deletions',
      { params },
    )
    return response.data
  },

  async retryDeletion(requestId: string) {
    const response = await browserApiClient.post<DeletionRequest>(
      `/admin/retention/deletions/${encodeURIComponent(requestId)}/retry`,
    )
    return response.data
  },

  async applyHold(requestId: string, body: ApplyHoldRequest) {
    const response = await browserApiClient.post<DeletionRequest>(
      `/admin/retention/deletions/${encodeURIComponent(requestId)}/holds`,
      body,
    )
    return response.data
  },

  async releaseHold(requestId: string) {
    const response = await browserApiClient.delete<DeletionRequest>(
      `/admin/retention/deletions/${encodeURIComponent(requestId)}/holds`,
    )
    return response.data
  },
}

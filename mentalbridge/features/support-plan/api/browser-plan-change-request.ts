import { browserApiClient } from '@/lib/api/browser-client'
import type { PlanChangeRequest } from './support-plan-contract'

export async function createPlanChangeRequest(
  proposalId: string,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<PlanChangeRequest>(
      '/care/plan-change-requests',
      { proposalId },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data
}

export async function getPlanChangeRequest(
  proposalId: string,
  viewer: 'USER' | 'SPECIALIST',
) {
  const path =
    viewer === 'USER'
      ? '/care/plan-change-requests'
      : `/care/specialist/plan-change-requests/${encodeURIComponent(proposalId)}`
  return (
    await browserApiClient.get<PlanChangeRequest>(path, {
      params: viewer === 'USER' ? { proposalId } : undefined,
    })
  ).data
}

export async function decidePlanChangeRequest(
  request: PlanChangeRequest,
  decision: 'ACCEPT' | 'REJECT',
  idempotencyKey: string,
) {
  return (
    await browserApiClient.put<PlanChangeRequest>(
      `/care/plan-change-requests/${encodeURIComponent(request.requestId)}/decision`,
      { decision },
      {
        headers: {
          'If-Match': `"${request.version}"`,
          'Idempotency-Key': idempotencyKey,
        },
      },
    )
  ).data
}

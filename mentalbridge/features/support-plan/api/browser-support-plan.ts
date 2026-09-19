import { browserApiClient } from '@/lib/api/browser-client'
import type { SupportPlanDraft } from './support-plan-contract'

export async function proposeSupportPlanDraft(idempotencyKey: string) {
  return (
    await browserApiClient.post<SupportPlanDraft>(
      '/care/support-plans',
      undefined,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data
}

export async function getCurrentSupportPlanDraft() {
  return (await browserApiClient.get<SupportPlanDraft>('/care/support-plans'))
    .data
}

import { browserApiClient } from '@/lib/api/browser-client'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
  SupportPlanDraft,
  SupportPlanOccurrenceList,
  SupportPlanOccurrence,
} from './support-plan-contract'

export async function proposeSupportPlanDraft(idempotencyKey: string) {
  return (
    await browserApiClient.post<SupportPlanDraft>(
      '/care/support-plans',
      undefined,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data
}

export async function getSupportPlanOccurrences(from: string, through: string) {
  return (
    await browserApiClient.get<SupportPlanOccurrenceList>(
      '/care/support-plan-occurrences',
      { params: { from, through } },
    )
  ).data
}

export async function changeSupportPlanOccurrenceState(
  occurrenceId: string,
  version: number,
  state: 'COMPLETED' | 'SKIPPED',
) {
  return (
    await browserApiClient.put<SupportPlanOccurrence>(
      `/care/support-plan-occurrences/${encodeURIComponent(occurrenceId)}/state`,
      { state },
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function changeSupportPlanStatus(
  supportPlanId: string,
  version: number,
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
) {
  return (
    await browserApiClient.put<SupportPlan>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/status`,
      { status },
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function getCurrentSupportPlanDraft() {
  return (await browserApiClient.get<SupportPlanDraft>('/care/support-plans'))
    .data
}

export async function getCurrentSupportPlan() {
  return (
    await browserApiClient.get<SupportPlan>('/care/support-plans/current')
  ).data
}

export async function replaceSupportPlanChoices(
  supportPlanId: string,
  version: number,
  request: ReplaceSupportPlanChoicesRequest,
) {
  return (
    await browserApiClient.put<SupportPlan>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/choices`,
      request,
      {
        headers: {
          'If-Match': `"${version}"`,
        },
      },
    )
  ).data
}

export async function activateSupportPlan(
  supportPlanId: string,
  version: number,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<SupportPlan>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/activate`,
      undefined,
      {
        headers: {
          'If-Match': `"${version}"`,
          'Idempotency-Key': idempotencyKey,
        },
      },
    )
  ).data
}

import { browserApiClient } from '@/lib/api/browser-client'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
  SupportPlanDraft,
  SupportPlanHistoryPage,
  SupportPlanOccurrenceList,
  SupportPlanOccurrence,
  ReplaceSupportPlanOccurrenceEngagementRequest,
  ReplaceCurrentSupportPlanRequest,
  SupportPlanReplacementReview,
  SupportPlanV3,
  SupportPlanPersonalization,
  ReplaceSupportPlanPersonalizationRequest,
  UpdateActionScheduleRequest,
  SupportPlanContextualCompanionMessage,
} from './support-plan-contract'

export type SupportPlanPersonalizationAuthority = Readonly<{
  value: SupportPlanPersonalization
  etag: string
}>

function personalizationAuthority(
  value: SupportPlanPersonalization,
  etag: unknown,
): SupportPlanPersonalizationAuthority {
  const fallback = `"${value.revision}"`
  return {
    value,
    etag: typeof etag === 'string' && /^"[0-9]+"$/.test(etag) ? etag : fallback,
  }
}

export async function getSupportPlanPersonalization() {
  const response = await browserApiClient.get<SupportPlanPersonalization>(
    '/care/support-plan-personalization',
  )
  return personalizationAuthority(response.data, response.headers.etag)
}

export async function replaceSupportPlanPersonalization(
  request: ReplaceSupportPlanPersonalizationRequest,
  etag: string,
) {
  const response = await browserApiClient.put<SupportPlanPersonalization>(
    '/care/support-plan-personalization',
    request,
    { headers: { 'If-Match': etag } },
  )
  return personalizationAuthority(response.data, response.headers.etag)
}

export async function proposeSupportPlanDraft(
  idempotencyKey: string,
  purpose: 'INITIAL_CHECK' | 'REASSESSMENT' = 'INITIAL_CHECK',
) {
  return (
    await browserApiClient.post<SupportPlanDraft>(
      `/care/support-plans?purpose=${purpose}`,
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

export async function replaceSupportPlanOccurrenceEngagement(
  occurrenceId: string,
  version: number,
  request: ReplaceSupportPlanOccurrenceEngagementRequest,
) {
  return (
    await browserApiClient.put<SupportPlanOccurrence>(
      `/care/support-plan-occurrences/${encodeURIComponent(occurrenceId)}/engagement`,
      request,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function deleteSupportPlanOccurrenceEngagement(
  occurrenceId: string,
  version: number,
) {
  return (
    await browserApiClient.delete<SupportPlanOccurrence>(
      `/care/support-plan-occurrences/${encodeURIComponent(occurrenceId)}/engagement`,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function changeSupportPlanStatus(
  supportPlanId: string,
  version: number,
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
  completionReason?: 'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER',
) {
  return (
    await browserApiClient.put<SupportPlan>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/status`,
      { status, ...(completionReason ? { completionReason } : {}) },
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

export async function getSupportPlan(supportPlanId: string) {
  return (
    await browserApiClient.get<SupportPlan>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}`,
    )
  ).data
}

export async function getSupportPlanActions(supportPlanId: string) {
  return (
    await browserApiClient.get<SupportPlanV3>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/actions`,
    )
  ).data
}

export async function requestSupportPlanActionCompanionExplanation(
  supportPlanId: string,
  actionId: string,
  surface: 'TODAY' | 'PLAN',
  signal?: AbortSignal,
) {
  return (
    await browserApiClient.post<SupportPlanContextualCompanionMessage>(
      `/care/v2/support-plans/${encodeURIComponent(supportPlanId)}/actions/${encodeURIComponent(actionId)}/companion-explanation`,
      { surface },
      { signal },
    )
  ).data
}

export async function getCurrentSupportPlanDraftActions() {
  return (
    await browserApiClient.get<SupportPlanV3>(
      '/care/support-plans/current-draft/actions',
    )
  ).data
}

export async function replaceSupportPlanActionSchedule(
  supportPlanId: string,
  actionId: string,
  version: number,
  request: UpdateActionScheduleRequest,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.put<SupportPlanV3>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/actions/${encodeURIComponent(actionId)}/schedule`,
      request,
      {
        headers: {
          'If-Match': `"${version}"`,
          'Idempotency-Key': idempotencyKey,
        },
      },
    )
  ).data
}

export async function getSupportPlanHistory(cursor?: string) {
  return (
    await browserApiClient.get<SupportPlanHistoryPage>(
      '/care/support-plans/history',
      { params: { limit: 10, ...(cursor ? { cursor } : {}) } },
    )
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

export async function reviewSupportPlanReplacement(
  supportPlanId: string,
  version: number,
  request: ReplaceCurrentSupportPlanRequest,
) {
  return (
    await browserApiClient.post<SupportPlanReplacementReview>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/replacement-review`,
      request,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function replaceSupportPlan(
  supportPlanId: string,
  version: number,
  request: ReplaceCurrentSupportPlanRequest,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<SupportPlan>(
      `/care/support-plans/${encodeURIComponent(supportPlanId)}/replace`,
      request,
      {
        headers: {
          'If-Match': `"${version}"`,
          'Idempotency-Key': idempotencyKey,
        },
      },
    )
  ).data
}

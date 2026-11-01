import { browserApiClient } from '@/lib/api/browser-client'
import type {
  ActionOccurrence,
  ActionOccurrenceList,
  AdaptiveReviewConfirmation,
  AdaptiveSupportPlanReview,
  ChangeSupportPlanStatusRequest,
  ConfirmAdaptiveReviewOptionRequest,
  EmotionCheckInOccurrenceReconciliation,
  JournalOccurrenceReconciliation,
  NativeSupportPlanReplacementReview,
  PlanResourceActionsV1,
  ReplaceCurrentSupportPlanRequest,
  ReplaceSupportPlanOccurrenceEngagementRequest,
  SupportPlanActionHistory,
  SupportPlanV3,
} from './support-plan-contract'

const planPath = (id: string) =>
  `/care/v2/support-plans/${encodeURIComponent(id)}`
const occurrencePath = (id: string) =>
  `/care/v2/support-plan-occurrences/${encodeURIComponent(id)}`

export async function getNativeSupportPlanEvaluationSource(
  purpose: 'INITIAL_CHECK' | 'REASSESSMENT',
) {
  return (
    await browserApiClient.get<{ sourceSupportEvaluationId: string }>(
      '/care/v2/support-plans/evaluation-source',
      { params: { purpose } },
    )
  ).data.sourceSupportEvaluationId
}

export async function getCurrentSupportPlanActions() {
  return (
    await browserApiClient.get<SupportPlanV3>('/care/v2/support-plans/current')
  ).data
}
export async function getCurrentPlanResourceActions(
  localDate: string,
  signal?: AbortSignal,
) {
  return (
    await browserApiClient.get<PlanResourceActionsV1>(
      '/care/v2/support-plans/current/resource-actions',
      { params: { localDate }, signal },
    )
  ).data
}
export async function getCurrentNativeSupportPlanDraft() {
  return (
    await browserApiClient.get<SupportPlanV3>(
      '/care/v2/support-plans/current-draft',
    )
  ).data
}
export async function getSupportPlanActionModel(id: string) {
  return (await browserApiClient.get<SupportPlanV3>(planPath(id))).data
}
export async function getSupportPlanActionHistory(cursor?: string) {
  return (
    await browserApiClient.get<SupportPlanActionHistory>(
      '/care/v2/support-plans/history',
      { params: { limit: 10, ...(cursor ? { cursor } : {}) } },
    )
  ).data
}
export async function proposeNativeSupportPlanDraft(
  sourceSupportEvaluationId: string,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<SupportPlanV3>(
      '/care/v2/support-plans',
      { sourceSupportEvaluationId },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data
}
export async function activateNativeSupportPlan(
  id: string,
  version: number,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<SupportPlanV3>(
      `${planPath(id)}/activate`,
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
export async function changeNativeSupportPlanStatus(
  id: string,
  version: number,
  request: ChangeSupportPlanStatusRequest,
) {
  return (
    await browserApiClient.put<SupportPlanV3>(
      `${planPath(id)}/status`,
      request,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}
export async function reviewNativeSupportPlanReplacement(
  id: string,
  version: number,
  request: ReplaceCurrentSupportPlanRequest,
) {
  return (
    await browserApiClient.post<NativeSupportPlanReplacementReview>(
      `${planPath(id)}/replacement-review`,
      request,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}
export async function getAdaptiveSupportPlanReview(
  id: string,
  reassessmentSummaryId?: string,
) {
  return (
    await browserApiClient.get<AdaptiveSupportPlanReview>(
      `${planPath(id)}/adaptive-review`,
      reassessmentSummaryId ? { params: { reassessmentSummaryId } } : {},
    )
  ).data
}
export async function confirmAdaptiveReviewOption(
  id: string,
  version: number,
  request: ConfirmAdaptiveReviewOptionRequest,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<AdaptiveReviewConfirmation>(
      `${planPath(id)}/adaptive-review/confirm`,
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
export async function replaceWithNativeSupportPlan(
  id: string,
  version: number,
  request: ReplaceCurrentSupportPlanRequest,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<SupportPlanV3>(
      `${planPath(id)}/replace`,
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
export async function getSupportPlanActionOccurrences(
  from: string,
  through: string,
) {
  return (
    await browserApiClient.get<ActionOccurrenceList>(
      '/care/v2/support-plan-occurrences',
      { params: { from, through } },
    )
  ).data
}
export async function changeNativeActionOccurrenceState(
  id: string,
  version: number,
  state: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
) {
  return (
    await browserApiClient.put<ActionOccurrence>(
      `${occurrencePath(id)}/state`,
      { state },
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}
export async function reconcileEmotionCheckInOccurrence(id: string) {
  return (
    await browserApiClient.post<EmotionCheckInOccurrenceReconciliation>(
      `${occurrencePath(id)}/emotion-check-in/reconcile`,
    )
  ).data
}

export async function reconcileResourceOccurrence(id: string, version: number) {
  return (
    await browserApiClient.post<ActionOccurrence>(
      `${occurrencePath(id)}/resource/reconcile`,
      undefined,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function continueSupportPlanCycle(
  id: string,
  version: number,
  idempotencyKey: string,
) {
  return (
    await browserApiClient.post<SupportPlanV3>(
      `${planPath(id)}/cycle-continuation`,
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
export async function replaceNativeOccurrenceEngagement(
  id: string,
  version: number,
  request: ReplaceSupportPlanOccurrenceEngagementRequest,
) {
  return (
    await browserApiClient.put<ActionOccurrence>(
      `${occurrencePath(id)}/engagement`,
      request,
      { headers: { 'If-Match': `"${version}"` } },
    )
  ).data
}

export async function reconcileJournalOccurrence(
  id: string,
  journalId: string,
) {
  return (
    await browserApiClient.post<JournalOccurrenceReconciliation>(
      `${occurrencePath(id)}/journal/reconcile`,
      { journalId },
    )
  ).data
}

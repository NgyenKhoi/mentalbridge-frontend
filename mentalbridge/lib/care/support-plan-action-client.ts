import 'server-only'

import type {
  ChangeSupportPlanStatusRequest,
  ProposeNativeSupportPlanRequest,
  ReplaceCurrentSupportPlanRequest,
} from '@/features/support-plan/api/support-plan-contract'
import { ApiError } from '@/lib/api/api-error'
import { careRequest } from './care-client'
import {
  parseActionOccurrence,
  parseActionOccurrenceList,
  parseCanonicalSupportPlan,
  parseEmotionCheckInReconciliation,
  parseNativeSupportPlanReplacementReview,
  parseSupportPlanActionHistory,
} from './support-plan-action-validation'

const planPath = (id: string) =>
  `/api/v2/support-plans/${encodeURIComponent(id)}`
const occurrencePath = (id: string) =>
  `/api/v2/support-plan-occurrences/${encodeURIComponent(id)}`

function identity<T extends { supportPlanId: string }>(
  parse: (value: unknown) => T | null,
  id: string,
) {
  return (value: unknown) => {
    const parsed = parse(value)
    return parsed?.supportPlanId === id ? parsed : null
  }
}

export const supportPlanActionClient = {
  current(authorization: string, correlationId: string) {
    return careRequest({
      method: 'GET',
      path: '/api/v2/support-plans/current',
      authorization,
      correlationId,
      parseSuccess: parseCanonicalSupportPlan,
    })
  },
  draft(authorization: string, correlationId: string) {
    return careRequest({
      method: 'GET',
      path: '/api/v2/support-plans/current-draft',
      authorization,
      correlationId,
      parseSuccess: parseCanonicalSupportPlan,
    })
  },
  detail(authorization: string, id: string, correlationId: string) {
    return careRequest({
      method: 'GET',
      path: planPath(id),
      authorization,
      correlationId,
      parseSuccess: identity(parseCanonicalSupportPlan, id),
    })
  },
  history(
    authorization: string,
    limit: number,
    cursor: string | undefined,
    correlationId: string,
  ) {
    const query = new URLSearchParams({
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    })
    return careRequest({
      method: 'GET',
      path: `/api/v2/support-plans/history?${query}`,
      authorization,
      correlationId,
      parseSuccess: parseSupportPlanActionHistory,
    })
  },
  propose(
    authorization: string,
    body: ProposeNativeSupportPlanRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return careRequest({
      method: 'POST',
      path: '/api/v2/support-plans',
      body,
      idempotencyKey,
      authorization,
      correlationId,
      parseSuccess(value) {
        const parsed = parseCanonicalSupportPlan(value)
        return parsed?.representationMode === 'NATIVE_V3' &&
          parsed.status === 'DRAFT'
          ? parsed
          : null
      },
    })
  },
  activate(
    authorization: string,
    id: string,
    ifMatch: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return careRequest({
      method: 'POST',
      path: `${planPath(id)}/activate`,
      ifMatch,
      idempotencyKey,
      authorization,
      correlationId,
      parseSuccess: identity(parseCanonicalSupportPlan, id),
    })
  },
  status(
    authorization: string,
    id: string,
    ifMatch: number,
    body: ChangeSupportPlanStatusRequest,
    correlationId: string,
  ) {
    return careRequest({
      method: 'PUT',
      path: `${planPath(id)}/status`,
      body,
      ifMatch,
      authorization,
      correlationId,
      parseSuccess: identity(parseCanonicalSupportPlan, id),
    })
  },
  review(
    authorization: string,
    id: string,
    ifMatch: number,
    body: ReplaceCurrentSupportPlanRequest,
    correlationId: string,
  ) {
    return careRequest({
      method: 'POST',
      path: `${planPath(id)}/replacement-review`,
      body,
      ifMatch,
      authorization,
      correlationId,
      parseSuccess(value) {
        const parsed = parseNativeSupportPlanReplacementReview(value)
        return parsed?.proposedPlan.supportPlanId === id &&
          parsed.currentPlan.supportPlanId === body.currentSupportPlanId &&
          parsed.reassessmentSummary.summaryId === body.reassessmentSummaryId
          ? parsed
          : null
      },
    })
  },
  replace(
    authorization: string,
    id: string,
    ifMatch: number,
    body: ReplaceCurrentSupportPlanRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return careRequest({
      method: 'POST',
      path: `${planPath(id)}/replace`,
      body,
      ifMatch,
      idempotencyKey,
      authorization,
      correlationId,
      parseSuccess: identity(parseCanonicalSupportPlan, id),
    })
  },
  occurrences(
    authorization: string,
    from: string,
    through: string,
    correlationId: string,
  ) {
    const query = new URLSearchParams({ from, through })
    return careRequest({
      method: 'GET',
      path: `/api/v2/support-plan-occurrences?${query}`,
      authorization,
      correlationId,
      parseSuccess(value) {
        const parsed = parseActionOccurrenceList(value)
        return parsed?.from === from && parsed.through === through
          ? parsed
          : null
      },
    })
  },
  occurrenceState(
    authorization: string,
    id: string,
    ifMatch: number,
    state: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
    correlationId: string,
  ) {
    return careRequest({
      method: 'PUT',
      path: `${occurrencePath(id)}/state`,
      body: { state },
      ifMatch,
      authorization,
      correlationId,
      parseSuccess(value) {
        const parsed = parseActionOccurrence(value)
        return parsed?.occurrenceId === id &&
          parsed.representationMode === 'NATIVE_V3'
          ? parsed
          : null
      },
    })
  },
  async reconcile(authorization: string, id: string, correlationId: string) {
    const result = await careRequest({
      method: 'POST',
      path: `${occurrencePath(id)}/emotion-check-in/reconcile`,
      authorization,
      correlationId,
      parseSuccess: parseEmotionCheckInReconciliation,
    })
    if (result.occurrenceId !== id)
      throw new ApiError({
        message: 'Invalid occurrence identity.',
        code: 'CARE_MALFORMED_RESPONSE',
        status: 502,
      })
    return result
  },
}

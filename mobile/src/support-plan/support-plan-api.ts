import type { AxiosInstance } from 'axios'

import {
  occurrenceListSchema,
  occurrenceSchema,
  planChangeRequestSchema,
  reassessmentSummaryReferenceSchema,
  replacementReviewSchema,
  supportPlanHistorySchema,
  supportPlanSchema,
  type OccurrenceEngagement,
  type PlanChangeRequest,
  type ReplacementReview,
  type SupportPlan,
  type SupportPlanHistory,
  type SupportPlanOccurrence,
  type SupportPlanOccurrenceList,
} from './support-plan-contract'

export interface SupportPlanApi {
  getCurrent(): Promise<SupportPlan>
  getCurrentDraft(): Promise<SupportPlan>
  getHistory(): Promise<SupportPlanHistory>
  replaceChoices(
    plan: SupportPlan,
    slotSelections: readonly {
      slotId: string
      resourceId: string
      contentVersion: string
    }[],
  ): Promise<SupportPlan>
  activate(plan: SupportPlan, idempotencyKey: string): Promise<SupportPlan>
  changeStatus(
    plan: SupportPlan,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
  ): Promise<SupportPlan>
  getOccurrences(
    from: string,
    through: string,
  ): Promise<SupportPlanOccurrenceList>
  replaceOccurrenceEngagement(
    occurrence: SupportPlanOccurrence,
    engagement: OccurrenceEngagement,
  ): Promise<SupportPlanOccurrence>
  getPlanChangeRequest(proposalId: string): Promise<PlanChangeRequest>
  reviewPlanChangeRequest(
    proposalId: string,
    idempotencyKey: string,
  ): Promise<PlanChangeRequest>
  decidePlanChangeRequest(
    request: PlanChangeRequest,
    decision: 'ACCEPT' | 'REJECT',
    idempotencyKey: string,
  ): Promise<PlanChangeRequest>
  reviewReplacement(
    current: SupportPlan,
    draft: SupportPlan,
  ): Promise<ReplacementReview>
  replaceCurrent(
    current: SupportPlan,
    draft: SupportPlan,
    review: ReplacementReview,
    idempotencyKey: string,
  ): Promise<SupportPlan>
}

export function createSupportPlanApi(client: AxiosInstance): SupportPlanApi {
  return {
    async getCurrent() {
      const response = await client.get('/api/v1/support-plans/current')
      return supportPlanSchema.parse(response.data)
    },
    async getCurrentDraft() {
      const response = await client.get('/api/v1/support-plans/current-draft')
      return supportPlanSchema.parse(response.data)
    },
    async getHistory() {
      const response = await client.get('/api/v1/support-plans/history', {
        params: { limit: 10 },
      })
      return supportPlanHistorySchema.parse(response.data)
    },
    async replaceChoices(plan, slotSelections) {
      const response = await client.put(
        `/api/v1/support-plans/${encodeURIComponent(plan.supportPlanId)}/choices`,
        { slotSelections },
        { headers: { 'If-Match': `"${plan.version}"` } },
      )
      return supportPlanSchema.parse(response.data)
    },
    async activate(plan, idempotencyKey) {
      const response = await client.post(
        `/api/v1/support-plans/${encodeURIComponent(plan.supportPlanId)}/activate`,
        undefined,
        {
          headers: {
            'If-Match': `"${plan.version}"`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      return supportPlanSchema.parse(response.data)
    },
    async changeStatus(plan, status) {
      const response = await client.put(
        `/api/v1/support-plans/${encodeURIComponent(plan.supportPlanId)}/status`,
        { status },
        { headers: { 'If-Match': `"${plan.version}"` } },
      )
      return supportPlanSchema.parse(response.data)
    },
    async getOccurrences(from, through) {
      const response = await client.get('/api/v1/support-plan-occurrences', {
        params: { from, through },
      })
      return occurrenceListSchema.parse(response.data)
    },
    async replaceOccurrenceEngagement(occurrence, engagement) {
      const response = await client.put(
        `/api/v1/support-plan-occurrences/${encodeURIComponent(occurrence.occurrenceId)}/engagement`,
        engagement,
        { headers: { 'If-Match': `"${occurrence.version}"` } },
      )
      return occurrenceSchema.parse(response.data)
    },
    async getPlanChangeRequest(proposalId) {
      const response = await client.get(
        `/api/v1/plan-change-requests/by-proposal/${encodeURIComponent(proposalId)}`,
      )
      return planChangeRequestSchema.parse(response.data)
    },
    async reviewPlanChangeRequest(proposalId, idempotencyKey) {
      const response = await client.post(
        '/api/v1/plan-change-requests',
        { proposalId },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      return planChangeRequestSchema.parse(response.data)
    },
    async decidePlanChangeRequest(request, decision, idempotencyKey) {
      const response = await client.put(
        `/api/v1/plan-change-requests/${encodeURIComponent(request.requestId)}/decision`,
        { decision },
        {
          headers: {
            'If-Match': `"${request.version}"`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      return planChangeRequestSchema.parse(response.data)
    },
    async reviewReplacement(current, draft) {
      const summaryResponse = await client.get(
        '/api/v1/reassessment-summaries/current',
      )
      const summary = reassessmentSummaryReferenceSchema.parse(
        summaryResponse.data,
      )
      const response = await client.post(
        `/api/v1/support-plans/${encodeURIComponent(draft.supportPlanId)}/replacement-review`,
        {
          currentSupportPlanId: current.supportPlanId,
          currentVersion: current.version,
          reassessmentSummaryId: summary.summaryId,
        },
        { headers: { 'If-Match': `"${draft.version}"` } },
      )
      return replacementReviewSchema.parse(response.data)
    },
    async replaceCurrent(current, draft, review, idempotencyKey) {
      const summary = reassessmentSummaryReferenceSchema.parse(
        review.reassessmentSummary,
      )
      const response = await client.post(
        `/api/v1/support-plans/${encodeURIComponent(draft.supportPlanId)}/replace`,
        {
          currentSupportPlanId: current.supportPlanId,
          currentVersion: current.version,
          reassessmentSummaryId: summary.summaryId,
        },
        {
          headers: {
            'If-Match': `"${draft.version}"`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      return supportPlanSchema.parse(response.data)
    },
  }
}

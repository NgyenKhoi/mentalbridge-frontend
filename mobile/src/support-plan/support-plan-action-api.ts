import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { screeningEpisodeSchema } from '@/assessment/assessment-contract'
import {
  reassessmentSummaryReferenceSchema,
  updateActionScheduleRequestSchema,
  type UpdateActionScheduleRequest,
} from './support-plan-contract'
import {
  actionOccurrenceListSchema,
  actionOccurrenceSchema,
  canonicalSupportPlanSchema,
  emotionReconciliationSchema,
  journalReconciliationSchema,
  nativeReplacementReviewSchema,
  supportPlanActionHistorySchema,
  type ActionOccurrence,
  type ActionOccurrenceList,
  type CanonicalSupportPlan,
  type EmotionReconciliation,
  type JournalReconciliation,
  type NativeReplacementReview,
  type SupportPlanActionHistory,
} from './support-plan-action-contract'

const replacementInput = z
  .object({
    currentSupportPlanId: z.uuid(),
    currentVersion: z.number().int().nonnegative(),
    reassessmentSummaryId: z.uuid(),
  })
  .strict()
type ReplacementInput = z.infer<typeof replacementInput>
const keySchema = z.string().regex(/^[!-~]{16,128}$/)
const versionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
const idSchema = z.uuid()
const planPath = (id: string) =>
  `/api/v2/support-plans/${encodeURIComponent(idSchema.parse(id))}`
const occurrencePath = (id: string) =>
  `/api/v2/support-plan-occurrences/${encodeURIComponent(idSchema.parse(id))}`
const validator = (version: number) => ({
  'If-Match': `"${versionSchema.parse(version)}"`,
})

export interface SupportPlanActionApi {
  getProposalEvaluationId(
    purpose: 'INITIAL_CHECK' | 'REASSESSMENT',
  ): Promise<string>
  getReassessmentSummary(): Promise<
    z.infer<typeof reassessmentSummaryReferenceSchema>
  >
  replaceSchedule(
    id: string,
    version: number,
    actionId: string,
    request: UpdateActionScheduleRequest,
    key: string,
  ): Promise<CanonicalSupportPlan>
  getCurrent(): Promise<CanonicalSupportPlan>
  getDraft(): Promise<CanonicalSupportPlan>
  getDetail(id: string): Promise<CanonicalSupportPlan>
  getHistory(cursor?: string): Promise<SupportPlanActionHistory>
  propose(
    sourceSupportEvaluationId: string,
    key: string,
  ): Promise<CanonicalSupportPlan>
  activate(
    id: string,
    version: number,
    key: string,
  ): Promise<CanonicalSupportPlan>
  changeStatus(
    id: string,
    version: number,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
    completionReason?: 'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER',
  ): Promise<CanonicalSupportPlan>
  reviewReplacement(
    id: string,
    version: number,
    request: ReplacementInput,
  ): Promise<NativeReplacementReview>
  replace(
    id: string,
    version: number,
    request: ReplacementInput,
    key: string,
  ): Promise<CanonicalSupportPlan>
  getOccurrences(from: string, through: string): Promise<ActionOccurrenceList>
  changeOccurrenceState(
    id: string,
    version: number,
    state: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
  ): Promise<ActionOccurrence>
  reconcileEmotion(id: string): Promise<EmotionReconciliation>
  reconcileJournal(
    id: string,
    journalId: string,
  ): Promise<JournalReconciliation>
}

function ownedPlan(value: unknown, id: string) {
  const parsed = canonicalSupportPlanSchema.parse(value)
  if (parsed.supportPlanId !== id)
    throw new Error('SupportPlan response identity mismatch.')
  return parsed
}

/** Uses the app's authenticated Care Axios client, never a second token store. */
export function createSupportPlanActionApi(
  client: AxiosInstance,
): SupportPlanActionApi {
  return {
    async getProposalEvaluationId(purpose) {
      const parsedPurpose = z
        .enum(['INITIAL_CHECK', 'REASSESSMENT'])
        .parse(purpose)
      const episode = screeningEpisodeSchema.parse(
        (
          await client.get('/api/v1/screening-episodes/current', {
            params: { purpose: parsedPurpose },
          })
        ).data,
      )
      if (
        episode.purpose !== parsedPurpose ||
        episode.status !== 'COMPLETED' ||
        !episode.supportEvaluationId
      )
        throw new Error(
          'Complete the current screening before proposing a plan.',
        )
      return episode.supportEvaluationId
    },
    async getReassessmentSummary() {
      return reassessmentSummaryReferenceSchema.parse(
        (await client.get('/api/v1/reassessment-summaries/current')).data,
      )
    },
    async replaceSchedule(id, version, actionId, request, key) {
      return ownedPlan(
        (
          await client.put(
            `${planPath(id)}/actions/${encodeURIComponent(idSchema.parse(actionId))}/schedule`,
            updateActionScheduleRequestSchema.parse(request),
            {
              headers: {
                ...validator(version),
                'Idempotency-Key': keySchema.parse(key),
              },
            },
          )
        ).data,
        id,
      )
    },
    async getCurrent() {
      return canonicalSupportPlanSchema.parse(
        (await client.get('/api/v2/support-plans/current')).data,
      )
    },
    async getDraft() {
      return canonicalSupportPlanSchema.parse(
        (await client.get('/api/v2/support-plans/current-draft')).data,
      )
    },
    async getDetail(id) {
      return ownedPlan((await client.get(planPath(id))).data, id)
    },
    async getHistory(cursor) {
      const parsed =
        cursor === undefined
          ? undefined
          : z.string().min(1).max(256).parse(cursor)
      return supportPlanActionHistorySchema.parse(
        (
          await client.get('/api/v2/support-plans/history', {
            params: { limit: 10, ...(parsed ? { cursor: parsed } : {}) },
          })
        ).data,
      )
    },
    async propose(sourceSupportEvaluationId, key) {
      const body = {
        sourceSupportEvaluationId: idSchema.parse(sourceSupportEvaluationId),
      }
      const parsed = canonicalSupportPlanSchema.parse(
        (
          await client.post('/api/v2/support-plans', body, {
            headers: { 'Idempotency-Key': keySchema.parse(key) },
          })
        ).data,
      )
      if (
        parsed.representationMode !== 'NATIVE_V3' ||
        parsed.status !== 'DRAFT'
      )
        throw new Error('Invalid native proposal.')
      return parsed
    },
    async activate(id, version, key) {
      return ownedPlan(
        (
          await client.post(`${planPath(id)}/activate`, undefined, {
            headers: {
              ...validator(version),
              'Idempotency-Key': keySchema.parse(key),
            },
          })
        ).data,
        id,
      )
    },
    async changeStatus(id, version, status, completionReason) {
      const body = z
        .object({
          status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'DISCARDED']),
          completionReason: z
            .enum(['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'])
            .optional(),
        })
        .strict()
        .refine(
          (value) =>
            value.completionReason === undefined ||
            value.status === 'COMPLETED',
        )
        .parse({ status, ...(completionReason ? { completionReason } : {}) })
      return ownedPlan(
        (
          await client.put(`${planPath(id)}/status`, body, {
            headers: validator(version),
          })
        ).data,
        id,
      )
    },
    async reviewReplacement(id, version, request) {
      const body = replacementInput.parse(request)
      const parsed = nativeReplacementReviewSchema.parse(
        (
          await client.post(`${planPath(id)}/replacement-review`, body, {
            headers: validator(version),
          })
        ).data,
      )
      if (
        parsed.proposedPlan.supportPlanId !== id ||
        parsed.currentPlan.supportPlanId !== body.currentSupportPlanId ||
        parsed.reassessmentSummary.summaryId !== body.reassessmentSummaryId
      )
        throw new Error('Replacement response identity mismatch.')
      return parsed
    },
    async replace(id, version, request, key) {
      return ownedPlan(
        (
          await client.post(
            `${planPath(id)}/replace`,
            replacementInput.parse(request),
            {
              headers: {
                ...validator(version),
                'Idempotency-Key': keySchema.parse(key),
              },
            },
          )
        ).data,
        id,
      )
    },
    async getOccurrences(from, through) {
      z.iso.date().parse(from)
      z.iso.date().parse(through)
      if (
        from > through ||
        Date.parse(through) - Date.parse(from) > 30 * 86400000
      )
        throw new Error('Invalid bounded occurrence window.')
      const parsed = actionOccurrenceListSchema.parse(
        (
          await client.get('/api/v2/support-plan-occurrences', {
            params: { from, through },
          })
        ).data,
      )
      if (parsed.from !== from || parsed.through !== through)
        throw new Error('Occurrence window identity mismatch.')
      return parsed
    },
    async changeOccurrenceState(id, version, state) {
      const body = {
        state: z.enum(['SCHEDULED', 'COMPLETED', 'SKIPPED']).parse(state),
      }
      const parsed = actionOccurrenceSchema.parse(
        (
          await client.put(`${occurrencePath(id)}/state`, body, {
            headers: validator(version),
          })
        ).data,
      )
      if (
        parsed.occurrenceId !== id ||
        parsed.representationMode !== 'NATIVE_V3'
      )
        throw new Error('Occurrence response identity mismatch.')
      return parsed
    },
    async reconcileEmotion(id) {
      const parsed = emotionReconciliationSchema.parse(
        (await client.post(`${occurrencePath(id)}/emotion-check-in/reconcile`))
          .data,
      )
      if (parsed.occurrenceId !== id)
        throw new Error('Emotion reconciliation identity mismatch.')
      return parsed
    },
    async reconcileJournal(id, journalId) {
      const body = { journalId: idSchema.parse(journalId) }
      const parsed = journalReconciliationSchema.parse(
        (await client.post(`${occurrencePath(id)}/journal/reconcile`, body))
          .data,
      )
      if (parsed.occurrenceId !== id || parsed.journalId !== body.journalId)
        throw new Error('Journal reconciliation identity mismatch.')
      return parsed
    },
  }
}

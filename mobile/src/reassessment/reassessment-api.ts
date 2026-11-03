import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import {
  reassessmentContextSchema,
  reassessmentPeriodSchema,
  reassessmentSelfReportDraftSchema,
  reassessmentSelfReportSchema,
  reassessmentSummarySchema,
  type ReassessmentContext,
  type ReassessmentSelfReport,
  type ReassessmentSelfReportDraft,
  type ReassessmentSummary,
} from './reassessment-contract'

const keySchema = z.string().regex(/^[!-~]{16,128}$/)
const idSchema = z.uuid()

const composeRequestSchema = z
  .object({
    phq9AssessmentId: z.uuid(),
    gad7AssessmentId: z.uuid(),
    journalJobId: z.uuid(),
    previousPeriod: reassessmentPeriodSchema,
    currentPeriod: reassessmentPeriodSchema,
    selfReportId: z.uuid().optional(),
  })
  .strict()

export interface ReassessmentApi {
  getContext(): Promise<ReassessmentContext>
  getCurrentReport(): Promise<ReassessmentSelfReport>
  getCurrentSummary(): Promise<ReassessmentSummary>
  createReport(
    context: ReassessmentContext,
    draft: ReassessmentSelfReportDraft,
    key: string,
  ): Promise<ReassessmentSelfReport>
  replaceReport(
    current: ReassessmentSelfReport,
    draft: ReassessmentSelfReportDraft,
  ): Promise<ReassessmentSelfReport>
  compose(
    context: ReassessmentContext,
    journalJobId: string,
    selfReportId: string | undefined,
    key: string,
  ): Promise<ReassessmentSummary>
}

function samePeriod(
  left: ReassessmentContext['currentPeriod'],
  right: ReassessmentContext['currentPeriod'],
) {
  return left.startAt === right.startAt && left.endAt === right.endAt
}

/** Uses the same authenticated Care client as the rest of the owner journey. */
export function createReassessmentApi(client: AxiosInstance): ReassessmentApi {
  return {
    async getContext() {
      return reassessmentContextSchema.parse(
        (await client.get('/api/v1/reassessment-summaries/context')).data,
      )
    },
    async getCurrentReport() {
      return reassessmentSelfReportSchema.parse(
        (await client.get('/api/v1/reassessment-self-reports/current')).data,
      )
    },
    async getCurrentSummary() {
      return reassessmentSummarySchema.parse(
        (await client.get('/api/v1/reassessment-summaries/current')).data,
      )
    },
    async createReport(context, draft, key) {
      const response = await client.post(
        '/api/v1/reassessment-self-reports',
        {
          currentPeriod: reassessmentPeriodSchema.parse(context.currentPeriod),
          ...reassessmentSelfReportDraftSchema.parse(draft),
        },
        { headers: { 'Idempotency-Key': keySchema.parse(key) } },
      )
      const report = reassessmentSelfReportSchema.parse(response.data)
      if (!samePeriod(report.currentPeriod, context.currentPeriod))
        throw new Error('Reassessment self-report period mismatch.')
      return report
    },
    async replaceReport(current, draft) {
      const response = await client.put(
        `/api/v1/reassessment-self-reports/${encodeURIComponent(idSchema.parse(current.selfReportId))}`,
        reassessmentSelfReportDraftSchema.parse(draft),
        { headers: { 'If-Match': `"${current.version}"` } },
      )
      const report = reassessmentSelfReportSchema.parse(response.data)
      if (
        report.selfReportId !== current.selfReportId ||
        report.version <= current.version ||
        !samePeriod(report.currentPeriod, current.currentPeriod)
      )
        throw new Error('Reassessment self-report authority mismatch.')
      return report
    },
    async compose(context, journalJobId, selfReportId, key) {
      if (
        context.state !== 'READY' ||
        !context.phq9AssessmentId ||
        !context.gad7AssessmentId
      )
        throw new Error('Reassessment screening is incomplete.')
      const request = composeRequestSchema.parse({
        phq9AssessmentId: context.phq9AssessmentId,
        gad7AssessmentId: context.gad7AssessmentId,
        journalJobId,
        previousPeriod: context.previousPeriod,
        currentPeriod: context.currentPeriod,
        ...(selfReportId ? { selfReportId } : {}),
      })
      const summary = reassessmentSummarySchema.parse(
        (
          await client.post('/api/v1/reassessment-summaries', request, {
            headers: { 'Idempotency-Key': keySchema.parse(key) },
          })
        ).data,
      )
      if (
        !samePeriod(summary.currentPeriod, context.currentPeriod) ||
        summary.summaryVersion !== 'reassessment-summary-v2'
      )
        throw new Error('Reassessment summary authority mismatch.')
      return summary
    },
  }
}

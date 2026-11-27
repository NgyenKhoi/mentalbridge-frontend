import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'
import {
  sessionSummaryListSchema,
  sessionSummaryReuseConsentRequestSchema,
  sessionSummarySchema,
  updateAgreedNextStepRequestSchema,
  type SessionSummary,
  type SessionSummaryList,
  type UpdateAgreedNextStepRequest,
} from '@/specialist-summary/specialist-summary-contract'

export interface UserSummaryApi {
  list(appointmentId: string): Promise<SessionSummaryList>
  updateConsent(
    appointmentId: string,
    summaryId: string,
    approved: boolean,
    version: number,
  ): Promise<SessionSummary>
  updateStep(
    appointmentId: string,
    nextStepId: string,
    request: UpdateAgreedNextStepRequest,
    version: number,
  ): Promise<SessionSummary>
}

export function createUserSummaryApi(
  client: AxiosInstance,
  userAccountId: string,
): UserSummaryApi {
  const assertAuthority = (
    summary: SessionSummary,
    appointmentId: string,
  ): SessionSummary => {
    if (
      summary.appointmentId !== appointmentId ||
      summary.userAccountId !== userAccountId
    ) {
      throw new ApiError({
        code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH',
        message: 'The SessionSummary response does not match the owner.',
        status: 502,
      })
    }
    return summary
  }

  const parseResponse = (value: unknown, appointmentId: string) =>
    assertAuthority(sessionSummarySchema.parse(value), appointmentId)

  return {
    async list(appointmentId) {
      const id = z.uuid().parse(appointmentId)
      const response = await client.get(
        `/api/v1/appointments/${encodeURIComponent(id)}/session-summaries`,
      )
      const summaries = sessionSummaryListSchema.parse(response.data)
      summaries.items.forEach((summary) => assertAuthority(summary, id))
      return summaries
    },
    async updateConsent(appointmentId, summaryId, approved, version) {
      const appointment = z.uuid().parse(appointmentId)
      const summary = z.uuid().parse(summaryId)
      const body = sessionSummaryReuseConsentRequestSchema.parse({ approved })
      const currentVersion = z.number().int().nonnegative().parse(version)
      const response = await client.put(
        `/api/v1/session-summaries/${encodeURIComponent(summary)}/reuse-consent`,
        body,
        { headers: { 'If-Match': `"${currentVersion}"` } },
      )
      const updated = parseResponse(response.data, appointment)
      if (updated.id !== summary) {
        throw new ApiError({
          code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH',
          message: 'The SessionSummary response does not match the command.',
          status: 502,
        })
      }
      return updated
    },
    async updateStep(appointmentId, nextStepId, request, version) {
      const appointment = z.uuid().parse(appointmentId)
      const step = z.uuid().parse(nextStepId)
      const body = updateAgreedNextStepRequestSchema.parse(request)
      const currentVersion = z.number().int().nonnegative().parse(version)
      const response = await client.put(
        `/api/v1/agreed-next-steps/${encodeURIComponent(step)}`,
        body,
        { headers: { 'If-Match': `"${currentVersion}"` } },
      )
      const updated = parseResponse(response.data, appointment)
      if (!updated.agreedNextSteps.some((item) => item.id === step)) {
        throw new ApiError({
          code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH',
          message: 'The SessionSummary response does not contain the command.',
          status: 502,
        })
      }
      return updated
    },
  }
}

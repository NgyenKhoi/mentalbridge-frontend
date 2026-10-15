import type { AxiosInstance } from 'axios'

import { ApiError } from '@/api/api-error'

import {
  publishSessionSummaryRequestSchema,
  sessionSummaryListSchema,
  sessionSummarySchema,
  type PublishSessionSummaryRequest,
  type SessionSummary,
  type SessionSummaryList,
} from './specialist-summary-contract'

export interface SpecialistSummaryApi {
  list(appointmentId: string): Promise<SessionSummaryList>
  publish(
    appointmentId: string,
    request: PublishSessionSummaryRequest,
    idempotencyKey: string,
    currentVersion: number | undefined,
  ): Promise<SessionSummary>
}

export function createSpecialistSummaryApi(
  client: AxiosInstance,
  specialistAccountId: string,
): SpecialistSummaryApi {
  const assertAuthority = (
    summary: SessionSummary,
    appointmentId: string,
  ): SessionSummary => {
    if (
      summary.appointmentId !== appointmentId ||
      summary.specialistAccountId !== specialistAccountId
    ) {
      throw new ApiError({
        code: 'SESSION_SUMMARY_AUTHORITY_MISMATCH',
        message:
          'The SessionSummary response does not match the requested authority.',
        status: 502,
      })
    }
    return summary
  }

  return {
    async list(appointmentId) {
      const response = await client.get(
        `/api/v1/specialist/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
      )
      const summaries = sessionSummaryListSchema.parse(response.data)
      summaries.items.forEach((summary) =>
        assertAuthority(summary, appointmentId),
      )
      return summaries
    },
    async publish(appointmentId, request, idempotencyKey, currentVersion) {
      const body = publishSessionSummaryRequestSchema.parse(request)
      const response = await client.post(
        `/api/v1/specialist/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
        body,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
            ...(currentVersion === undefined
              ? {}
              : { 'If-Match': `"${currentVersion}"` }),
          },
        },
      )
      return assertAuthority(
        sessionSummarySchema.parse(response.data),
        appointmentId,
      )
    },
  }
}

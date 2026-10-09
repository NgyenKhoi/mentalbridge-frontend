import type { AxiosInstance } from 'axios'

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
): SpecialistSummaryApi {
  return {
    async list(appointmentId) {
      const response = await client.get(
        `/api/v1/specialist/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
      )
      return sessionSummaryListSchema.parse(response.data)
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
      return sessionSummarySchema.parse(response.data)
    },
  }
}

import { browserApiClient } from '@/lib/api/browser-client'
import type {
  PublishSessionSummaryInput,
  ReusableSessionSummaryList,
  SessionSummary,
  SessionSummaryList,
  UpdateAgreedNextStepInput,
} from '@/lib/consultation/session-summary-validation'

export const sessionSummaryBrowserClient = {
  async list(appointmentId: string, viewer: 'USER' | 'SPECIALIST') {
    const prefix =
      viewer === 'SPECIALIST' ? '/consultation/specialist' : '/consultation'
    return (
      await browserApiClient.get<SessionSummaryList>(
        `${prefix}/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
      )
    ).data
  },
  async reusable(appointmentId: string) {
    return (
      await browserApiClient.get<ReusableSessionSummaryList>(
        `/consultation/specialist/appointments/${encodeURIComponent(appointmentId)}/reusable-session-summaries`,
      )
    ).data
  },
  async publish(
    appointmentId: string,
    input: PublishSessionSummaryInput,
    idempotencyKey: string,
    currentVersion?: number,
  ) {
    return (
      await browserApiClient.post<SessionSummary>(
        `/consultation/specialist/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
        input,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
            ...(currentVersion === undefined
              ? {}
              : { 'If-Match': `"${currentVersion}"` }),
          },
        },
      )
    ).data
  },
  async updateConsent(summaryId: string, approved: boolean, version: number) {
    return (
      await browserApiClient.put<SessionSummary>(
        `/consultation/session-summaries/${encodeURIComponent(summaryId)}/reuse-consent`,
        { approved },
        { headers: { 'If-Match': `"${version}"` } },
      )
    ).data
  },
  async updateStep(
    nextStepId: string,
    input: UpdateAgreedNextStepInput,
    version: number,
  ) {
    return (
      await browserApiClient.put<SessionSummary>(
        `/consultation/agreed-next-steps/${encodeURIComponent(nextStepId)}`,
        input,
        { headers: { 'If-Match': `"${version}"` } },
      )
    ).data
  },
}

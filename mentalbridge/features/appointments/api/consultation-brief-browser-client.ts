import { browserApiClient } from '@/lib/api/browser-client'
import type {
  ConsultationBrief,
  ConsultationBriefAiDraftJob,
  ConsultationBriefDraftRequest,
  ConsultationBriefScreeningContextList,
  SpecialistConsultationBrief,
  SpecialistClientContinuityList,
} from './consultation-brief-contract'

const base = (appointmentId: string) =>
  `/care/consultation-briefs/${encodeURIComponent(appointmentId)}`

export const consultationBriefBrowserClient = {
  async screeningContexts() {
    return (
      await browserApiClient.get<ConsultationBriefScreeningContextList>(
        '/care/consultation-briefs/screening-contexts',
      )
    ).data
  },
  async get(appointmentId: string) {
    return (await browserApiClient.get<ConsultationBrief>(base(appointmentId)))
      .data
  },
  async save(
    appointmentId: string,
    request: ConsultationBriefDraftRequest,
    version?: number,
  ) {
    return (
      await browserApiClient.put<ConsultationBrief>(
        `${base(appointmentId)}/draft`,
        request,
        version === undefined
          ? undefined
          : { headers: { 'If-Match': `"${version}"` } },
      )
    ).data
  },
  async requestAiDraft(appointmentId: string, version: number) {
    return (
      await browserApiClient.post<ConsultationBriefAiDraftJob>(
        `${base(appointmentId)}/ai-draft-jobs`,
        undefined,
        {
          headers: {
            'If-Match': `"${version}"`,
            'Idempotency-Key': crypto.randomUUID(),
          },
        },
      )
    ).data
  },
  async aiDraftJob(appointmentId: string, jobId: string) {
    return (
      await browserApiClient.get<ConsultationBriefAiDraftJob>(
        `${base(appointmentId)}/ai-draft-jobs/${encodeURIComponent(jobId)}`,
      )
    ).data
  },
  async action(
    appointmentId: string,
    action: 'approve' | 'revoke',
    version: number,
  ) {
    return (
      await browserApiClient.post<ConsultationBrief>(
        `${base(appointmentId)}/${action}`,
        undefined,
        { headers: { 'If-Match': `"${version}"` } },
      )
    ).data
  },
  async delete(appointmentId: string, version: number) {
    await browserApiClient.delete(base(appointmentId), {
      headers: { 'If-Match': `"${version}"` },
    })
  },
  async specialist(appointmentId: string) {
    return (
      await browserApiClient.get<SpecialistConsultationBrief>(
        `/care/specialist/consultation-briefs/${encodeURIComponent(appointmentId)}`,
      )
    ).data
  },
  async specialistContinuity() {
    return (
      await browserApiClient.get<SpecialistClientContinuityList>(
        '/care/specialist/client-continuity',
      )
    ).data
  },
}

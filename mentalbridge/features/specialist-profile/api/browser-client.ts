import type {
  PendingProfiles,
  SpecialistApprovalStatus,
  SpecialistDecisionReason,
  SpecialistProfile,
  SpecialistProfileInput,
  SpecialistSuspensionResult,
} from '@/lib/consultation/consultation-validation'

export class BrowserConsultationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; etag: string | null }> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json, application/problem+json',
      ...init?.headers,
    },
  })
  const body = (await response.json().catch(() => null)) as
    { title?: string; code?: string } | T | null
  if (!response.ok) {
    const problem = body as { title?: string; code?: string } | null
    throw new BrowserConsultationError(
      response.status,
      problem?.code ?? 'REQUEST_FAILED',
      problem?.title ?? 'Không thể hoàn tất yêu cầu.',
    )
  }
  return { data: body as T, etag: response.headers.get('etag') }
}

export const browserConsultation = {
  own() {
    return call<SpecialistProfile>('/api/consultation/specialist-profile')
  },
  save(body: SpecialistProfileInput, etag: string | null) {
    return call<SpecialistProfile>('/api/consultation/specialist-profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(etag ? { 'If-Match': etag } : {}),
      },
      body: JSON.stringify(body),
    })
  },
  submit(etag: string) {
    return call<SpecialistProfile>(
      '/api/consultation/specialist-profile/submit',
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
  resubmit(etag: string) {
    return call<SpecialistProfile>(
      '/api/consultation/specialist-profile/resubmit',
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
  profiles(status: SpecialistApprovalStatus) {
    return call<PendingProfiles>(
      `/api/admin/specialist-profiles?status=${status}`,
    )
  },
  detail(id: string) {
    return call<SpecialistProfile>(
      `/api/admin/specialist-profiles/${encodeURIComponent(id)}`,
    )
  },
  approve(id: string, etag: string) {
    return call<SpecialistProfile>(
      `/api/admin/specialist-profiles/${encodeURIComponent(id)}/approve`,
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
  reject(id: string, etag: string, reasonCode: SpecialistDecisionReason) {
    return call<SpecialistProfile>(
      `/api/admin/specialist-profiles/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify({ reasonCode }),
      },
    )
  },
  suspend(id: string, etag: string, reasonCode: SpecialistDecisionReason) {
    return call<SpecialistSuspensionResult>(
      `/api/admin/specialist-profiles/${encodeURIComponent(id)}/suspend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify({ reasonCode }),
      },
    )
  },
  restore(id: string, etag: string) {
    return call<SpecialistProfile>(
      `/api/admin/specialist-profiles/${encodeURIComponent(id)}/restore`,
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
}

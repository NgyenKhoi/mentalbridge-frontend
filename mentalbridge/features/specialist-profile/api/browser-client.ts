import type {
  PendingProfiles,
  ProfileAmendment,
  ProfileAmendmentDetail,
  ProfileAmendments,
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
  ownAmendment(signal?: AbortSignal) {
    return call<ProfileAmendmentDetail>(
      '/api/consultation/specialist-profile/amendments/current',
      { signal },
    )
  },
  startAmendment(etag: string) {
    return call<ProfileAmendment>(
      '/api/consultation/specialist-profile/amendments',
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
  saveAmendment(id: string, body: SpecialistProfileInput, etag: string) {
    return call<ProfileAmendment>(
      `/api/consultation/specialist-profile/amendments/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: { 'If-Match': etag, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
  },
  submitAmendment(id: string, action: 'submit' | 'resubmit', etag: string) {
    return call<ProfileAmendment>(
      `/api/consultation/specialist-profile/amendments/${encodeURIComponent(id)}/${action}`,
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
  cancelAmendment(id: string, etag: string) {
    return call<ProfileAmendment>(
      `/api/consultation/specialist-profile/amendments/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', headers: { 'If-Match': etag } },
    )
  },
  profileAmendments(page = 0, signal?: AbortSignal) {
    return call<ProfileAmendments>(
      `/api/admin/specialist-profiles/amendments?page=${page}`,
      { signal },
    )
  },
  amendmentDetail(id: string, signal?: AbortSignal) {
    return call<ProfileAmendmentDetail>(
      `/api/admin/specialist-profiles/amendments/${encodeURIComponent(id)}`,
      { signal },
    )
  },
  decideAmendment(
    id: string,
    action: 'approve' | 'reject',
    etag: string,
    reasonCode?: SpecialistDecisionReason,
  ) {
    return call<ProfileAmendment>(
      `/api/admin/specialist-profiles/amendments/${encodeURIComponent(id)}/${action}`,
      {
        method: 'POST',
        headers: {
          'If-Match': etag,
          ...(action === 'reject'
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        ...(action === 'reject'
          ? { body: JSON.stringify({ reasonCode }) }
          : {}),
      },
    )
  },
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

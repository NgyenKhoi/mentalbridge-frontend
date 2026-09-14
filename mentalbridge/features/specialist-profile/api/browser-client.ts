import type {
  PendingProfiles,
  SpecialistProfile,
  SpecialistProfileInput,
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
  pending() {
    return call<PendingProfiles>('/api/admin/specialist-profiles')
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
}

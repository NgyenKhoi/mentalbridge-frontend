import type {
  AvailabilitySlot,
  AvailabilitySlotList,
  PublishAvailabilityInput,
} from '@/lib/consultation/consultation-validation'

export class AvailabilityBrowserError extends Error {
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
    throw new AvailabilityBrowserError(
      response.status,
      problem?.code ?? 'REQUEST_FAILED',
      problem?.title ?? 'Không thể hoàn tất yêu cầu.',
    )
  }
  return { data: body as T, etag: response.headers.get('etag') }
}

export const browserAvailability = {
  list() {
    return call<AvailabilitySlotList>(
      '/api/consultation/availability-slots?includeWithdrawn=true',
    )
  },
  publish(body: PublishAvailabilityInput, idempotencyKey: string) {
    return call<AvailabilitySlot>('/api/consultation/availability-slots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    })
  },
  withdraw(id: string, version: number) {
    return call<AvailabilitySlot>(
      `/api/consultation/availability-slots/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { 'If-Match': `"${version}"` } },
    )
  },
}

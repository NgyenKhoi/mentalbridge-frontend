import 'server-only'

import { readConsultationServerConfig } from '@/lib/config/server'
import {
  parseAvailabilitySlot,
  parseAvailabilitySlotList,
  parsePendingProfiles,
  parseProblem,
  parseProfile,
  type PendingProfiles,
  type AvailabilitySlot,
  type AvailabilitySlotList,
  type PublishAvailabilityInput,
  type SpecialistProfile,
  type SpecialistProfileInput,
} from './consultation-validation'

const MAX_RESPONSE_BYTES = 128 * 1024

export class ConsultationServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId?: string,
    cause?: unknown,
  ) {
    super(message, { cause })
  }
}

type Result<T> = Readonly<{ data: T; etag: string | null }>

async function json(response: Response) {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw malformed()
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
    throw malformed()
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw malformed(cause)
  }
}

function malformed(cause?: unknown) {
  return new ConsultationServiceError(
    502,
    'CONSULTATION_MALFORMED_RESPONSE',
    'Consultation returned an invalid response.',
    undefined,
    cause,
  )
}

async function request<T>(options: {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE'
  path: string
  token: string
  correlationId: string
  body?: unknown
  ifMatch?: string
  idempotencyKey?: string
  parse: (value: unknown) => T | null
}): Promise<Result<T>> {
  const config = readConsultationServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(options.path.replace(/^\//, ''), config.baseUrl),
      {
        method: options.method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${options.token}`,
          'X-Correlation-Id': options.correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {}),
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )
    const value = await json(response)
    if (!response.ok) {
      const problem = parseProblem(value, response.status)
      if (!problem) throw malformed()
      throw new ConsultationServiceError(
        problem.status,
        problem.code,
        problem.title,
        problem.correlationId,
      )
    }
    const parsed = options.parse(value)
    if (!parsed) throw malformed()
    return { data: parsed, etag: response.headers.get('etag') }
  } catch (error) {
    if (error instanceof ConsultationServiceError) throw error
    if (controller.signal.aborted)
      throw new ConsultationServiceError(
        504,
        'CONSULTATION_TIMEOUT',
        'Consultation request timed out.',
        undefined,
        error,
      )
    throw new ConsultationServiceError(
      503,
      'CONSULTATION_UNAVAILABLE',
      'Consultation is unavailable.',
      undefined,
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

const profileRequest = (
  method: 'GET' | 'PUT' | 'POST',
  path: string,
  token: string,
  correlationId: string,
  body?: SpecialistProfileInput,
  ifMatch?: string,
) =>
  request<SpecialistProfile>({
    method,
    path,
    token,
    correlationId,
    body,
    ifMatch,
    parse: parseProfile,
  })

export const consultationClient = {
  own(token: string, correlationId: string) {
    return profileRequest(
      'GET',
      '/api/v1/specialist-profile',
      token,
      correlationId,
    )
  },
  save(
    token: string,
    correlationId: string,
    body: SpecialistProfileInput,
    etag?: string,
  ) {
    return profileRequest(
      'PUT',
      '/api/v1/specialist-profile',
      token,
      correlationId,
      body,
      etag,
    )
  },
  submit(token: string, correlationId: string, etag: string) {
    return profileRequest(
      'POST',
      '/api/v1/specialist-profile/submit',
      token,
      correlationId,
      undefined,
      etag,
    )
  },
  pending(token: string, correlationId: string) {
    return request<PendingProfiles>({
      method: 'GET',
      path: '/api/v1/admin/specialist-profiles?limit=100',
      token,
      correlationId,
      parse: parsePendingProfiles,
    })
  },
  detail(token: string, correlationId: string, id: string) {
    return profileRequest(
      'GET',
      `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}`,
      token,
      correlationId,
    )
  },
  approve(token: string, correlationId: string, id: string, etag: string) {
    return profileRequest(
      'POST',
      `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}/approve`,
      token,
      correlationId,
      undefined,
      etag,
    )
  },
  availability(token: string, correlationId: string, query = '') {
    return request<AvailabilitySlotList>({
      method: 'GET',
      path: `/api/v1/availability-slots${query}`,
      token,
      correlationId,
      parse: parseAvailabilitySlotList,
    })
  },
  publishAvailability(
    token: string,
    correlationId: string,
    body: PublishAvailabilityInput,
    idempotencyKey: string,
  ) {
    return request<AvailabilitySlot>({
      method: 'POST',
      path: '/api/v1/availability-slots',
      token,
      correlationId,
      body,
      idempotencyKey,
      parse: parseAvailabilitySlot,
    })
  },
  withdrawAvailability(
    token: string,
    correlationId: string,
    id: string,
    etag: string,
  ) {
    return request<AvailabilitySlot>({
      method: 'DELETE',
      path: `/api/v1/availability-slots/${encodeURIComponent(id)}`,
      token,
      correlationId,
      ifMatch: etag,
      parse: parseAvailabilitySlot,
    })
  },
}

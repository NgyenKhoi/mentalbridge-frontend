import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import { readJournalServerConfig } from '@/lib/config/server'
import type {
  CompanionCommitment,
  CompanionState,
  CreateCompanionCommitmentRequest,
  ResolveCompanionCommitmentRequest,
  UpdateCompanionStateRequest,
} from './contract'
import { parseCompanionCommitment, parseCompanionState } from './validation'

type Options = Readonly<{
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  accessToken: string
  correlationId: string
  body?: unknown
}>

const MAX_RESPONSE_BYTES = 128 * 1024

const malformed = (cause?: unknown) =>
  new ApiError({
    message: 'Companion state returned an invalid response.',
    code: 'COMPANION_STATE_MALFORMED_RESPONSE',
    status: 502,
    cause,
  })

const outcomeUnknown = (cause?: unknown) =>
  new ApiError({
    message: 'The companion state mutation outcome is unknown.',
    code: 'COMPANION_STATE_MUTATION_OUTCOME_UNKNOWN',
    status: 503,
    cause,
  })

async function json(response: Response): Promise<unknown> {
  const type = response.headers.get('content-type') ?? ''
  const length = Number(response.headers.get('content-length'))
  if (
    !type.toLowerCase().includes('json') ||
    (Number.isFinite(length) && length > MAX_RESPONSE_BYTES)
  )
    throw malformed()
  try {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
      throw malformed()
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw malformed(error)
  }
}

async function call<T>(
  options: Options,
  parse: (value: unknown) => T | null,
): Promise<T> {
  const config = readJournalServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  const mutation = options.method !== 'GET'
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
          Authorization: `Bearer ${options.accessToken}`,
          'X-Correlation-Id': options.correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )
    if (!response.ok) {
      let body: unknown
      try {
        body = await json(response)
      } catch (error) {
        if (mutation) throw outcomeUnknown(error)
        throw error
      }
      if (isProblemDetails(body))
        throw new ApiError({
          message: body.title,
          code: body.code,
          status: response.status,
          correlationId: body.correlationId,
          problem: body,
        })
      if (mutation) throw outcomeUnknown(malformed())
      throw malformed()
    }
    try {
      const parsed = parse(await json(response))
      if (!parsed) throw malformed()
      return parsed
    } catch (error) {
      if (mutation) throw outcomeUnknown(error)
      throw error
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (mutation) throw outcomeUnknown(error)
    throw new ApiError({
      message: 'Companion state is unavailable.',
      code: 'COMPANION_STATE_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

const base = '/api/v1/companion-state'

export const companionStateClient = {
  get(accessToken: string, correlationId: string) {
    return call<CompanionState>(
      { method: 'GET', path: base, accessToken, correlationId },
      parseCompanionState,
    )
  },
  update(
    accessToken: string,
    body: UpdateCompanionStateRequest,
    correlationId: string,
  ) {
    return call<CompanionState>(
      { method: 'PATCH', path: base, accessToken, correlationId, body },
      parseCompanionState,
    )
  },
  createCommitment(
    accessToken: string,
    body: CreateCompanionCommitmentRequest,
    correlationId: string,
  ) {
    return call<CompanionCommitment>(
      {
        method: 'POST',
        path: `${base}/commitments`,
        accessToken,
        correlationId,
        body,
      },
      parseCompanionCommitment,
    )
  },
  resolveCommitment(
    accessToken: string,
    commitmentId: string,
    body: ResolveCompanionCommitmentRequest,
    correlationId: string,
  ) {
    return call<CompanionCommitment>(
      {
        method: 'PATCH',
        path: `${base}/commitments/${commitmentId}`,
        accessToken,
        correlationId,
        body,
      },
      (value) => {
        const parsed = parseCompanionCommitment(value)
        return parsed?.id === commitmentId ? parsed : null
      },
    )
  },
}

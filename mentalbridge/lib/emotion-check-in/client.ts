import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import { readJournalServerConfig } from '@/lib/config/server'
import type {
  EmotionCheckIn,
  EmotionCheckInCreate,
  EmotionCheckInValue,
} from './contract'
import { parseEmotionCheckIn } from './validation'

type Options = Readonly<{
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  accessToken: string
  correlationId: string
  body?: unknown
  idempotencyKey?: string
  revision?: number
}>

const malformed = (cause?: unknown) =>
  new ApiError({
    message: 'Emotion check-in returned an invalid response.',
    code: 'EMOTION_CHECK_IN_MALFORMED_RESPONSE',
    status: 502,
    cause,
  })

const outcomeUnknown = (cause?: unknown) =>
  new ApiError({
    message: 'The emotion check-in mutation outcome is unknown.',
    code: 'EMOTION_CHECK_IN_MUTATION_OUTCOME_UNKNOWN',
    status: 503,
    cause,
  })

async function json(response: Response): Promise<unknown> {
  const type = response.headers.get('content-type') ?? ''
  const length = Number(response.headers.get('content-length'))
  if (
    !type.toLowerCase().includes('json') ||
    (Number.isFinite(length) && length > 128 * 1024)
  )
    throw malformed()
  try {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > 128 * 1024)
      throw malformed()
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw malformed(error)
  }
}

async function call(options: Options): Promise<EmotionCheckIn> {
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
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : {}),
          ...(options.revision
            ? { 'If-Match-Revision': String(options.revision) }
            : {}),
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
      const parsed = parseEmotionCheckIn(await json(response))
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
      message: 'Emotion check-in is unavailable.',
      code: 'EMOTION_CHECK_IN_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export const emotionCheckInClient = {
  get(accessToken: string, localDate: string, correlationId: string) {
    return call({
      method: 'GET',
      path: `/api/v1/emotion-check-ins/${localDate}`,
      accessToken,
      correlationId,
    })
  },
  create(
    accessToken: string,
    body: EmotionCheckInCreate,
    key: string,
    correlationId: string,
  ) {
    return call({
      method: 'POST',
      path: '/api/v1/emotion-check-ins',
      accessToken,
      correlationId,
      idempotencyKey: key,
      body,
    })
  },
  update(
    accessToken: string,
    localDate: string,
    revision: number,
    body: EmotionCheckInValue,
    key: string,
    correlationId: string,
  ) {
    return call({
      method: 'PATCH',
      path: `/api/v1/emotion-check-ins/${localDate}`,
      accessToken,
      correlationId,
      idempotencyKey: key,
      revision,
      body,
    })
  },
}

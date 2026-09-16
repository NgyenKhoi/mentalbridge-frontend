import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import { readJournalServerConfig } from '@/lib/config/server'
import type {
  EmotionCheckIn,
  EmotionCheckInCreate,
  EmotionCheckInList,
  EmotionCheckInTombstone,
  EmotionCheckInValue,
} from './contract'
import {
  parseEmotionCheckIn,
  parseEmotionList,
  parseEmotionTombstone,
} from './validation'

type Options<T> = Readonly<{
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  accessToken: string
  correlationId: string
  body?: unknown
  idempotencyKey?: string
  revision?: number
  parse: (value: unknown) => T | null
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
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > 128 * 1024) throw malformed()
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw malformed(error)
  }
}

async function call<T>(options: Options<T>): Promise<T> {
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
      const parsed = options.parse(await json(response))
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
    return call<EmotionCheckIn>({
      method: 'GET',
      path: `/api/v1/emotion-check-ins/${localDate}`,
      accessToken,
      correlationId,
      parse: parseEmotionCheckIn,
    })
  },
  list(
    accessToken: string,
    before: string | undefined,
    limit: number,
    correlationId: string,
  ) {
    const query = new URLSearchParams({ limit: String(limit) })
    if (before) query.set('before', before)
    return call<EmotionCheckInList>({
      method: 'GET',
      path: `/api/v1/emotion-check-ins?${query}`,
      accessToken,
      correlationId,
      parse: parseEmotionList,
    })
  },
  create(
    accessToken: string,
    body: EmotionCheckInCreate,
    key: string,
    correlationId: string,
  ) {
    return call<EmotionCheckIn>({
      method: 'POST',
      path: '/api/v1/emotion-check-ins',
      accessToken,
      correlationId,
      idempotencyKey: key,
      body,
      parse: parseEmotionCheckIn,
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
    return call<EmotionCheckIn>({
      method: 'PATCH',
      path: `/api/v1/emotion-check-ins/${localDate}`,
      accessToken,
      correlationId,
      idempotencyKey: key,
      revision,
      body,
      parse: parseEmotionCheckIn,
    })
  },
  remove(
    accessToken: string,
    localDate: string,
    key: string,
    correlationId: string,
  ) {
    return call<EmotionCheckInTombstone>({
      method: 'DELETE',
      path: `/api/v1/emotion-check-ins/${localDate}`,
      accessToken,
      correlationId,
      idempotencyKey: key,
      parse: parseEmotionTombstone,
    })
  },
}

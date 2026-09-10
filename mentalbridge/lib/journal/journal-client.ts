import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import { readJournalServerConfig } from '@/lib/config/server'
import type {
  JournalCreate,
  JournalEntry,
  JournalPage,
  JournalTombstone,
  JournalWrite,
} from './journal-contract'
import {
  parseJournalEntry,
  parseJournalPage,
  parseTombstone,
} from './journal-validation'

type Options<T> = Readonly<{
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  accessToken: string
  correlationId: string
  idempotencyKey?: string
  revision?: number
  body?: unknown
  parse: (value: unknown) => T | null
}>

const malformed = (cause?: unknown) =>
  new ApiError({
    message: 'Journal returned an invalid response.',
    code: 'JOURNAL_MALFORMED_RESPONSE',
    status: 502,
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

async function request<T>(options: Options<T>): Promise<T> {
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
      const body = await json(response)
      if (isProblemDetails(body))
        throw new ApiError({
          message: body.title,
          code: body.code,
          status: response.status,
          correlationId: body.correlationId,
          problem: body,
        })
      throw malformed()
    }
    const parsed = options.parse(await json(response))
    if (!parsed) throw malformed()
    return parsed
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (mutation)
      throw new ApiError({
        message: 'The journal mutation outcome is unknown.',
        code: 'JOURNAL_MUTATION_OUTCOME_UNKNOWN',
        status: 503,
        cause: error,
      })
    throw new ApiError({
      message: 'Journal is unavailable.',
      code: 'JOURNAL_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export const journalClient = {
  list(
    accessToken: string,
    cursor: string | undefined,
    correlationId: string,
  ): Promise<JournalPage> {
    const query = new URLSearchParams({ limit: '20' })
    if (cursor) query.set('cursor', cursor)
    return request({
      method: 'GET',
      path: `/api/v1/journals?${query}`,
      accessToken,
      correlationId,
      parse: parseJournalPage,
    })
  },
  detail(
    accessToken: string,
    id: string,
    correlationId: string,
  ): Promise<JournalEntry> {
    return request({
      method: 'GET',
      path: `/api/v1/journals/${id}`,
      accessToken,
      correlationId,
      parse: parseJournalEntry,
    })
  },
  create(
    accessToken: string,
    body: JournalCreate,
    key: string,
    correlationId: string,
  ): Promise<JournalEntry> {
    return request({
      method: 'POST',
      path: '/api/v1/journals',
      accessToken,
      correlationId,
      idempotencyKey: key,
      body,
      parse: parseJournalEntry,
    })
  },
  revise(
    accessToken: string,
    id: string,
    revision: number,
    body: JournalWrite,
    key: string,
    correlationId: string,
  ): Promise<JournalEntry> {
    return request({
      method: 'PATCH',
      path: `/api/v1/journals/${id}`,
      accessToken,
      correlationId,
      idempotencyKey: key,
      revision,
      body,
      parse: parseJournalEntry,
    })
  },
  remove(
    accessToken: string,
    id: string,
    key: string,
    correlationId: string,
  ): Promise<JournalTombstone> {
    return request({
      method: 'DELETE',
      path: `/api/v1/journals/${id}`,
      accessToken,
      correlationId,
      idempotencyKey: key,
      parse: parseTombstone,
    })
  },
}

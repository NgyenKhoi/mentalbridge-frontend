import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import { readJournalServerConfig } from '@/lib/config/server'
import type {
  CompanionConversation,
  CompanionConversationSummary,
  CompanionSend,
  CompanionSendInput,
} from './companion-contract'
import {
  parseConversation,
  parseConversationList,
  parseSend,
} from './companion-validation'

type Options<T> = Readonly<{
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  accessToken: string
  correlationId: string
  idempotencyKey?: string
  body?: unknown
  parse?: (value: unknown) => T | null
}>

const malformed = (cause?: unknown) =>
  new ApiError({
    message: 'AI Companion returned an invalid response.',
    code: 'COMPANION_MALFORMED_RESPONSE',
    status: 502,
    cause,
  })

const maximumCompanionResponseBytes = 8 * 1024 * 1024

async function json(response: Response): Promise<unknown> {
  try {
    const text = await response.text()
    if (
      new TextEncoder().encode(text).byteLength > maximumCompanionResponseBytes
    )
      throw malformed()
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw malformed(error)
  }
}

async function upstream<T>(options: Options<T>): Promise<T | undefined> {
  const config = readJournalServerConfig()
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
          Authorization: `Bearer ${options.accessToken}`,
          'X-Correlation-Id': options.correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
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
    if (response.status === 204) return undefined
    const parsed = options.parse?.(await json(response))
    if (!parsed) throw malformed()
    return parsed
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.idempotencyKey)
      throw new ApiError({
        message: 'The AI Companion send outcome could not be confirmed.',
        code: 'COMPANION_OUTCOME_UNKNOWN',
        status: 503,
        cause: error,
      })
    throw new ApiError({
      message: 'AI Companion is unavailable.',
      code: 'COMPANION_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export const companionClient = {
  create(
    accessToken: string,
    correlationId: string,
  ): Promise<CompanionConversation> {
    return upstream({
      method: 'POST',
      path: '/api/v1/ai-companion/conversations',
      accessToken,
      correlationId,
      body: {},
      parse: parseConversation,
    }) as Promise<CompanionConversation>
  },
  list(accessToken: string, correlationId: string) {
    return upstream({
      method: 'GET',
      path: '/api/v1/ai-companion/conversations',
      accessToken,
      correlationId,
      parse: parseConversationList,
    }) as Promise<Readonly<{ items: CompanionConversationSummary[] }>>
  },
  get(accessToken: string, id: string, correlationId: string) {
    return upstream({
      method: 'GET',
      path: `/api/v1/ai-companion/conversations/${id}`,
      accessToken,
      correlationId,
      parse: parseConversation,
    }) as Promise<CompanionConversation>
  },
  send(
    accessToken: string,
    id: string,
    body: CompanionSendInput,
    key: string,
    correlationId: string,
  ) {
    return upstream({
      method: 'POST',
      path: `/api/v1/ai-companion/conversations/${id}/messages`,
      accessToken,
      correlationId,
      idempotencyKey: key,
      body,
      parse: parseSend,
    }) as Promise<CompanionSend>
  },
  async remove(accessToken: string, id: string, correlationId: string) {
    await upstream({
      method: 'DELETE',
      path: `/api/v1/ai-companion/conversations/${id}`,
      accessToken,
      correlationId,
    })
  },
}

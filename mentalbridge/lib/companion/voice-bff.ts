import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { correlationIdFrom, localProblem } from '@/lib/auth/bff-response'
import { isSameOrigin } from '@/lib/auth/same-origin'
import { readBoundedJson } from '@/lib/auth/request-body'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  readCareServerConfig,
  readJournalServerConfig,
} from '@/lib/config/server'
import {
  validators,
  validConsentCommand,
  validEmptyCommand,
  voiceId,
  publicVoiceCode,
  type Responses,
} from '@/features/ai-companion/voice/contract'

type Resource = {
  owner: 'care' | 'journal'
  path: string
  schema: keyof Responses
  status: number
}
function resource(method: string, parts: string[]): Resource | null {
  const [name, id, action] = parts
  if (parts.length === 1) {
    if (method === 'GET' && name === 'eligibility')
      return {
        owner: 'journal',
        path: '/api/v1/ai-companion/voice-eligibility',
        schema: 'eligibility',
        status: 200,
      }
    if (method === 'GET' && name === 'disclosure')
      return {
        owner: 'care',
        path: '/api/v1/ai-voice-processing-disclosure',
        schema: 'disclosure',
        status: 200,
      }
    if (name === 'consent' && ['GET', 'POST'].includes(method))
      return {
        owner: 'care',
        path: '/api/v1/consents/ai-voice-processing',
        schema: 'consent',
        status: 200,
      }
    if (method === 'POST' && name === 'sessions')
      return {
        owner: 'journal',
        path: '/api/v1/ai-companion/voice-sessions',
        schema: 'session',
        status: 202,
      }
  }
  if (name !== 'sessions' || !voiceId(id)) return null
  const path = `/api/v1/ai-companion/voice-sessions/${id}`
  if (parts.length === 2 && method === 'GET')
    return { owner: 'journal', path, schema: 'session', status: 200 }
  if (
    parts.length === 3 &&
    method === 'POST' &&
    (action === 'end' || action === 'connection')
  )
    return {
      owner: 'journal',
      path: `${path}/${action}`,
      schema: action === 'end' ? 'session' : 'connection',
      status: action === 'end' ? 202 : 200,
    }
  return null
}

export async function voiceBff(request: NextRequest, parts: string[]) {
  const correlationId = correlationIdFrom(request)
  const problem = (status: number, code: string) =>
    localProblem(
      status,
      code,
      'Chưa thể hoàn tất yêu cầu gọi AI.',
      correlationId,
    )
  const selected = resource(request.method, parts)
  if (!selected || request.nextUrl.search)
    return problem(404, 'INVALID_REQUEST')
  if (request.method === 'POST' && !isSameOrigin(request))
    return problem(403, 'FORBIDDEN')
  let user: Awaited<ReturnType<typeof authenticatedJournalUser>>
  try {
    user = await authenticatedJournalUser(request, correlationId)
  } catch (error) {
    return journalAuthenticationFailure(error, correlationId)
  }
  const respond = (response: NextResponse) =>
    carryJournalSession(response, user)
  let body: unknown
  const key = request.headers.get('Idempotency-Key')
  if (request.method === 'POST') {
    try {
      body = await readBoundedJson(request, 1024)
    } catch {
      return respond(problem(422, 'INVALID_REQUEST'))
    }
    if (
      !voiceId(key) ||
      !(selected.schema === 'consent'
        ? validConsentCommand(body)
        : validEmptyCommand(body))
    )
      return respond(problem(422, 'INVALID_REQUEST'))
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  request.signal.addEventListener('abort', abort, { once: true })
  if (request.signal.aborted) controller.abort()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const config =
      selected.owner === 'care'
        ? readCareServerConfig()
        : readJournalServerConfig()
    timeout = setTimeout(abort, config.timeoutMs)
    const response = await fetch(
      new URL(selected.path.slice(1), config.baseUrl),
      {
        method: request.method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${user.accessToken}`,
          'X-Correlation-Id': correlationId,
          ...(request.method === 'POST'
            ? {
                'Content-Type': 'application/json',
                'Idempotency-Key': key ?? '',
              }
            : {}),
        },
        ...(request.method === 'POST' ? { body: JSON.stringify(body) } : {}),
      },
    )
    const raw = await response.text()
    if (new TextEncoder().encode(raw).length > 32_768)
      return respond(problem(502, 'INVALID_RESPONSE'))
    const value: unknown = JSON.parse(raw)
    if (!response.ok) {
      const code =
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof value.code === 'string'
          ? publicVoiceCode(value.code)
          : 'VOICE_UNAVAILABLE'
      return respond(
        problem(
          response.status >= 400 && response.status <= 599
            ? response.status
            : 502,
          code,
        ),
      )
    }
    if (!validators[selected.schema](value))
      return respond(problem(502, 'INVALID_RESPONSE'))
    const result = NextResponse.json(value, {
      status: selected.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Correlation-Id': correlationId,
      },
    })
    return respond(result)
  } catch {
    return respond(
      problem(
        503,
        request.method === 'POST' ? 'OUTCOME_UNKNOWN' : 'VOICE_UNAVAILABLE',
      ),
    )
  } finally {
    if (timeout) clearTimeout(timeout)
    request.signal.removeEventListener('abort', abort)
  }
}

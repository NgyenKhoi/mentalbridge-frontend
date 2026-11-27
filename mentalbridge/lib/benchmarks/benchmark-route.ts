import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  successResponse,
} from '@/lib/auth/bff-response'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from '@/lib/auth/admin-actor'
import { benchmarkRequest } from './benchmark-client'

const BODY_LIMIT = 256 * 1024
const safeSegment = /^[A-Za-z0-9._-]{1,128}$/

async function boundedBody(request: NextRequest) {
  const text = await request.text()
  if (!text || new TextEncoder().encode(text).byteLength > BODY_LIMIT)
    throw new Error('INVALID_BODY')
  return JSON.parse(text) as unknown
}

export async function proxyBenchmark(
  request: NextRequest,
  method: 'GET' | 'POST',
  segments: readonly string[],
) {
  const correlationId = correlationIdFrom(request)
  if (segments.some((segment) => !safeSegment.test(segment)))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Benchmark route is invalid.',
      correlationId,
    )
  let actor: Awaited<ReturnType<typeof authenticatedAdminActor>>
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }
  try {
    const mutation = method === 'POST'
    const key = request.headers.get('Idempotency-Key')
    if (mutation && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(key ?? ''))
      return carryAdminSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'A valid idempotency key is required.',
          correlationId,
        ),
        actor,
      )
    const body = mutation ? await boundedBody(request) : undefined
    const result = await benchmarkRequest({
      method,
      path: `/api/v1/admin/ai-benchmarks/${segments.join('/')}`,
      accessToken: actor.accessToken,
      correlationId,
      ...(key ? { idempotencyKey: key } : {}),
      ...(body === undefined ? {} : { body }),
    })
    const status =
      method === 'POST' && segments.length === 1 && segments[0] === 'runs'
        ? 202
        : mutation && segments.at(-1) !== 'archive'
          ? 201
          : 200
    return carryAdminSession(
      successResponse(result, correlationId, status),
      actor,
    )
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error as Error)?.message === 'INVALID_BODY'
    )
      return carryAdminSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Benchmark request body is invalid.',
          correlationId,
        ),
        actor,
      )
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

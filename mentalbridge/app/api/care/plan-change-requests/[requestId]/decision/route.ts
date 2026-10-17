import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import { isCareIdempotencyKey, isUuid } from '@/lib/care/care-validation'

const VERSION = /^"(0|[1-9]\d*)"$/

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/plan-change-requests/[requestId]/decision'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { requestId } = await context.params
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  const version = match ? Number(match[1]) : Number.NaN
  const key = request.headers.get('idempotency-key')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const decision =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).decision
      : null
  if (
    !isUuid(requestId) ||
    !Number.isSafeInteger(version) ||
    !isCareIdempotencyKey(key) ||
    !['ACCEPT', 'REJECT'].includes(String(decision))
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid request, If-Match, Idempotency-Key, and decision are required.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const result = await careClient.decidePlanChangeRequest(
      user.accessToken,
      requestId,
      version,
      { decision: decision as 'ACCEPT' | 'REJECT' },
      key,
      correlationId,
    )
    const response = careSuccessResponse(result, correlationId)
    response.headers.set('ETag', `"${result.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

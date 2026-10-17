import type { NextRequest } from 'next/server'

import type { ReplaceCurrentSupportPlanRequest } from '@/features/support-plan/api/support-plan-contract'
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

function replacementRequest(
  value: unknown,
): ReplaceCurrentSupportPlanRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const body = value as Record<string, unknown>
  if (
    !isUuid(body.currentSupportPlanId) ||
    !Number.isSafeInteger(body.currentVersion) ||
    Number(body.currentVersion) < 0 ||
    !isUuid(body.reassessmentSummaryId)
  )
    return null
  return body as ReplaceCurrentSupportPlanRequest
}

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plans/[supportPlanId]/replace'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { supportPlanId } = await context.params
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  const version = match ? Number(match[1]) : Number.NaN
  const key = request.headers.get('idempotency-key')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const parsed = replacementRequest(body)
  if (
    !isUuid(supportPlanId) ||
    !Number.isSafeInteger(version) ||
    !isCareIdempotencyKey(key) ||
    !parsed
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid plan id, If-Match, Idempotency-Key, and replacement request are required.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const plan = await careClient.replaceSupportPlan(
      user.accessToken,
      supportPlanId,
      version,
      parsed,
      key,
      correlationId,
    )
    const response = careSuccessResponse(plan, correlationId)
    response.headers.set('ETag', `"${plan.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

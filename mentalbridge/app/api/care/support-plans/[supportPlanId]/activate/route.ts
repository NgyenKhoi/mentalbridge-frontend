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
import { isUuid } from '@/lib/care/care-validation'

const IDEMPOTENCY_KEY = /^[!-~]{16,128}$/
const VERSION = /^"(0|[1-9]\d*)"$/

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plans/[supportPlanId]/activate'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { supportPlanId } = await context.params
  const versionMatch = VERSION.exec(request.headers.get('if-match') ?? '')
  const version = versionMatch ? Number(versionMatch[1]) : Number.NaN
  const key = request.headers.get('idempotency-key') ?? ''
  if (
    !isUuid(supportPlanId) ||
    !Number.isSafeInteger(version) ||
    !IDEMPOTENCY_KEY.test(key)
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid plan id, If-Match, and Idempotency-Key are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const plan = await careClient.activateSupportPlan(
      user.accessToken,
      supportPlanId,
      version,
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

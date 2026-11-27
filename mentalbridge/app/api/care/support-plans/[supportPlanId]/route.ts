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

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plans/[supportPlanId]'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { supportPlanId } = await context.params
  if (!isUuid(supportPlanId)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid SupportPlan id is required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const plan = await careClient.supportPlan(
      user.accessToken,
      supportPlanId,
      correlationId,
    )
    const response = careSuccessResponse(plan, correlationId)
    response.headers.set('ETag', `"${plan.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

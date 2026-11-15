import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedContentUser,
  carryContentSession,
  contentAuthenticationFailure,
} from '@/lib/content/authenticated-user'
import {
  contentErrorResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentResourceJourneyClient } from '@/lib/content/content-client'
import { isLocalDate } from '@/lib/content/content-validation'
import { careErrorResponse } from '@/lib/care/bff-response'
import { supportPlanActionClient } from '@/lib/care/support-plan-action-client'

function validTimeZone(value: string) {
  if (value.length < 1 || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const localDate = request.nextUrl.searchParams.get('date')
  const timeZone = request.nextUrl.searchParams.get('timeZone')
  if (
    !localDate ||
    !isLocalDate(localDate) ||
    !timeZone ||
    !validTimeZone(timeZone)
  ) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Resource journey date or time zone is invalid.',
        correlationId,
      ),
      user,
    )
  }

  let plan: Awaited<ReturnType<typeof supportPlanActionClient.resourceActions>>
  try {
    plan = await supportPlanActionClient.resourceActions(
      user.accessToken,
      localDate,
      correlationId,
    )
  } catch (error) {
    return carryContentSession(careErrorResponse(error, correlationId), user)
  }

  if (
    plan.planState !== 'ACTIVE' ||
    !plan.supportPlanId ||
    plan.supportPlanVersion === undefined ||
    !plan.activatedAt ||
    !plan.targetDomains
  ) {
    return carryContentSession(
      localProblem(
        409,
        'ACTIVE_SUPPORT_PLAN_REQUIRED',
        'Activate a support plan before starting the daily journey.',
        correlationId,
      ),
      user,
    )
  }

  const selectedResourceIds = [
    ...new Set(plan.actions.map((action) => action.resource.resourceId)),
  ].slice(0, 12)

  try {
    const journey = await contentResourceJourneyClient.materialize(
      user.accessToken,
      localDate,
      {
        timeZone,
        supportPlan: {
          supportPlanId: plan.supportPlanId,
          version: plan.supportPlanVersion,
          status: 'ACTIVE',
          activatedAt: plan.activatedAt,
          domains: plan.targetDomains,
          selectedResourceIds,
        },
      },
      correlationId,
    )
    return carryContentSession(
      contentSuccessResponse(journey, correlationId),
      user,
    )
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}

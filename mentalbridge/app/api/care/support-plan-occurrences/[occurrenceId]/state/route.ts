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

const VERSION = /^"(0|[1-9]\d*)"$/

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plan-occurrences/[occurrenceId]/state'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { occurrenceId } = await context.params
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  const version = match ? Number(match[1]) : Number.NaN
  const body: unknown = await request.json().catch(() => null)
  const state =
    typeof body === 'object' && body !== null && 'state' in body
      ? (body as { state?: unknown }).state
      : undefined
  if (
    !isUuid(occurrenceId) ||
    !Number.isSafeInteger(version) ||
    (state !== 'COMPLETED' && state !== 'SKIPPED')
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid occurrence id, If-Match, and state are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const occurrence = await careClient.changeSupportPlanOccurrenceState(
      user.accessToken,
      occurrenceId,
      version,
      { state },
      correlationId,
    )
    const response = careSuccessResponse(occurrence, correlationId)
    response.headers.set('ETag', `"${occurrence.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

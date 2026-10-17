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

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/care/consultation-briefs/[appointmentId]/[action]'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { appointmentId, action } = await context.params
  const rawVersion = request.headers.get('if-match')
  const version =
    rawVersion && /^"\d+"$/.test(rawVersion)
      ? Number(rawVersion.slice(1, -1))
      : null
  if (
    !isUuid(appointmentId) ||
    !['approve', 'revoke'].includes(action) ||
    version === null
  )
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Consultation brief action is invalid.',
        correlationId,
      ),
      user,
    )
  try {
    const brief = await careClient.consultationBriefAction(
      user.accessToken,
      appointmentId,
      action as 'approve' | 'revoke',
      version,
      correlationId,
    )
    const response = careSuccessResponse(brief, correlationId)
    response.headers.set('ETag', `"${brief.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

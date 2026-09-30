import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareActor,
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
  context: RouteContext<'/api/care/specialist/consultation-briefs/[appointmentId]'>,
) {
  const correlationId = correlationIdFrom(request)
  let specialist: Awaited<ReturnType<typeof authenticatedCareActor>>
  try {
    specialist = await authenticatedCareActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  if (!isUuid(appointmentId))
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid appointment id is required.',
        correlationId,
      ),
      specialist,
    )
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.specialistConsultationBrief(
          specialist.accessToken,
          appointmentId,
          correlationId,
        ),
        correlationId,
      ),
      specialist,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), specialist)
  }
}

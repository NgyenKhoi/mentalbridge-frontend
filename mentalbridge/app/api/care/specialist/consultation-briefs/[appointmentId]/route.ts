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

import {
  isSpecialistMockEnabled,
  specialistMockService,
} from '@/lib/mock/specialist-mock-service'

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/care/specialist/consultation-briefs/[appointmentId]'>,
) {
  const correlationId = correlationIdFrom(request)
  const mockEnabled = isSpecialistMockEnabled(request)
  const { appointmentId } = await context.params
  if (!isUuid(appointmentId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'A valid appointment id is required.',
      correlationId,
    )

  if (mockEnabled) {
    const brief = specialistMockService.getConsultationBrief(appointmentId)
    if (brief) {
      let specialist
      try {
        specialist = await authenticatedCareActor(request, correlationId, [
          'SPECIALIST',
        ])
      } catch {
        // mock preview allowed without active session
      }
      const res = careSuccessResponse(brief, correlationId)
      return specialist ? carryCareSession(res, specialist) : res
    }
  }

  let specialist: Awaited<ReturnType<typeof authenticatedCareActor>>
  try {
    specialist = await authenticatedCareActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

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

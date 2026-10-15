import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareActor,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

import {
  isSpecialistMockEnabled,
  specialistMockService,
} from '@/lib/mock/specialist-mock-service'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const mockEnabled = isSpecialistMockEnabled(request)
  let specialist: Awaited<ReturnType<typeof authenticatedCareActor>>
  try {
    specialist = await authenticatedCareActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    if (mockEnabled) {
      return careSuccessResponse(
        specialistMockService.getClientContinuity(),
        correlationId,
      )
    }
    return careAuthenticationFailure(error, correlationId)
  }

  if (mockEnabled) {
    return carryCareSession(
      careSuccessResponse(
        specialistMockService.getClientContinuity(),
        correlationId,
      ),
      specialist,
    )
  }

  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.specialistClientContinuity(
          specialist.accessToken,
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

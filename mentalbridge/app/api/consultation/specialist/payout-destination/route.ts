import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'
import {
  ConsultationInputError,
  parseSavePayoutDestinationInput,
} from '@/lib/consultation/consultation-validation'

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  try {
    const body = parseSavePayoutDestinationInput(
      await readBoundedJson(request, 4 * 1024),
    )
    const result = await consultationClient.saveSpecialistPayoutDestination(
      actor.accessToken,
      correlationId,
      body,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          'Thông tin nơi nhận tiền không hợp lệ.',
          correlationId,
          [{ field: error.field, code: 'INVALID_VALUE' }],
        ),
        actor,
      )
    if (error instanceof RequestBodyError)
      return carryConsultationSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        actor,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

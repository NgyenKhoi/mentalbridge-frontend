import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
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
  validEtag,
  validIdempotencyKey,
  validUuid,
} from '@/lib/consultation/consultation-validation'
import {
  isSpecialistMockEnabled,
  specialistMockService,
} from '@/lib/mock/specialist-mock-service'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/consultation/specialist/appointments/[appointmentId]/[decision]'>,
) {
  const correlationId = correlationIdFrom(request)
  const mockEnabled = isSpecialistMockEnabled(request)

  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    if (!mockEnabled) {
      return consultationAuthenticationFailure(error, correlationId)
    }
  }

  const { appointmentId, decision } = await context.params
  const etag = request.headers.get('If-Match')
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (
    !validUuid(appointmentId) ||
    !['accept', 'reject'].includes(decision) ||
    !validEtag(etag) ||
    !validIdempotencyKey(idempotencyKey)
  )
    return actor
      ? carryConsultationSession(
          localProblem(
            400,
            'VALIDATION_FAILED',
            'Yêu cầu xử lý lịch hẹn không hợp lệ.',
            correlationId,
          ),
          actor,
        )
      : localProblem(
          400,
          'VALIDATION_FAILED',
          'Yêu cầu xử lý lịch hẹn không hợp lệ.',
          correlationId,
        )

  if (mockEnabled) {
    const decided = specialistMockService.decideAppointment(
      appointmentId,
      decision as 'accept' | 'reject',
    )
    if (decided) {
      const res = consultationSuccess(decided.data, correlationId, decided.etag)
      return actor ? carryConsultationSession(res, actor) : res
    }
  }

  try {
    const result = await consultationClient.decideAppointment(
      actor!.accessToken,
      correlationId,
      appointmentId,
      decision as 'accept' | 'reject',
      etag,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor!,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor!,
    )
  }
}

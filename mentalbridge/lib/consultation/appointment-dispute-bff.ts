import 'server-only'

import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from './authenticated-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from './bff-response'
import { consultationClient } from './consultation-client'
import {
  ConsultationInputError,
  parseOpenAppointmentDisputeInput,
  validIdempotencyKey,
  validUuid,
} from './consultation-validation'

export async function readParticipantDispute(
  request: NextRequest,
  appointmentId: string,
  role: 'USER' | 'SPECIALIST',
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [role])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  if (!validUuid(appointmentId))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Lịch hẹn không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.participantAppointmentDispute(
      actor.accessToken,
      correlationId,
      appointmentId,
      role,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

export async function openParticipantDispute(
  request: NextRequest,
  appointmentId: string,
  role: 'USER' | 'SPECIALIST',
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [role])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!validUuid(appointmentId) || !validIdempotencyKey(idempotencyKey))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu xem xét không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const body = parseOpenAppointmentDisputeInput(
      await readBoundedJson(request, 1_024),
    )
    const result = await consultationClient.openAppointmentDispute(
      actor.accessToken,
      correlationId,
      appointmentId,
      role,
      body,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryConsultationSession(
        localProblem(error.status, error.code, error.message, correlationId),
        actor,
      )
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Yêu cầu xem xét không hợp lệ.',
          correlationId,
        ),
        actor,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

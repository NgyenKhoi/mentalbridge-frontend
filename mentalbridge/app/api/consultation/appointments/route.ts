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
  parseAppointmentRequestInput,
  validIdempotencyKey,
} from '@/lib/consultation/consultation-validation'

async function actor(request: NextRequest, correlationId: string) {
  return authenticatedConsultationActor(request, correlationId, ['USER'])
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let current
  try {
    current = await actor(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  try {
    const result = await consultationClient.appointments(
      current.accessToken,
      correlationId,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      current,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      current,
    )
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let current
  try {
    current = await actor(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const key = request.headers.get('Idempotency-Key')
  if (!validIdempotencyKey(key))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Idempotency-Key không hợp lệ.',
        correlationId,
      ),
      current,
    )
  try {
    const body = parseAppointmentRequestInput(
      await readBoundedJson(request, 2 * 1024),
    )
    const result = await consultationClient.requestAppointment(
      current.accessToken,
      correlationId,
      body,
      key,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, null, 201),
      current,
    )
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          `Trường ${error.field} không hợp lệ.`,
          correlationId,
        ),
        current,
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
        current,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      current,
    )
  }
}

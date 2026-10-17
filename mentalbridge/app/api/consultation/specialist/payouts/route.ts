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
import { validIdempotencyKey } from '@/lib/consultation/consultation-validation'

function destinationId(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 1 ||
    typeof record.destinationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      record.destinationId,
    )
  )
    return null
  return record.destinationId
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!validIdempotencyKey(idempotencyKey))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Idempotency-Key không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const id = destinationId(await readBoundedJson(request, 4 * 1024))
    if (!id)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          'Nơi nhận tiền không hợp lệ.',
          correlationId,
          [{ field: 'destinationId', code: 'INVALID_VALUE' }],
        ),
        actor,
      )
    const result = await consultationClient.createSpecialistPayout(
      actor.accessToken,
      correlationId,
      id,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
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

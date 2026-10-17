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
  parsePublishAvailabilityInput,
  validIdempotencyKey,
  validUtcInstant,
} from '@/lib/consultation/consultation-validation'

async function authorize(request: NextRequest, correlationId: string) {
  return authenticatedConsultationActor(request, correlationId, ['SPECIALIST'])
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authorize(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const includeWithdrawn =
    request.nextUrl.searchParams.get('includeWithdrawn') ?? 'true'
  if (
    (from !== null && !validUtcInstant(from)) ||
    (to !== null && !validUtcInstant(to)) ||
    !['true', 'false'].includes(includeWithdrawn)
  ) {
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Khoảng thời gian lịch khả dụng không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  }
  const query = new URLSearchParams({ includeWithdrawn })
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  try {
    const result = await consultationClient.availability(
      actor.accessToken,
      correlationId,
      `?${query.toString()}`,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authorize(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!validIdempotencyKey(idempotencyKey)) {
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Idempotency-Key không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  }
  try {
    const body = parsePublishAvailabilityInput(
      await readBoundedJson(request, 4 * 1024),
    )
    const result = await consultationClient.publishAvailability(
      actor.accessToken,
      correlationId,
      body,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag, 201),
      actor,
    )
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          `Trường ${error.field} không hợp lệ.`,
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

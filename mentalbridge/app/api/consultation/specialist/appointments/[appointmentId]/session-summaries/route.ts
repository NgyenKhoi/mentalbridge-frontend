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
  validEtag,
  validIdempotencyKey,
  validUuid,
} from '@/lib/consultation/consultation-validation'
import {
  parsePublishSessionSummaryInput,
  SessionSummaryInputError,
} from '@/lib/consultation/session-summary-validation'

async function specialist(request: NextRequest, correlationId: string) {
  return authenticatedConsultationActor(request, correlationId, ['SPECIALIST'])
}

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/consultation/specialist/appointments/[appointmentId]/session-summaries'>,
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await specialist(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
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
    const result = await consultationClient.specialistSessionSummaries(
      actor.accessToken,
      correlationId,
      appointmentId,
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

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/consultation/specialist/appointments/[appointmentId]/session-summaries'>,
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await specialist(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  const idempotencyKey = request.headers.get('Idempotency-Key')
  const ifMatch = request.headers.get('If-Match')
  if (
    !validUuid(appointmentId) ||
    !validIdempotencyKey(idempotencyKey) ||
    (ifMatch !== null && !validEtag(ifMatch))
  )
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu xuất bản không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const body = parsePublishSessionSummaryInput(
      await readBoundedJson(request, 16 * 1024),
    )
    const result = await consultationClient.publishSessionSummary(
      actor.accessToken,
      correlationId,
      appointmentId,
      body,
      idempotencyKey,
      ifMatch ?? undefined,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag, 201),
      actor,
    )
  } catch (error) {
    if (error instanceof SessionSummaryInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          'Nội dung bản tóm tắt không hợp lệ.',
          correlationId,
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

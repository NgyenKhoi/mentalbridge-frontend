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
  validEtag,
  validIdempotencyKey,
  validUuid,
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
  const query = request.nextUrl.searchParams
  const originatingPlanActionIds = query.getAll('originatingPlanActionId')
  if (
    [...query.keys()].some((key) => key !== 'originatingPlanActionId') ||
    originatingPlanActionIds.length > 1 ||
    (originatingPlanActionIds[0] !== undefined &&
      !validUuid(originatingPlanActionIds[0]))
  ) {
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Bộ lọc lịch hẹn không hợp lệ.',
        correlationId,
      ),
      current,
    )
  }
  try {
    const result = await consultationClient.appointments(
      current.accessToken,
      correlationId,
      originatingPlanActionIds[0],
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
    const replacementEtag = request.headers.get('If-Match')
    if (body.replacesAppointmentId && !validEtag(replacementEtag))
      return carryConsultationSession(
        localProblem(
          428,
          'APPOINTMENT_VERSION_REQUIRED',
          'Phiên bản hiện tại của lịch cần đổi là bắt buộc.',
          correlationId,
        ),
        current,
      )
    const result = await consultationClient.requestAppointment(
      current.accessToken,
      correlationId,
      body,
      key,
      replacementEtag ?? undefined,
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

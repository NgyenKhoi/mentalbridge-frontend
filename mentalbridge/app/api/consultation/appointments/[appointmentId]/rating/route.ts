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
  validUuid,
} from '@/lib/consultation/consultation-validation'

type Context = RouteContext<'/api/consultation/appointments/[appointmentId]/rating'>

async function actor(request: NextRequest, correlationId: string) {
  return authenticatedConsultationActor(request, correlationId, ['USER'])
}

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let current
  try {
    current = await actor(request, correlationId)
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
      current,
    )
  try {
    const result = await consultationClient.appointmentRating(
      current.accessToken,
      correlationId,
      appointmentId,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      current,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      current,
    )
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let current
  try {
    current = await actor(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  const etag = request.headers.get('If-Match')
  if (!validUuid(appointmentId) || (etag !== null && !validEtag(etag)))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Lịch hẹn hoặc phiên bản đánh giá không hợp lệ.',
        correlationId,
      ),
      current,
    )
  try {
    const input = await readBoundedJson(request, 512)
    const body =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : null
    if (
      !body ||
      Object.keys(body).length !== 1 ||
      !Number.isInteger(body.rating) ||
      Number(body.rating) < 1 ||
      Number(body.rating) > 5
    )
      throw new RequestBodyError(
        400,
        'VALIDATION_FAILED',
        'Điểm đánh giá phải từ 1 đến 5.',
      )
    const result = await consultationClient.saveAppointmentRating(
      current.accessToken,
      correlationId,
      appointmentId,
      Number(body.rating),
      etag ?? undefined,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      current,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryConsultationSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
        ),
        current,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      current,
    )
  }
}

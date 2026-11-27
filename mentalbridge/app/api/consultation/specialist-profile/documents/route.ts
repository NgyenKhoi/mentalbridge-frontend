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

export async function GET(request: NextRequest) {
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
    const result = await consultationClient.credentialDocuments(
      actor.accessToken,
      correlationId,
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
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const length = Number(request.headers.get('content-length'))
  if (Number.isFinite(length) && length > 11 * 1024 * 1024) {
    return carryConsultationSession(
      localProblem(
        413,
        'CREDENTIAL_TOO_LARGE',
        'Tệp vượt quá 10 MB.',
        correlationId,
      ),
      actor,
    )
  }
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 10 * 1024 * 1024
    ) {
      return carryConsultationSession(
        localProblem(
          422,
          'INVALID_CREDENTIAL_DOCUMENT',
          'Chọn tệp PDF, JPG hoặc PNG tối đa 10 MB.',
          correlationId,
        ),
        actor,
      )
    }
    const result = await consultationClient.uploadCredential(
      actor.accessToken,
      correlationId,
      form,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag, 201),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

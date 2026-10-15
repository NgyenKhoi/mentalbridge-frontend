import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import { consultationFailure, consultationSuccess, localProblem } from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'
import { validEtag } from '@/lib/consultation/consultation-validation'

export async function PUT(request: NextRequest, context: RouteContext<'/api/consultation/specialist-profile/documents/[documentId]/badge'>) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, ['SPECIALIST'])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const etag = request.headers.get('If-Match')
  if (!validEtag(etag)) return carryConsultationSession(localProblem(428,
    'CREDENTIAL_VERSION_REQUIRED', 'Hãy tải lại giấy tờ trước khi đổi huy hiệu.', correlationId), actor)
  const { documentId } = await context.params
  try {
    const body = await readBoundedJson(request, 256)
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof (body as Record<string, unknown>).visible !== 'boolean') {
      return carryConsultationSession(localProblem(422, 'INVALID_CREDENTIAL_BADGE',
        'Trạng thái huy hiệu không hợp lệ.', correlationId), actor)
    }
    const visible = (body as { visible: boolean }).visible
    const result = await consultationClient.credentialBadge(actor.accessToken, correlationId,
      documentId, visible, etag)
    return carryConsultationSession(consultationSuccess(result.data, correlationId, result.etag), actor)
  } catch (error) {
    if (error instanceof RequestBodyError) return carryConsultationSession(localProblem(
      error.status, error.code, error.message, correlationId, error.violations), actor)
    return carryConsultationSession(consultationFailure(error, correlationId), actor)
  }
}

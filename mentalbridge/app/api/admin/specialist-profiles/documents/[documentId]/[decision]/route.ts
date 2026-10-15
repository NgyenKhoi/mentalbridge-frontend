import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { authenticatedConsultationActor, carryConsultationSession, consultationAuthenticationFailure } from '@/lib/consultation/authenticated-actor'
import { consultationFailure, consultationSuccess, localProblem } from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'

export async function POST(request: NextRequest, context: { params: Promise<{ documentId: string; decision: string }> }) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, ['ADMIN'])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { documentId, decision } = await context.params
  if (decision !== 'verify' && decision !== 'reject') {
    return carryConsultationSession(localProblem(404, 'NOT_FOUND', 'Không tìm thấy thao tác xét duyệt.', correlationId), actor)
  }
  const ifMatch = request.headers.get('if-match')
  if (!ifMatch) {
    return carryConsultationSession(localProblem(428, 'PRECONDITION_REQUIRED', 'Cần phiên bản giấy tờ để xét duyệt.', correlationId), actor)
  }
  try {
    const result = await consultationClient.reviewCredential(actor.accessToken, correlationId, documentId, decision, ifMatch)
    return carryConsultationSession(consultationSuccess(result.data, correlationId, result.etag), actor)
  } catch (error) {
    return carryConsultationSession(consultationFailure(error, correlationId), actor)
  }
}

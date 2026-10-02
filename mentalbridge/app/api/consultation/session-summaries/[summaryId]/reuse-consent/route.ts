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
import {
  parseSessionSummaryReuseConsentInput,
  SessionSummaryInputError,
} from '@/lib/consultation/session-summary-validation'

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/consultation/session-summaries/[summaryId]/reuse-consent'>,
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { summaryId } = await context.params
  const ifMatch = request.headers.get('If-Match')
  if (!validUuid(summaryId) || !validEtag(ifMatch))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu cập nhật không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const body = parseSessionSummaryReuseConsentInput(
      await readBoundedJson(request, 1024),
    )
    const result = await consultationClient.updateSessionSummaryReuseConsent(
      actor.accessToken,
      correlationId,
      summaryId,
      body,
      ifMatch,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor,
    )
  } catch (error) {
    if (error instanceof SessionSummaryInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          'Lựa chọn chia sẻ không hợp lệ.',
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

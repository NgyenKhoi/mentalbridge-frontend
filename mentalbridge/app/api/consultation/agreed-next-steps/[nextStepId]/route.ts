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
  parseUpdateAgreedNextStepInput,
  SessionSummaryInputError,
} from '@/lib/consultation/session-summary-validation'

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/consultation/agreed-next-steps/[nextStepId]'>,
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
  const { nextStepId } = await context.params
  const ifMatch = request.headers.get('If-Match')
  if (!validUuid(nextStepId) || !validEtag(ifMatch))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Bước tiếp theo không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const body = parseUpdateAgreedNextStepInput(
      await readBoundedJson(request, 1024),
    )
    const result = await consultationClient.updateAgreedNextStep(
      actor.accessToken,
      correlationId,
      nextStepId,
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
          'Trạng thái bước tiếp theo không hợp lệ.',
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

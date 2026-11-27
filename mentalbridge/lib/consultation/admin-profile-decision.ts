import 'server-only'

import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from './authenticated-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from './bff-response'
import { consultationClient } from './consultation-client'
import {
  ConsultationInputError,
  parseSpecialistDecisionInput,
  validEtag,
  validUuid,
} from './consultation-validation'

type Context = { params: Promise<{ specialistId: string }> }
type Decision = 'REJECT' | 'SUSPEND' | 'RESTORE'

export async function adminProfileDecision(
  request: NextRequest,
  context: Context,
  decision: Decision,
) {
  const correlationId = correlationIdFrom(request)
  const { specialistId } = await context.params
  if (!validUuid(specialistId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã chuyên gia không hợp lệ.',
      correlationId,
    )
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const etag = request.headers.get('If-Match')
  if (!validEtag(etag))
    return carryConsultationSession(
      localProblem(
        428,
        'PROFILE_VERSION_REQUIRED',
        'Cần phiên bản hồ sơ hiện tại.',
        correlationId,
      ),
      actor,
    )
  try {
    const body =
      decision === 'RESTORE'
        ? null
        : parseSpecialistDecisionInput(
            await readBoundedJson(request, 1024),
            decision === 'REJECT' ? 'REJECTION' : 'SUSPENSION',
          )
    const result =
      decision === 'REJECT'
        ? await consultationClient.reject(
            actor.accessToken,
            correlationId,
            specialistId,
            etag,
            body!.reasonCode,
          )
        : decision === 'SUSPEND'
          ? await consultationClient.suspend(
              actor.accessToken,
              correlationId,
              specialistId,
              etag,
              body!.reasonCode,
            )
          : await consultationClient.restore(
              actor.accessToken,
              correlationId,
              specialistId,
              etag,
            )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
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

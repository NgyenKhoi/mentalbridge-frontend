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
  parseProfileInput,
  parseSpecialistDecisionInput,
  validEtag,
  validUuid,
} from './consultation-validation'

type Action =
  | 'current'
  | 'start'
  | 'save'
  | 'submit'
  | 'resubmit'
  | 'queue'
  | 'detail'
  | 'approve'
  | 'reject'

export async function profileAmendmentRoute(
  request: NextRequest,
  action: Action,
  id?: string,
) {
  const correlationId = correlationIdFrom(request)
  const admin = ['queue', 'detail', 'approve', 'reject'].includes(action)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      admin ? 'ADMIN' : 'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const carry = (response: Parameters<typeof carryConsultationSession>[0]) =>
    carryConsultationSession(response, actor)
  if (
    !['current', 'start', 'queue'].includes(action) &&
    (!id || !validUuid(id))
  )
    return carry(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Mã bản chỉnh sửa không hợp lệ.',
        correlationId,
      ),
    )
  const etag = request.headers.get('If-Match')
  if (!['current', 'queue', 'detail'].includes(action) && !validEtag(etag))
    return carry(
      localProblem(
        428,
        'PROFILE_VERSION_REQUIRED',
        'Cần phiên bản hiện tại. Hãy tải lại hồ sơ.',
        correlationId,
      ),
    )
  try {
    const token = actor.accessToken
    const page = request.nextUrl.searchParams.get('page') ?? '0'
    if (
      action === 'queue' &&
      (!/^\d{1,4}$/.test(page) ||
        Number(page) > 1000 ||
        [...request.nextUrl.searchParams.keys()].some((key) => key !== 'page'))
    )
      throw new ConsultationInputError('page')
    const result =
      action === 'current'
        ? await consultationClient.ownAmendment(token, correlationId)
        : action === 'start'
          ? await consultationClient.startAmendment(token, correlationId, etag!)
          : action === 'save'
            ? await consultationClient.saveAmendment(
                token,
                correlationId,
                id!,
                parseProfileInput(await readBoundedJson(request, 16 * 1024)),
                etag!,
              )
            : action === 'submit' || action === 'resubmit'
              ? await consultationClient.submitAmendment(
                  token,
                  correlationId,
                  id!,
                  action,
                  etag!,
                )
              : action === 'queue'
                ? await consultationClient.profileAmendments(
                    token,
                    correlationId,
                    Number(page),
                  )
                : action === 'detail'
                  ? await consultationClient.amendmentDetail(
                      token,
                      correlationId,
                      id!,
                    )
                  : await consultationClient.decideAmendment(
                      token,
                      correlationId,
                      id!,
                      action,
                      etag!,
                      action === 'reject'
                        ? parseSpecialistDecisionInput(
                            await readBoundedJson(request, 1024),
                            'REJECTION',
                          ).reasonCode
                        : undefined,
                    )
    return carry(consultationSuccess(result.data, correlationId, result.etag))
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carry(
        localProblem(
          422,
          'VALIDATION_FAILED',
          `Trường ${error.field} không hợp lệ.`,
          correlationId,
          [{ field: error.field, code: 'INVALID_VALUE' }],
        ),
      )
    if (error instanceof RequestBodyError)
      return carry(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
      )
    return carry(consultationFailure(error, correlationId))
  }
}

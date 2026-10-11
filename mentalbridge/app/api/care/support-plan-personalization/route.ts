import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import { validateSupportPlanPersonalizationReplacement } from '@/lib/care/support-plan-validation'

function withRevisionEtag<T extends { revision: number }>(
  value: T,
  correlationId: string,
) {
  const response = careSuccessResponse(value, correlationId)
  response.headers.set('ETag', `"${value.revision}"`)
  return response
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    const value = await careClient.supportPlanPersonalization(
      user.accessToken,
      correlationId,
    )
    return carryCareSession(withRevisionEtag(value, correlationId), user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    const rawRevision = request.headers.get('If-Match')
    const match = rawRevision?.match(/^"([0-9]+)"$/)
    const revision = match ? Number(match[1]) : undefined
    const validation = validateSupportPlanPersonalizationReplacement(
      await readBoundedJson(request),
    )
    if (
      revision === undefined ||
      !Number.isSafeInteger(revision) ||
      !validation.success
    ) {
      return carryCareSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          validation.success
            ? [
                {
                  field: 'If-Match',
                  code: rawRevision === null ? 'REQUIRED' : 'INVALID_VALUE',
                },
              ]
            : validation.violations,
        ),
        user,
      )
    }

    const value = await careClient.replaceSupportPlanPersonalization(
      user.accessToken,
      validation.value,
      revision,
      correlationId,
    )
    return carryCareSession(withRevisionEtag(value, correlationId), user)
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryCareSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        user,
      )
    }
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

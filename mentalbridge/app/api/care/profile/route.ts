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
import { validateProfileUpdate } from '@/lib/care/care-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.getProfile(user.accessToken, correlationId),
        correlationId,
      ),
      user,
    )
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
    const validation = validateProfileUpdate(await readBoundedJson(request))
    const rawVersion = request.headers.get('If-Match')
    const match = rawVersion?.match(/^"([0-9]+)"$/)
    const version = match ? Number(match[1]) : undefined
    if (
      !validation.success ||
      (rawVersion !== null && !match) ||
      (version !== undefined && !Number.isSafeInteger(version))
    )
      return carryCareSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          validation.success ? undefined : validation.violations,
        ),
        user,
      )
    const profile = await careClient.putProfile(
      user.accessToken,
      validation.value,
      version,
      correlationId,
    )
    return carryCareSession(
      careSuccessResponse(
        profile,
        correlationId,
        rawVersion === null ? 201 : 200,
      ),
      user,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
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
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

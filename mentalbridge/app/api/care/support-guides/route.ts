import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
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
import { readInitialCheckIds } from '@/lib/care/guided-initial-check-cookies'
import { isUuid } from '@/lib/care/care-validation'

const IDEMPOTENCY_KEY = /^[!-~]{16,128}$/

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const key = request.headers.get('idempotency-key') ?? ''
  const { phq9AssessmentId, gad7AssessmentId } = readInitialCheckIds(
    request.cookies,
  )
  if (!IDEMPOTENCY_KEY.test(key)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid Idempotency-Key is required.',
        correlationId,
      ),
      user,
    )
  }
  if (
    !phq9AssessmentId ||
    !gad7AssessmentId ||
    !isUuid(phq9AssessmentId) ||
    !isUuid(gad7AssessmentId)
  ) {
    return carryCareSession(
      localProblem(
        409,
        'INITIAL_CHECK_INCOMPLETE',
        'Both guided assessments are required before generating a Support Guide.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const guide = await careClient.generateSupportGuide(
      user.accessToken,
      { phq9AssessmentId, gad7AssessmentId },
      key,
      correlationId,
    )
    return carryCareSession(
      careSuccessResponse(guide, correlationId, 201),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '10')
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (cursor?.length ?? 0) > 256
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
      ),
      user,
    )
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.supportGuideHistory(
          user.accessToken,
          cursor,
          limit,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

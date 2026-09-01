import type { NextRequest, NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/api-error'
import {
  correlationIdFrom,
  identityErrorResponse,
} from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  applySessionCookies,
  clearSessionCookies,
  readSessionCredentials,
} from '@/lib/auth/session-cookies'
import {
  ensureRole,
  RefreshFailedError,
  resolveSession,
} from '@/lib/auth/session-service'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import {
  readAuthenticatedAssessmentId,
  rememberAuthenticatedAssessment,
} from '@/lib/care/assessment-cookies'
import {
  isCareIdempotencyKey,
  parseSubmission,
} from '@/lib/care/care-validation'

async function authenticatedUser(request: NextRequest, correlationId: string) {
  const credentials = readSessionCredentials(request.cookies)
  const session = await resolveSession(credentials, correlationId)
  ensureRole(session.account, ['USER'])
  const accessToken =
    session.rotatedTokens?.accessToken ?? credentials.accessToken
  if (!accessToken)
    throw new Error('Resolved session has no access credential.')
  return { accessToken, rotatedTokens: session.rotatedTokens }
}

function authenticationFailure(error: unknown, correlationId: string) {
  const response = identityErrorResponse(
    error instanceof RefreshFailedError ? error.cause : error,
    correlationId,
  )
  if (
    error instanceof RefreshFailedError ||
    (error instanceof ApiError && error.status === 401)
  ) {
    clearSessionCookies(response)
  }
  return response
}

function carryRotatedSession<T>(
  response: NextResponse<T>,
  user: Awaited<ReturnType<typeof authenticatedUser>>,
) {
  if (user.rotatedTokens) applySessionCookies(response, user.rotatedTokens)
  return response
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedUser>>

  try {
    user = await authenticatedUser(request, correlationId)
  } catch (error) {
    return authenticationFailure(error, correlationId)
  }

  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!isCareIdempotencyKey(idempotencyKey)) {
      return carryRotatedSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          [{ field: 'Idempotency-Key', code: 'INVALID_FORMAT' }],
        ),
        user,
      )
    }
    const submission = parseSubmission(await readBoundedJson(request))
    if (!submission) {
      return carryRotatedSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
        ),
        user,
      )
    }

    const assessment = await careClient.submitAuthenticated(
      user.accessToken,
      submission,
      idempotencyKey,
      correlationId,
    )
    const response = careSuccessResponse(assessment, correlationId, 201)
    rememberAuthenticatedAssessment(response, assessment.assessmentId)
    return carryRotatedSession(response, user)
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryRotatedSession(
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
    return carryRotatedSession(careErrorResponse(error, correlationId), user)
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const assessmentId = readAuthenticatedAssessmentId(request.cookies)
  if (!assessmentId) {
    return localProblem(
      404,
      'ASSESSMENT_NOT_FOUND',
      'No authenticated assessment result is available.',
      correlationId,
    )
  }

  let user: Awaited<ReturnType<typeof authenticatedUser>>
  try {
    user = await authenticatedUser(request, correlationId)
  } catch (error) {
    return authenticationFailure(error, correlationId)
  }

  try {
    const assessment = await careClient.getAuthenticated(
      user.accessToken,
      assessmentId,
      correlationId,
    )
    const response = careSuccessResponse(assessment, correlationId)
    return carryRotatedSession(response, user)
  } catch (error) {
    return carryRotatedSession(careErrorResponse(error, correlationId), user)
  }
}

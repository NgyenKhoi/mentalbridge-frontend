import type { NextRequest } from 'next/server'

import { ApiError } from '@/lib/api/api-error'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import {
  clearAnonymousSessionCookies,
  readAnonymousSession,
  rememberAnonymousAssessment,
} from '@/lib/care/assessment-cookies'
import {
  isCareIdempotencyKey,
  parseSubmission,
} from '@/lib/care/care-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'

function requiredCredentials(request: NextRequest) {
  const credentials = readAnonymousSession(request.cookies)
  if (!credentials.sessionId || !credentials.sessionToken) {
    return null
  }
  return {
    sessionId: credentials.sessionId,
    sessionToken: credentials.sessionToken,
    assessmentId: credentials.assessmentId,
  }
}

function shouldClearSession(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 410)
  )
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const session = requiredCredentials(request)
  if (!session) {
    return localProblem(
      401,
      'ANONYMOUS_SESSION_REQUIRED',
      'An anonymous assessment session is required.',
      correlationId,
    )
  }

  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!isCareIdempotencyKey(idempotencyKey)) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        [{ field: 'Idempotency-Key', code: 'INVALID_FORMAT' }],
      )
    }

    const submission = parseSubmission(await readBoundedJson(request))
    if (!submission) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
      )
    }

    const assessment = await careClient.submitAnonymous(
      session.sessionId,
      session.sessionToken,
      submission,
      idempotencyKey,
      correlationId,
    )
    const response = careSuccessResponse(assessment, correlationId, 201)
    rememberAnonymousAssessment(
      response,
      assessment.assessmentId,
      assessment.expiresAt,
    )
    return response
  } catch (error) {
    const response =
      error instanceof RequestBodyError
        ? localProblem(
            error.status,
            error.code,
            error.message,
            correlationId,
            error.violations,
          )
        : careErrorResponse(error, correlationId)
    if (shouldClearSession(error)) clearAnonymousSessionCookies(response)
    return response
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const session = requiredCredentials(request)
  if (!session) {
    return localProblem(
      401,
      'ANONYMOUS_SESSION_REQUIRED',
      'An anonymous assessment session is required.',
      correlationId,
    )
  }
  const assessmentId = session.assessmentId

  if (!assessmentId) {
    return localProblem(
      404,
      'ASSESSMENT_NOT_FOUND',
      'No anonymous assessment result is available.',
      correlationId,
    )
  }

  try {
    const assessment = await careClient.getAnonymous(
      session.sessionId,
      session.sessionToken,
      assessmentId,
      correlationId,
    )
    return careSuccessResponse(assessment, correlationId)
  } catch (error) {
    const response = careErrorResponse(error, correlationId)
    if (shouldClearSession(error)) clearAnonymousSessionCookies(response)
    return response
  }
}

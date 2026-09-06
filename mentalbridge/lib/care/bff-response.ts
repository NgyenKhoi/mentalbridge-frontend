import 'server-only'

import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/api-error'
import {
  CORRELATION_HEADER,
  localProblem,
  problemResponse,
} from '@/lib/auth/bff-response'
import { isUuid } from './care-validation'

export { localProblem }

function safeCode(code: string) {
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'CARE_UPSTREAM_ERROR'
}

function safeTitle(code: string, status: number) {
  if (code === 'QUESTIONNAIRE_NOT_FOUND') {
    return 'A reviewed questionnaire is not available.'
  }
  if (code === 'VALIDATION_FAILED') return 'Request validation failed.'
  if (code === 'INVALID_ANONYMOUS_SESSION') {
    return 'The anonymous assessment session is invalid.'
  }
  if (code === 'ANONYMOUS_SESSION_EXPIRED') {
    return 'The anonymous assessment session has expired.'
  }
  if (code === 'UNAUTHENTICATED' || code === 'SESSION_REQUIRED') {
    return 'Authentication is required.'
  }
  if (code === 'FORBIDDEN') return 'Access is forbidden.'
  if (code === 'CARE_TIMEOUT') return 'Care request timed out.'
  if (code === 'CARE_UNAVAILABLE') return 'Care is unavailable.'
  if (code === 'CARE_MALFORMED_RESPONSE') {
    return 'Care returned an invalid response.'
  }
  if (code === 'INSUFFICIENT_COMPARABLE_DATA') {
    return 'Comparable assessment data is unavailable.'
  }
  if (status === 429) return 'Too many requests.'
  if (status === 409) return 'Request conflict.'
  if (status >= 400 && status < 500) return 'Care request was rejected.'
  return 'Care request failed.'
}

export function careErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) {
    const status = error.status ?? 502
    const code = safeCode(error.code)
    const responseCorrelationId =
      error.correlationId && isUuid(error.correlationId)
        ? error.correlationId
        : correlationId
    const violations = error.problem?.violations
      ?.filter(
        (violation) =>
          /^[A-Za-z0-9_.\[\]-]{1,64}$/.test(violation.field) &&
          /^[A-Z0-9_]{1,64}$/.test(violation.code),
      )
      .map(({ field, code }) => ({ field, code }))

    return problemResponse({
      type: `/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title: safeTitle(code, status),
      status,
      code,
      correlationId: responseCorrelationId,
      ...(violations === undefined ? {} : { violations }),
    })
  }

  return localProblem(
    502,
    'CARE_DEPENDENCY_FAILED',
    'Care request failed.',
    correlationId,
  )
}

export function careSuccessResponse<T>(
  body: T,
  correlationId: string,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

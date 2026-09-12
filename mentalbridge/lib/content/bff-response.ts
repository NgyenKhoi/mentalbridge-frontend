import 'server-only'

import { NextResponse } from 'next/server'
import {
  CORRELATION_HEADER,
  localProblem,
  problemResponse,
} from '@/lib/auth/bff-response'
import { ContentServiceError } from './content-client'

export { localProblem }

export function contentErrorResponse(error: unknown, correlationId: string) {
  if (!(error instanceof ContentServiceError)) {
    return localProblem(
      502,
      'CONTENT_DEPENDENCY_FAILED',
      'Content request failed.',
      correlationId,
    )
  }
  const responseCorrelationId =
    typeof error.correlationId === 'string'
      ? error.correlationId
      : correlationId
  return problemResponse({
    type: `/problems/${error.code.toLowerCase().replaceAll('_', '-')}`,
    title: safeTitle(error.code, error.status),
    status: error.status,
    code: error.code,
    correlationId: responseCorrelationId,
    ...(error.fieldViolations
      ? {
          violations: error.fieldViolations.map(({ field }) => ({
            field,
            code: 'INVALID_VALUE',
          })),
        }
      : {}),
  })
}

export function contentSuccessResponse<T>(
  body: T,
  correlationId: string,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function contentNoContentResponse(correlationId: string) {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function safeTitle(code: string, status: number) {
  if (code === 'REVIEW_APPROVAL_REQUIRED')
    return 'Review approval is required before publication.'
  if (code === 'IDEMPOTENCY_CONFLICT')
    return 'The retry key conflicts with an earlier request.'
  if (code === 'INVALID_STATE_TRANSITION')
    return 'The resource changed; refresh before retrying.'
  if (code === 'CONTENT_COMMAND_OUTCOME_UNKNOWN')
    return 'The command outcome is unknown; refresh before retrying.'
  if (code === 'CONTENT_TIMEOUT') return 'Content request timed out.'
  if (code === 'CONTENT_UNAVAILABLE') return 'Content is unavailable.'
  if (status === 401) return 'Authentication is required.'
  if (status === 403) return 'Access is forbidden.'
  if (status === 404) return 'Resource was not found.'
  if (status === 422) return 'Request validation failed.'
  return 'Content request failed.'
}

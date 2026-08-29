import 'server-only'

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/api-error'

import { isUuid, type ValidationViolation } from './identity-validation'

export const CORRELATION_HEADER = 'X-Correlation-Id'

type SafeProblem = Readonly<{
  type: string
  title: string
  status: number
  code: string
  correlationId: string
  violations?: readonly ValidationViolation[]
}>

export function correlationIdFrom(request: Request) {
  const supplied = request.headers.get(CORRELATION_HEADER)
  return isUuid(supplied) ? supplied : randomUUID()
}

export function problemResponse(problem: SafeProblem) {
  const response = NextResponse.json(problem, { status: problem.status })
  response.headers.set('Content-Type', 'application/problem+json')
  response.headers.set(CORRELATION_HEADER, problem.correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function localProblem(
  status: number,
  code: string,
  title: string,
  correlationId: string,
  violations?: readonly ValidationViolation[],
) {
  return problemResponse({
    type: `/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    code,
    correlationId,
    ...(violations === undefined ? {} : { violations }),
  })
}

export function identityErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) {
    const status = error.status ?? 502
    const problem = error.problem
    const code = safeCode(error.code)
    const violations = problem?.violations
      ?.map((violation) => safeViolation(violation.field, violation.code))
      .filter((violation) => violation !== null)
    const responseCorrelationId =
      error.correlationId && isUuid(error.correlationId)
        ? error.correlationId
        : correlationId

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
    'IDENTITY_DEPENDENCY_FAILED',
    'Identity request failed.',
    correlationId,
  )
}

function safeCode(code: string) {
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'IDENTITY_UPSTREAM_ERROR'
}

function safeViolation(field: string, code: string) {
  if (
    !/^[A-Za-z0-9_.\[\]-]{1,64}$/.test(field) ||
    !/^[A-Z0-9_]{1,64}$/.test(code)
  ) {
    return null
  }

  return { field, code }
}

function safeTitle(code: string, status: number) {
  if (code === 'VALIDATION_FAILED') return 'Request validation failed.'
  if (code === 'INVALID_CREDENTIALS') return 'Credentials are invalid.'
  if (code === 'INVALID_SESSION') return 'Session is invalid.'
  if (code === 'UNAUTHORIZED' || code === 'SESSION_REQUIRED') {
    return 'Authentication is required.'
  }
  if (code === 'IDENTITY_TIMEOUT') return 'Identity request timed out.'
  if (code === 'IDENTITY_UNAVAILABLE') return 'Identity is unavailable.'
  if (code === 'IDENTITY_MALFORMED_RESPONSE') {
    return 'Identity returned an invalid response.'
  }
  if (status === 429) return 'Too many requests.'
  if (status === 409) return 'Request conflict.'
  if (status >= 400 && status < 500) return 'Identity request was rejected.'

  return 'Identity request failed.'
}

export function successResponse<T>(
  body: T,
  correlationId: string,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function noContentResponse(correlationId: string) {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

import 'server-only'

import { NextResponse } from 'next/server'
import {
  CORRELATION_HEADER,
  localProblem,
  problemResponse,
} from '@/lib/auth/bff-response'
import { CommunityServiceError } from './community-client'

export { localProblem }

export function communityErrorResponse(error: unknown, correlationId: string) {
  if (!(error instanceof CommunityServiceError)) {
    return localProblem(
      502,
      'COMMUNITY_DEPENDENCY_FAILED',
      'Community request failed.',
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
  })
}

export function communitySuccessResponse<T>(
  body: T,
  correlationId: string,
  headers?: HeadersInit,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  if (headers) {
    new Headers(headers).forEach((value, name) =>
      response.headers.set(name, value),
    )
  }
  return response
}

export function communityNoContentResponse(
  correlationId: string,
  status = 204,
) {
  const response = new NextResponse(null, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function safeTitle(code: string, status: number) {
  if (code === 'INVALID_CURSOR' || status === 400)
    return 'Community request is invalid.'
  if (status === 401) return 'Authentication is required.'
  if (status === 403) return 'Access is forbidden.'
  if (code === 'COMMUNITY_PROFILE_NOT_FOUND')
    return 'Community profile was not found.'
  if (code === 'COMMUNITY_MEDIA_NOT_FOUND')
    return 'Community media was not found.'
  if (code === 'COMMUNITY_COMMENT_NOT_FOUND')
    return 'Community comment was not found.'
  if (status === 404) return 'Community post was not found.'
  if (code === 'COMMUNITY_TIMEOUT') return 'Community request timed out.'
  if (code === 'COMMUNITY_UNAVAILABLE') return 'Community is unavailable.'
  return 'Community request failed.'
}

import 'server-only'

import { NextResponse } from 'next/server'
import {
  CORRELATION_HEADER,
  localProblem,
  problemResponse,
} from '@/lib/auth/bff-response'
import { ConsultationServiceError } from './consultation-client'

export { localProblem }

export function consultationSuccess<T>(
  body: T,
  correlationId: string,
  etag?: string | null,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  if (etag) response.headers.set('ETag', etag)
  return response
}

export function consultationFailure(error: unknown, correlationId: string) {
  if (!(error instanceof ConsultationServiceError))
    return localProblem(
      502,
      'CONSULTATION_DEPENDENCY_FAILED',
      'Consultation request failed.',
      correlationId,
    )
  return problemResponse({
    type: `/problems/${error.code.toLowerCase().replaceAll('_', '-')}`,
    title:
      error.status === 412
        ? 'Dữ liệu đã thay đổi. Vui lòng tải lại.'
        : error.message,
    status: error.status,
    code: error.code,
    correlationId: error.correlationId ?? correlationId,
  })
}

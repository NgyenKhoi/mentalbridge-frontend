import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'
import {
  ConsultationInputError,
  parseProfileInput,
  validEtag,
} from '@/lib/consultation/consultation-validation'

import {
  specialistMockService,
} from '@/lib/mock/specialist-mock-service'

async function authorize(request: NextRequest, correlationId: string) {
  return authenticatedConsultationActor(request, correlationId, ['SPECIALIST'])
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const mockEnabled = request.nextUrl.searchParams.get('mock') === 'true'

  let actor
  try {
    actor = await authorize(request, correlationId)
  } catch (error) {
    if (mockEnabled) {
      const mock = specialistMockService.getProfile()
      return consultationSuccess(mock.data, correlationId, mock.etag)
    }
    return consultationAuthenticationFailure(error, correlationId)
  }

  if (mockEnabled) {
    const mock = specialistMockService.getProfile()
    return carryConsultationSession(
      consultationSuccess(mock.data, correlationId, mock.etag),
      actor,
    )
  }

  try {
    const result = await consultationClient.own(
      actor.accessToken,
      correlationId,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const mockEnabled = request.nextUrl.searchParams.get('mock') === 'true'

  const etag = request.headers.get('If-Match')
  if (etag !== null && !validEtag(etag))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'If-Match không hợp lệ.',
      correlationId,
    )

  if (mockEnabled) {
    try {
      const body = parseProfileInput(await readBoundedJson(request, 8 * 1024))
      const updated = specialistMockService.updateProfile(body)
      let actor
      try {
        actor = await authorize(request, correlationId)
      } catch {
        // mock preview allowed without active session
      }
      const res = consultationSuccess(
        updated.data,
        correlationId,
        updated.etag,
        200,
      )
      return actor ? carryConsultationSession(res, actor) : res
    } catch (error) {
      if (error instanceof ConsultationInputError)
        return localProblem(
          422,
          'VALIDATION_FAILED',
          `Trường ${error.field} không hợp lệ.`,
          correlationId,
          [{ field: error.field, code: 'INVALID_VALUE' }],
        )
      if (error instanceof RequestBodyError)
        return localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        )
      return consultationFailure(error, correlationId)
    }
  }

  let actor
  try {
    actor = await authorize(request, correlationId)
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }

  try {
    const body = parseProfileInput(await readBoundedJson(request, 8 * 1024))
    const result = await consultationClient.save(
      actor.accessToken,
      correlationId,
      body,
      etag ?? undefined,
    )
    return carryConsultationSession(
      consultationSuccess(
        result.data,
        correlationId,
        result.etag,
        etag ? 200 : 201,
      ),
      actor,
    )
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          `Trường ${error.field} không hợp lệ.`,
          correlationId,
          [{ field: error.field, code: 'INVALID_VALUE' }],
        ),
        actor,
      )
    if (error instanceof RequestBodyError)
      return carryConsultationSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        actor,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

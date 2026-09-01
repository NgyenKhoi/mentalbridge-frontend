import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import type {
  AnonymousAssessment,
  AnonymousSession,
  Assessment,
  AssessmentSubmissionRequest,
  Questionnaire,
} from '@/features/assessment/api/care-contract'
import { readCareServerConfig } from '@/lib/config/server'

import {
  parseAnonymousAssessment,
  parseAnonymousSession,
  parseAssessment,
  parseQuestionnaire,
} from './care-validation'

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST'
  path: string
  correlationId: string
  authorization?: string
  anonymousSessionToken?: string
  idempotencyKey?: string
  body?: unknown
  parseSuccess: (value: unknown) => T | null
}>

const MAX_CARE_RESPONSE_BYTES = 128 * 1_024

function upstreamUrl(baseUrl: string, path: string) {
  return new URL(path.replace(/^\//, ''), baseUrl)
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  const contentLength = Number(response.headers.get('content-length'))

  if (!contentType.toLowerCase().includes('json')) {
    throw malformedResponse()
  }
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_CARE_RESPONSE_BYTES
  ) {
    throw malformedResponse()
  }

  try {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_CARE_RESPONSE_BYTES) {
      throw malformedResponse()
    }
    return JSON.parse(text) as unknown
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    throw malformedResponse(cause)
  }
}

function malformedResponse(cause?: unknown) {
  return new ApiError({
    message: 'Care returned an invalid response.',
    code: 'CARE_MALFORMED_RESPONSE',
    status: 502,
    cause,
  })
}

async function careRequest<T>(options: RequestOptions<T>): Promise<T> {
  const config = readCareServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(upstreamUrl(config.baseUrl, options.path), {
      method: options.method,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/problem+json',
        'X-Correlation-Id': options.correlationId,
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(options.authorization === undefined
          ? {}
          : { Authorization: `Bearer ${options.authorization}` }),
        ...(options.anonymousSessionToken === undefined
          ? {}
          : {
              'X-Anonymous-Session-Token': options.anonymousSessionToken,
            }),
        ...(options.idempotencyKey === undefined
          ? {}
          : { 'Idempotency-Key': options.idempotencyKey }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    })

    if (!response.ok) {
      const body = await readJson(response)
      if (isProblemDetails(body)) {
        throw new ApiError({
          message: body.title,
          code: body.code,
          status: response.status,
          correlationId: body.correlationId,
          problem: body,
        })
      }
      throw malformedResponse()
    }

    const parsed = options.parseSuccess(await readJson(response))
    if (!parsed) throw malformedResponse()
    return parsed
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError({
        message: 'Care request timed out.',
        code: 'CARE_TIMEOUT',
        status: 504,
        cause: error,
      })
    }
    throw new ApiError({
      message: 'Care is unavailable.',
      code: 'CARE_UNAVAILABLE',
      status: 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export const careClient = {
  currentPhq9(correlationId: string): Promise<Questionnaire> {
    const { questionnaireLocale } = readCareServerConfig()
    return careRequest({
      method: 'GET',
      path: `/api/v1/questionnaires/PHQ9/current?locale=${encodeURIComponent(questionnaireLocale)}`,
      correlationId,
      parseSuccess: parseQuestionnaire,
    })
  },

  createAnonymousSession(correlationId: string): Promise<AnonymousSession> {
    return careRequest({
      method: 'POST',
      path: '/api/v1/anonymous-assessment-sessions',
      correlationId,
      parseSuccess: parseAnonymousSession,
    })
  },

  submitAnonymous(
    sessionId: string,
    sessionToken: string,
    request: AssessmentSubmissionRequest,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<AnonymousAssessment> {
    return careRequest({
      method: 'POST',
      path: `/api/v1/anonymous-assessment-sessions/${sessionId}/assessments`,
      correlationId,
      anonymousSessionToken: sessionToken,
      idempotencyKey,
      body: request,
      parseSuccess: parseAnonymousAssessment,
    })
  },

  getAnonymous(
    sessionId: string,
    sessionToken: string,
    assessmentId: string,
    correlationId: string,
  ): Promise<AnonymousAssessment> {
    return careRequest({
      method: 'GET',
      path: `/api/v1/anonymous-assessment-sessions/${sessionId}/assessments/${assessmentId}`,
      correlationId,
      anonymousSessionToken: sessionToken,
      parseSuccess: parseAnonymousAssessment,
    })
  },

  submitAuthenticated(
    accessToken: string,
    request: AssessmentSubmissionRequest,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<Assessment> {
    return careRequest({
      method: 'POST',
      path: '/api/v1/assessments',
      correlationId,
      authorization: accessToken,
      idempotencyKey,
      body: request,
      parseSuccess: parseAssessment,
    })
  },

  getAuthenticated(
    accessToken: string,
    assessmentId: string,
    correlationId: string,
  ): Promise<Assessment> {
    return careRequest({
      method: 'GET',
      path: `/api/v1/assessments/${assessmentId}`,
      correlationId,
      authorization: accessToken,
      parseSuccess: parseAssessment,
    })
  },
}

import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { isProblemDetails } from '@/lib/api/problem-details'
import type {
  AnonymousAssessment,
  AnonymousSession,
  Assessment,
  AssessmentSubmissionRequest,
  Questionnaire,
  CareProfile,
  CareProfileUpdate,
  ConsentCollection,
  ConsentDecision,
  ConsentDecisionRequest,
  PrivacyDisclosure,
  AssessmentHistoryPage,
  AssessmentProgress,
} from '@/features/assessment/api/care-contract'
import { readCareServerConfig } from '@/lib/config/server'

import {
  parseAnonymousAssessment,
  parseAnonymousSession,
  parseAssessment,
  parseQuestionnaire,
  parseProfile,
  parsePrivacyDisclosure,
  parseConsentCollection,
  parseAssessmentHistory,
  parseAssessmentProgress,
} from './care-validation'

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST' | 'PUT'
  path: string
  correlationId: string
  authorization?: string
  anonymousSessionToken?: string
  idempotencyKey?: string
  ifMatch?: number
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
        ...(options.ifMatch === undefined
          ? {}
          : { 'If-Match': `"${options.ifMatch}"` }),
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
  currentPrivacyDisclosure(correlationId: string): Promise<PrivacyDisclosure> {
    return careRequest({
      method: 'GET',
      path: '/api/v1/privacy-disclosures/current?locale=vi-VN',
      correlationId,
      parseSuccess: parsePrivacyDisclosure,
    })
  },

  getProfile(accessToken: string, correlationId: string): Promise<CareProfile> {
    return careRequest({
      method: 'GET',
      path: '/api/v1/profile',
      correlationId,
      authorization: accessToken,
      parseSuccess: parseProfile,
    })
  },

  putProfile(
    accessToken: string,
    request: CareProfileUpdate,
    version: number | undefined,
    correlationId: string,
  ): Promise<CareProfile> {
    return careRequest({
      method: 'PUT',
      path: '/api/v1/profile',
      correlationId,
      authorization: accessToken,
      ifMatch: version,
      body: request,
      parseSuccess: parseProfile,
    })
  },

  getConsents(
    accessToken: string,
    correlationId: string,
  ): Promise<ConsentCollection> {
    return careRequest({
      method: 'GET',
      path: '/api/v1/consents',
      correlationId,
      authorization: accessToken,
      parseSuccess: parseConsentCollection,
    })
  },

  recordConsent(
    accessToken: string,
    request: ConsentDecisionRequest,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<ConsentDecision> {
    return careRequest({
      method: 'POST',
      path: '/api/v1/consent-decisions',
      correlationId,
      authorization: accessToken,
      idempotencyKey,
      body: request,
      parseSuccess: (value) => {
        const parsed = parseConsentCollection({ decisions: [value] })
        return parsed?.decisions[0] ?? null
      },
    })
  },

  history(
    accessToken: string,
    cursor: string | undefined,
    limit: number,
    correlationId: string,
  ): Promise<AssessmentHistoryPage> {
    const query = new URLSearchParams({ limit: String(limit) })
    if (cursor) query.set('cursor', cursor)
    return careRequest({
      method: 'GET',
      path: `/api/v1/assessments?${query}`,
      correlationId,
      authorization: accessToken,
      parseSuccess: parseAssessmentHistory,
    })
  },
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

  progress(
    accessToken: string,
    assessmentId: string,
    correlationId: string,
  ): Promise<AssessmentProgress> {
    return careRequest({
      method: 'GET',
      path: `/api/v1/assessments/${assessmentId}/progress`,
      correlationId,
      authorization: accessToken,
      parseSuccess: parseAssessmentProgress,
    })
  },
}

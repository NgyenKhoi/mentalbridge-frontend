import type { NextRequest } from 'next/server'

import type { ReassessmentSelfReportCreateRequest } from '@/features/assessment/api/care-contract'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import { isCareIdempotencyKey } from '@/lib/care/care-validation'

const experiences = new Set([
  'BETTER',
  'ABOUT_THE_SAME',
  'MORE_DIFFICULT',
  'UNSURE',
])

function boundedContext(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length <= 500)
  )
}

function createRequest(
  value: unknown,
): ReassessmentSelfReportCreateRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const body = value as Record<string, unknown>
  const period = body.currentPeriod
  if (
    typeof period !== 'object' ||
    period === null ||
    Array.isArray(period) ||
    !experiences.has(String(body.currentExperience)) ||
    !boundedContext(body.helpfulContext) ||
    !boundedContext(body.difficultContext)
  )
    return null
  const currentPeriod = period as Record<string, unknown>
  if (
    typeof currentPeriod.startAt !== 'string' ||
    typeof currentPeriod.endAt !== 'string' ||
    !Number.isFinite(Date.parse(currentPeriod.startAt)) ||
    !Number.isFinite(Date.parse(currentPeriod.endAt))
  )
    return null
  return {
    currentPeriod: {
      startAt: currentPeriod.startAt,
      endAt: currentPeriod.endAt,
    },
    currentExperience:
      body.currentExperience as ReassessmentSelfReportCreateRequest['currentExperience'],
    helpfulContext:
      typeof body.helpfulContext === 'string'
        ? body.helpfulContext.trim() || null
        : null,
    difficultContext:
      typeof body.difficultContext === 'string'
        ? body.difficultContext.trim() || null
        : null,
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.currentReassessmentSelfReport(
          user.accessToken,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const key = request.headers.get('idempotency-key')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const parsed = createRequest(body)
  if (!isCareIdempotencyKey(key) || !parsed) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
      ),
      user,
    )
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.createReassessmentSelfReport(
          user.accessToken,
          parsed,
          key,
          correlationId,
        ),
        correlationId,
        201,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

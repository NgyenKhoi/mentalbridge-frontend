import type { NextRequest } from 'next/server'

import type { ReassessmentSummaryCreateRequest } from '@/features/assessment/api/care-contract'
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
import { isCareIdempotencyKey, isUuid } from '@/lib/care/care-validation'

function period(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const item = value as Record<string, unknown>
  if (
    typeof item.startAt !== 'string' ||
    typeof item.endAt !== 'string' ||
    !Number.isFinite(Date.parse(item.startAt)) ||
    !Number.isFinite(Date.parse(item.endAt)) ||
    Date.parse(item.startAt) >= Date.parse(item.endAt)
  )
    return null
  return { startAt: item.startAt, endAt: item.endAt }
}

function composeRequest(
  value: unknown,
): ReassessmentSummaryCreateRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const body = value as Record<string, unknown>
  const previousPeriod = period(body.previousPeriod)
  const currentPeriod = period(body.currentPeriod)
  if (
    !isUuid(body.phq9AssessmentId) ||
    !isUuid(body.gad7AssessmentId) ||
    !isUuid(body.journalJobId) ||
    body.journalAnalysisId !== undefined ||
    (body.selfReportId !== undefined && !isUuid(body.selfReportId)) ||
    !previousPeriod ||
    !currentPeriod
  )
    return null
  return {
    phq9AssessmentId: body.phq9AssessmentId,
    gad7AssessmentId: body.gad7AssessmentId,
    journalJobId: body.journalJobId,
    previousPeriod,
    currentPeriod,
    ...(typeof body.selfReportId === 'string'
      ? { selfReportId: body.selfReportId }
      : {}),
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
        await careClient.reassessmentContext(user.accessToken, correlationId),
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
  const parsed = composeRequest(body)
  if (!isCareIdempotencyKey(key) || !parsed)
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
      ),
      user,
    )
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.composeReassessmentSummary(
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

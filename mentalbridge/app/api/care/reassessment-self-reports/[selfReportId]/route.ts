import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import type { ReassessmentSelfReportReplaceRequest } from '@/features/assessment/api/care-contract'
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
import { isUuid } from '@/lib/care/care-validation'

const experiences = new Set([
  'BETTER',
  'ABOUT_THE_SAME',
  'MORE_DIFFICULT',
  'UNSURE',
])

function version(value: string | null) {
  if (!value || !/^"\d+"$/.test(value)) return null
  const parsed = Number(value.slice(1, -1))
  return Number.isSafeInteger(parsed) ? parsed : null
}

function replaceRequest(
  value: unknown,
): ReassessmentSelfReportReplaceRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const body = value as Record<string, unknown>
  const contexts = [body.helpfulContext, body.difficultContext]
  if (
    !experiences.has(String(body.currentExperience)) ||
    contexts.some(
      (context) =>
        context !== undefined &&
        context !== null &&
        (typeof context !== 'string' || context.trim().length > 500),
    )
  )
    return null
  return {
    currentExperience:
      body.currentExperience as ReassessmentSelfReportReplaceRequest['currentExperience'],
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

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/reassessment-self-reports/[selfReportId]'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { selfReportId } = await context.params
  const expectedVersion = version(request.headers.get('if-match'))
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const parsed = replaceRequest(body)
  if (!isUuid(selfReportId) || expectedVersion === null || !parsed) {
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
        await careClient.replaceReassessmentSelfReport(
          user.accessToken,
          selfReportId,
          expectedVersion,
          parsed,
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

export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/care/reassessment-self-reports/[selfReportId]'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { selfReportId } = await context.params
  const expectedVersion = version(request.headers.get('if-match'))
  if (!isUuid(selfReportId) || expectedVersion === null)
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
    await careClient.deleteReassessmentSelfReport(
      user.accessToken,
      selfReportId,
      expectedVersion,
      correlationId,
    )
    const response = new NextResponse(null, { status: 204 })
    response.headers.set('X-Correlation-Id', correlationId)
    response.headers.set('Cache-Control', 'no-store')
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

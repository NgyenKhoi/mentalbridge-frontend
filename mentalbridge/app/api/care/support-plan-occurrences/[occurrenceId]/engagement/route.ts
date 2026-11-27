import type { NextRequest } from 'next/server'

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
import { parseEngagementRequest } from '@/lib/care/support-plan-engagement-request'

const VERSION = /^"(0|[1-9]\d*)"$/

type Context =
  RouteContext<'/api/care/support-plan-occurrences/[occurrenceId]/engagement'>

function versionFrom(request: NextRequest) {
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  return match ? Number(match[1]) : Number.NaN
}

async function authenticated(request: NextRequest, correlationId: string) {
  try {
    return { user: await authenticatedCareUser(request, correlationId) }
  } catch (error) {
    return { failure: careAuthenticationFailure(error, correlationId) }
  }
}

function invalid(correlationId: string) {
  return localProblem(
    400,
    'VALIDATION_FAILED',
    'A valid occurrence id, If-Match, and engagement are required.',
    correlationId,
  )
}

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const auth = await authenticated(request, correlationId)
  if (auth.failure) return auth.failure
  const user = auth.user!
  const { occurrenceId } = await context.params
  const version = versionFrom(request)
  const body = parseEngagementRequest(await request.json().catch(() => null))
  if (!isUuid(occurrenceId) || !Number.isSafeInteger(version) || !body) {
    return carryCareSession(invalid(correlationId), user)
  }

  try {
    const occurrence = await careClient.replaceSupportPlanOccurrenceEngagement(
      user.accessToken,
      occurrenceId,
      version,
      body,
      correlationId,
    )
    const response = careSuccessResponse(occurrence, correlationId)
    response.headers.set('ETag', `"${occurrence.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const auth = await authenticated(request, correlationId)
  if (auth.failure) return auth.failure
  const user = auth.user!
  const { occurrenceId } = await context.params
  const version = versionFrom(request)
  if (!isUuid(occurrenceId) || !Number.isSafeInteger(version)) {
    return carryCareSession(invalid(correlationId), user)
  }

  try {
    const occurrence = await careClient.deleteSupportPlanOccurrenceEngagement(
      user.accessToken,
      occurrenceId,
      version,
      correlationId,
    )
    const response = careSuccessResponse(occurrence, correlationId)
    response.headers.set('ETag', `"${occurrence.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

import type { NextRequest } from 'next/server'

import type { ReplaceSupportPlanOccurrenceEngagementRequest } from '@/features/support-plan/api/support-plan-contract'
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

const VERSION = /^"(0|[1-9]\d*)"$/
const STATES = new Set(['SCHEDULED', 'COMPLETED', 'SKIPPED'])
const HELPFULNESS = new Set([
  'NOT_HELPFUL',
  'A_LITTLE_HELPFUL',
  'HELPFUL',
  'VERY_HELPFUL',
])
const BARRIERS = new Set([
  'LOW_ENERGY',
  'NOT_ENOUGH_TIME',
  'DIFFICULT_TO_START',
  'NOT_A_GOOD_FIT',
  'OTHER',
])
const ENGAGEMENT_FIELDS = [
  'state',
  'hidden',
  'helpfulness',
  'barrierCode',
  'reflection',
  'summaryReuseApproved',
] as const

type Context =
  RouteContext<'/api/care/support-plan-occurrences/[occurrenceId]/engagement'>

function versionFrom(request: NextRequest) {
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  return match ? Number(match[1]) : Number.NaN
}

function engagementRequest(value: unknown) {
  if (typeof value !== 'object' || value === null) return null
  const body = value as Record<string, unknown>
  const reflection = body.reflection
  if (
    Object.keys(body).some(
      (key) =>
        !ENGAGEMENT_FIELDS.includes(key as (typeof ENGAGEMENT_FIELDS)[number]),
    ) ||
    ENGAGEMENT_FIELDS.some((key) => !(key in body)) ||
    !STATES.has(String(body.state)) ||
    typeof body.hidden !== 'boolean' ||
    typeof body.summaryReuseApproved !== 'boolean' ||
    !(
      body.helpfulness === null ||
      (typeof body.helpfulness === 'string' &&
        HELPFULNESS.has(body.helpfulness))
    ) ||
    !(
      body.barrierCode === null ||
      (typeof body.barrierCode === 'string' && BARRIERS.has(body.barrierCode))
    ) ||
    !(
      reflection === null ||
      (typeof reflection === 'string' &&
        reflection.trim().length > 0 &&
        reflection.length <= 500)
    ) ||
    (body.state === 'SCHEDULED' &&
      (body.helpfulness !== null ||
        body.barrierCode !== null ||
        reflection !== null ||
        body.summaryReuseApproved)) ||
    (body.state === 'COMPLETED' && body.barrierCode !== null) ||
    (body.state === 'SKIPPED' && body.helpfulness !== null)
  )
    return null
  return body as ReplaceSupportPlanOccurrenceEngagementRequest
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
  const body = engagementRequest(await request.json().catch(() => null))
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

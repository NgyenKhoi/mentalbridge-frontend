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

const VERSION = /^"(0|[1-9]\d*)"$/
const STATUSES = new Set(['ACTIVE', 'PAUSED', 'COMPLETED', 'DISCARDED'])
const COMPLETION_REASONS = new Set([
  'USER_DECISION',
  'PLAN_NO_LONGER_FITS',
  'OTHER',
])

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plans/[supportPlanId]/status'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { supportPlanId } = await context.params
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  const version = match ? Number(match[1]) : Number.NaN
  const body: unknown = await request.json().catch(() => null)
  const record =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  const status = record?.status
  const completionReason = record?.completionReason
  const keysAreValid =
    record !== null &&
    Object.keys(record).every((key) =>
      ['status', 'completionReason'].includes(key),
    )
  if (
    !isUuid(supportPlanId) ||
    !Number.isSafeInteger(version) ||
    typeof status !== 'string' ||
    !STATUSES.has(status) ||
    !keysAreValid ||
    (completionReason !== undefined &&
      (status !== 'COMPLETED' ||
        typeof completionReason !== 'string' ||
        !COMPLETION_REASONS.has(completionReason)))
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid plan id, If-Match, and target status are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const plan = await careClient.changeSupportPlanStatus(
      user.accessToken,
      supportPlanId,
      version,
      completionReason === undefined
        ? { status: status as 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED' }
        : {
            status: status as 'COMPLETED',
            completionReason: completionReason as
              'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER',
          },
      correlationId,
    )
    const response = careSuccessResponse(plan, correlationId)
    response.headers.set('ETag', `"${plan.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

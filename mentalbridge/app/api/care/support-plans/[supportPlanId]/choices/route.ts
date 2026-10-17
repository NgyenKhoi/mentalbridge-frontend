import type { NextRequest } from 'next/server'

import type { ReplaceSupportPlanChoicesRequest } from '@/features/support-plan/api/support-plan-contract'
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
const CONTENT_VERSION = /^\d+$/

function expectedVersion(request: NextRequest) {
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  if (!match) return null
  const value = Number(match[1])
  return Number.isSafeInteger(value) ? value : null
}

function choices(value: unknown): ReplaceSupportPlanChoicesRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const selections = (value as Record<string, unknown>).slotSelections
  if (
    !Array.isArray(selections) ||
    selections.length < 1 ||
    selections.length > 5
  ) {
    return null
  }
  const slotIds = new Set<string>()
  for (const selection of selections) {
    if (
      typeof selection !== 'object' ||
      selection === null ||
      Array.isArray(selection)
    ) {
      return null
    }
    const item = selection as Record<string, unknown>
    if (
      typeof item.slotId !== 'string' ||
      item.slotId.length < 1 ||
      item.slotId.length > 64 ||
      slotIds.has(item.slotId) ||
      !isUuid(String(item.resourceId)) ||
      typeof item.contentVersion !== 'string' ||
      !CONTENT_VERSION.test(item.contentVersion)
    ) {
      return null
    }
    slotIds.add(item.slotId)
  }
  return value as ReplaceSupportPlanChoicesRequest
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plans/[supportPlanId]/choices'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { supportPlanId } = await context.params
  const version = expectedVersion(request)
  let body: ReplaceSupportPlanChoicesRequest | null = null
  try {
    body = choices(await request.json())
  } catch {
    // The stable validation response below covers malformed JSON as well.
  }

  if (!isUuid(supportPlanId) || version === null || !body) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid plan id, If-Match, and choice set are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const plan = await careClient.replaceSupportPlanChoices(
      user.accessToken,
      supportPlanId,
      body,
      version,
      correlationId,
    )
    const response = careSuccessResponse(plan, correlationId)
    response.headers.set('ETag', `"${plan.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

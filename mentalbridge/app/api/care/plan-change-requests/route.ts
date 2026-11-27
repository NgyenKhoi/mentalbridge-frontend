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
import { isCareIdempotencyKey, isUuid } from '@/lib/care/care-validation'

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
  const proposalId =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).proposalId
      : null
  if (!isCareIdempotencyKey(key) || !isUuid(proposalId)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid proposal id and Idempotency-Key are required.',
        correlationId,
      ),
      user,
    )
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.createPlanChangeRequest(
          user.accessToken,
          { proposalId },
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

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const proposalId = request.nextUrl.searchParams.get('proposalId')
  if (!isUuid(proposalId)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid proposal id is required.',
        correlationId,
      ),
      user,
    )
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.planChangeRequestByProposal(
          user.accessToken,
          proposalId,
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

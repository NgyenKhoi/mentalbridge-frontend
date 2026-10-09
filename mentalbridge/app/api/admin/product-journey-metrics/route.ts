import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  successResponse,
} from '@/lib/auth/bff-response'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from '@/lib/auth/admin-actor'
import { identityClient } from '@/lib/auth/identity-client'

const MAXIMUM_WINDOW_MS = 366 * 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const fromTime = from ? Date.parse(from) : Number.NaN
  const toTime = to ? Date.parse(to) : Number.NaN
  if (
    !from ||
    !to ||
    !Number.isFinite(fromTime) ||
    !Number.isFinite(toTime) ||
    fromTime >= toTime ||
    toTime - fromTime > MAXIMUM_WINDOW_MS
  ) {
    return Response.json(
      { code: 'INVALID_PRODUCT_JOURNEY_WINDOW' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }
  try {
    const metrics = await identityClient.productJourneyMetrics(
      actor.accessToken,
      { from, to },
      correlationId,
    )
    return carryAdminSession(successResponse(metrics, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

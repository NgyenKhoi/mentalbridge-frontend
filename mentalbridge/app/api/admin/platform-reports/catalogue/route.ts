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

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }
  try {
    const catalogue = await identityClient.platformReportCatalogue(
      actor.accessToken,
      correlationId,
    )
    return carryAdminSession(successResponse(catalogue, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

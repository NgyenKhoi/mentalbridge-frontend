import type { NextRequest } from 'next/server'
import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  successResponse,
} from '@/lib/auth/bff-response'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from '@/lib/auth/admin-actor'
import { administrationAuditSearch } from '@/lib/auth/audit-validation'
import { identityClient } from '@/lib/auth/identity-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const filters = administrationAuditSearch(request.nextUrl.searchParams, true)
  if (!filters) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Audit filters are invalid.',
      correlationId,
    )
  }

  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }

  try {
    const page = await identityClient.browseAdministrationAuditEvents(
      actor.accessToken,
      filters,
      correlationId,
    )
    return carryAdminSession(successResponse(page, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

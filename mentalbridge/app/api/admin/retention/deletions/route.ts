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
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') ?? undefined
  const holdType = searchParams.get('holdType') ?? undefined
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : undefined
  const pageParam = searchParams.get('page')
  const pageNumber = pageParam !== null && pageParam !== undefined ? Number(pageParam) : undefined

  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }

  try {
    const page = await identityClient.getDeletionRequests(
      actor.accessToken,
      { status, holdType, limit, page: pageNumber },
      correlationId,
    )
    return carryAdminSession(successResponse(page, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

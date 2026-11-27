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
import { identityClient } from '@/lib/auth/identity-client'
import {
  isValidAccountStatus,
  isValidEmail,
  isValidIdentityRole,
} from '@/lib/auth/identity-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const search = request.nextUrl.searchParams
  const status = search.get('status')
  const role = search.get('role')
  const email = search.get('email')
  const cursor = search.get('cursor')
  const rawLimit = search.get('limit')
  const limit = rawLimit === null ? undefined : Number(rawLimit)

  if (
    (status !== null && !isValidAccountStatus(status)) ||
    (role !== null && !isValidIdentityRole(role)) ||
    (email !== null && !isValidEmail(email)) ||
    (cursor !== null && (cursor.length < 1 || cursor.length > 512)) ||
    (limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 100))
  ) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Account search parameters are invalid.',
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
    const page = await identityClient.searchAccounts(
      actor.accessToken,
      {
        ...(status === null ? {} : { status }),
        ...(role === null ? {} : { role }),
        ...(email === null ? {} : { email }),
        ...(cursor === null ? {} : { cursor }),
        ...(limit === undefined ? {} : { limit }),
      },
      correlationId,
    )
    return carryAdminSession(successResponse(page, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

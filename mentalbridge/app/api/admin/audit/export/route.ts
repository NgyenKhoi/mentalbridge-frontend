import { NextResponse, type NextRequest } from 'next/server'
import {
  CORRELATION_HEADER,
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
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
  const filters = administrationAuditSearch(request.nextUrl.searchParams, false)
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
    const exported = await identityClient.exportAdministrationAuditEvents(
      actor.accessToken,
      filters,
      correlationId,
    )
    const body = exported.bytes.buffer.slice(
      exported.bytes.byteOffset,
      exported.bytes.byteOffset + exported.bytes.byteLength,
    ) as ArrayBuffer
    const response = new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=UTF-8',
        'Content-Disposition': exported.contentDisposition,
        'Cache-Control': 'no-store',
        [CORRELATION_HEADER]: correlationId,
      },
    })
    return carryAdminSession(response, actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

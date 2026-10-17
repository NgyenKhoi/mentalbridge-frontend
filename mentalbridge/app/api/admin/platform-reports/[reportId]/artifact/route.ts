import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
} from '@/lib/auth/bff-response'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from '@/lib/auth/admin-actor'
import { identityClient } from '@/lib/auth/identity-client'
import { isUuid } from '@/lib/auth/identity-validation'

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/admin/platform-reports/[reportId]/artifact'>,
) {
  const correlationId = correlationIdFrom(request)
  const { reportId } = await context.params
  if (!isUuid(reportId)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Report identifier is invalid.',
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
    const artifact = await identityClient.downloadPlatformReport(
      actor.accessToken,
      reportId,
      correlationId,
    )
    const response = new NextResponse(artifact.content, { status: 200 })
    response.headers.set('Content-Type', artifact.contentType)
    response.headers.set('Content-Length', String(artifact.content.byteLength))
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Correlation-Id', correlationId)
    if (artifact.contentDisposition)
      response.headers.set('Content-Disposition', artifact.contentDisposition)
    if (artifact.sha256)
      response.headers.set('X-Content-SHA256', artifact.sha256)
    if (artifact.retainedUntil)
      response.headers.set('X-Retained-Until', artifact.retainedUntil)
    return carryAdminSession(response, actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

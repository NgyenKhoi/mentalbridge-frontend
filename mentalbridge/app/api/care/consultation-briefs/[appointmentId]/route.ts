import { NextResponse, type NextRequest } from 'next/server'

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

type Context = RouteContext<'/api/care/consultation-briefs/[appointmentId]'>

async function actor(request: NextRequest, correlationId: string) {
  try {
    return await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
}

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const user = await actor(request, correlationId)
  if (user instanceof Response) return user
  const { appointmentId } = await context.params
  if (!isUuid(appointmentId))
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid appointment id is required.',
        correlationId,
      ),
      user,
    )
  try {
    const brief = await careClient.consultationBrief(
      user.accessToken,
      appointmentId,
      correlationId,
    )
    const response = careSuccessResponse(brief, correlationId)
    response.headers.set('ETag', `"${brief.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const user = await actor(request, correlationId)
  if (user instanceof Response) return user
  const { appointmentId } = await context.params
  const version = versionHeader(request)
  if (!isUuid(appointmentId) || version === null)
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid appointment id and If-Match version are required.',
        correlationId,
      ),
      user,
    )
  try {
    await careClient.deleteConsultationBrief(
      user.accessToken,
      appointmentId,
      version,
      correlationId,
    )
    return carryCareSession(new NextResponse(null, { status: 204 }), user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

function versionHeader(request: NextRequest) {
  const value = request.headers.get('if-match')
  return value && /^"\d+"$/.test(value) ? Number(value.slice(1, -1)) : null
}

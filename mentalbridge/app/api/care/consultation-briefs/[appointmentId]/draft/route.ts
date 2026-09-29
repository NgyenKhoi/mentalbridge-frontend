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
import { isUuid } from '@/lib/care/care-validation'
import { parseConsultationBriefDraftRequest } from '@/lib/care/consultation-brief-validation'

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/consultation-briefs/[appointmentId]/draft'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  const body = parseConsultationBriefDraftRequest(
    await request.json().catch(() => null),
  )
  const rawVersion = request.headers.get('if-match')
  const version =
    rawVersion && /^"\d+"$/.test(rawVersion)
      ? Number(rawVersion.slice(1, -1))
      : undefined
  if (
    !isUuid(appointmentId) ||
    !body ||
    (rawVersion !== null && version === undefined)
  )
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Consultation brief draft is invalid.',
        correlationId,
      ),
      user,
    )
  try {
    const brief = await careClient.saveConsultationBriefDraft(
      user.accessToken,
      appointmentId,
      body,
      version,
      correlationId,
    )
    const response = careSuccessResponse(brief, correlationId)
    response.headers.set('ETag', `"${brief.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

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

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/care/consultation-briefs/[appointmentId]/ai-draft-jobs'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  const rawVersion = request.headers.get('if-match')
  const version =
    rawVersion && /^"\d+"$/.test(rawVersion)
      ? Number(rawVersion.slice(1, -1))
      : null
  const idempotencyKey = request.headers.get('idempotency-key')
  if (
    !isUuid(appointmentId) ||
    version === null ||
    !idempotencyKey ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)
  )
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'AI consultation brief draft request is invalid.',
        correlationId,
      ),
      user,
    )
  try {
    const job = await careClient.createConsultationBriefAiDraftJob(
      user.accessToken,
      appointmentId,
      version,
      idempotencyKey,
      correlationId,
    )
    return carryCareSession(careSuccessResponse(job, correlationId, 202), user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

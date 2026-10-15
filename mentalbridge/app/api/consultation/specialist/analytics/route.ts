import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'

const PERIODS = new Set(['7', '30', '90'])

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const days = request.nextUrl.searchParams.get('days') ?? '30'
  if (!PERIODS.has(days)) {
    return localProblem(
      400,
      'SPECIALIST_ANALYTICS_PERIOD_INVALID',
      'Khoảng thời gian không hợp lệ.',
      correlationId,
    )
  }
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const to = new Date()
  const from = new Date(to.getTime() - Number(days) * 86_400_000)
  try {
    const result = await consultationClient.specialistOperationalAnalytics(
      actor.accessToken,
      correlationId,
      from.toISOString(),
      to.toISOString(),
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}

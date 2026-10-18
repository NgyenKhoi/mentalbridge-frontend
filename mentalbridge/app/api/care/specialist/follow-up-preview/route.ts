import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import { FOLLOW_UP_PREVIEW } from '@/features/appointments/mocks/follow-up-preview'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }

  const response =
    process.env.NODE_ENV === 'development' &&
    process.env.USE_MOCK_SPECIALIST === 'true'
      ? { enabled: true, board: FOLLOW_UP_PREVIEW }
      : { enabled: false }

  return carryConsultationSession(
    NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } }),
    actor,
  )
}

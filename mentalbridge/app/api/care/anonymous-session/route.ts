import type { NextRequest } from 'next/server'

import { correlationIdFrom, noContentResponse } from '@/lib/auth/bff-response'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import {
  applyAnonymousSessionCookies,
  clearAnonymousSessionCookies,
} from '@/lib/care/assessment-cookies'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)

  try {
    const session = await careClient.createAnonymousSession(correlationId)
    const response = careSuccessResponse(
      { expiresAt: session.expiresAt },
      correlationId,
      201,
    )
    applyAnonymousSessionCookies(response, session)
    return response
  } catch (error) {
    return careErrorResponse(error, correlationId)
  }
}

export async function DELETE(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const response = noContentResponse(correlationId)
  clearAnonymousSessionCookies(response)
  return response
}

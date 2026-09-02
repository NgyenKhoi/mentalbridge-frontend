import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  try {
    return careSuccessResponse(
      await careClient.currentPrivacyDisclosure(correlationId),
      correlationId,
    )
  } catch (error) {
    return careErrorResponse(error, correlationId)
  }
}

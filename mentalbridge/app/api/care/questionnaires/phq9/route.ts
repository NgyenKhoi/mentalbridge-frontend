import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { careClient } from '@/lib/care/care-client'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)

  try {
    const questionnaire = await careClient.currentPhq9(correlationId)
    return careSuccessResponse(questionnaire, correlationId)
  } catch (error) {
    return careErrorResponse(error, correlationId)
  }
}

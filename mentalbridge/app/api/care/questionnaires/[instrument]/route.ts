import type { NextRequest } from 'next/server'

import type { Instrument } from '@/features/assessment/api/care-contract'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

const instruments: Readonly<Record<string, Instrument>> = {
  phq9: 'PHQ9',
  gad7: 'GAD7',
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/api/care/questionnaires/[instrument]'>,
) {
  const correlationId = correlationIdFrom(request)
  const { instrument: segment } = await params
  const instrument = instruments[segment.toLowerCase()]
  if (!instrument) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Request validation failed.',
      correlationId,
    )
  }

  try {
    const questionnaire = await careClient.currentQuestionnaire(
      instrument,
      correlationId,
    )
    return careSuccessResponse(questionnaire, correlationId)
  } catch (error) {
    return careErrorResponse(error, correlationId)
  }
}

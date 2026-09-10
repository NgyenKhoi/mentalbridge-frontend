import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import { isUuid } from '@/lib/care/care-validation'

export async function GET(
  request: NextRequest,
  {
    params,
  }: RouteContext<'/api/care/questionnaires/definitions/[definitionId]'>,
) {
  const correlationId = correlationIdFrom(request)
  const { definitionId } = await params
  if (!isUuid(definitionId)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Request validation failed.',
      correlationId,
    )
  }

  try {
    return careSuccessResponse(
      await careClient.questionnaireDefinition(definitionId, correlationId),
      correlationId,
    )
  } catch (error) {
    return careErrorResponse(error, correlationId)
  }
}

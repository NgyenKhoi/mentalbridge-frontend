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
import {
  readInitialCheckIds,
  rememberInitialCheckEvaluation,
} from '@/lib/care/guided-initial-check-cookies'
import { isUuid } from '@/lib/care/care-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>

  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { phq9AssessmentId, gad7AssessmentId } = readInitialCheckIds(
    request.cookies,
  )
  if (
    !phq9AssessmentId ||
    !gad7AssessmentId ||
    !isUuid(phq9AssessmentId) ||
    !isUuid(gad7AssessmentId)
  ) {
    return carryCareSession(
      localProblem(
        409,
        'INITIAL_CHECK_INCOMPLETE',
        'Both guided assessments are required before support evaluation.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const selection = { phq9AssessmentId, gad7AssessmentId }
    const evaluation = await careClient.evaluateSupport(
      user.accessToken,
      selection,
      `initial-check:${phq9AssessmentId}:${gad7AssessmentId}`,
      correlationId,
    )
    const response = careSuccessResponse(evaluation, correlationId, 201)
    rememberInitialCheckEvaluation(response, evaluation.supportEvaluationId)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

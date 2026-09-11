import type { NextRequest } from 'next/server'

import type { Assessment } from '@/features/assessment/api/care-contract'
import type { InitialCheckState } from '@/features/initial-check/api/initial-check-contract'
import { ApiError } from '@/lib/api/api-error'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import {
  clearInitialCheck,
  clearInitialCheckAfterPhq9,
  clearInitialCheckEvaluation,
  readInitialCheckIds,
} from '@/lib/care/guided-initial-check-cookies'
import { isUuid } from '@/lib/care/care-validation'

function isMissingOwnedResource(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 404 ||
      (error.status === 403 && error.code === 'RESOURCE_NOT_OWNED'))
  )
}

function stateResponse(
  state: InitialCheckState,
  correlationId: string,
  user: Awaited<ReturnType<typeof authenticatedCareUser>>,
) {
  return carryCareSession(careSuccessResponse(state, correlationId), user)
}

async function readAssessment(
  accessToken: string,
  assessmentId: string,
  correlationId: string,
): Promise<Assessment | null> {
  try {
    return await careClient.getAuthenticated(
      accessToken,
      assessmentId,
      correlationId,
    )
  } catch (error) {
    if (isMissingOwnedResource(error)) return null
    throw error
  }
}

function evaluationMatchesAssessments(
  evaluation: Awaited<ReturnType<typeof careClient.getSupportEvaluation>>,
  phq9: Assessment,
  gad7: Assessment,
) {
  return [phq9, gad7].every((assessment) => {
    const evidence = evaluation.evidence.find(
      (item) => item.instrument === assessment.instrument,
    )
    return (
      evidence?.assessmentId.toLowerCase() ===
        assessment.assessmentId.toLowerCase() &&
      evidence.questionnaireVersion === assessment.questionnaireVersion &&
      evidence.scoringVersion === assessment.result.scoringVersion &&
      evidence.screeningLevel === assessment.result.screeningLevel &&
      evidence.safetyStatus === assessment.result.safetyStatus
    )
  })
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>

  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    try {
      await careClient.getProfile(user.accessToken, correlationId)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PROFILE_NOT_FOUND') {
        return stateResponse({ phase: 'PROFILE_REQUIRED' }, correlationId, user)
      }
      throw error
    }

    const [disclosure, consents] = await Promise.all([
      careClient.currentPrivacyDisclosure(correlationId),
      careClient.getConsents(user.accessToken, correlationId),
    ])
    const hasCurrentConsent = consents.decisions.some(
      (decision) =>
        decision.policyVersion === disclosure.version && decision.granted,
    )
    if (!hasCurrentConsent) {
      return stateResponse({ phase: 'CONSENT_REQUIRED' }, correlationId, user)
    }

    const ids = readInitialCheckIds(request.cookies)
    if (!ids.phq9AssessmentId || !isUuid(ids.phq9AssessmentId)) {
      const response = stateResponse({ phase: 'PHQ9' }, correlationId, user)
      clearInitialCheck(response)
      return response
    }

    const phq9 = await readAssessment(
      user.accessToken,
      ids.phq9AssessmentId,
      correlationId,
    )
    if (!phq9 || phq9.instrument !== 'PHQ9' || phq9.voidedAt) {
      const response = stateResponse({ phase: 'PHQ9' }, correlationId, user)
      clearInitialCheck(response)
      return response
    }

    if (!ids.gad7AssessmentId || !isUuid(ids.gad7AssessmentId)) {
      const response = stateResponse(
        { phase: 'GAD7', phq9 },
        correlationId,
        user,
      )
      clearInitialCheckAfterPhq9(response)
      return response
    }

    const gad7 = await readAssessment(
      user.accessToken,
      ids.gad7AssessmentId,
      correlationId,
    )
    if (!gad7 || gad7.instrument !== 'GAD7' || gad7.voidedAt) {
      const response = stateResponse(
        { phase: 'GAD7', phq9 },
        correlationId,
        user,
      )
      clearInitialCheckAfterPhq9(response)
      return response
    }

    const pending: InitialCheckState = {
      phase: 'EVALUATION_PENDING',
      phq9,
      gad7,
    }
    if (!ids.supportEvaluationId || !isUuid(ids.supportEvaluationId)) {
      const response = stateResponse(pending, correlationId, user)
      clearInitialCheckEvaluation(response)
      return response
    }

    try {
      const evaluation = await careClient.getSupportEvaluation(
        user.accessToken,
        ids.supportEvaluationId,
        {
          phq9AssessmentId: phq9.assessmentId,
          gad7AssessmentId: gad7.assessmentId,
        },
        correlationId,
      )
      if (!evaluationMatchesAssessments(evaluation, phq9, gad7)) {
        throw new Error(
          'Support evaluation evidence does not match assessments.',
        )
      }
      return stateResponse(
        { phase: 'COMPLETED', phq9, gad7, evaluation },
        correlationId,
        user,
      )
    } catch (error) {
      if (!isMissingOwnedResource(error)) throw error
      const response = stateResponse(pending, correlationId, user)
      clearInitialCheckEvaluation(response)
      return response
    }
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function DELETE(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>

  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const response = stateResponse({ phase: 'PHQ9' }, correlationId, user)
  clearInitialCheck(response)
  return response
}

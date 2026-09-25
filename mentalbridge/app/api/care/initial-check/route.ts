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
  const purpose =
    request.nextUrl.searchParams.get('purpose') === 'REASSESSMENT'
      ? ('REASSESSMENT' as const)
      : ('INITIAL_CHECK' as const)
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

    let episode
    try {
      episode = await careClient.currentScreeningEpisode(
        user.accessToken,
        purpose,
        correlationId,
      )
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'SCREENING_EPISODE_NOT_FOUND'
      ) {
        return stateResponse({ phase: 'PHQ9' }, correlationId, user)
      }
      throw error
    }

    if (!episode.phq9AssessmentId || !isUuid(episode.phq9AssessmentId)) {
      return stateResponse({ phase: 'PHQ9' }, correlationId, user)
    }

    const phq9 = await readAssessment(
      user.accessToken,
      episode.phq9AssessmentId,
      correlationId,
    )
    if (!phq9 || phq9.instrument !== 'PHQ9' || phq9.voidedAt) {
      return stateResponse({ phase: 'PHQ9' }, correlationId, user)
    }

    if (!episode.gad7AssessmentId || !isUuid(episode.gad7AssessmentId)) {
      return stateResponse({ phase: 'GAD7', phq9 }, correlationId, user)
    }

    const gad7 = await readAssessment(
      user.accessToken,
      episode.gad7AssessmentId,
      correlationId,
    )
    if (!gad7 || gad7.instrument !== 'GAD7' || gad7.voidedAt) {
      return stateResponse({ phase: 'GAD7', phq9 }, correlationId, user)
    }

    const pending: InitialCheckState = {
      phase: 'EVALUATION_PENDING',
      phq9,
      gad7,
    }
    if (
      episode.status !== 'COMPLETED' ||
      !episode.presentationEvaluationId ||
      !isUuid(episode.presentationEvaluationId)
    ) {
      return stateResponse(pending, correlationId, user)
    }

    try {
      const evaluation = await careClient.getSupportEvaluation(
        user.accessToken,
        episode.presentationEvaluationId,
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
      return stateResponse(pending, correlationId, user)
    }
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

export async function DELETE(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const purpose =
    request.nextUrl.searchParams.get('purpose') === 'REASSESSMENT'
      ? ('REASSESSMENT' as const)
      : ('INITIAL_CHECK' as const)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>

  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    await careClient.startScreeningEpisode(
      user.accessToken,
      purpose,
      correlationId,
    )
    return stateResponse({ phase: 'PHQ9' }, correlationId, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

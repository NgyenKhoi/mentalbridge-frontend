import type { NextRequest } from 'next/server'

import { ApiError } from '@/lib/api/api-error'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
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
  clearInitialCheck,
  readInitialCheckIds,
  rememberInitialCheckGad7,
  rememberInitialCheckPhq9,
} from '@/lib/care/guided-initial-check-cookies'
import {
  isCareIdempotencyKey,
  isUuid,
  parseSubmission,
} from '@/lib/care/care-validation'

function orderProblem(
  correlationId: string,
  user: Awaited<ReturnType<typeof authenticatedCareUser>>,
) {
  return carryCareSession(
    localProblem(
      409,
      'INITIAL_CHECK_ORDER_REQUIRED',
      'The guided initial check must complete PHQ-9 before GAD-7.',
      correlationId,
    ),
    user,
  )
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext<'/api/care/initial-check/assessments/[instrument]'>,
) {
  const correlationId = correlationIdFrom(request)
  const { instrument: routeInstrument } = await params
  const instrument =
    routeInstrument === 'phq9'
      ? 'PHQ9'
      : routeInstrument === 'gad7'
        ? 'GAD7'
        : null
  if (!instrument) {
    return localProblem(
      404,
      'QUESTIONNAIRE_NOT_FOUND',
      'The requested guided assessment is not available.',
      correlationId,
    )
  }

  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    if (instrument === 'GAD7') {
      const { phq9AssessmentId } = readInitialCheckIds(request.cookies)
      if (!phq9AssessmentId || !isUuid(phq9AssessmentId)) {
        const response = orderProblem(correlationId, user)
        clearInitialCheck(response)
        return response
      }
      try {
        const phq9 = await careClient.getAuthenticated(
          user.accessToken,
          phq9AssessmentId,
          correlationId,
        )
        if (phq9.instrument !== 'PHQ9' || phq9.voidedAt) {
          const response = orderProblem(correlationId, user)
          clearInitialCheck(response)
          return response
        }
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 404 ||
            (error.status === 403 && error.code === 'RESOURCE_NOT_OWNED'))
        ) {
          const response = orderProblem(correlationId, user)
          clearInitialCheck(response)
          return response
        }
        throw error
      }
    }

    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!isCareIdempotencyKey(idempotencyKey)) {
      return carryCareSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          [{ field: 'Idempotency-Key', code: 'INVALID_FORMAT' }],
        ),
        user,
      )
    }
    const submission = parseSubmission(await readBoundedJson(request))
    if (!submission) {
      return carryCareSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
        ),
        user,
      )
    }

    const questionnaire = await careClient.questionnaireDefinition(
      submission.questionnaireDefinitionId,
      correlationId,
    )
    if (questionnaire.instrument !== instrument) {
      return carryCareSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          [
            {
              field: 'questionnaireDefinitionId',
              code: 'INSTRUMENT_MISMATCH',
            },
          ],
        ),
        user,
      )
    }

    const assessment = await careClient.submitAuthenticated(
      user.accessToken,
      submission,
      idempotencyKey,
      correlationId,
    )
    if (assessment.instrument !== instrument || assessment.voidedAt) {
      throw new Error('Care returned an assessment for another guided step.')
    }

    const response = careSuccessResponse(assessment, correlationId, 201)
    if (instrument === 'PHQ9') {
      rememberInitialCheckPhq9(response, assessment.assessmentId)
    } else {
      rememberInitialCheckGad7(response, assessment.assessmentId)
    }
    return carryCareSession(response, user)
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryCareSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        user,
      )
    }
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

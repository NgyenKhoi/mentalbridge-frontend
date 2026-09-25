import type { NextRequest } from 'next/server'

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
  isCareIdempotencyKey,
  parseSubmission,
} from '@/lib/care/care-validation'

export async function POST(
  request: NextRequest,
  { params }: RouteContext<'/api/care/initial-check/assessments/[instrument]'>,
) {
  const correlationId = correlationIdFrom(request)
  const purpose =
    request.nextUrl.searchParams.get('purpose') === 'REASSESSMENT'
      ? ('REASSESSMENT' as const)
      : ('INITIAL_CHECK' as const)
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

    const episode = await careClient.startScreeningEpisode(
      user.accessToken,
      purpose,
      correlationId,
    )
    const assessment = await careClient.submitScreeningEpisodeAssessment(
      user.accessToken,
      episode.episodeId,
      instrument,
      submission,
      idempotencyKey,
      correlationId,
    )
    if (assessment.instrument !== instrument || assessment.voidedAt) {
      throw new Error('Care returned an assessment for another guided step.')
    }

    return carryCareSession(
      careSuccessResponse(assessment, correlationId, 201),
      user,
    )
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

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

const IDEMPOTENCY_KEY = /^[!-~]{16,128}$/

type AssessmentPair = {
  phq9AssessmentId: string
  gad7AssessmentId: string
}

async function resolveHistoricalAssessmentPair(
  accessToken: string,
  correlationId: string,
): Promise<AssessmentPair | undefined> {
  let cursor: string | undefined
  let phq9AssessmentId: string | undefined
  let gad7AssessmentId: string | undefined

  do {
    const page = await careClient.history(
      accessToken,
      cursor,
      50,
      correlationId,
    )
    for (const assessment of page.items) {
      if (!phq9AssessmentId && assessment.instrument === 'PHQ9') {
        phq9AssessmentId = assessment.assessmentId
      }
      if (!gad7AssessmentId && assessment.instrument === 'GAD7') {
        gad7AssessmentId = assessment.assessmentId
      }
      if (phq9AssessmentId && gad7AssessmentId) {
        return { phq9AssessmentId, gad7AssessmentId }
      }
    }
    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined
  } while (cursor)

  return undefined
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const key = request.headers.get('idempotency-key') ?? ''
  if (!IDEMPOTENCY_KEY.test(key)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid Idempotency-Key is required.',
        correlationId,
      ),
      user,
    )
  }

  const purpose = request.nextUrl.searchParams.get('purpose') ?? 'INITIAL_CHECK'
  if (purpose !== 'INITIAL_CHECK' && purpose !== 'REASSESSMENT') {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'purpose must be INITIAL_CHECK or REASSESSMENT.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const episode = await careClient.currentScreeningEpisode(
      user.accessToken,
      purpose,
      correlationId,
    )
    let supportEvaluationId =
      episode.status === 'COMPLETED' ? episode.supportEvaluationId : null

    if (!supportEvaluationId && purpose === 'INITIAL_CHECK') {
      const assessmentPair = await resolveHistoricalAssessmentPair(
        user.accessToken,
        correlationId,
      )
      if (assessmentPair) {
        const evaluation = await careClient.evaluateSupportV2(
          user.accessToken,
          assessmentPair,
          `support-plan-evaluation:${assessmentPair.phq9AssessmentId}:${assessmentPair.gad7AssessmentId}`,
          correlationId,
        )
        supportEvaluationId = evaluation.supportEvaluationId
      }
    }

    if (!supportEvaluationId) {
      const title =
        purpose === 'REASSESSMENT'
          ? 'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt đánh giá lại trước khi tạo kế hoạch thay thế.'
          : 'Cần có kết quả PHQ-9 và GAD-7 đã hoàn tất trước khi tạo kế hoạch hỗ trợ.'
      return carryCareSession(
        localProblem(
          409,
          purpose === 'REASSESSMENT'
            ? 'REASSESSMENT_INCOMPLETE'
            : 'INITIAL_CHECK_INCOMPLETE',
          title,
          correlationId,
        ),
        user,
      )
    }

    const draft = await careClient.proposeSupportPlanDraft(
      user.accessToken,
      { sourceSupportEvaluationId: supportEvaluationId },
      key,
      correlationId,
    )
    return carryCareSession(
      careSuccessResponse(draft, correlationId, 201),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
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
    return carryCareSession(
      careSuccessResponse(
        await careClient.currentSupportPlanDraft(
          user.accessToken,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

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
import { readInitialCheckIds } from '@/lib/care/guided-initial-check-cookies'
import { isUuid } from '@/lib/care/care-validation'

const IDEMPOTENCY_KEY = /^[!-~]{16,128}$/

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const key = request.headers.get('idempotency-key') ?? ''
  const { phq9AssessmentId, gad7AssessmentId } = readInitialCheckIds(
    request.cookies,
  )
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
        'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt Kiểm tra ban đầu trước khi tạo kế hoạch hỗ trợ.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const evaluation = await careClient.evaluateSupportV2(
      user.accessToken,
      { phq9AssessmentId, gad7AssessmentId },
      `support-plan-evaluation:${phq9AssessmentId}:${gad7AssessmentId}`,
      correlationId,
    )
    const draft = await careClient.proposeSupportPlanDraft(
      user.accessToken,
      { sourceSupportEvaluationId: evaluation.supportEvaluationId },
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

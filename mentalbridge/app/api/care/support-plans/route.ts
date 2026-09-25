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
    if (episode.status !== 'COMPLETED' || !episode.supportEvaluationId) {
      const title =
        purpose === 'REASSESSMENT'
          ? 'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt đánh giá lại trước khi tạo kế hoạch thay thế.'
          : 'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt Kiểm tra ban đầu trước khi tạo kế hoạch hỗ trợ.'
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
      { sourceSupportEvaluationId: episode.supportEvaluationId },
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

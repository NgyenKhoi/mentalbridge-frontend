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

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  try {
    const journey = await careClient.currentGuidedJourney(
      user.accessToken,
      correlationId,
    )
    if (!journey.episodeId) {
      return carryCareSession(
        localProblem(
          409,
          'INITIAL_CHECK_INCOMPLETE',
          'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt Kiểm tra ban đầu trước khi tạo gợi ý hỗ trợ.',
          correlationId,
        ),
        user,
      )
    }
    const guide = await careClient.ensureScreeningEpisodeSupportGuide(
      user.accessToken,
      journey.episodeId,
      correlationId,
    )
    return carryCareSession(careSuccessResponse(guide, correlationId), user)
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
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '10')
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (cursor?.length ?? 0) > 256
  ) {
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
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.supportGuideHistory(
          user.accessToken,
          cursor,
          limit,
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

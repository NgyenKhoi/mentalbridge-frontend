import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCommunityAdmin,
  carryCommunityAdminSession,
  communityAdminAuthenticationFailure,
} from '@/lib/community/authenticated-admin'
import {
  communityErrorResponse,
  communitySuccessResponse,
  localProblem,
} from '@/lib/community/bff-response'
import { communityClient } from '@/lib/community/community-client'
import { parseModerationActionInput } from '@/lib/community/community-validation'

type Context = { params: Promise<{ caseId: string }> }
const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i

export async function POST(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let admin: Awaited<ReturnType<typeof authenticatedCommunityAdmin>>
  try {
    admin = await authenticatedCommunityAdmin(request, correlationId)
  } catch (error) {
    return communityAdminAuthenticationFailure(error, correlationId)
  }
  const { caseId } = await context.params
  const key = request.headers.get('Idempotency-Key')
  let input = null
  try {
    input = parseModerationActionInput(await request.json())
  } catch {
    input = null
  }
  if (
    !UUID.test(caseId) ||
    !input ||
    !key ||
    key.length < 16 ||
    key.length > 128 ||
    !/^[!-~]+$/.test(key)
  )
    return carryCommunityAdminSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Moderation action is invalid.',
        correlationId,
      ),
      admin,
    )
  try {
    return carryCommunityAdminSession(
      communitySuccessResponse(
        await communityClient.moderationAction(
          admin.accessToken,
          caseId,
          input,
          key,
          correlationId,
        ),
        correlationId,
        undefined,
        201,
      ),
      admin,
    )
  } catch (error) {
    return carryCommunityAdminSession(
      communityErrorResponse(error, correlationId),
      admin,
    )
  }
}

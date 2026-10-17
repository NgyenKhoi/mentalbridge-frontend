import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    const plan = await careClient.currentSupportPlan(
      user.accessToken,
      correlationId,
    )
    const response = careSuccessResponse(plan, correlationId)
    response.headers.set('ETag', `"${plan.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}

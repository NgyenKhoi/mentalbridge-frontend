import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedContentUser,
  carryContentSession,
  contentAuthenticationFailure,
} from '@/lib/content/authenticated-user'
import {
  contentErrorResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentAchievementClient } from '@/lib/content/content-client'
import { parseAchievementPreferenceUpdate } from '@/lib/content/content-validation'

const ETAG_PATTERN = /^"(0|[1-9]\d*)"$/

function timezone(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('timezone')
  return value && value.length <= 64 ? value : null
}

async function authenticated(request: NextRequest, correlationId: string) {
  try {
    return await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const user = await authenticated(request, correlationId)
  if (user instanceof Response) return user
  const timeZone = timezone(request)
  if (!timeZone) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A timezone is required.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const result = await contentAchievementClient.get(
      user.accessToken,
      timeZone,
      correlationId,
    )
    const response = contentSuccessResponse(result.collection, correlationId)
    response.headers.set('ETag', result.etag)
    return carryContentSession(response, user)
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const user = await authenticated(request, correlationId)
  if (user instanceof Response) return user
  const timeZone = timezone(request)
  const ifMatch = request.headers.get('if-match')
  if (!timeZone || !ifMatch || !ETAG_PATTERN.test(ifMatch)) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Timezone and a valid collection version are required.',
        correlationId,
      ),
      user,
    )
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const update = parseAchievementPreferenceUpdate(body)
  if (!update) {
    return carryContentSession(
      localProblem(
        422,
        'VALIDATION_FAILED',
        'Achievement preference is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const result = await contentAchievementClient.setVisibility(
      user.accessToken,
      timeZone,
      update,
      ifMatch,
      correlationId,
    )
    const response = contentSuccessResponse(result.collection, correlationId)
    response.headers.set('ETag', result.etag)
    return carryContentSession(response, user)
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}

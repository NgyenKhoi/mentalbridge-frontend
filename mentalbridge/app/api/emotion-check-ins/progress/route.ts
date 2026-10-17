import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  emotionErrorResponse,
  emotionSuccessResponse,
  localProblem,
} from '@/lib/emotion-check-in/bff-response'
import { emotionCheckInClient } from '@/lib/emotion-check-in/client'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'

const validTimezone = (value: string | null): value is string => {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedJournalUser>>
  try {
    user = await authenticatedJournalUser(request, correlationId)
  } catch (error) {
    return journalAuthenticationFailure(error, correlationId)
  }
  try {
    const params = request.nextUrl.searchParams
    const timezone = params.get('timezone')
    if (
      [...params.keys()].some((key) => key !== 'timezone') ||
      params.getAll('timezone').length !== 1 ||
      !validTimezone(timezone)
    )
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Múi giờ xem tiến trình cảm xúc không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.progress(
          user.accessToken,
          timezone,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryJournalSession(emotionErrorResponse(error, correlationId), user)
  }
}

import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  companionErrorResponse,
  companionSuccessResponse,
  localProblem,
} from '@/lib/companion/bff-response'
import {
  companionClient,
  type CompanionOpening,
} from '@/lib/companion/companion-client'

const OPENINGS: readonly string[] = ['FROM_JOURNAL', 'FROM_RESULT']

/** The optional opener of a new conversation; no JSON body means none. Null when the body is not allowed. */
async function openingOf(
  request: NextRequest,
): Promise<{ opening?: CompanionOpening } | null> {
  const type = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!type.startsWith('application/json')) return {}
  const body = await readBoundedJson(request, 1024)
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return null
  const keys = Object.keys(body)
  if (keys.some((key) => key !== 'opening')) return null
  const opening = (body as { opening?: unknown }).opening
  if (opening === undefined) return {}
  return typeof opening === 'string' && OPENINGS.includes(opening)
    ? { opening: opening as CompanionOpening }
    : null
}

async function user(request: NextRequest, correlationId: string) {
  try {
    return { value: await authenticatedJournalUser(request, correlationId) }
  } catch (error) {
    return { response: journalAuthenticationFailure(error, correlationId) }
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    return carryJournalSession(
      companionSuccessResponse(
        await companionClient.list(resolved.value.accessToken, correlationId),
        correlationId,
      ),
      resolved.value,
    )
  } catch (error) {
    return carryJournalSession(
      companionErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    const input = await openingOf(request)
    if (!input)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Yêu cầu tạo cuộc trò chuyện không hợp lệ.',
          correlationId,
        ),
        resolved.value,
      )
    return carryJournalSession(
      companionSuccessResponse(
        await companionClient.create(
          resolved.value.accessToken,
          correlationId,
          input.opening,
        ),
        correlationId,
        201,
      ),
      resolved.value,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryJournalSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        resolved.value,
      )
    return carryJournalSession(
      companionErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}

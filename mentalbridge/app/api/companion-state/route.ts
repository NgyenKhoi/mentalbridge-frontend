import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  companionErrorResponse,
  companionSuccessResponse,
  localProblem,
} from '@/lib/companion-state/bff-response'
import { companionStateClient } from '@/lib/companion-state/client'
import {
  MAX_GUIDE_LENGTH,
  parseUpdateCompanionState,
} from '@/lib/companion-state/validation'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'

// The serialized guide state (up to 6144 characters) travels JSON-escaped inside the body.
const MAX_BODY_BYTES = MAX_GUIDE_LENGTH * 2 + 4096

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
        await companionStateClient.get(
          resolved.value.accessToken,
          correlationId,
        ),
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

export async function PATCH(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    const body = parseUpdateCompanionState(
      await readBoundedJson(request, MAX_BODY_BYTES),
    )
    if (!body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu gửi cho Mầm không hợp lệ.',
          correlationId,
        ),
        resolved.value,
      )
    return carryJournalSession(
      companionSuccessResponse(
        await companionStateClient.update(
          resolved.value.accessToken,
          body,
          correlationId,
        ),
        correlationId,
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

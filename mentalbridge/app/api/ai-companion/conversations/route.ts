import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  companionErrorResponse,
  companionSuccessResponse,
} from '@/lib/companion/bff-response'
import { companionClient } from '@/lib/companion/companion-client'

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
    return carryJournalSession(
      companionSuccessResponse(
        await companionClient.create(resolved.value.accessToken, correlationId),
        correlationId,
        201,
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

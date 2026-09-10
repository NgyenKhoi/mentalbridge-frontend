import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  journalErrorResponse,
  journalSuccessResponse,
  localProblem,
} from '@/lib/journal/bff-response'
import { journalClient } from '@/lib/journal/journal-client'
import {
  isIdempotencyKey,
  isJournalId,
  parseJournalWrite,
} from '@/lib/journal/journal-validation'

type Context = RouteContext<'/api/journals/[journalId]'>
async function user(request: NextRequest, correlationId: string) {
  try {
    return { value: await authenticatedJournalUser(request, correlationId) }
  } catch (error) {
    return { response: journalAuthenticationFailure(error, correlationId) }
  }
}
export async function GET(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { journalId } = await params
  if (!isJournalId(journalId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Dữ liệu nhật ký không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    return carryJournalSession(
      journalSuccessResponse(
        await journalClient.detail(
          resolved.value.accessToken,
          journalId,
          correlationId,
        ),
        correlationId,
      ),
      resolved.value,
    )
  } catch (error) {
    return carryJournalSession(
      journalErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { journalId } = await params
  if (!isJournalId(journalId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Dữ liệu nhật ký không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    const key = request.headers.get('Idempotency-Key')
    const revision = Number(request.headers.get('If-Match-Revision'))
    const body = parseJournalWrite(await readBoundedJson(request))
    if (
      !isIdempotencyKey(key) ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      !body
    )
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu nhật ký không hợp lệ.',
          correlationId,
        ),
        resolved.value,
      )
    return carryJournalSession(
      journalSuccessResponse(
        await journalClient.revise(
          resolved.value.accessToken,
          journalId,
          revision,
          body,
          key,
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
      journalErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { journalId } = await params
  const key = request.headers.get('Idempotency-Key')
  if (!isJournalId(journalId) || !isIdempotencyKey(key))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Dữ liệu nhật ký không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    return carryJournalSession(
      journalSuccessResponse(
        await journalClient.remove(
          resolved.value.accessToken,
          journalId,
          key,
          correlationId,
        ),
        correlationId,
      ),
      resolved.value,
    )
  } catch (error) {
    return carryJournalSession(
      journalErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}

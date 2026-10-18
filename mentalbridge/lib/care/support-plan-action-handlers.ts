import 'server-only'

import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from './authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from './bff-response'
import { isUuid } from './care-validation'
import { supportPlanActionClient } from './support-plan-action-client'
import { isSupportPlanLocalDate } from './support-plan-action-validation'
import { parseEngagementRequest } from './support-plan-engagement-request'

type Operation =
  | 'current'
  | 'draft'
  | 'detail'
  | 'history'
  | 'propose'
  | 'activate'
  | 'status'
  | 'review'
  | 'replace'
  | 'occurrences'
  | 'occurrenceState'
  | 'reconcile'
  | 'companionExplanation'
  | 'reconcileJournal'
  | 'continueCycle'
  | 'occurrenceEngagement'
const READS: readonly Operation[] = [
  'current',
  'draft',
  'detail',
  'history',
  'occurrences',
]
const VERSION = /^"(0|[1-9]\d*)"$/
const KEY = /^[!-~]{16,128}$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function exact(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  )
}
function invalid(): never {
  throw new RequestBodyError(
    400,
    'VALIDATION_FAILED',
    'Request validation failed.',
  )
}

async function requireEmptyBody(request: NextRequest) {
  const length = Number(request.headers.get('content-length'))
  if (Number.isFinite(length) && length > 0) invalid()
  if (!request.body) return
  const reader = request.body.getReader()
  try {
    const first = await reader.read()
    if (!first.done) {
      await reader.cancel()
      invalid()
    }
  } finally {
    reader.releaseLock()
  }
}

/** Bounded v3 owner operations only, not a general upstream proxy. */
export async function supportPlanActionHandler(
  request: NextRequest,
  operation: Operation,
  id?: string,
  secondaryId?: string,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  try {
    if (
      !READS.includes(operation) &&
      request.headers.get('origin') !== request.nextUrl.origin
    ) {
      throw new RequestBodyError(
        403,
        'CROSS_ORIGIN_REQUEST',
        'Same-origin request required.',
      )
    }
    if (
      [
        'detail',
        'activate',
        'status',
        'review',
        'replace',
        'occurrenceState',
        'reconcile',
        'companionExplanation',
        'reconcileJournal',
        'continueCycle',
        'occurrenceEngagement',
      ].includes(operation) &&
      (!id || !isUuid(id))
    )
      invalid()
    if (
      operation === 'companionExplanation' &&
      (!secondaryId || !isUuid(secondaryId))
    )
      invalid()
    const ownerId = id ?? ''
    let version = 0
    if (
      [
        'activate',
        'status',
        'review',
        'replace',
        'occurrenceState',
        'continueCycle',
        'occurrenceEngagement',
      ].includes(operation)
    ) {
      const match = VERSION.exec(request.headers.get('if-match') ?? '')
      if (!match || !Number.isSafeInteger(Number(match[1]))) invalid()
      version = Number(match[1])
    }
    const key = request.headers.get('idempotency-key') ?? ''
    if (
      ['propose', 'activate', 'replace', 'continueCycle'].includes(operation) &&
      !KEY.test(key)
    )
      invalid()
    if (['activate', 'reconcile', 'continueCycle'].includes(operation)) {
      await requireEmptyBody(request)
    }
    let result: unknown
    let status = 200
    const token = user.accessToken
    switch (operation) {
      case 'current':
        result = await supportPlanActionClient.current(token, correlationId)
        break
      case 'draft':
        result = await supportPlanActionClient.draft(token, correlationId)
        break
      case 'detail':
        result = await supportPlanActionClient.detail(
          token,
          ownerId,
          correlationId,
        )
        break
      case 'history': {
        const limit = Number(request.nextUrl.searchParams.get('limit') ?? 10)
        const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
        if (
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 20 ||
          (cursor !== undefined && (cursor.length < 1 || cursor.length > 256))
        )
          invalid()
        result = await supportPlanActionClient.history(
          token,
          limit,
          cursor,
          correlationId,
        )
        break
      }
      case 'occurrences': {
        const from = request.nextUrl.searchParams.get('from')
        const through = request.nextUrl.searchParams.get('through')
        if (
          !isSupportPlanLocalDate(from) ||
          !isSupportPlanLocalDate(through) ||
          from > through ||
          Date.parse(through) - Date.parse(from) > 30 * 86400000
        )
          invalid()
        result = await supportPlanActionClient.occurrences(
          token,
          from,
          through,
          correlationId,
        )
        break
      }
      case 'propose': {
        const body = await readBoundedJson(request, 1024)
        if (
          !exact(body, ['sourceSupportEvaluationId']) ||
          !isUuid(String(body.sourceSupportEvaluationId))
        )
          invalid()
        result = await supportPlanActionClient.propose(
          token,
          { sourceSupportEvaluationId: String(body.sourceSupportEvaluationId) },
          key,
          correlationId,
        )
        status = 201
        break
      }
      case 'activate':
        result = await supportPlanActionClient.activate(
          token,
          ownerId,
          version,
          key,
          correlationId,
        )
        break
      case 'status': {
        const body = await readBoundedJson(request, 1024)
        if (
          !record(body) ||
          Object.keys(body).some(
            (field) => !['status', 'completionReason'].includes(field),
          ) ||
          !['ACTIVE', 'PAUSED', 'COMPLETED', 'DISCARDED'].includes(
            String(body.status),
          ) ||
          (Object.hasOwn(body, 'completionReason') &&
            (body.status !== 'COMPLETED' ||
              !['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'].includes(
                String(body.completionReason),
              )))
        )
          invalid()
        const state = body.status as
          'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED'
        const reason = body.completionReason as
          'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER' | undefined
        result = await supportPlanActionClient.status(
          token,
          ownerId,
          version,
          { status: state, ...(reason ? { completionReason: reason } : {}) },
          correlationId,
        )
        break
      }
      case 'review':
      case 'replace': {
        const body = await readBoundedJson(request, 1024)
        if (
          !exact(body, [
            'currentSupportPlanId',
            'currentVersion',
            'reassessmentSummaryId',
          ]) ||
          !isUuid(String(body.currentSupportPlanId)) ||
          !isUuid(String(body.reassessmentSummaryId)) ||
          !Number.isSafeInteger(body.currentVersion) ||
          Number(body.currentVersion) < 0
        )
          invalid()
        const input = {
          currentSupportPlanId: String(body.currentSupportPlanId),
          currentVersion: Number(body.currentVersion),
          reassessmentSummaryId: String(body.reassessmentSummaryId),
        }
        result =
          operation === 'review'
            ? await supportPlanActionClient.review(
                token,
                ownerId,
                version,
                input,
                correlationId,
              )
            : await supportPlanActionClient.replace(
                token,
                ownerId,
                version,
                input,
                key,
                correlationId,
              )
        break
      }
      case 'occurrenceState': {
        const body = await readBoundedJson(request, 1024)
        if (
          !exact(body, ['state']) ||
          !['SCHEDULED', 'COMPLETED', 'SKIPPED'].includes(String(body.state))
        )
          invalid()
        result = await supportPlanActionClient.occurrenceState(
          token,
          ownerId,
          version,
          body.state as 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
          correlationId,
        )
        break
      }
      case 'reconcile':
        result = await supportPlanActionClient.reconcile(
          token,
          ownerId,
          correlationId,
        )
        break
      case 'companionExplanation': {
        const body = await readBoundedJson(request, 256)
        if (
          !exact(body, ['surface']) ||
          !['TODAY', 'PLAN'].includes(String(body.surface))
        )
          invalid()
        result = await supportPlanActionClient.companionExplanation(
          token,
          ownerId,
          secondaryId ?? '',
          body.surface as 'TODAY' | 'PLAN',
          correlationId,
        )
        break
      }
      case 'reconcileJournal': {
        const body = await readBoundedJson(request, 1024)
        if (
          !exact(body, ['journalId']) ||
          typeof body.journalId !== 'string' ||
          !isUuid(body.journalId)
        )
          invalid()
        result = await supportPlanActionClient.reconcileJournal(
          token,
          ownerId,
          body.journalId,
          correlationId,
        )
        break
      }
      case 'continueCycle':
        result = await supportPlanActionClient.continueCycle(
          token,
          ownerId,
          version,
          key,
          correlationId,
        )
        break
      case 'occurrenceEngagement': {
        const body = parseEngagementRequest(
          await readBoundedJson(request, 2048),
        )
        if (!body) invalid()
        result = await supportPlanActionClient.occurrenceEngagement(
          token,
          ownerId,
          version,
          body,
          correlationId,
        )
        break
      }
    }
    const response = careSuccessResponse(result, correlationId, status)
    if (record(result) && Number.isSafeInteger(result.version))
      response.headers.set('ETag', `"${result.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    const response =
      error instanceof RequestBodyError
        ? localProblem(error.status, error.code, error.message, correlationId)
        : careErrorResponse(error, correlationId)
    return carryCareSession(response, user)
  }
}

import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCommunityUser,
  carryCommunitySession,
  communityAuthenticationFailure,
} from '@/lib/community/authenticated-user'
import {
  communityErrorResponse,
  communityNoContentResponse,
  communitySuccessResponse,
  localProblem,
} from '@/lib/community/bff-response'
import {
  parseChatConversation,
  parseChatPrivacy,
  parseChatPrivacyView,
  parseChatReadResult,
  parseChatReportInput,
  parseChatReportResult,
  parseChatSendResult,
  parseConversationPage,
  parseDecisionInput,
  parseDirectConversationResult,
  parseMessagePage,
  parseReadInput,
  parseRequestPage,
  parseSendInput,
  parseStartDirectInput,
  UUID_PATTERN,
} from '@/features/community-chat/api/community-chat-contract'
import { communityChatRequest } from '@/features/community-chat/server/community-chat-client'

type Context = { params: Promise<{ path: string[] }> }
type User = Awaited<ReturnType<typeof authenticatedCommunityUser>>

const quotedVersion = /^"(0|[1-9]\d{0,18})"$/

function invalid(correlationId: string, user: User) {
  return carryCommunitySession(
    localProblem(
      400,
      'VALIDATION_FAILED',
      'Community chat request is invalid.',
      correlationId,
    ),
    user,
  )
}

function validPageQuery(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const limit = query.get('limit')
  const cursor = query.get('cursor')
  return (
    (limit === null || /^(?:[1-9]|[1-4]\d|50)$/.test(limit)) &&
    (cursor === null || (cursor.length >= 1 && cursor.length <= 1024)) &&
    [...query.keys()].every((key) => key === 'limit' || key === 'cursor') &&
    query.getAll('limit').length <= 1 &&
    query.getAll('cursor').length <= 1
  )
}

function upstreamQuery(request: NextRequest) {
  const query = new URLSearchParams()
  const limit = request.nextUrl.searchParams.get('limit')
  const cursor = request.nextUrl.searchParams.get('cursor')
  if (limit) query.set('limit', limit)
  if (cursor) query.set('cursor', cursor)
  return query.size ? `?${query.toString()}` : ''
}

async function body(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function handle(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: User
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { path } = await context.params
  const key = path.join('/')
  const method = request.method
  const identifiers = path.filter((_, index) => index % 2 === 1)
  if (identifiers.some((identifier) => !UUID_PATTERN.test(identifier)))
    return invalid(correlationId, user)

  try {
    if (key === 'privacy' && method === 'GET') {
      const result = await communityChatRequest(
        '/api/v1/community/chat/privacy',
        user.accessToken,
        correlationId,
        parseChatPrivacyView,
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (key === 'privacy' && method === 'PUT') {
      const input = parseChatPrivacy(await body(request))
      const version = request.headers.get('If-Match')
      if (!input || !version || !quotedVersion.test(version))
        return invalid(correlationId, user)
      const result = await communityChatRequest(
        '/api/v1/community/chat/privacy',
        user.accessToken,
        correlationId,
        parseChatPrivacyView,
        { method: 'PUT', body: input, headers: { 'If-Match': version } },
      )
      return carryCommunitySession(
        communitySuccessResponse(
          result.data,
          correlationId,
          result.etag ? { ETag: result.etag } : undefined,
        ),
        user,
      )
    }
    if (key === 'direct-conversations' && method === 'POST') {
      const input = parseStartDirectInput(await body(request))
      const idempotencyKey = request.headers.get('Idempotency-Key')
      if (!input || !idempotencyKey || !UUID_PATTERN.test(idempotencyKey))
        return invalid(correlationId, user)
      const result = await communityChatRequest(
        '/api/v1/community/chat/direct-conversations',
        user.accessToken,
        correlationId,
        parseDirectConversationResult,
        {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': idempotencyKey },
          expectedStatus: 201,
        },
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId, undefined, 201),
        user,
      )
    }
    if (key === 'requests' && method === 'GET') {
      if (!validPageQuery(request)) return invalid(correlationId, user)
      const result = await communityChatRequest(
        `/api/v1/community/chat/requests${upstreamQuery(request)}`,
        user.accessToken,
        correlationId,
        parseRequestPage,
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (key === 'conversations' && method === 'GET') {
      if (!validPageQuery(request)) return invalid(correlationId, user)
      const result = await communityChatRequest(
        `/api/v1/community/chat/conversations${upstreamQuery(request)}`,
        user.accessToken,
        correlationId,
        parseConversationPage,
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (key === 'reports' && method === 'POST') {
      const input = parseChatReportInput(await body(request))
      const idempotencyKey = request.headers.get('Idempotency-Key')
      if (!input || !idempotencyKey || !UUID_PATTERN.test(idempotencyKey))
        return invalid(correlationId, user)
      const result = await communityChatRequest(
        '/api/v1/community/chat/reports',
        user.accessToken,
        correlationId,
        parseChatReportResult,
        {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': idempotencyKey },
          expectedStatus: 201,
        },
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId, undefined, 201),
        user,
      )
    }
    if (
      path.length === 3 &&
      path[0] === 'requests' &&
      path[2] === 'decision' &&
      method === 'POST'
    ) {
      const input = parseDecisionInput(await body(request))
      const version = request.headers.get('If-Match')
      if (!input || !version || !quotedVersion.test(version))
        return invalid(correlationId, user)
      const result = await communityChatRequest(
        `/api/v1/community/chat/requests/${path[1]}/decision`,
        user.accessToken,
        correlationId,
        parseDirectConversationResult,
        {
          method: 'POST',
          body: input,
          headers: { 'If-Match': version },
          allowNoContent: true,
        },
      )
      return carryCommunitySession(
        result.status === 204
          ? communityNoContentResponse(correlationId)
          : communitySuccessResponse(
              result.data,
              correlationId,
              result.etag ? { ETag: result.etag } : undefined,
            ),
        user,
      )
    }
    if (path.length === 2 && path[0] === 'conversations' && method === 'GET') {
      const result = await communityChatRequest(
        `/api/v1/community/chat/conversations/${path[1]}`,
        user.accessToken,
        correlationId,
        parseChatConversation,
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (
      path.length === 3 &&
      path[0] === 'conversations' &&
      path[2] === 'messages'
    ) {
      if (method === 'GET') {
        if (!validPageQuery(request)) return invalid(correlationId, user)
        const result = await communityChatRequest(
          `/api/v1/community/chat/conversations/${path[1]}/messages${upstreamQuery(request)}`,
          user.accessToken,
          correlationId,
          parseMessagePage,
        )
        return carryCommunitySession(
          communitySuccessResponse(result.data, correlationId),
          user,
        )
      }
      if (method === 'POST') {
        const input = parseSendInput(await body(request))
        const idempotencyKey = request.headers.get('Idempotency-Key')
        if (!input || !idempotencyKey || !UUID_PATTERN.test(idempotencyKey))
          return invalid(correlationId, user)
        const result = await communityChatRequest(
          `/api/v1/community/chat/conversations/${path[1]}/messages`,
          user.accessToken,
          correlationId,
          parseChatSendResult,
          {
            method: 'POST',
            body: input,
            headers: { 'Idempotency-Key': idempotencyKey },
            expectedStatus: 201,
          },
        )
        return carryCommunitySession(
          communitySuccessResponse(result.data, correlationId, undefined, 201),
          user,
        )
      }
    }
    if (
      path.length === 3 &&
      path[0] === 'conversations' &&
      path[2] === 'read-cursor' &&
      method === 'PUT'
    ) {
      const input = parseReadInput(await body(request))
      if (!input) return invalid(correlationId, user)
      const result = await communityChatRequest(
        `/api/v1/community/chat/conversations/${path[1]}/read-cursor`,
        user.accessToken,
        correlationId,
        parseChatReadResult,
        { method: 'PUT', body: input },
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    return invalid(correlationId, user)
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle

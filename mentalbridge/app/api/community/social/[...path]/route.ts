import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { isSameOrigin } from '@/lib/auth/same-origin'
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
import { communityChatRequest } from '@/features/community-chat/server/community-chat-client'
import {
  parseFriendship,
  parseFriendshipPage,
  parseMemberPage,
  parseMemberProfile,
  socialUuid,
} from '@/features/community/api/community-social'

type Context = { params: Promise<{ path: string[] }> }

async function emptyObjectBody(request: NextRequest) {
  const reader = request.body?.getReader()
  if (!reader) return false
  let length = 0
  let text = ''
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 32) {
        await reader.cancel()
        return false
      }
      text += decoder.decode(value, { stream: true })
    }
    const body: unknown = JSON.parse(text + decoder.decode())
    return (
      body !== null &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Object.keys(body).length === 0
    )
  } catch {
    return false
  } finally {
    reader.releaseLock()
  }
}

async function handle(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const invalid = () =>
    carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community request is invalid.',
        correlationId,
      ),
      user,
    )
  const { path } = await context.params
  const method = request.method
  const mutation = method !== 'GET'
  if (mutation && !isSameOrigin(request))
    return carryCommunitySession(
      localProblem(
        403,
        'FORBIDDEN',
        'Request origin is invalid.',
        correlationId,
      ),
      user,
    )
  const [surface, id, action] = path
  if (path.length > 3 || (id !== undefined && !socialUuid.test(id)))
    return invalid()
  const query = request.nextUrl.searchParams
  const allowed =
    surface === 'members' && !id
      ? ['q', 'cursor', 'limit']
      : surface === 'friends' && !id
        ? ['view', 'cursor', 'limit']
        : ['cursor', 'limit']
  if (
    [...query.keys()].some(
      (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
    )
  )
    return invalid()
  const cursor = query.get('cursor')
  const limit = query.get('limit')
  if (
    (cursor &&
      (cursor.length > 256 ||
        ((surface !== 'members' || !id) && !socialUuid.test(cursor)))) ||
    (limit && !/^(?:[1-9]|[1-4]\d|50)$/.test(limit))
  )
    return invalid()
  if (mutation) {
    if (query.size) return invalid()
    if (
      method === 'DELETE'
        ? request.body !== null
        : !(await emptyObjectBody(request))
    )
      return invalid()
  }
  try {
    const suffix = query.size ? `?${query.toString()}` : ''
    if (method === 'GET' && surface === 'friends' && path.length === 1) {
      const view = query.get('view') ?? 'accepted'
      if (!['accepted', 'incoming', 'outgoing'].includes(view)) return invalid()
      const result = await communityChatRequest(
        `api/v1/community/chat/friends${suffix}`,
        user.accessToken,
        correlationId,
        parseFriendshipPage,
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (method === 'GET' && surface === 'members' && path.length <= 2) {
      if (!id) {
        const q = query.get('q') ?? ''
        if ([...q.trim()].length < 2 || [...q].length > 80) return invalid()
        const result = await communityChatRequest(
          `api/v1/community/members${suffix}`,
          user.accessToken,
          correlationId,
          parseMemberPage,
        )
        return carryCommunitySession(
          communitySuccessResponse(result.data, correlationId),
          user,
        )
      }
      const result = await communityChatRequest(
        `api/v1/community/members/${id}${suffix}`,
        user.accessToken,
        correlationId,
        parseMemberProfile,
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (method === 'PUT' && surface === 'friends' && id && path.length === 2) {
      const result = await communityChatRequest(
        `api/v1/community/chat/friends/${id}`,
        user.accessToken,
        correlationId,
        parseFriendship,
        { method: 'PUT', body: {} },
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (
      method === 'POST' &&
      surface === 'friendships' &&
      id &&
      action === 'accept' &&
      path.length === 3
    ) {
      const result = await communityChatRequest(
        `api/v1/community/chat/friendships/${id}/accept`,
        user.accessToken,
        correlationId,
        parseFriendship,
        { method: 'POST', body: {} },
      )
      return carryCommunitySession(
        communitySuccessResponse(result.data, correlationId),
        user,
      )
    }
    if (
      method === 'DELETE' &&
      surface === 'friendships' &&
      id &&
      path.length === 2
    ) {
      await communityChatRequest(
        `api/v1/community/chat/friendships/${id}`,
        user.accessToken,
        correlationId,
        () => null,
        { method: 'DELETE', allowNoContent: true },
      )
      return carryCommunitySession(
        communityNoContentResponse(correlationId),
        user,
      )
    }
    return invalid()
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}

export { handle as GET, handle as PUT, handle as POST, handle as DELETE }

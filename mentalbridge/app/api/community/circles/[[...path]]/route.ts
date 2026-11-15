import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import { isSameOrigin } from '@/lib/auth/same-origin'
import {
  authenticatedCommunityUser,
  carryCommunitySession,
  communityAuthenticationFailure,
} from '@/lib/community/authenticated-user'
import {
  communityErrorResponse,
  communitySuccessResponse,
  communityNoContentResponse,
  localProblem,
} from '@/lib/community/bff-response'
import { communityChatRequest } from '@/features/community-chat/server/community-chat-client'
import {
  circleSchema,
  circleDetailSchema,
  circlePageSchema,
  circleEntrySchema,
  entryPageSchema,
  createCircleSchema,
  writeCircleSchema,
  inviteCircleSchema,
  decideCircleSchema,
} from '@/features/community/api/community-circles'

type Context = { params: Promise<{ path?: string[] }> }
async function handle(request: NextRequest, context: Context) {
  const correlation = correlationIdFrom(request)
  let user
  try {
    user = await authenticatedCommunityUser(request, correlation)
  } catch (error) {
    return communityAuthenticationFailure(error, correlation)
  }
  const invalid = () =>
    carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu nhóm chưa hợp lệ.',
        correlation,
      ),
      user,
    )
  if (request.method !== 'GET' && !isSameOrigin(request))
    return carryCommunitySession(
      localProblem(
        403,
        'FORBIDDEN',
        'Hãy thao tác từ trang cộng đồng.',
        correlation,
      ),
      user,
    )
  const path = (await context.params).path ?? []
  const [circle, surface, entry, action] = path
  const validId = (value?: string) => z.string().uuid().safeParse(value).success
  if (
    path.length > 4 ||
    (circle && !validId(circle)) ||
    (entry && !validId(entry))
  )
    return invalid()
  const get = request.method === 'GET',
    post = request.method === 'POST',
    del = request.method === 'DELETE'
  const list =
    !path.length ||
    (path.length === 2 && surface === 'posts') ||
    (path.length === 4 && surface === 'posts' && action === 'comments')
  const query = request.nextUrl.searchParams
  if (
    [...query.keys()].some(
      (key) =>
        !get ||
        !list ||
        !['cursor', 'limit'].includes(key) ||
        query.getAll(key).length !== 1,
    ) ||
    (query.has('cursor') && !validId(query.get('cursor') ?? undefined)) ||
    (query.has('limit') && !/^(?:[1-9]|10)$/.test(query.get('limit') ?? ''))
  )
    return invalid()
  let output: z.ZodType = circleSchema
  let bodySchema: z.ZodType | undefined
  let noContent = false
  let keyed = false
  if (!path.length && get) output = circlePageSchema
  else if (!path.length && post) {
    bodySchema = createCircleSchema
    keyed = true
  } else if (path.length === 1 && get) output = circleDetailSchema
  else if (path.length === 1 && del) noContent = true
  else if (path.length === 2 && surface === 'invitations' && post) {
    bodySchema = inviteCircleSchema
    noContent = true
  } else if (path.length === 2 && surface === 'decision' && post) {
    bodySchema = decideCircleSchema
    noContent = true
  } else if (path.length === 3 && surface === 'members' && del) noContent = true
  else if (
    (path.length === 2 && surface === 'posts') ||
    (path.length === 4 && surface === 'posts' && action === 'comments')
  ) {
    if (get) output = entryPageSchema
    else if (post) {
      bodySchema = writeCircleSchema
      output = circleEntrySchema
      keyed = true
    } else return invalid()
  } else if (
    path.length === 3 &&
    ['posts', 'comments'].includes(surface) &&
    del
  )
    noContent = true
  else return invalid()
  const key = request.headers.get('Idempotency-Key')
  if (keyed && !validId(key ?? undefined)) return invalid()
  try {
    const body = bodySchema
      ? bodySchema.safeParse(await readBoundedJson(request, 24000))
      : undefined
    if (body && !body.success) return invalid()
    const result = await communityChatRequest(
      `api/v1/community/circles${path.length ? '/' + path.join('/') : ''}${query.size ? '?' + query.toString() : ''}`,
      user.accessToken,
      correlation,
      (value) => {
        const parsed = output.safeParse(value)
        return parsed.success ? parsed.data : null
      },
      {
        method: get ? 'GET' : post ? 'POST' : 'DELETE',
        ...(body?.success ? { body: body.data } : {}),
        ...(keyed && key ? { headers: { 'Idempotency-Key': key } } : {}),
        ...(noContent ? { allowNoContent: true } : {}),
      },
    )
    return carryCommunitySession(
      noContent
        ? communityNoContentResponse(correlation)
        : communitySuccessResponse(result.data, correlation),
      user,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryCommunitySession(
        localProblem(
          error.status,
          error.code,
          'Yêu cầu nhóm chưa hợp lệ.',
          correlation,
        ),
        user,
      )
    return carryCommunitySession(
      communityErrorResponse(error, correlation),
      user,
    )
  }
}
export const GET = handle
export const POST = handle
export const DELETE = handle

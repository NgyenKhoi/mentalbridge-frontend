import 'server-only'

import { readCommunityServerConfig } from '@/lib/config/server'
import {
  isCommunityEtag,
  parseCommunityFeedPage,
  parseCommunityProfile,
  parseCommunityPostDetail,
  parseCommunityProblem,
  parseOwnerVersion,
  parseCommunityTopics,
  parseMediaUploadIntent,
  parseCommunityMediaRecord,
  parseCommunityComment,
  parseCommunityCommentPage,
  parseModerationCase,
  parseModerationCases,
  parseCommunityReaction,
  type CommunityFeedPage,
  type CommunityProfile,
  type CommunityPostDetail,
  type CommunityPostWrite,
  type CommunityProblem,
  type CommunityTopic,
  type PutCommunityProfileRequest,
  type CreateMediaUploadIntentRequest,
  type MediaUploadIntent,
  type CommunityMediaRecord,
  type CommunityComment,
  type CommunityCommentPage,
  type CreateCommentRequest,
  type UpdateCommentRequest,
  type CreateReportRequest,
  type ReportTargetType,
  type ModerationCase,
  type CreateModerationActionRequest,
  type CommunityReaction,
  type PutReactionRequest,
} from './community-validation'

const MAX_RESPONSE_BYTES = 256 * 1024

export class CommunityServiceError extends Error {
  readonly code: string
  readonly status: number
  readonly correlationId?: string | null

  constructor(
    problem: Pick<CommunityProblem, 'type' | 'title' | 'status' | 'code'> & {
      correlationId?: string | null
    },
    cause?: unknown,
  ) {
    super(problem.title, { cause })
    this.name = 'CommunityServiceError'
    this.code = problem.code
    this.status = problem.status
    this.correlationId = problem.correlationId
  }
}

function localError(
  status: number,
  code: string,
  title: string,
  cause?: unknown,
) {
  return new CommunityServiceError(
    { type: 'about:blank', title, status, code },
    cause,
  )
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const contentLength = Number(response.headers.get('content-length'))
  if (
    !contentType.includes('json') ||
    (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES)
  ) {
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned an invalid response.',
    )
  }
  const reader = response.body?.getReader()
  if (!reader) {
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned an invalid response.',
    )
  }
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw localError(
        502,
        'COMMUNITY_MALFORMED_RESPONSE',
        'Community returned an oversized response.',
      )
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch (cause) {
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned invalid JSON.',
      cause,
    )
  }
}

type CommunityResult<T> = Readonly<{ data: T; etag: string | null }>

function requireProfileEtag(
  result: CommunityResult<CommunityProfile>,
): CommunityResult<CommunityProfile> {
  if (
    !isCommunityEtag(result.etag) ||
    Number(result.etag.slice(1, -1)) !== result.data.version
  ) {
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned an invalid profile version.',
    )
  }
  return result
}

function requireCommentEtag(
  result: CommunityResult<CommunityComment>,
): CommunityResult<CommunityComment> {
  if (
    !isCommunityEtag(result.etag) ||
    Number(result.etag.slice(1, -1)) !== result.data.version
  ) {
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned an invalid comment version.',
    )
  }
  return result
}

async function request<T>(
  path: string,
  accessToken: string,
  correlationId: string,
  parse: (value: unknown) => T | null,
  options: Readonly<{
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT'
    body?: unknown
    headers?: Record<string, string>
  }> = {},
): Promise<CommunityResult<T>> {
  const config = readCommunityServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(path.replace(/^\//, ''), config.baseUrl),
      {
        method: options.method ?? 'GET',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${accessToken}`,
          'X-Correlation-Id': correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )
    const raw = await readJson(response)
    if (!response.ok) {
      const problem = parseCommunityProblem(raw, response.status)
      if (!problem) {
        throw localError(
          502,
          'COMMUNITY_MALFORMED_RESPONSE',
          'Community returned an invalid error response.',
        )
      }
      throw new CommunityServiceError(problem)
    }
    const parsed = parse(raw)
    if (!parsed) {
      throw localError(
        502,
        'COMMUNITY_MALFORMED_RESPONSE',
        'Community returned an invalid response.',
      )
    }
    return { data: parsed, etag: response.headers.get('etag') }
  } catch (error) {
    if (error instanceof CommunityServiceError) throw error
    if (controller.signal.aborted) {
      throw localError(
        504,
        'COMMUNITY_TIMEOUT',
        'Community request timed out.',
        error,
      )
    }
    throw localError(
      503,
      'COMMUNITY_UNAVAILABLE',
      'Community is unavailable.',
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export const communityClient = {
  async feed(
    accessToken: string,
    query: URLSearchParams,
    correlationId: string,
  ) {
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return (
      await request<CommunityFeedPage>(
        `/api/v1/community/feed${suffix}`,
        accessToken,
        correlationId,
        parseCommunityFeedPage,
      )
    ).data
  },
  async detail(accessToken: string, postId: string, correlationId: string) {
    const response = await request<CommunityPostDetail>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}`,
      accessToken,
      correlationId,
      parseCommunityPostDetail,
    )
    const version = parseOwnerVersion(response.etag)
    if (response.etag !== null && version === null) {
      throw localError(
        502,
        'COMMUNITY_MALFORMED_RESPONSE',
        'Community returned an invalid owner version.',
      )
    }
    return { post: response.data, version }
  },
  async topics(accessToken: string, correlationId: string) {
    return (
      await request<CommunityTopic[]>(
        '/api/v1/community/topics',
        accessToken,
        correlationId,
        parseCommunityTopics,
      )
    ).data
  },
  async create(
    accessToken: string,
    input: CommunityPostWrite,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const response = await request<CommunityPostDetail>(
      '/api/v1/community/posts',
      accessToken,
      correlationId,
      parseCommunityPostDetail,
      {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    )
    const version = parseOwnerVersion(response.etag)
    if (version === null) {
      throw localError(
        502,
        'COMMUNITY_MALFORMED_RESPONSE',
        'Community returned an invalid owner version.',
      )
    }
    return { post: response.data, version }
  },
  async update(
    accessToken: string,
    postId: string,
    input: CommunityPostWrite,
    ifMatch: string,
    correlationId: string,
  ) {
    const response = await request<CommunityPostDetail>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}`,
      accessToken,
      correlationId,
      parseCommunityPostDetail,
      {
        method: 'PATCH',
        body: input,
        headers: { 'If-Match': ifMatch },
      },
    )
    const version = parseOwnerVersion(response.etag)
    if (version === null) {
      throw localError(
        502,
        'COMMUNITY_MALFORMED_RESPONSE',
        'Community returned an invalid owner version.',
      )
    }
    return { post: response.data, version }
  },
  delete(
    accessToken: string,
    postId: string,
    ifMatch: string,
    correlationId: string,
  ) {
    return deleteRequest(
      `/api/v1/community/posts/${encodeURIComponent(postId)}`,
      accessToken,
      correlationId,
      ifMatch,
    )
  },
  async profile(accessToken: string, correlationId: string) {
    return requireProfileEtag(
      await request<CommunityProfile>(
        '/api/v1/community/profile',
        accessToken,
        correlationId,
        parseCommunityProfile,
      ),
    )
  },
  async putProfile(
    accessToken: string,
    correlationId: string,
    input: PutCommunityProfileRequest,
    ifMatch?: string,
  ) {
    return requireProfileEtag(
      await request<CommunityProfile>(
        '/api/v1/community/profile',
        accessToken,
        correlationId,
        parseCommunityProfile,
        {
          method: 'PUT',
          body: input,
          headers: ifMatch ? { 'If-Match': ifMatch } : undefined,
        },
      ),
    )
  },
  async createMediaIntent(
    accessToken: string,
    input: CreateMediaUploadIntentRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return (
      await request<MediaUploadIntent>(
        '/api/v1/community/media/upload-intents',
        accessToken,
        correlationId,
        parseMediaUploadIntent,
        {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      )
    ).data
  },
  async finalizeMedia(
    accessToken: string,
    mediaId: string,
    correlationId: string,
  ) {
    return (
      await request<CommunityMediaRecord>(
        `/api/v1/community/media/${encodeURIComponent(mediaId)}/finalize`,
        accessToken,
        correlationId,
        parseCommunityMediaRecord,
        { method: 'POST' },
      )
    ).data
  },
  deleteMedia(
    accessToken: string,
    mediaId: string,
    ifMatch: string,
    correlationId: string,
  ) {
    return deleteRequest(
      `/api/v1/community/media/${encodeURIComponent(mediaId)}`,
      accessToken,
      correlationId,
      ifMatch,
    )
  },
  async comments(
    accessToken: string,
    postId: string,
    query: URLSearchParams,
    correlationId: string,
  ) {
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return (
      await request<CommunityCommentPage>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/comments${suffix}`,
        accessToken,
        correlationId,
        parseCommunityCommentPage,
      )
    ).data
  },
  async createComment(
    accessToken: string,
    postId: string,
    input: CreateCommentRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return requireCommentEtag(
      await request<CommunityComment>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/comments`,
        accessToken,
        correlationId,
        parseCommunityComment,
        {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      ),
    )
  },
  async updateComment(
    accessToken: string,
    commentId: string,
    input: UpdateCommentRequest,
    ifMatch: string,
    correlationId: string,
  ) {
    return requireCommentEtag(
      await request<CommunityComment>(
        `/api/v1/community/comments/${encodeURIComponent(commentId)}`,
        accessToken,
        correlationId,
        parseCommunityComment,
        {
          method: 'PATCH',
          body: input,
          headers: { 'If-Match': ifMatch },
        },
      ),
    )
  },
  deleteComment(
    accessToken: string,
    commentId: string,
    ifMatch: string,
    correlationId: string,
  ) {
    return deleteRequest(
      `/api/v1/community/comments/${encodeURIComponent(commentId)}`,
      accessToken,
      correlationId,
      ifMatch,
    )
  },
  async putReaction(
    accessToken: string,
    postId: string,
    input: PutReactionRequest,
    correlationId: string,
  ) {
    return (
      await request<CommunityReaction>(
        `/api/v1/community/posts/${encodeURIComponent(postId)}/reaction`,
        accessToken,
        correlationId,
        parseCommunityReaction,
        { method: 'PUT', body: input },
      )
    ).data
  },
  deleteReaction(accessToken: string, postId: string, correlationId: string) {
    return noContentRequest(
      `/api/v1/community/posts/${encodeURIComponent(postId)}/reaction`,
      'DELETE',
      accessToken,
      correlationId,
    )
  },
  putBookmark(accessToken: string, postId: string, correlationId: string) {
    return noContentRequest(
      `/api/v1/community/posts/${encodeURIComponent(postId)}/bookmark`,
      'PUT',
      accessToken,
      correlationId,
    )
  },
  deleteBookmark(accessToken: string, postId: string, correlationId: string) {
    return noContentRequest(
      `/api/v1/community/posts/${encodeURIComponent(postId)}/bookmark`,
      'DELETE',
      accessToken,
      correlationId,
    )
  },
  report(
    accessToken: string,
    input: CreateReportRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return noContentRequest(
      '/api/v1/community/reports',
      'POST',
      accessToken,
      correlationId,
      { 'Idempotency-Key': idempotencyKey },
      input,
      202,
    )
  },
  hide(
    accessToken: string,
    targetType: ReportTargetType,
    targetId: string,
    correlationId: string,
  ) {
    return noContentRequest(
      `/api/v1/community/hidden-content/${targetType}/${encodeURIComponent(targetId)}`,
      'PUT',
      accessToken,
      correlationId,
    )
  },
  block(accessToken: string, profileId: string, correlationId: string) {
    return noContentRequest(
      `/api/v1/community/blocks/${encodeURIComponent(profileId)}`,
      'PUT',
      accessToken,
      correlationId,
    )
  },
  unblock(accessToken: string, profileId: string, correlationId: string) {
    return noContentRequest(
      `/api/v1/community/blocks/${encodeURIComponent(profileId)}`,
      'DELETE',
      accessToken,
      correlationId,
    )
  },
  async moderationCases(
    accessToken: string,
    query: URLSearchParams,
    correlationId: string,
  ) {
    const suffix = query.size ? `?${query.toString()}` : ''
    return (
      await request<ModerationCase[]>(
        `/api/v1/community/admin/moderation-cases${suffix}`,
        accessToken,
        correlationId,
        parseModerationCases,
      )
    ).data
  },
  async moderationAction(
    accessToken: string,
    caseId: string,
    input: CreateModerationActionRequest,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return (
      await request<ModerationCase>(
        `/api/v1/community/admin/moderation-cases/${encodeURIComponent(caseId)}/actions`,
        accessToken,
        correlationId,
        parseModerationCase,
        {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      )
    ).data
  },
}

async function noContentRequest(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  accessToken: string,
  correlationId: string,
  headers?: Record<string, string>,
  body?: unknown,
  expectedStatus = 204,
) {
  const config = readCommunityServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(path.replace(/^\//, ''), config.baseUrl),
      {
        method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${accessToken}`,
          'X-Correlation-Id': correlationId,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
      },
    )
    if (response.status === expectedStatus) return
    const raw = await readJson(response)
    if (!response.ok) {
      const problem = parseCommunityProblem(raw, response.status)
      if (problem) throw new CommunityServiceError(problem)
    }
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned an invalid response.',
    )
  } catch (error) {
    if (error instanceof CommunityServiceError) throw error
    if (controller.signal.aborted)
      throw localError(
        504,
        'COMMUNITY_TIMEOUT',
        'Community request timed out.',
        error,
      )
    throw localError(
      503,
      'COMMUNITY_UNAVAILABLE',
      'Community is unavailable.',
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function deleteRequest(
  path: string,
  accessToken: string,
  correlationId: string,
  ifMatch: string,
) {
  const config = readCommunityServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(path.replace(/^\//, ''), config.baseUrl),
      {
        method: 'DELETE',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${accessToken}`,
          'X-Correlation-Id': correlationId,
          'If-Match': ifMatch,
        },
      },
    )
    if (response.status === 204) return
    const raw = await readJson(response)
    if (!response.ok) {
      const problem = parseCommunityProblem(raw, response.status)
      if (problem) throw new CommunityServiceError(problem)
    }
    throw localError(
      502,
      'COMMUNITY_MALFORMED_RESPONSE',
      'Community returned an invalid response.',
    )
  } catch (error) {
    if (error instanceof CommunityServiceError) throw error
    if (controller.signal.aborted) {
      throw localError(
        504,
        'COMMUNITY_TIMEOUT',
        'Community request timed out.',
        error,
      )
    }
    throw localError(
      503,
      'COMMUNITY_UNAVAILABLE',
      'Community is unavailable.',
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

import 'server-only'

import { readCommunityServerConfig } from '@/lib/config/server'
import {
  parseCommunityFeedPage,
  parseCommunityPostDetail,
  parseCommunityProblem,
  parseCommunityTopics,
  type CommunityFeedPage,
  type CommunityPostDetail,
  type CommunityProblem,
  type CommunityTopic,
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

async function request<T>(
  path: string,
  accessToken: string,
  correlationId: string,
  parse: (value: unknown) => T | null,
): Promise<T> {
  const config = readCommunityServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(path.replace(/^\//, ''), config.baseUrl),
      {
        method: 'GET',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${accessToken}`,
          'X-Correlation-Id': correlationId,
        },
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
    return parsed
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
  feed(accessToken: string, query: URLSearchParams, correlationId: string) {
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return request<CommunityFeedPage>(
      `/api/v1/community/feed${suffix}`,
      accessToken,
      correlationId,
      parseCommunityFeedPage,
    )
  },
  detail(accessToken: string, postId: string, correlationId: string) {
    return request<CommunityPostDetail>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}`,
      accessToken,
      correlationId,
      parseCommunityPostDetail,
    )
  },
  topics(accessToken: string, correlationId: string) {
    return request<CommunityTopic[]>(
      '/api/v1/community/topics',
      accessToken,
      correlationId,
      parseCommunityTopics,
    )
  },
}

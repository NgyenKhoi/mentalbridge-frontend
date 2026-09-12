import 'server-only'

import { readContentServerConfig } from '@/lib/config/server'
import {
  parseAdminResourceDetail,
  parseContentProblem,
  parseResourceList,
  parseResourceSummary,
  type AdminResourceDetail,
  type ContentProblem,
  type ResourceListResponse,
  type ResourceSummary,
} from './content-validation'

const MAX_CONTENT_RESPONSE_BYTES = 128 * 1024

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  expectedStatus: number
  accessToken: string
  correlationId: string
  body?: unknown
  idempotencyKey?: string
  parseSuccess?: (value: unknown) => T | null
  mutation?: boolean
}>

export class ContentServiceError extends Error {
  readonly code: string
  readonly status: number
  readonly correlationId?: string | null
  readonly fieldViolations?: ContentProblem['fieldViolations']

  constructor(problem: ContentProblem, cause?: unknown) {
    super(problem.title, { cause })
    this.name = 'ContentServiceError'
    this.code = problem.code
    this.status = problem.status
    this.correlationId = problem.correlationId
    this.fieldViolations = problem.fieldViolations
  }
}

function localError(
  status: number,
  code: string,
  title: string,
  cause?: unknown,
) {
  return new ContentServiceError(
    { type: 'about:blank', title, status, code },
    cause,
  )
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const contentLength = Number(response.headers.get('content-length'))
  if (
    !contentType.includes('json') ||
    (Number.isFinite(contentLength) &&
      contentLength > MAX_CONTENT_RESPONSE_BYTES)
  ) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid response.',
    )
  }
  const reader = response.body?.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  if (!reader) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid response.',
    )
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_CONTENT_RESPONSE_BYTES) {
      await reader.cancel()
      throw localError(
        502,
        'CONTENT_MALFORMED_RESPONSE',
        'Content returned an oversized response.',
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
  const text = new TextDecoder().decode(bytes)
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid response.',
      cause,
    )
  }
}

async function contentRequest<T>(options: RequestOptions<T>): Promise<T> {
  const config = readContentServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(options.path.replace(/^\//, ''), config.baseUrl),
      {
        method: options.method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${options.accessToken}`,
          'X-Correlation-Id': options.correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )

    if (!response.ok) {
      const problem = parseContentProblem(
        await readJson(response),
        response.status,
      )
      if (!problem) {
        throw localError(
          502,
          'CONTENT_MALFORMED_RESPONSE',
          'Content returned an invalid error response.',
        )
      }
      throw new ContentServiceError(problem)
    }
    if (response.status !== options.expectedStatus) {
      throw localError(
        502,
        'CONTENT_MALFORMED_RESPONSE',
        'Content returned an unexpected status.',
      )
    }
    if (response.status === 204) return undefined as T
    const parsed = options.parseSuccess?.(await readJson(response))
    if (!parsed) {
      throw localError(
        502,
        'CONTENT_MALFORMED_RESPONSE',
        'Content returned an invalid response.',
      )
    }
    return parsed
  } catch (error) {
    if (error instanceof ContentServiceError) throw error
    if (options.mutation) {
      throw localError(
        503,
        'CONTENT_COMMAND_OUTCOME_UNKNOWN',
        'The command outcome could not be confirmed.',
        error,
      )
    }
    if (controller.signal.aborted) {
      throw localError(
        504,
        'CONTENT_TIMEOUT',
        'Content request timed out.',
        error,
      )
    }
    throw localError(
      503,
      'CONTENT_UNAVAILABLE',
      'Content is unavailable.',
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export const contentAdminClient = {
  list(accessToken: string, query: URLSearchParams, correlationId: string) {
    return contentRequest<ResourceListResponse>({
      method: 'GET',
      path: `/api/v1/resources/admin/list?${query.toString()}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseResourceList,
    })
  },
  detail(accessToken: string, id: string, correlationId: string) {
    return contentRequest<AdminResourceDetail>({
      method: 'GET',
      path: `/api/v1/resources/admin/${encodeURIComponent(id)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseAdminResourceDetail,
    })
  },
  create(
    accessToken: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'POST',
      path: '/api/v1/resources',
      expectedStatus: 201,
      accessToken,
      correlationId,
      idempotencyKey,
      body,
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
  update(
    accessToken: string,
    id: string,
    version: number,
    body: unknown,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'PATCH',
      path: `/api/v1/resources/${encodeURIComponent(id)}?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body,
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
  delete(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<void>({
      method: 'DELETE',
      path: `/api/v1/resources/${encodeURIComponent(id)}?version=${String(version)}`,
      expectedStatus: 204,
      accessToken,
      correlationId,
      mutation: true,
    })
  },
  publish(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<never>({
      method: 'POST',
      path: `/api/v1/resources/${encodeURIComponent(id)}/publish?version=${String(version)}`,
      expectedStatus: 409,
      accessToken,
      correlationId,
      mutation: true,
    })
  },
  archive(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'POST',
      path: `/api/v1/resources/${encodeURIComponent(id)}/archive?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
}

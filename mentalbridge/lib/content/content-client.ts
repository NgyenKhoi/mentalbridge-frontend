import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { readContentServerConfig } from '@/lib/config/server'
import type { ResourceListResponse } from '@/features/resources/api/content-contract'

import { parseResourceList } from './content-validation'

const MAX_CONTENT_RESPONSE_BYTES = 128 * 1_024

async function readResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  const contentLength = Number(response.headers.get('content-length'))
  if (
    !contentType.toLowerCase().includes('json') ||
    (Number.isFinite(contentLength) &&
      contentLength > MAX_CONTENT_RESPONSE_BYTES)
  ) {
    throw malformedResponse()
  }

  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_CONTENT_RESPONSE_BYTES) {
    throw malformedResponse()
  }
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw malformedResponse(cause)
  }
}

function malformedResponse(cause?: unknown) {
  return new ApiError({
    message: 'Content returned an invalid response.',
    code: 'CONTENT_MALFORMED_RESPONSE',
    status: 502,
    cause,
  })
}

export async function listReviewedResources(
  correlationId: string,
): Promise<ResourceListResponse> {
  const config = readContentServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  const url = new URL('api/v1/resources', config.baseUrl)
  url.searchParams.set('locale', 'vi-VN')
  url.searchParams.set('limit', '20')

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/problem+json',
        'X-Correlation-Id': correlationId,
      },
    })
    if (!response.ok) {
      throw new ApiError({
        message: 'Content is unavailable.',
        code: 'CONTENT_UNAVAILABLE',
        status: response.status >= 500 ? 503 : response.status,
      })
    }
    const parsed = parseResourceList(await readResponse(response))
    if (!parsed) throw malformedResponse()
    return parsed
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError({
      message: controller.signal.aborted
        ? 'Content request timed out.'
        : 'Content is unavailable.',
      code: controller.signal.aborted
        ? 'CONTENT_TIMEOUT'
        : 'CONTENT_UNAVAILABLE',
      status: controller.signal.aborted ? 504 : 503,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

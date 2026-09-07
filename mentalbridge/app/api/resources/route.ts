import { NextRequest, NextResponse } from 'next/server'

import type { components } from '@/contracts/content.generated'
import { readContentServerConfig } from '@/lib/config/server'

type ResourceSummary = components['schemas']['ResourceSummary']
type ResourceCategory = ResourceSummary['category']
type ResourceStatus = ResourceSummary['status']

interface BackendResourcesResponse {
  data: ResourceSummary[]
  count: number
  nextCursor?: string
}

export interface ResourcesResponse {
  items: ResourceSummary[]
  hasMore: boolean
  nextCursor?: string
  unavailable?: boolean
  message?: string
}

interface ErrorResponse {
  type: string
  title: string
  status: number
  code: string
  detail: string
}

const RESOURCE_CATEGORIES = new Set<ResourceCategory>([
  'BREATHING',
  'MEDITATION',
  'ARTICLE',
  'VIDEO',
  'JOURNALING',
  'COMMUNITY',
])
const RESOURCE_STATUSES = new Set<ResourceStatus>([
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UNAVAILABLE_MESSAGE =
  'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.'

function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
) {
  return NextResponse.json<ErrorResponse>(
    { type: 'about:blank', title, status, code, detail },
    {
      status,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  )
}

function malformedResponse(detail: string) {
  return problemResponse(
    502,
    'CONTENT_INVALID_RESPONSE',
    'Malformed Response',
    detail,
  )
}

function isDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  )
}

function isSafeExternalUrl(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string' || value.length === 0) return false

  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}

function isValidResourceSummary(
  resource: unknown,
): resource is ResourceSummary {
  if (typeof resource !== 'object' || resource === null) return false

  const value = resource as Record<string, unknown>
  return (
    typeof value.id === 'string' &&
    UUID_PATTERN.test(value.id) &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.category === 'string' &&
    RESOURCE_CATEGORIES.has(value.category as ResourceCategory) &&
    typeof value.locale === 'string' &&
    value.locale.length > 0 &&
    isSafeExternalUrl(value.externalUrl) &&
    typeof value.status === 'string' &&
    RESOURCE_STATUSES.has(value.status as ResourceStatus) &&
    (value.reviewedAt === null || isDateTime(value.reviewedAt)) &&
    isDateTime(value.createdAt) &&
    (value.updatedAt === undefined || isDateTime(value.updatedAt))
  )
}

function validateQuery(searchParams: URLSearchParams): ErrorResponse | null {
  const category = searchParams.get('category')
  if (category && !RESOURCE_CATEGORIES.has(category as ResourceCategory)) {
    return {
      type: 'about:blank',
      title: 'Invalid Request',
      status: 400,
      code: 'INVALID_RESOURCE_CATEGORY',
      detail: 'category must be a supported resource category',
    }
  }

  const limit = searchParams.get('limit')
  if (
    limit &&
    (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
  ) {
    return {
      type: 'about:blank',
      title: 'Invalid Request',
      status: 400,
      code: 'INVALID_RESOURCE_LIMIT',
      detail: 'limit must be an integer between 1 and 100',
    }
  }

  const cursor = searchParams.get('cursor')
  if (cursor && !UUID_PATTERN.test(cursor)) {
    return {
      type: 'about:blank',
      title: 'Invalid Request',
      status: 400,
      code: 'INVALID_RESOURCE_CURSOR',
      detail: 'cursor must be a valid UUID',
    }
  }

  return null
}

/**
 * BFF route for fetching reviewed resources from Content service.
 * Upstream addresses and error payloads never cross the browser boundary.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const queryError = validateQuery(searchParams)
  if (queryError) {
    return NextResponse.json(queryError, {
      status: queryError.status,
      headers: { 'Content-Type': 'application/problem+json' },
    })
  }

  const contentConfig = readContentServerConfig()
  const category = searchParams.get('category')
  const limit = searchParams.get('limit')
  const cursor = searchParams.get('cursor')
  const acceptLanguage = request.headers.get('accept-language')
  const locale =
    acceptLanguage?.split(',')[0]?.split('-')[0]?.toLowerCase() === 'en'
      ? 'en-US'
      : 'vi-VN'

  const upstreamUrl = new URL('api/v1/resources', contentConfig.baseUrl)
  upstreamUrl.searchParams.set('locale', locale)
  if (category) upstreamUrl.searchParams.set('category', category)
  if (limit) upstreamUrl.searchParams.set('limit', limit)
  if (cursor) upstreamUrl.searchParams.set('cursor', cursor)

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    contentConfig.timeoutMs,
  )

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      const status =
        response.status >= 400 && response.status <= 599 ? response.status : 502
      return problemResponse(
        status,
        'CONTENT_REQUEST_FAILED',
        'Content Request Failed',
        'The resource catalogue could not be loaded.',
      )
    }

    let rawData: unknown
    try {
      rawData = await response.json()
    } catch {
      return malformedResponse('Content service returned invalid JSON')
    }

    if (typeof rawData !== 'object' || rawData === null) {
      return malformedResponse('Content service returned a non-object response')
    }

    const value = rawData as Record<string, unknown>
    if (value.fallback !== undefined) {
      if (
        value.fallback !== 'unavailable' ||
        !Array.isArray(value.data) ||
        value.data.length !== 0 ||
        value.count !== 0
      ) {
        return malformedResponse(
          'Content service returned an invalid fallback response',
        )
      }

      return NextResponse.json<ResourcesResponse>({
        items: [],
        hasMore: false,
        unavailable: true,
        message: UNAVAILABLE_MESSAGE,
      })
    }

    if (
      !Array.isArray(value.data) ||
      !Number.isInteger(value.count) ||
      (value.count as number) < 0 ||
      (value.nextCursor !== undefined &&
        (typeof value.nextCursor !== 'string' ||
          !UUID_PATTERN.test(value.nextCursor)))
    ) {
      return malformedResponse(
        'Content service returned an invalid response structure',
      )
    }

    if (!value.data.every(isValidResourceSummary)) {
      console.warn('[BFF] Content service returned an invalid resource row.')
      return malformedResponse(
        'Content service returned an invalid resource row',
      )
    }

    const backendData = value as unknown as BackendResourcesResponse
    if (
      backendData.data.some(
        (resource) =>
          resource.status === 'PUBLISHED' && resource.reviewedAt === null,
      )
    ) {
      console.warn(
        '[BFF] Content service returned an unreviewed published resource.',
      )
      return malformedResponse(
        'Content service returned an unreviewed published resource',
      )
    }

    const items = backendData.data.filter(
      (resource) =>
        resource.status === 'PUBLISHED' && resource.reviewedAt !== null,
    )

    return NextResponse.json<ResourcesResponse>({
      items,
      hasMore: backendData.nextCursor !== undefined,
      ...(backendData.nextCursor ? { nextCursor: backendData.nextCursor } : {}),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return problemResponse(
        504,
        'CONTENT_TIMEOUT',
        'Service Timeout',
        'The resource catalogue did not respond in time.',
      )
    }

    console.error('[BFF] Resource fetch failed.')
    return problemResponse(
      503,
      'CONTENT_UNAVAILABLE',
      'Service Unavailable',
      'The resource catalogue is temporarily unavailable.',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

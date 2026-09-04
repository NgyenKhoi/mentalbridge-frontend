import { NextRequest, NextResponse } from 'next/server'
import type { components } from '@/contracts/care.generated'

// Use generated types from OpenAPI contract
type ResourceSummary = components['schemas']['ResourceSummary']
type ResourceCategory = components['schemas']['ResourceCategory']

// Backend actual response
interface BackendResourcesResponse {
  data: ResourceSummary[]
  count: number
  nextCursor?: string
  fallback?: 'unavailable'
  message?: string
}

// Frontend normalized response
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
  detail?: string
}

const CONTENT_SERVICE_BASE_URL =
  process.env.CONTENT_SERVICE_URL || 'http://localhost:3003'
const REQUEST_TIMEOUT_MS = 5000

/**
 * BFF route for fetching resources from Content service
 * Never exposes upstream URLs to browser
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.url
    ? new URL(request.url)
    : { searchParams: new URLSearchParams() }

  const category = searchParams.get('category')
  const limit = searchParams.get('limit')
  const cursor = searchParams.get('cursor')

  // Get locale from Accept-Language header or default to vi-VN
  const acceptLanguage = request.headers.get('accept-language')
  const locale = acceptLanguage?.split(',')[0]?.split('-')[0] === 'en' ? 'en-US' : 'vi-VN'

  // Build upstream URL
  const upstreamUrl = new URL(`${CONTENT_SERVICE_BASE_URL}/api/v1/resources`)
  upstreamUrl.searchParams.set('locale', locale)
  if (category) upstreamUrl.searchParams.set('category', category)
  if (limit) upstreamUrl.searchParams.set('limit', limit)
  if (cursor) upstreamUrl.searchParams.set('cursor', cursor)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // Parse Problem Details if available
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/problem+json')) {
        const problemDetails: ErrorResponse = await response.json()
        return NextResponse.json(problemDetails, { status: response.status })
      }

      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Upstream Error',
          status: response.status,
          detail: `Content service returned ${response.status}`,
        } as ErrorResponse,
        { status: response.status },
      )
    }

    const backendData: BackendResourcesResponse = await response.json()

    // Check if backend returned unavailable state
    if (backendData.fallback === 'unavailable') {
      const normalizedResponse: ResourcesResponse = {
        items: [],
        hasMore: false,
        unavailable: true,
        message: backendData.message,
      }
      return NextResponse.json(normalizedResponse)
    }

    // Validate backend response structure
    if (
      !Array.isArray(backendData.data) ||
      typeof backendData.count !== 'number'
    ) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Malformed Response',
          status: 502,
          detail: 'Content service returned invalid response structure',
        } as ErrorResponse,
        { status: 502 },
      )
    }

    // Validate each resource row at runtime before accepting
    function isValidResourceSummary(resource: any): resource is ResourceSummary {
      return (
        typeof resource === 'object' &&
        resource !== null &&
        typeof resource.id === 'string' &&
        typeof resource.title === 'string' &&
        typeof resource.summary === 'string' &&
        ['BREATHING', 'MEDITATION', 'ARTICLE', 'VIDEO', 'JOURNALING', 'COMMUNITY'].includes(resource.category) &&
        typeof resource.locale === 'string' &&
        (resource.externalUrl === null || typeof resource.externalUrl === 'string') &&
        resource.status === 'PUBLISHED' &&
        (resource.reviewedBy === null || typeof resource.reviewedBy === 'string') &&
        (resource.reviewedAt === null || typeof resource.reviewedAt === 'string') &&
        typeof resource.createdAt === 'string' &&
        typeof resource.updatedAt === 'string'
      )
    }

    // Filter and validate each resource row
    const validResources = backendData.data.filter((resource): resource is ResourceSummary => {
      const isValid = isValidResourceSummary(resource)
      if (!isValid) {
        console.warn('[BFF] Invalid resource row:', resource)
      }
      return isValid && resource.status === 'PUBLISHED'
    })

    // Normalize to frontend contract
    const normalizedResponse: ResourcesResponse = {
      items: validResources,
      hasMore: !!backendData.nextCursor,
      nextCursor: backendData.nextCursor,
    }

    return NextResponse.json(normalizedResponse)
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Service Timeout',
          status: 504,
          detail: 'Content service did not respond within timeout',
        } as ErrorResponse,
        { status: 504 },
      )
    }

    // Handle network errors → return error to allow frontend to show unavailable state
    console.error('[BFF] Resource fetch failed:', error)

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Network Error',
        status: 503,
        detail: 'Could not connect to Content service',
      } as ErrorResponse,
      { status: 503 },
    )
  }
}

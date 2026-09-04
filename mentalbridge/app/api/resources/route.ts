import { NextRequest, NextResponse } from 'next/server'

// Type definitions matching backend contract
export interface Resource {
  id: string
  title: string
  summary: string | null
  category: 'ARTICLE' | 'VIDEO' | 'GUIDE' | 'SUPPORT_GROUP'
  externalUrl: string
  thumbnailUrl: string | null
  locale: string
  status: 'PUBLISHED'
  reviewedBy: string
  reviewedAt: string
  effectiveAt: string | null
  expiresAt: string | null
  createdAt: string
}

// Backend actual response
interface BackendResourcesResponse {
  data: Resource[]
  count: number
  nextCursor?: string
  fallback?: boolean
  message?: string
}

// Frontend normalized response
export interface ResourcesResponse {
  items: Resource[]
  hasMore: boolean
  nextCursor?: string
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

  // Build upstream URL
  const upstreamUrl = new URL(`${CONTENT_SERVICE_BASE_URL}/api/v1/resources`)
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

    // Filter out non-PUBLISHED resources (backend should do this, but double-check)
    const publishedResources = backendData.data.filter(
      (resource) => resource.status === 'PUBLISHED',
    )

    // Normalize to frontend contract
    const normalizedResponse: ResourcesResponse = {
      items: publishedResources,
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

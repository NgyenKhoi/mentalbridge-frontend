import { NextRequest, NextResponse } from 'next/server';

// Type definitions matching backend contract
export interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: 'ARTICLE' | 'VIDEO' | 'HOTLINE' | 'GUIDE' | 'SUPPORT_GROUP';
  contentUrl: string;
  thumbnailUrl: string | null;
  author: string | null;
  status: 'PUBLISHED';
  reviewedBy: string;
  reviewedAt: string;
  effectiveAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ResourcesResponse {
  items: Resource[];
  hasMore: boolean;
  nextCursor?: string;
}

interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

const CONTENT_SERVICE_BASE_URL = process.env.CONTENT_SERVICE_URL || 'http://localhost:8082';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * BFF route for fetching resources from Content service
 * Never exposes upstream URLs to browser
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.url ? new URL(request.url) : { searchParams: new URLSearchParams() };
  
  const category = searchParams.get('category');
  const limit = searchParams.get('limit');
  const cursor = searchParams.get('cursor');

  // Build upstream URL
  const upstreamUrl = new URL(`${CONTENT_SERVICE_BASE_URL}/api/v1/resources`);
  if (category) upstreamUrl.searchParams.set('category', category);
  if (limit) upstreamUrl.searchParams.set('limit', limit);
  if (cursor) upstreamUrl.searchParams.set('cursor', cursor);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Parse Problem Details if available
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/problem+json')) {
        const problemDetails: ErrorResponse = await response.json();
        return NextResponse.json(problemDetails, { status: response.status });
      }

      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Upstream Error',
          status: response.status,
          detail: `Content service returned ${response.status}`,
        } as ErrorResponse,
        { status: response.status }
      );
    }

    const data: ResourcesResponse = await response.json();
    
    // Validate response structure
    if (!Array.isArray(data.items) || typeof data.hasMore !== 'boolean') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Malformed Response',
          status: 502,
          detail: 'Content service returned invalid response structure',
        } as ErrorResponse,
        { status: 502 }
      );
    }

    return NextResponse.json(data);

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
        { status: 504 }
      );
    }

    // Handle network errors → neutral fallback
    console.error('[BFF] Resource fetch failed:', error);
    
    return NextResponse.json(
      {
        items: [],
        hasMore: false,
      } as ResourcesResponse,
      { status: 200 }
    );
  }
}

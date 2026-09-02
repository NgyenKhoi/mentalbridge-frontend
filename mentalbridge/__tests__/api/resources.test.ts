import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/resources/route';
import { NextRequest } from 'next/server';

// Mock fetch
global.fetch = vi.fn();

describe('GET /api/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return resources from upstream service', async () => {
    const mockResponse = {
      items: [
        {
          id: '123',
          title: 'Test Article',
          description: 'Test description',
          category: 'ARTICLE',
          contentUrl: 'https://example.com/article',
          thumbnailUrl: null,
          author: 'Test Author',
          status: 'PUBLISHED',
          reviewedBy: 'reviewer@test.com',
          reviewedAt: '2024-01-01T00:00:00Z',
          effectiveAt: null,
          expiresAt: null,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      hasMore: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });

    const request = new NextRequest('http://localhost:3000/api/resources?category=ARTICLE&limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('Test Article');
    expect(data.hasMore).toBe(false);
  });

  it('should return empty array on network error (neutral fallback)', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(data.hasMore).toBe(false);
  });

  it('should return 504 on timeout', async () => {
    (global.fetch as any).mockRejectedValueOnce(Object.assign(new Error('Abort'), { name: 'AbortError' }));

    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.title).toBe('Service Timeout');
  });

  it('should return 502 on malformed response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ invalid: 'structure' }),
    });

    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.title).toBe('Malformed Response');
  });

  it('should forward Problem Details from upstream', async () => {
    const problemDetails = {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid limit parameter',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/problem+json' }),
      json: async () => problemDetails,
    });

    const request = new NextRequest('http://localhost:3000/api/resources?limit=invalid');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.title).toBe('Bad Request');
  });

  it('should pass category filter to upstream', async () => {
    const mockResponse = { items: [], hasMore: false };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });

    const request = new NextRequest('http://localhost:3000/api/resources?category=VIDEO&limit=5');
    await GET(request);

    const fetchCall = (global.fetch as any).mock.calls[0];
    const upstreamUrl = new URL(fetchCall[0]);

    expect(upstreamUrl.searchParams.get('category')).toBe('VIDEO');
    expect(upstreamUrl.searchParams.get('limit')).toBe('5');
  });
});

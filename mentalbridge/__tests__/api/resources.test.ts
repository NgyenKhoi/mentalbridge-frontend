import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/resources/route';
import { NextRequest } from 'next/server';

global.fetch = vi.fn();

describe('GET /api/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return published resources from upstream', async () => {
    const mockBackendResponse = {
      data: [{
        id: '123', title: 'Test Article', summary: 'Test summary', category: 'ARTICLE',
        externalUrl: 'https://example.com/article', thumbnailUrl: null, locale: 'vi-VN',
        status: 'PUBLISHED', reviewedBy: 'reviewer@test.com', reviewedAt: '2024-01-01T00:00:00Z',
        effectiveAt: null, expiresAt: null, createdAt: '2024-01-01T00:00:00Z',
      }],
      count: 1,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockBackendResponse,
    });

    const request = new NextRequest('http://localhost:3000/api/resources?category=ARTICLE&limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('Test Article');
    expect(data.hasMore).toBe(false);
  });

  it('should filter unpublished resources', async () => {
    const mockBackendResponse = {
      data: [
        { id: '123', title: 'Published', summary: 'OK', category: 'ARTICLE', externalUrl: 'https://e.com/p', thumbnailUrl: null, locale: 'vi-VN', status: 'PUBLISHED', reviewedBy: 'r@test.com', reviewedAt: '2024-01-01T00:00:00Z', effectiveAt: null, expiresAt: null, createdAt: '2024-01-01T00:00:00Z' },
        { id: '456', title: 'Draft', summary: 'No', category: 'ARTICLE', externalUrl: 'https://e.com/d', thumbnailUrl: null, locale: 'vi-VN', status: 'DRAFT', reviewedBy: null, reviewedAt: null, effectiveAt: null, expiresAt: null, createdAt: '2024-01-01T00:00:00Z' },
      ],
      count: 2,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockBackendResponse,
    });

    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].status).toBe('PUBLISHED');
  });

  it('should return unavailable on network error', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data.title).toBe('Network Error');
  });

  it('should return 504 on timeout', async () => {
    (global.fetch as any).mockRejectedValueOnce(Object.assign(new Error('Abort'), { name: 'AbortError' }));
    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    expect(response.status).toBe(504);
  });

  it('should return 502 on malformed response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ invalid: 'structure' }),
    });
    const request = new NextRequest('http://localhost:3000/api/resources');
    const response = await GET(request);
    expect(response.status).toBe(502);
  });

  it('should pass filters to upstream', async () => {
    const mockResponse = { data: [], count: 0 };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200,
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

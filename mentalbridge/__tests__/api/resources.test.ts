import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/resources/route'
process.env.CONTENT_SERVICE_URL = 'http://localhost:3003'

const mockFetch = vi.fn()
let interceptedFetch: typeof globalThis.fetch

const publishedResource = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  category: 'ARTICLE',
  locale: 'vi-VN',
  title: 'Bài viết đã kiểm duyệt',
  summary: 'Nội dung hỗ trợ đã được kiểm duyệt.',
  externalUrl: 'https://example.com/article',
  status: 'PUBLISHED',
  reviewedAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
} as const

function upstreamJson(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  }
}

function request(query = '', acceptLanguage?: string) {
  return new NextRequest(`http://localhost:3000/api/resources${query}`, {
    headers: acceptLanguage ? { 'Accept-Language': acceptLanguage } : undefined,
  })
}

describe('GET /api/resources', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    interceptedFetch = globalThis.fetch
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = interceptedFetch
  })

  it('returns only reviewed PUBLISHED resources', async () => {
    mockFetch.mockResolvedValueOnce(
      upstreamJson({
        data: [
          publishedResource,
          {
            ...publishedResource,
            id: '123e4567-e89b-42d3-a456-426614174001',
            title: 'Draft resource',
            status: 'DRAFT',
            reviewedAt: null,
          },
          {
            ...publishedResource,
            id: '123e4567-e89b-42d3-a456-426614174002',
            title: 'Archived resource',
            status: 'ARCHIVED',
          },
        ],
        count: 3,
      }),
    )

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toEqual([publishedResource])
    expect(data.hasMore).toBe(false)
  })

  it('returns 502 instead of disguising an invalid row as an empty catalogue', async () => {
    mockFetch.mockResolvedValueOnce(
      upstreamJson({
        data: [{ id: 'not-a-uuid', title: 'Invalid' }],
        count: 1,
      }),
    )

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.code).toBe('CONTENT_INVALID_RESPONSE')
    expect(data.detail).toBe('Content service returned an invalid resource row')
  })

  it('rejects a PUBLISHED resource without review evidence', async () => {
    mockFetch.mockResolvedValueOnce(
      upstreamJson({
        data: [{ ...publishedResource, reviewedAt: null }],
        count: 1,
      }),
    )

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.detail).toContain('unreviewed published resource')
  })

  it('rejects unsafe external URL protocols', async () => {
    mockFetch.mockResolvedValueOnce(
      upstreamJson({
        data: [{ ...publishedResource, externalUrl: 'javascript:alert(1)' }],
        count: 1,
      }),
    )

    const response = await GET(request())

    expect(response.status).toBe(502)
  })

  it('normalizes the provider unavailable fallback to reviewed copy', async () => {
    mockFetch.mockResolvedValueOnce(
      upstreamJson({
        data: [],
        count: 0,
        fallback: 'unavailable',
        message: 'Unreviewed provider copy',
      }),
    )

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      items: [],
      hasMore: false,
      unavailable: true,
      message:
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
    })
  })

  it('returns 503 on a network error without logging the raw error', async () => {
    const error = new Error('internal host and credential details')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(error)

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.code).toBe('CONTENT_UNAVAILABLE')
    expect(JSON.stringify(data)).not.toContain(error.message)
    expect(consoleError).toHaveBeenCalledWith('[BFF] Resource fetch failed.')
    consoleError.mockRestore()
  })

  it('returns 504 when the provider request is aborted', async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('Abort'), { name: 'AbortError' }),
    )

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(504)
    expect(data.code).toBe('CONTENT_TIMEOUT')
  })

  it('returns 502 for invalid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ...upstreamJson(null),
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.detail).toBe('Content service returned invalid JSON')
  })

  it.each([null, 'not an object', { data: [], count: -1 }])(
    'returns 502 for an invalid top-level response: %j',
    async (body) => {
      mockFetch.mockResolvedValueOnce(upstreamJson(body))

      const response = await GET(request())

      expect(response.status).toBe(502)
    },
  )

  it.each([
    ['?category=UNKNOWN', 'INVALID_RESOURCE_CATEGORY'],
    ['?limit=0', 'INVALID_RESOURCE_LIMIT'],
    ['?limit=101', 'INVALID_RESOURCE_LIMIT'],
    ['?cursor=not-a-uuid', 'INVALID_RESOURCE_CURSOR'],
  ])('rejects an invalid public query (%s)', async (query, code) => {
    const response = await GET(request(query))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe(code)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('forwards validated filters and the supported English locale', async () => {
    const cursor = '123e4567-e89b-42d3-a456-426614174099'
    mockFetch.mockResolvedValueOnce(
      upstreamJson({ data: [], count: 0, nextCursor: cursor }),
    )

    const response = await GET(
      request(`?category=VIDEO&limit=5&cursor=${cursor}`, 'en-GB,en;q=0.8'),
    )
    const upstreamUrl = new URL(mockFetch.mock.calls[0][0])

    expect(response.status).toBe(200)
    expect(upstreamUrl.searchParams.get('category')).toBe('VIDEO')
    expect(upstreamUrl.searchParams.get('limit')).toBe('5')
    expect(upstreamUrl.searchParams.get('cursor')).toBe(cursor)
    expect(upstreamUrl.searchParams.get('locale')).toBe('en-US')
  })

  it('sanitizes upstream Problem Details before returning them to the browser', async () => {
    mockFetch.mockResolvedValueOnce(
      upstreamJson(
        {
          title: 'Database password leaked',
          detail: 'postgres://admin:secret@internal-db',
        },
        401,
      ),
    )

    const response = await GET(request())
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('CONTENT_REQUEST_FAILED')
    expect(JSON.stringify(data)).not.toContain('secret')
    expect(JSON.stringify(data)).not.toContain('internal-db')
  })
})

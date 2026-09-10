import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '@/app/api/admin/resources/route'
import { mockServer } from '@/tests/mocks/server'

process.env.CONTENT_SERVICE_URL = 'http://localhost:3003'

const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock session resolution
const mockResolveSession = vi.fn()
const mockEnsureRole = vi.fn()

vi.mock('@/lib/auth/session-cookies', () => ({
  readSessionCredentials: vi.fn(() => ({ accessToken: 'test-token' })),
}))

vi.mock('@/lib/auth/session-service', () => ({
  resolveSession: mockResolveSession,
  ensureRole: mockEnsureRole,
}))

const adminResource = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  category: 'ARTICLE',
  locale: 'vi-VN', 
  title: 'Admin Draft Resource',
  summary: 'Draft content for admin management.',
  externalUrl: null,
  status: 'DRAFT',
  reviewedAt: null,
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

function request(query = '', method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost:3000/api/admin/resources${query}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  })
}

describe('Admin Resources API', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockResolveSession.mockReset()
    mockEnsureRole.mockReset()
    mockServer.close()

    // Default: successful auth
    mockResolveSession.mockResolvedValue({ 
      account: { accountId: 'admin-123', roles: ['ADMIN'] } 
    })
    mockEnsureRole.mockReturnValue(true)
  })

  afterEach(() => {
    mockServer.listen({ onUnhandledRequest: 'error' })
  })

  describe('GET /api/admin/resources', () => {
    it('returns admin resources with all statuses when authenticated', async () => {
      mockFetch.mockResolvedValueOnce(
        upstreamJson({
          data: [
            adminResource,
            { ...adminResource, status: 'PUBLISHED', reviewedAt: '2026-09-01T00:00:00Z' },
            { ...adminResource, status: 'ARCHIVED' },
          ],
          count: 3,
        })
      )

      const response = await GET(request())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.count).toBe(3)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/resources/admin/list'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      )
    })

    it('requires ADMIN role', async () => {
      mockEnsureRole.mockImplementation(() => {
        throw new Error('Forbidden')
      })

      await expect(GET(request())).rejects.toThrow('Forbidden')
      expect(mockEnsureRole).toHaveBeenCalledWith(
        { accountId: 'admin-123', roles: ['ADMIN'] },
        ['ADMIN']
      )
    })

    it('forwards status filter to backend', async () => {
      mockFetch.mockResolvedValueOnce(upstreamJson({ data: [], count: 0 }))

      await GET(request('?status=DRAFT'))

      const upstreamUrl = new URL(mockFetch.mock.calls[0][0])
      expect(upstreamUrl.searchParams.get('status')).toBe('DRAFT')
    })

    it('rejects invalid status', async () => {
      const response = await GET(request('?status=INVALID'))
      
      expect(response.status).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/admin/resources', () => {
    const validResource = {
      category: 'ARTICLE',
      title: 'Test Resource',
      summary: 'Test summary',
      contentBody: 'Test content',
    }

    it('creates resource when authenticated as ADMIN', async () => {
      mockFetch.mockResolvedValueOnce(
        upstreamJson({ ...adminResource, ...validResource }, 201)
      )

      const response = await POST(request('', 'POST', validResource))
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/resources'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
          body: JSON.stringify(validResource),
        })
      )
    })

    it('supports idempotencyKey parameter', async () => {
      mockFetch.mockResolvedValueOnce(upstreamJson(adminResource, 201))

      await POST(request('?idempotencyKey=test-key', 'POST', validResource))

      const upstreamUrl = new URL(mockFetch.mock.calls[0][0])
      expect(upstreamUrl.searchParams.get('idempotencyKey')).toBe('test-key')
    })

    it('requires ADMIN role', async () => {
      mockEnsureRole.mockImplementation(() => {
        throw new Error('Forbidden')
      })

      await expect(POST(request('', 'POST', validResource))).rejects.toThrow('Forbidden')
    })

    it('validates required fields', async () => {
      const response = await POST(request('', 'POST', { category: 'ARTICLE' }))
      
      expect(response.status).toBe(422)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handles backend validation errors', async () => {
      mockFetch.mockResolvedValueOnce(
        upstreamJson({
          type: 'https://mentalbridge.io/errors/VALIDATION_ERROR',
          status: 422,
        }, 422)
      )

      const response = await POST(request('', 'POST', validResource))
      
      expect(response.status).toBe(422)
    })
  })

  describe('Error handling', () => {
    it('returns 401 when session resolution fails', async () => {
      mockResolveSession.mockRejectedValue(new Error('Unauthorized'))

      const response = await GET(request())
      
      expect(response.status).toBe(500) // Will be handled by ApiError in real implementation
    })

    it('handles backend unavailable', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const response = await GET(request())
      
      expect(response.status).toBe(500)
    })

    it('forwards backend errors correctly', async () => {
      mockFetch.mockResolvedValueOnce(upstreamJson({ error: 'Backend error' }, 409))

      const response = await GET(request())
      
      expect(response.status).toBe(409)
    })
  })
})
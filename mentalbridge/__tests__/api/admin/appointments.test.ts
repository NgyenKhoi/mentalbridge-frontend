import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/appointments/route'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const correlationId = '8fb5720a-53ab-40db-9cf4-f5cfabbdaf65'

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function request(query: string) {
  return new NextRequest(`http://localhost/api/admin/appointments?${query}`, {
    headers: {
      Host: 'localhost',
      'X-Correlation-Id': correlationId,
      Cookie: `${ACCESS_COOKIE_NAME}=admin-access-token`,
    },
  })
}

function admin() {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    status: 'ACTIVE',
    roles: ['ADMIN'],
    emailVerified: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    version: 1,
  }
}

function page() {
  return {
    source: 'CONSULTATION',
    dataState: 'CURRENT',
    generatedAt: '2026-10-05T10:00:00Z',
    queryFrom: '2026-10-01T00:00:00Z',
    queryTo: '2026-11-01T00:00:00Z',
    items: [],
    count: 0,
    nextCursor: null,
  }
}

beforeEach(() => {
  vi.stubEnv('IDENTITY_API_BASE_URL', 'http://identity.test')
  vi.stubEnv('IDENTITY_API_TIMEOUT_MS', '1000')
  vi.stubEnv('CONSULTATION_SERVICE_URL', 'http://consultation.test')
  vi.stubEnv('CONSULTATION_SERVICE_TIMEOUT_MS', '1000')
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('admin appointment BFF', () => {
  it('authenticates ADMIN and forwards only validated filters', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(admin()))
      .mockResolvedValueOnce(response(page()))
    const result = await GET(
      request(
        'from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z&status=CONFIRMED&limit=20',
      ),
    )
    expect(result.status).toBe(200)
    const [url, options] = vi.mocked(fetch).mock.calls[1]
    expect(String(url)).toContain('/api/v1/admin/appointments?')
    expect(String(url)).toContain('status=CONFIRMED')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer admin-access-token',
    )
  })

  it('rejects unbounded and unsupported filters before reading the session', async () => {
    const tooWide = await GET(
      request('from=2026-01-01T00%3A00%3A00Z&to=2026-12-31T00%3A00%3A00Z'),
    )
    const unknown = await GET(
      request(
        'from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z&status=UNKNOWN',
      ),
    )
    expect(tooWide.status).toBe(400)
    expect(unknown.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails closed when Consultation returns private or malformed fields', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(admin()))
      .mockResolvedValueOnce(response({ ...page(), chatMessages: ['private'] }))
    const result = await GET(
      request('from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z'),
    )
    expect(result.status).toBe(502)
    expect(JSON.stringify(await result.json())).not.toContain('private')
  })

  it('fails closed when Consultation returns an empty cursor', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(admin()))
      .mockResolvedValueOnce(response({ ...page(), nextCursor: '' }))
    const result = await GET(
      request('from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z'),
    )
    expect(result.status).toBe(502)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as searchAccounts } from '@/app/api/admin/accounts/route'
import { GET as getAccount } from '@/app/api/admin/accounts/[accountId]/route'
import { PUT as changeState } from '@/app/api/admin/accounts/[accountId]/state/route'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const correlationId = '8fb5720a-53ab-40db-9cf4-f5cfabbdaf65'
const accountId = '94464b2b-a7fd-46fd-9310-64ef4eac7de7'

function account(roles: ('USER' | 'SPECIALIST' | 'ADMIN')[] = ['ADMIN']) {
  return {
    accountId,
    email: 'admin@example.com',
    status: 'ACTIVE',
    roles,
    emailVerified: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    version: 2,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        status >= 400 ? 'application/problem+json' : 'application/json',
    },
  })
}

function request(
  path: string,
  options: {
    method?: string
    body?: unknown
    ifMatch?: string
    origin?: string
  } = {},
) {
  const headers = new Headers({
    Host: 'localhost',
    Origin: options.origin ?? 'http://localhost',
    'X-Correlation-Id': correlationId,
    Cookie: `${ACCESS_COOKIE_NAME}=admin-access-token`,
  })
  if (options.body !== undefined)
    headers.set('Content-Type', 'application/json')
  if (options.ifMatch) headers.set('If-Match', options.ifMatch)
  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  })
}

beforeEach(() => {
  vi.stubEnv('IDENTITY_API_BASE_URL', 'http://identity.test')
  vi.stubEnv('IDENTITY_API_TIMEOUT_MS', '1000')
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('admin account BFF', () => {
  it('authenticates ADMIN and forwards bounded search filters', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(account()))
      .mockResolvedValueOnce(
        jsonResponse({ items: [account(['USER'])], nextCursor: null }),
      )

    const response = await searchAccounts(
      request(
        '/api/admin/accounts?status=ACTIVE&role=USER&email=user%40example.com&limit=20',
      ),
    )

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, options] = vi.mocked(fetch).mock.calls[1]
    expect(String(url)).toContain('status=ACTIVE')
    expect(String(url)).toContain('role=USER')
    expect(String(url)).toContain('email=user%40example.com')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer admin-access-token',
    )
    expect(new Headers(options?.headers).get('X-Correlation-Id')).toBe(
      correlationId,
    )
  })

  it('rejects a non-admin actor before calling the admin endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(account(['USER'])))
    const response = await searchAccounts(request('/api/admin/accounts'))
    expect(response.status).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns safe detail with an ETag', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(account()))
      .mockResolvedValueOnce(jsonResponse(account(['USER'])))
    const response = await getAccount(
      request(`/api/admin/accounts/${accountId}`),
      {
        params: Promise.resolve({ accountId }),
      },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toBe('"2"')
    expect(await response.json()).not.toHaveProperty('passwordHash')
  })

  it('forwards If-Match and maps stale version without leaking upstream detail', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(account()))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            type: '/problems/version-conflict?secret=no',
            title: 'internal database detail',
            status: 412,
            code: 'VERSION_CONFLICT',
            correlationId,
          },
          412,
        ),
      )
    const response = await changeState(
      request(`/api/admin/accounts/${accountId}/state`, {
        method: 'PUT',
        ifMatch: '"2"',
        body: { status: 'DISABLED', reasonCode: 'SAFETY_CONCERN' },
      }),
      { params: Promise.resolve({ accountId }) },
    )
    expect(response.status).toBe(412)
    expect(
      new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get('If-Match'),
    ).toBe('"2"')
    expect(JSON.stringify(await response.json())).not.toContain(
      'database detail',
    )
  })

  it('rejects malformed If-Match and arbitrary reason codes locally', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(jsonResponse(account())),
    )
    const malformed = await changeState(
      request(`/api/admin/accounts/${accountId}/state`, {
        method: 'PUT',
        ifMatch: '2',
        body: { status: 'DISABLED', reasonCode: 'ANY_REASON' },
      }),
      { params: Promise.resolve({ accountId }) },
    )
    expect(malformed.status).toBe(428)

    const invalidReason = await changeState(
      request(`/api/admin/accounts/${accountId}/state`, {
        method: 'PUT',
        ifMatch: '"2"',
        body: { status: 'DISABLED', reasonCode: 'ANY_REASON' },
      }),
      { params: Promise.resolve({ accountId }) },
    )
    expect(invalidReason.status).toBe(400)
  })

  it('rejects a cross-origin state change before reading the session', async () => {
    const response = await changeState(
      request(`/api/admin/accounts/${accountId}/state`, {
        method: 'PUT',
        origin: 'https://attacker.example',
        ifMatch: '"2"',
        body: { status: 'DISABLED', reasonCode: 'SAFETY_CONCERN' },
      }),
      { params: Promise.resolve({ accountId }) },
    )

    expect(response.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST as login } from './login/route'
import { POST as logoutAll } from './logout-all/route'
import { POST as logout } from './logout/route'
import { POST as refresh } from './refresh/route'
import { GET as session } from './session/route'
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/auth/session-cookies'

const correlationId = '8fb5720a-53ab-40db-9cf4-f5cfabbdaf65'

function tokenPair(refreshToken = 'r'.repeat(43)) {
  return {
    accessToken: 'access-secret',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken,
    refreshExpiresAt: '2026-09-01T00:00:00Z',
  }
}

function accountDetail() {
  return {
    accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
    email: 'member@example.com',
    status: 'ACTIVE',
    roles: ['USER'],
    emailVerified: true,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    version: 2,
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  contentType = 'application/json',
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  })
}

function request(
  path: string,
  options: Readonly<{
    method?: string
    body?: unknown
    cookies?: Record<string, string>
  }> = {},
) {
  const headers = new Headers({ 'X-Correlation-Id': correlationId })

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.cookies) {
    headers.set(
      'Cookie',
      Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    )
  }

  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  })
}

function setCookieHeader(response: Response) {
  return response.headers.get('set-cookie') ?? ''
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('IDENTITY_API_BASE_URL', 'http://identity.test')
  vi.stubEnv('IDENTITY_API_TIMEOUT_MS', '100')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Identity BFF route handlers', () => {
  it('logs in without returning credentials to browser JavaScript', async () => {
    const upstream = vi.fn().mockResolvedValue(jsonResponse(tokenPair()))
    vi.stubGlobal('fetch', upstream)

    const response = await login(
      request('/api/identity/login', {
        method: 'POST',
        body: { email: 'member@example.com', password: 'secret' },
      }),
    )
    const body = await response.text()
    const setCookie = setCookieHeader(response)

    expect(response.status).toBe(200)
    expect(body).toBe('{"authenticated":true}')
    expect(body).not.toContain('access-secret')
    expect(body).not.toContain('refreshToken')
    expect(setCookie.match(/HttpOnly/g)).toHaveLength(2)
    expect(upstream).toHaveBeenCalledTimes(1)

    const upstreamHeaders = new Headers(upstream.mock.calls[0]?.[1]?.headers)
    expect(upstreamHeaders.get('X-Correlation-Id')).toBe(correlationId)
  })

  it('rejects invalid and mass-assigned login fields before calling Identity', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)

    const response = await login(
      request('/api/identity/login', {
        method: 'POST',
        body: {
          email: 'not-an-email',
          password: '',
          role: 'ADMIN',
        },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('VALIDATION_FAILED')
    expect(body.violations).toEqual(
      expect.arrayContaining([
        { field: 'body', code: 'UNKNOWN_FIELD' },
        { field: 'email', code: 'INVALID_FORMAT' },
        { field: 'password', code: 'INVALID_LENGTH' },
      ]),
    )
    expect(upstream).not.toHaveBeenCalled()
  })

  it('maps invalid credentials without leaking upstream detail or extensions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            type: '/problems/invalid-credentials?secret=never-return-this',
            title: 'password=never-return-this',
            status: 401,
            code: 'INVALID_CREDENTIALS',
            correlationId,
            detail: 'password=never-return-this',
            upstreamSecret: 'never-return-this',
          },
          401,
          'application/problem+json',
        ),
      ),
    )

    const response = await login(
      request('/api/identity/login', {
        method: 'POST',
        body: { email: 'member@example.com', password: 'wrong' },
      }),
    )
    const body = await response.text()

    expect(response.status).toBe(401)
    expect(body).toContain('INVALID_CREDENTIALS')
    expect(body).not.toContain('never-return-this')
    expect(body).not.toContain('upstreamSecret')
  })

  it('maps malformed successful responses to a safe gateway error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ accessToken: 'partial' })),
    )

    const response = await login(
      request('/api/identity/login', {
        method: 'POST',
        body: { email: 'member@example.com', password: 'secret' },
      }),
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      code: 'IDENTITY_MALFORMED_RESPONSE',
    })
    expect(setCookieHeader(response)).toBe('')
  })

  it('maps an Identity timeout without logging or returning credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
      }),
    )

    const response = await login(
      request('/api/identity/login', {
        method: 'POST',
        body: { email: 'member@example.com', password: 'secret' },
      }),
    )

    expect(response.status).toBe(504)
    await expect(response.json()).resolves.toMatchObject({
      code: 'IDENTITY_TIMEOUT',
    })
  })

  it('returns only a minimal account DTO from the session route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(accountDetail())),
    )

    const response = await session(
      request('/api/identity/session', {
        cookies: { [ACCESS_COOKIE_NAME]: 'access-secret' },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      account: {
        accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    expect(JSON.stringify(body)).not.toContain('member@example.com')
    expect(JSON.stringify(body)).not.toContain('access-secret')
  })

  it('returns 401 for direct session access without credentials', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)

    const response = await session(request('/api/identity/session'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SESSION_REQUIRED',
    })
    expect(upstream).not.toHaveBeenCalled()
  })

  it('clears an invalid access-only session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            type: '/problems/unauthorized',
            title: 'Authentication is required',
            status: 401,
            code: 'UNAUTHORIZED',
            correlationId,
          },
          401,
          'application/problem+json',
        ),
      ),
    )

    const response = await session(
      request('/api/identity/session', {
        cookies: { [ACCESS_COOKIE_NAME]: 'invalid-access' },
      }),
    )

    expect(response.status).toBe(401)
    expect(setCookieHeader(response).match(/Max-Age=0/g)).toHaveLength(2)
  })

  it('coordinates concurrent refresh requests into one rotation', async () => {
    let complete: ((response: Response) => void) | undefined
    const upstream = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve
        }),
    )
    vi.stubGlobal('fetch', upstream)
    const refreshToken = 'c'.repeat(43)
    const first = refresh(
      request('/api/identity/refresh', {
        method: 'POST',
        cookies: { [REFRESH_COOKIE_NAME]: refreshToken },
      }),
    )
    const second = refresh(
      request('/api/identity/refresh', {
        method: 'POST',
        cookies: { [REFRESH_COOKIE_NAME]: refreshToken },
      }),
    )

    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1))
    complete?.(jsonResponse(tokenPair('d'.repeat(43))))

    const [firstResponse, secondResponse] = await Promise.all([first, second])
    expect(firstResponse.status).toBe(204)
    expect(secondResponse.status).toBe(204)
    expect(setCookieHeader(firstResponse)).toContain('HttpOnly')
    expect(setCookieHeader(secondResponse)).toContain('HttpOnly')
  })

  it('clears the local session when refresh is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            type: '/problems/invalid-session',
            title: 'Session is invalid',
            status: 401,
            code: 'INVALID_SESSION',
            correlationId,
          },
          401,
          'application/problem+json',
        ),
      ),
    )

    const response = await refresh(
      request('/api/identity/refresh', {
        method: 'POST',
        cookies: { [REFRESH_COOKIE_NAME]: 'i'.repeat(43) },
      }),
    )

    expect(response.status).toBe(401)
    expect(setCookieHeader(response).match(/Max-Age=0/g)).toHaveLength(2)
  })

  it('clears local cookies when logout revocation cannot be confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const response = await logout(
      request('/api/identity/logout', {
        method: 'POST',
        cookies: {
          [ACCESS_COOKIE_NAME]: 'access-secret',
          [REFRESH_COOKIE_NAME]: 'l'.repeat(43),
        },
      }),
    )

    expect(response.status).toBe(503)
    expect(setCookieHeader(response).match(/Max-Age=0/g)).toHaveLength(2)
  })

  it('revokes the current session and clears browser credentials on logout', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', upstream)

    const response = await logout(
      request('/api/identity/logout', {
        method: 'POST',
        cookies: {
          [ACCESS_COOKIE_NAME]: 'access-secret',
          [REFRESH_COOKIE_NAME]: 'o'.repeat(43),
        },
      }),
    )

    expect(response.status).toBe(204)
    expect(setCookieHeader(response).match(/Max-Age=0/g)).toHaveLength(2)

    const upstreamHeaders = new Headers(upstream.mock.calls[0]?.[1]?.headers)
    expect(upstreamHeaders.get('authorization')).toBe('Bearer access-secret')
    expect(upstream.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ refreshToken: 'o'.repeat(43) }),
    )
  })

  it('revokes all sessions and clears browser credentials on logout-all', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', upstream)

    const response = await logoutAll(
      request('/api/identity/logout-all', {
        method: 'POST',
        cookies: { [ACCESS_COOKIE_NAME]: 'access-secret' },
      }),
    )

    expect(response.status).toBe(204)
    expect(setCookieHeader(response).match(/Max-Age=0/g)).toHaveLength(2)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('rejects direct logout-all access without an access credential and clears cookies', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)

    const response = await logoutAll(
      request('/api/identity/logout-all', { method: 'POST' }),
    )

    expect(response.status).toBe(401)
    expect(setCookieHeader(response).match(/Max-Age=0/g)).toHaveLength(2)
    expect(upstream).not.toHaveBeenCalled()
  })
})

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/auth/session-cookies'

const journalMocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/journal/journal-client', () => ({
  journalClient: journalMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, POST } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const timestamp = '2026-09-11T03:00:00.000Z'
const created = {
  id: '40000000-0000-4000-8000-000000000001',
  ownerAccountId: account.accountId,
  currentRevision: 1,
  occurredAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: false,
  tags: [],
  encryption: {
    algorithm: 'AES-256-GCM',
    keyId: 'test-v1',
    encryptedAt: timestamp,
  },
  analysisState: 'not_requested',
  content: { text: 'synthetic journal', byteLength: 17 },
}
const body = {
  clientEntryId: '50000000-0000-4000-8000-000000000001',
  occurredAt: timestamp,
  content: { text: 'synthetic journal' },
}

function request(method = 'GET', requestBody?: unknown, key?: string) {
  return new NextRequest('http://localhost/api/journals', {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...(requestBody === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
  })
}

describe('/api/journals Route Handler', () => {
  beforeEach(() => {
    journalMocks.list.mockReset()
    journalMocks.create.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('uses a rotated server credential and carries protected cookies', async () => {
    sessionMocks.resolveSession.mockResolvedValue({
      account,
      rotatedTokens: {
        accessToken: 'rotated-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: 'r'.repeat(43),
        refreshExpiresAt: '2099-01-01T00:00:00Z',
      },
    })
    journalMocks.list.mockResolvedValue({
      items: [],
      page: { limit: 20, hasMore: false },
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(journalMocks.list).toHaveBeenCalledWith(
      'rotated-access-token',
      undefined,
      expect.any(String),
    )
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain(`${ACCESS_COOKIE_NAME}=rotated-access-token`)
    expect(cookies).toContain(`${REFRESH_COOKIE_NAME}=`)
    expect(cookies).toContain('HttpOnly')
    expect(JSON.stringify(await response.json())).not.toContain(
      'rotated-access-token',
    )
  })

  it('forwards a validated create with the browser idempotency key', async () => {
    journalMocks.create.mockResolvedValue(created)

    const response = await POST(request('POST', body, 'create-command-0001'))

    expect(response.status).toBe(201)
    expect(journalMocks.create).toHaveBeenCalledWith(
      'access-token',
      body,
      'create-command-0001',
      expect.any(String),
    )
  })

  it('rejects invalid create input before provider access', async () => {
    const response = await POST(
      request('POST', { ...body, occurredAt: 'not-a-time' }, 'short'),
    )

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(journalMocks.create).not.toHaveBeenCalled()
  })

  it('fails closed when the session is unavailable', async () => {
    sessionMocks.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(journalMocks.list).not.toHaveBeenCalled()
  })

  it('sanitizes a documented provider error', async () => {
    journalMocks.list.mockRejectedValue(
      new ApiError({
        message: 'private provider detail',
        code: 'DEPENDENCY_UNAVAILABLE',
        status: 503,
      }),
    )

    const response = await GET(request())
    const responseBody = await response.json()

    expect(response.status).toBe(503)
    expect(responseBody.code).toBe('DEPENDENCY_UNAVAILABLE')
    expect(JSON.stringify(responseBody)).not.toContain(
      'private provider detail',
    )
  })
})

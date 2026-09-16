import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/emotion-check-in/client', () => ({
  emotionCheckInClient: client,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: session.resolveSession,
  ensureRole: session.ensureRole,
}))

import { GET, POST } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const body = {
  localDate: '2026-09-17',
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD',
  intensity: 4,
  note: null,
}

function request(method = 'GET', value?: unknown, key?: string) {
  return new NextRequest('http://localhost/api/emotion-check-ins?limit=7', {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  })
}

describe('/api/emotion-check-ins Route Handler', () => {
  beforeEach(() => {
    client.list.mockReset()
    client.create.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('forwards bounded owner history', async () => {
    client.list.mockResolvedValue({
      items: [],
      page: { limit: 7, hasMore: false },
      label: 'SELF_REPORTED_EMOTION',
      interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(client.list).toHaveBeenCalledWith(
      'access-token',
      undefined,
      7,
      expect.any(String),
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('validates and forwards create with the browser retry key', async () => {
    client.create.mockResolvedValue({ ...body, id: 'unused' })

    const response = await POST(
      request('POST', body, 'emotion-create-command-0001'),
    )

    expect(response.status).toBe(201)
    expect(client.create).toHaveBeenCalledWith(
      'access-token',
      body,
      'emotion-create-command-0001',
      expect.any(String),
    )
  })

  it('rejects invalid values before provider access', async () => {
    const response = await POST(
      request('POST', { ...body, intensity: 8 }, 'short'),
    )

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(client.create).not.toHaveBeenCalled()
  })

  it('sanitizes dependency details', async () => {
    client.list.mockRejectedValue(
      new ApiError({
        message: 'private database detail',
        code: 'DEPENDENCY_UNAVAILABLE',
        status: 503,
      }),
    )

    const response = await GET(request())
    const responseBody = await response.json()

    expect(response.status).toBe(503)
    expect(responseBody.code).toBe('DEPENDENCY_UNAVAILABLE')
    expect(JSON.stringify(responseBody)).not.toContain(
      'private database detail',
    )
  })
})

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ create: vi.fn() }))
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

import { POST } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const body = {
  localDate: '2026-09-26',
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD',
  intensity: 4,
  note: null,
}

function request(value: unknown = body, key = 'emotion-command-00000001') {
  return new NextRequest('http://localhost/api/emotion-check-ins', {
    method: 'POST',
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(value),
  })
}

describe('/api/emotion-check-ins Route Handler', () => {
  beforeEach(() => {
    client.create.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('creates through the authenticated owner contract without accepting an owner id', async () => {
    client.create.mockResolvedValue({ id: 'created' })

    const response = await POST(request())

    expect(response.status).toBe(201)
    expect(client.create).toHaveBeenCalledWith(
      'access-token',
      body,
      'emotion-command-00000001',
      expect.any(String),
    )

    const invalid = await POST(
      request({ ...body, ownerAccountId: account.accountId }),
    )
    expect(invalid.status).toBe(400)
    expect(client.create).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the session has expired', async () => {
    session.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(client.create).not.toHaveBeenCalled()
  })

  it('returns a bounded problem without leaking provider detail', async () => {
    client.create.mockRejectedValue(
      new ApiError({
        message: 'private provider detail',
        code: 'DEPENDENCY_UNAVAILABLE',
        status: 503,
      }),
    )

    const response = await POST(request())
    const responseBody = await response.json()

    expect(response.status).toBe(503)
    expect(responseBody.code).toBe('DEPENDENCY_UNAVAILABLE')
    expect(JSON.stringify(responseBody)).not.toContain(
      'private provider detail',
    )
  })
})

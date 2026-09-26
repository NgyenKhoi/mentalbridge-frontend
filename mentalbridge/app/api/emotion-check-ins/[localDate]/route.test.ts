import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))
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

import { GET, PATCH } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const localDate = '2026-09-26'
const context = {
  params: Promise.resolve({ localDate }),
} as RouteContext<'/api/emotion-check-ins/[localDate]'>

function request(method: 'GET' | 'PATCH', revision = '1') {
  const value = { emotion: 'LOW', intensity: 3, note: null }
  return new NextRequest(
    `http://localhost/api/emotion-check-ins/${localDate}`,
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=access-token`,
        ...(method === 'PATCH'
          ? {
              'Content-Type': 'application/json',
              'Idempotency-Key': 'emotion-command-00000001',
              'If-Match-Revision': revision,
            }
          : {}),
      },
      ...(method === 'PATCH' ? { body: JSON.stringify(value) } : {}),
    },
  )
}

describe('/api/emotion-check-ins/[localDate] Route Handler', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.update.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('loads the authenticated owner day and preserves a not-found boundary', async () => {
    client.get.mockRejectedValue(
      new ApiError({
        message: 'private absence detail',
        code: 'RESOURCE_NOT_FOUND',
        status: 404,
      }),
    )

    const response = await GET(request('GET'), context)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(client.get).toHaveBeenCalledWith(
      'access-token',
      localDate,
      expect.any(String),
    )
    expect(body.title).toBe('Hôm nay bạn chưa ghi nhận cảm xúc.')
    expect(JSON.stringify(body)).not.toContain('private absence detail')
  })

  it('forwards the exact revision for a same-day update', async () => {
    const value = { emotion: 'LOW', intensity: 3, note: null }
    client.update.mockResolvedValue({ localDate, revision: 2 })

    const response = await PATCH(request('PATCH'), context)

    expect(response.status).toBe(200)
    expect(client.update).toHaveBeenCalledWith(
      'access-token',
      localDate,
      1,
      value,
      'emotion-command-00000001',
      expect.any(String),
    )
  })

  it('rejects malformed dates and revisions before provider access', async () => {
    const invalidContext = {
      params: Promise.resolve({ localDate: '2026-02-31' }),
    } as RouteContext<'/api/emotion-check-ins/[localDate]'>

    expect((await GET(request('GET'), invalidContext)).status).toBe(400)
    expect((await PATCH(request('PATCH', '0'), context)).status).toBe(400)
    expect(client.get).not.toHaveBeenCalled()
    expect(client.update).not.toHaveBeenCalled()
  })
})

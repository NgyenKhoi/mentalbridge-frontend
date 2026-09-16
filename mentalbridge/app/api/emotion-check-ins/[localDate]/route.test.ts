import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
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

import { DELETE, GET, PATCH } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const localDate = '2026-09-17'
const context = {
  params: Promise.resolve({ localDate }),
} as RouteContext<'/api/emotion-check-ins/[localDate]'>

function request(method: string, value?: unknown, revision?: string) {
  return new NextRequest(
    `http://localhost/api/emotion-check-ins/${localDate}`,
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=access-token`,
        'Idempotency-Key': 'emotion-mutation-command-0001',
        ...(revision ? { 'If-Match-Revision': revision } : {}),
        ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    },
  )
}

describe('/api/emotion-check-ins/[localDate] Route Handler', () => {
  beforeEach(() => {
    Object.values(client).forEach((mock) => mock.mockReset())
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('forwards optimistic update and owner delete boundaries', async () => {
    client.update.mockResolvedValue({ localDate, revision: 2 })
    const value = { emotion: 'LOW', intensity: 3, note: null }

    const updated = await PATCH(request('PATCH', value, '1'), context)

    expect(updated.status).toBe(200)
    expect(client.update).toHaveBeenCalledWith(
      'access-token',
      localDate,
      1,
      value,
      'emotion-mutation-command-0001',
      expect.any(String),
    )

    client.remove.mockResolvedValue({
      localDate,
      deleted: true,
      deletedAt: '2026-09-16T17:30:00.000Z',
    })
    const removed = await DELETE(request('DELETE'), context)
    expect(removed.status).toBe(200)
    expect(client.remove).toHaveBeenCalledWith(
      'access-token',
      localDate,
      'emotion-mutation-command-0001',
      expect.any(String),
    )
  })

  it('rejects malformed day and revision before provider access', async () => {
    const invalidContext = {
      params: Promise.resolve({ localDate: '2026-02-31' }),
    } as RouteContext<'/api/emotion-check-ins/[localDate]'>
    expect((await GET(request('GET'), invalidContext)).status).toBe(400)
    expect(
      (
        await PATCH(
          request('PATCH', { emotion: 'GOOD', intensity: 3 }, '0'),
          context,
        )
      ).status,
    ).toBe(400)
    expect(client.get).not.toHaveBeenCalled()
    expect(client.update).not.toHaveBeenCalled()
  })
})

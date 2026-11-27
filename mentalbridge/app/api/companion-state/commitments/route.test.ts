import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ createCommitment: vi.fn() }))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/companion-state/client', () => ({
  companionStateClient: client,
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
  kind: 'REST',
  minutes: 5,
  dueOn: '2026-11-28',
  source: 'HOME',
}

const request = (value: unknown = body) =>
  new NextRequest('http://localhost/api/companion-state/commitments', {
    method: 'POST',
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  })

describe('/api/companion-state/commitments Route Handler', () => {
  beforeEach(() => {
    client.createCommitment.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('creates a commitment for the authenticated owner', async () => {
    client.createCommitment.mockResolvedValue({ id: 'created' })

    const response = await POST(request())

    expect(response.status).toBe(201)
    expect(client.createCommitment).toHaveBeenCalledWith(
      'access-token',
      body,
      expect.any(String),
    )
  })

  it('accepts a null duration for a step without a time', async () => {
    client.createCommitment.mockResolvedValue({ id: 'created' })

    expect((await POST(request({ ...body, minutes: null }))).status).toBe(201)
  })

  it.each([
    ['unknown kind', { ...body, kind: 'RUN_MARATHON' }],
    ['minutes off the list', { ...body, minutes: 7 }],
    ['missing minutes', { kind: 'REST', dueOn: '2026-11-28', source: 'HOME' }],
    ['unknown source', { ...body, source: 'ADS' }],
    ['bad date', { ...body, dueOn: '28/11/2026' }],
    ['owner id', { ...body, ownerAccountId: account.accountId }],
    ['status set by the client', { ...body, status: 'DONE' }],
  ])('rejects %s before calling the service', async (_name, value) => {
    const response = await POST(request(value))

    expect(response.status).toBe(400)
    expect(client.createCommitment).not.toHaveBeenCalled()
  })

  it('rejects a non-JSON body', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/companion-state/commitments', {
        method: 'POST',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=access-token`,
          'Content-Type': 'text/plain',
        },
        body: 'REST',
      }),
    )

    expect(response.status).toBe(415)
    expect(client.createCommitment).not.toHaveBeenCalled()
  })

  it('passes the commitment limit code through', async () => {
    client.createCommitment.mockRejectedValue(
      new ApiError({
        message: 'private provider detail',
        code: 'COMMITMENT_LIMIT',
        status: 409,
      }),
    )

    const response = await POST(request())
    const result = await response.json()

    expect(response.status).toBe(409)
    expect(result.code).toBe('COMMITMENT_LIMIT')
    expect(JSON.stringify(result)).not.toContain('private provider detail')
  })

  it('fails closed when the session has expired', async () => {
    session.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )

    expect((await POST(request())).status).toBe(401)
    expect(client.createCommitment).not.toHaveBeenCalled()
  })
})

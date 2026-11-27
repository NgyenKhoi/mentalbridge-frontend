import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ resolveCommitment: vi.fn() }))
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

import { PATCH } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const id = '30000000-0000-4000-8000-000000000001'

const call = (value: unknown = { status: 'DONE' }, commitmentId = id) =>
  PATCH(
    new NextRequest(
      `http://localhost/api/companion-state/commitments/${commitmentId}`,
      {
        method: 'PATCH',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=access-token`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
      },
    ),
    { params: Promise.resolve({ commitmentId }) },
  )

describe('/api/companion-state/commitments/[commitmentId] Route Handler', () => {
  beforeEach(() => {
    client.resolveCommitment.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it.each(['DONE', 'NOT_YET', 'SWAPPED'])(
    'resolves a commitment as %s',
    async (status) => {
      client.resolveCommitment.mockResolvedValue({ id })

      const response = await call({ status })

      expect(response.status).toBe(200)
      expect(client.resolveCommitment).toHaveBeenCalledWith(
        'access-token',
        id,
        { status },
        expect.any(String),
      )
    },
  )

  it.each([
    ['reopening', { status: 'OPEN' }],
    ['unknown status', { status: 'LATER' }],
    ['extra field', { status: 'DONE', kind: 'REST' }],
    ['no status', {}],
  ])('rejects %s before calling the service', async (_name, value) => {
    expect((await call(value)).status).toBe(400)
    expect(client.resolveCommitment).not.toHaveBeenCalled()
  })

  it('rejects an id that is not a UUID', async () => {
    expect((await call({ status: 'DONE' }, 'not-a-uuid')).status).toBe(400)
    expect(client.resolveCommitment).not.toHaveBeenCalled()
  })

  it.each([
    ['COMMITMENT_RESOLVED', 409],
    ['RESOURCE_NOT_FOUND', 404],
  ])('passes %s through', async (code, status) => {
    client.resolveCommitment.mockRejectedValue(
      new ApiError({ message: 'private provider detail', code, status }),
    )

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(status)
    expect(body.code).toBe(code)
    expect(JSON.stringify(body)).not.toContain('private provider detail')
  })

  it('fails closed when the session has expired', async () => {
    session.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )

    expect((await call()).status).toBe(401)
    expect(client.resolveCommitment).not.toHaveBeenCalled()
  })
})

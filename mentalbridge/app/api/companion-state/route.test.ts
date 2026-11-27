import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))
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

import { GET, PATCH } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const empty = {
  focus: null,
  chapters: [],
  commitments: [],
  ui: { guide: null, seen: [] },
  revision: 0,
}
const cookie = `${ACCESS_COOKIE_NAME}=access-token`

const patch = (value: unknown) =>
  new NextRequest('http://localhost/api/companion-state', {
    method: 'PATCH',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })

describe('/api/companion-state Route Handler', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.update.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('reads the owner state with the server-held credential', async () => {
    client.get.mockResolvedValue(empty)

    const response = await GET(
      new NextRequest('http://localhost/api/companion-state', {
        headers: { cookie },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual(empty)
    expect(client.get).toHaveBeenCalledWith('access-token', expect.any(String))
  })

  it('merges a valid partial update, including a guide state up to 6144 characters', async () => {
    client.update.mockResolvedValue(empty)
    const body = {
      focus: { goal: 'SLEEP', chosenOn: '2026-11-27' },
      chapter: { startedOn: '2026-11-27', rating: 'LIGHTER' },
      guide: 'x'.repeat(6144),
      seenAdd: ['declined:abc', 'reminder:2026-11-27'],
    }

    const response = await PATCH(patch(body))

    expect(response.status).toBe(200)
    expect(client.update).toHaveBeenCalledWith(
      'access-token',
      body,
      expect.any(String),
    )
  })

  it.each([
    ['empty body', {}],
    ['unknown owner field', { ownerAccountId: account.accountId }],
    ['unknown goal', { focus: { goal: 'MONEY', chosenOn: '2026-11-27' } }],
    ['impossible date', { focus: { goal: 'SLEEP', chosenOn: '2026-02-31' } }],
    ['bad rating', { chapter: { startedOn: '2026-11-27', rating: 'BEST' } }],
    ['guide too long', { guide: 'x'.repeat(6145) }],
    ['bad seen key', { seenAdd: ['Has Space'] }],
    ['no seen keys', { seenAdd: [] }],
    ['too many seen keys', { seenAdd: Array.from({ length: 51 }, () => 'a') }],
  ])('rejects %s before calling the service', async (_name, value) => {
    const response = await PATCH(patch(value))

    expect(response.status).toBe(400)
    expect(client.update).not.toHaveBeenCalled()
  })

  it('allows clearing the focus and the guide', async () => {
    client.update.mockResolvedValue(empty)

    expect((await PATCH(patch({ focus: null, guide: null }))).status).toBe(200)
  })

  it('fails closed when the session has expired', async () => {
    session.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )

    const response = await GET(
      new NextRequest('http://localhost/api/companion-state', {
        headers: { cookie },
      }),
    )

    expect(response.status).toBe(401)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('passes a conflict code through without provider detail', async () => {
    client.update.mockRejectedValue(
      new ApiError({
        message: 'private provider detail',
        code: 'CONFLICT',
        status: 409,
      }),
    )

    const response = await PATCH(patch({ guide: null }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('CONFLICT')
    expect(JSON.stringify(body)).not.toContain('private provider detail')
  })

  it('answers an unreachable service with a bounded problem', async () => {
    client.get.mockRejectedValue(new Error('socket hang up'))

    const response = await GET(
      new NextRequest('http://localhost/api/companion-state', {
        headers: { cookie },
      }),
    )

    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('socket')
  })
})

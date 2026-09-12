import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const journalMocks = vi.hoisted(() => ({
  detail: vi.fn(),
  revise: vi.fn(),
  remove: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/journal/journal-client', () => ({ journalClient: journalMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { DELETE, GET, PATCH } from './route'

const journalId = '40000000-0000-4000-8000-000000000001'
const timestamp = '2026-09-11T03:00:00.000Z'
const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const entry = {
  id: journalId,
  ownerAccountId: account.accountId,
  currentRevision: 2,
  occurredAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: false,
  tags: ['updated'],
  encryption: {
    algorithm: 'AES-256-GCM',
    keyId: 'test-v1',
    encryptedAt: timestamp,
  },
  analysisState: 'stale',
  content: { text: 'updated journal', byteLength: 15 },
}

function request(method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost/api/journals/${journalId}`, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(method === 'PATCH'
        ? {
            'Idempotency-Key': 'revise-command-0001',
            'If-Match-Revision': '1',
          }
        : {}),
      ...(method === 'DELETE'
        ? { 'Idempotency-Key': 'delete-command-0001' }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
const context = (id = journalId) => ({
  params: Promise.resolve({ journalId: id }),
})

describe('/api/journals/[journalId] Route Handler', () => {
  beforeEach(() => {
    journalMocks.detail.mockReset()
    journalMocks.revise.mockReset()
    journalMocks.remove.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('reads one owner-scoped entry through the server client', async () => {
    journalMocks.detail.mockResolvedValue(entry)

    const response = await GET(request(), context())

    expect(response.status).toBe(200)
    expect(journalMocks.detail).toHaveBeenCalledWith(
      'access-token',
      journalId,
      expect.any(String),
    )
  })

  it('forwards revision and idempotency headers for PATCH', async () => {
    journalMocks.revise.mockResolvedValue(entry)
    const write = { content: { text: 'updated journal' }, tags: ['updated'] }

    const response = await PATCH(request('PATCH', write), context())

    expect(response.status).toBe(200)
    expect(journalMocks.revise).toHaveBeenCalledWith(
      'access-token',
      journalId,
      1,
      write,
      'revise-command-0001',
      expect.any(String),
    )
  })

  it('forwards the stable command key for DELETE', async () => {
    journalMocks.remove.mockResolvedValue({
      id: journalId,
      ownerAccountId: account.accountId,
      deleted: true,
      deletedAt: timestamp,
    })

    const response = await DELETE(request('DELETE'), context())

    expect(response.status).toBe(200)
    expect(journalMocks.remove).toHaveBeenCalledWith(
      'access-token',
      journalId,
      'delete-command-0001',
      expect.any(String),
    )
  })

  it('rejects malformed identifiers before session or provider access', async () => {
    const response = await GET(request(), context('not-a-uuid'))

    expect(response.status).toBe(400)
    expect(sessionMocks.resolveSession).not.toHaveBeenCalled()
    expect(journalMocks.detail).not.toHaveBeenCalled()
  })

  it('enforces the USER role at the server boundary', async () => {
    sessionMocks.ensureRole.mockImplementation(() => {
      throw new ApiError({
        message: 'Forbidden',
        code: 'FORBIDDEN',
        status: 403,
      })
    })

    const response = await GET(request(), context())

    expect(response.status).toBe(403)
    expect(journalMocks.detail).not.toHaveBeenCalled()
  })

  it('preserves the mutation unknown-outcome code for safe same-key retry', async () => {
    journalMocks.revise.mockRejectedValue(
      new ApiError({
        message: 'ambiguous provider response',
        code: 'JOURNAL_MUTATION_OUTCOME_UNKNOWN',
        status: 503,
      }),
    )

    const response = await PATCH(
      request('PATCH', { content: { text: 'updated journal' } }),
      context(),
    )
    const responseBody = await response.json()

    expect(response.status).toBe(503)
    expect(responseBody.code).toBe('JOURNAL_MUTATION_OUTCOME_UNKNOWN')
    expect(JSON.stringify(responseBody)).not.toContain(
      'ambiguous provider response',
    )
  })
})

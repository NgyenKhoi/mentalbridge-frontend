import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'

process.env.CONTENT_SERVICE_URL = 'http://content.test'
process.env.CONTENT_SERVICE_TIMEOUT_MS = '100'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  readSessionCredentials: vi.fn(() => ({
    accessToken: 'expired-access',
    refreshToken: 'refresh-token',
  })),
}))

vi.mock('@/lib/auth/session-cookies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session-cookies')>()),
  readSessionCredentials: mocks.readSessionCredentials,
}))

vi.mock('@/lib/auth/session-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session-service')>()),
  resolveSession: mocks.resolveSession,
  ensureRole: mocks.ensureRole,
}))

import { GET as list, POST as create } from '@/app/api/admin/resources/route'
import {
  DELETE as remove,
  GET as detail,
  PATCH as update,
} from '@/app/api/admin/resources/[id]/route'
import { POST as publish } from '@/app/api/admin/resources/[id]/publish/route'
import { POST as archive } from '@/app/api/admin/resources/[id]/archive/route'

const RESOURCE_ID = '123e4567-e89b-42d3-a456-426614174000'
const CORRELATION_ID = '223e4567-e89b-42d3-a456-426614174000'
const rotatedTokens = {
  accessToken: 'rotated-access',
  refreshToken: 'rotated-refresh',
  tokenType: 'Bearer' as const,
  expiresIn: 300,
  refreshExpiresAt: '2099-01-01T00:00:00Z',
}
const summary = {
  id: RESOURCE_ID,
  category: 'ARTICLE',
  locale: 'vi-VN',
  title: 'Draft',
  summary: 'Summary',
  externalUrl: null,
  status: 'DRAFT',
  reviewedAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}
const fullDetail = {
  ...summary,
  contentBody: 'Body',
  reviewedBy: null,
  effectiveAt: null,
  expiresAt: null,
  version: 0,
}

function json(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType },
  })
}

function req(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('x-correlation-id', CORRELATION_ID)
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init?.method,
    headers,
    ...(init?.body === undefined || init.body === null
      ? {}
      : { body: init.body }),
  })
}

const context = { params: Promise.resolve({ id: RESOURCE_ID }) }

describe('Content admin BFF boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.resolveSession.mockReset()
    mocks.ensureRole.mockReset()
    mocks.resolveSession.mockResolvedValue({
      account: { accountId: 'admin', roles: ['ADMIN'] },
      rotatedTokens,
    })
    mocks.ensureRole.mockReturnValue(undefined)
  })

  it('uses the rotated access token, validates list data, and carries rotated cookies', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ data: [summary], count: 1 }))
    const response = await list(req('/api/admin/resources?status=DRAFT'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [summary], count: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/api/v1/resources/admin/list' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer rotated-access',
        }),
      }),
    )
    expect(response.headers.getSetCookie().join(';')).toContain(
      'mentalbridge_access=rotated-access',
    )
  })

  it('uses the authenticated admin detail endpoint for drafts', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(json(fullDetail))
    const response = await detail(
      req(`/api/admin/resources/${RESOURCE_ID}`),
      context,
    )

    expect(response!.status).toBe(200)
    expect((await response!.json()).version).toBe(0)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: `/api/v1/resources/admin/${RESOURCE_ID}`,
      }),
      expect.anything(),
    )
  })

  it('requires the idempotency header and forwards it for valid create requests', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(json(summary, 201))
    const body = {
      category: 'ARTICLE',
      title: 'Draft',
      summary: 'Summary',
      contentBody: 'Body',
    }

    expect(
      (await create(
        req('/api/admin/resources', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
      ))!.status,
    ).toBe(400)

    const response = await create(
      req('/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'logical-create-1',
        },
      }),
    )
    expect(response.status).toBe(201)
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'logical-create-1',
        }),
      }),
    )
  })

  it('validates malformed requests before contacting Content', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
    const response = await create(
      req('/api/admin/resources', {
        method: 'POST',
        body: '{broken',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'logical-create-2',
        },
      }),
    )
    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('covers update, stale delete, blocked publish, and archive handlers', async () => {
    const conflict = {
      type: 'https://mentalbridge.io/errors/INVALID_STATE_TRANSITION',
      title: 'Conflict',
      status: 409,
      code: 'INVALID_STATE_TRANSITION',
      correlationId: CORRELATION_ID,
    }
    const reviewRequired = {
      type: 'https://mentalbridge.io/errors/REVIEW_APPROVAL_REQUIRED',
      title: 'Review required',
      status: 409,
      code: 'REVIEW_APPROVAL_REQUIRED',
      correlationId: CORRELATION_ID,
    }
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ ...summary, title: 'Updated' }))
      .mockResolvedValueOnce(json(conflict, 409, 'application/problem+json'))
      .mockResolvedValueOnce(
        json(reviewRequired, 409, 'application/problem+json'),
      )
      .mockResolvedValueOnce(json({ ...summary, status: 'ARCHIVED' }))

    expect(
      (await update(
        req(`/api/admin/resources/${RESOURCE_ID}?version=0`, {
          method: 'PATCH',
          body: JSON.stringify({ title: 'Updated' }),
          headers: { 'content-type': 'application/json' },
        }),
        context,
      ))!.status,
    ).toBe(200)
    expect(
      (await remove(
        req(`/api/admin/resources/${RESOURCE_ID}?version=0`, {
          method: 'DELETE',
        }),
        context,
      ))!.status,
    ).toBe(409)
    expect(
      (
        await publish(
          req(`/api/admin/resources/${RESOURCE_ID}/publish?version=0`, {
            method: 'POST',
          }),
          context,
        )
      ).status,
    ).toBe(409)
    expect(
      (
        await archive(
          req(`/api/admin/resources/${RESOURCE_ID}/archive?version=1`, {
            method: 'POST',
          }),
          context,
        )
      ).status,
    ).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('sanitizes malformed upstream errors and unknown mutation outcomes', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ secret: 'leak' }, 500))
    const malformed = await list(req('/api/admin/resources'))
    expect(malformed.status).toBe(502)
    expect(await malformed.text()).not.toContain('secret')

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'x'.repeat(140_000) }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    const oversized = await list(req('/api/admin/resources'))
    expect(oversized.status).toBe(502)

    fetchMock.mockRejectedValueOnce(new Error('socket reset with secret'))
    const unknown = await remove(
      req(`/api/admin/resources/${RESOURCE_ID}?version=0`, {
        method: 'DELETE',
      }),
      context,
    )
    expect(unknown!.status).toBe(503)
    expect((await unknown!.json()).code).toBe('CONTENT_COMMAND_OUTCOME_UNKNOWN')
  })

  it('returns timeout/unavailable states and rejects forbidden sessions without upstream calls', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    expect((await list(req('/api/admin/resources'))).status).toBe(504)

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('unavailable'))
    expect((await list(req('/api/admin/resources'))).status).toBe(503)

    mocks.ensureRole.mockImplementationOnce(() => {
      throw new ApiError({
        message: 'Forbidden',
        code: 'FORBIDDEN',
        status: 403,
      })
    })
    const fetchMock = vi.spyOn(global, 'fetch')
    const forbidden = await list(req('/api/admin/resources'))
    expect(forbidden.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

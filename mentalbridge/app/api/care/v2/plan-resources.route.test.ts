import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({
  resourceActions: vi.fn(),
  reconcileResource: vi.fn(),
}))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/care/support-plan-action-client', () => ({
  supportPlanActionClient: client,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class extends Error {},
  ...session,
}))

import { GET } from './support-plans/current/resource-actions/route'
import { POST } from './support-plan-occurrences/[occurrenceId]/resource/reconcile/route'

const occurrenceId = '20000000-0000-4000-8000-000000000670'
const context = { params: Promise.resolve({ occurrenceId }) }
const projection = { planState: 'NONE', localDate: '2026-10-21', actions: [] }
function request(
  method: string,
  query = '',
  headers: Record<string, string> = {},
  body?: string,
) {
  return new NextRequest(`http://localhost/api/care/v2/support-plans${query}`, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=server-token`,
      origin: 'http://localhost',
      ...headers,
    },
    ...(body === undefined ? {} : { body }),
  })
}

describe('MB-670 plan resource BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.resolveSession.mockResolvedValue({ account: { roles: ['USER'] } })
    client.resourceActions.mockResolvedValue(projection)
    client.reconcileResource.mockResolvedValue({
      occurrenceId,
      version: 2,
      state: 'COMPLETED',
    })
  })

  it('reads the minimized owner projection for the explicit local date', async () => {
    const response = await GET(request('GET', '?localDate=2026-10-21'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(projection)
    expect(client.resourceActions).toHaveBeenCalledWith(
      'server-token',
      '2026-10-21',
      expect.any(String),
    )
    expect(session.ensureRole).toHaveBeenCalledWith(expect.anything(), ['USER'])
  })

  it.each(['', '?localDate=2026-02-30', '?localDate=yesterday'])(
    'rejects invalid date %s',
    async (query) => {
      expect((await GET(request('GET', query))).status).toBe(400)
      expect(client.resourceActions).not.toHaveBeenCalled()
    },
  )

  it('reconciles only a server checked Content fact with an exact occurrence version and empty body', async () => {
    const response = await POST(
      request('POST', '', { 'If-Match': '"1"' }),
      context,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(client.reconcileResource).toHaveBeenCalledWith(
      'server-token',
      occurrenceId,
      1,
      expect.any(String),
    )
    expect(await response.text()).not.toContain('server-token')
  })

  it.each([
    [{}, undefined, 400],
    [{ 'If-Match': 'W/"1"' }, undefined, 400],
    [{ 'If-Match': '"1"', origin: 'http://foreign.test' }, undefined, 403],
    [{ 'If-Match': '"1"' }, '{"factId":"client-proof"}', 400],
  ] as const)(
    'rejects invalid reconciliation headers or client facts',
    async (headers, body, status) => {
      expect(
        (await POST(request('POST', '', headers, body), context)).status,
      ).toBe(status)
      expect(client.reconcileResource).not.toHaveBeenCalled()
    },
  )

  it.each([
    [409, 'RESOURCE_EVIDENCE_NOT_FOUND'],
    [409, 'RESOURCE_EVIDENCE_ALREADY_USED'],
    [412, 'STALE_VERSION'],
    [503, 'CONTENT_UNAVAILABLE'],
  ])('preserves a safe %s reconciliation failure', async (status, code) => {
    client.reconcileResource.mockRejectedValue(
      new ApiError({
        status: Number(status),
        code: String(code),
        message: 'private upstream message',
      }),
    )
    const response = await POST(
      request('POST', '', { 'If-Match': '"1"' }),
      context,
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ status, code })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  failure: vi.fn(),
  request: vi.fn(),
}))

vi.mock('@/lib/auth/admin-actor', () => ({
  authenticatedAdminActor: mocks.actor,
  adminAuthenticationFailure: mocks.failure,
  carryAdminSession: (response: Response) => response,
}))
vi.mock('@/lib/benchmarks/benchmark-client', () => ({
  benchmarkRequest: mocks.request,
}))

import { GET, POST } from './route'

const correlationId = '8fb5720a-53ab-40db-9cf4-f5cfabbdaf65'

function next(method = 'GET', body?: unknown, key?: string) {
  return new NextRequest('http://localhost/api/admin/ai-benchmarks/datasets', {
    method,
    headers: {
      'X-Correlation-Id': correlationId,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.actor.mockResolvedValue({ accessToken: 'admin-token' })
  mocks.request.mockResolvedValue([])
  mocks.failure.mockReturnValue(
    Response.json({ code: 'FORBIDDEN' }, { status: 403 }),
  )
})

describe('admin benchmark dataset BFF', () => {
  it('fails closed when ADMIN authentication is denied', async () => {
    mocks.actor.mockRejectedValue(new Error('FORBIDDEN'))
    const response = await GET(next())
    expect(response.status).toBe(403)
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('forwards only the bounded admin dataset request', async () => {
    await GET(next())
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/admin/ai-benchmarks/datasets',
      accessToken: 'admin-token',
      correlationId,
    })
  })

  it('requires and forwards a UUID command key', async () => {
    const body = { datasetId: 'synthetic' }
    const missing = await POST(next('POST', body))
    expect(missing.status).toBe(400)

    const key = '4b5fcd4b-ed59-4a6a-8848-b5a6125c99b2'
    const accepted = await POST(next('POST', body, key))
    expect(accepted.status).toBe(201)
    expect(mocks.request).toHaveBeenLastCalledWith({
      method: 'POST',
      path: '/api/v1/admin/ai-benchmarks/datasets',
      accessToken: 'admin-token',
      correlationId,
      idempotencyKey: key,
      body,
    })
  })
})

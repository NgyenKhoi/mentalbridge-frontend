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

import { POST } from './route'

describe('admin benchmark run BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.actor.mockResolvedValue({ accessToken: 'admin-token' })
    mocks.request.mockResolvedValue({
      runId: crypto.randomUUID(),
      status: 'RUNNING',
    })
  })

  it('returns an asynchronous 202 acceptance receipt and preserves command identity', async () => {
    const key = '4b5fcd4b-ed59-4a6a-8848-b5a6125c99b2'
    const body = {
      datasetId: 'synthetic-safety',
      datasetVersion: 'v1',
      provider: 'BEDROCK',
      model: 'approved-model',
    }
    const response = await POST(
      new NextRequest('http://localhost/api/admin/ai-benchmarks/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(body),
      }),
    )
    expect(response.status).toBe(202)
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/admin/ai-benchmarks/runs',
        idempotencyKey: key,
        body,
      }),
    )
  })
})

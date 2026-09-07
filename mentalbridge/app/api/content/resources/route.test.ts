import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const contentMocks = vi.hoisted(() => ({
  listReviewedResources: vi.fn(),
}))

vi.mock('@/lib/content/content-client', () => ({
  listReviewedResources: contentMocks.listReviewedResources,
}))

import { GET } from './route'

const correlationId = '40000000-0000-4000-8000-000000000001'

describe('GET /api/content/resources', () => {
  beforeEach(() => contentMocks.listReviewedResources.mockReset())

  it('returns reviewed Content data with correlation evidence', async () => {
    contentMocks.listReviewedResources.mockResolvedValue({ data: [], count: 0 })
    const response = await GET(
      new NextRequest('http://localhost/api/content/resources', {
        headers: { 'X-Correlation-Id': correlationId },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Correlation-Id')).toBe(correlationId)
    expect(await response.json()).toEqual({ data: [], count: 0 })
  })
})

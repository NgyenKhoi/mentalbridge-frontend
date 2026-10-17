import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const resourceId = '00000000-0000-4000-8000-000000000213'
const contentMocks = vi.hoisted(() => ({ detail: vi.fn() }))

vi.mock('@/lib/content/content-client', () => ({
  contentPublicClient: contentMocks,
  ContentServiceError: class ContentServiceError extends Error {},
}))

import { GET } from './route'

function request(id = resourceId, contentVersion?: string) {
  const url = new URL(`http://localhost/api/resources/${id}`)
  if (contentVersion !== undefined) {
    url.searchParams.set('contentVersion', contentVersion)
  }
  return new NextRequest(url)
}

function context(id = resourceId) {
  return {
    params: Promise.resolve({ resourceId: id }),
  } as RouteContext<'/api/resources/[resourceId]'>
}

describe('GET /api/resources/[resourceId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the reviewed public detail without authentication', async () => {
    contentMocks.detail.mockResolvedValue({
      id: resourceId,
      category: 'VIDEO',
      title: 'Reviewed video',
      sourceOrganization: 'NHS Every Mind Matters',
      contentVersion: '4',
    })

    const response = await GET(request(), context())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: resourceId,
      sourceOrganization: 'NHS Every Mind Matters',
    })
    expect(contentMocks.detail).toHaveBeenCalledWith(
      resourceId,
      expect.any(String),
      undefined,
    )
  })

  it('forwards and verifies an exact SupportPlan content version', async () => {
    contentMocks.detail.mockResolvedValue({
      id: resourceId,
      category: 'VIDEO',
      title: 'Reviewed video',
      contentVersion: '4',
    })

    const response = await GET(request(resourceId, '4'), context())

    expect(response.status).toBe(200)
    expect(contentMocks.detail).toHaveBeenCalledWith(
      resourceId,
      expect.any(String),
      '4',
    )
  })

  it('fails closed when Content returns a different version', async () => {
    contentMocks.detail.mockResolvedValue({
      id: resourceId,
      category: 'VIDEO',
      title: 'Reviewed video',
      contentVersion: '5',
    })

    const response = await GET(request(resourceId, '4'), context())

    expect(response.status).toBe(502)
    expect((await response.json()).code).toBe('CONTENT_VERSION_MISMATCH')
  })

  it('rejects a malformed identifier before calling Content', async () => {
    const response = await GET(request('not-a-uuid'), context('not-a-uuid'))

    expect(response.status).toBe(400)
    expect(contentMocks.detail).not.toHaveBeenCalled()
  })

  it('rejects a malformed content version before calling Content', async () => {
    const response = await GET(request(resourceId, 'latest'), context())

    expect(response.status).toBe(400)
    expect(contentMocks.detail).not.toHaveBeenCalled()
  })
})

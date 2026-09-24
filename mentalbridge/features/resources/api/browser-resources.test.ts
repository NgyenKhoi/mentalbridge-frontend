import { afterEach, describe, expect, it, vi } from 'vitest'

import { getResourceDetail } from './browser-resources'

const resourceId = '00000000-0000-4000-8000-000000000213'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getResourceDetail', () => {
  it('carries the exact content version to the Resource Detail BFF', async () => {
    const detail = {
      id: resourceId,
      category: 'ARTICLE',
      locale: 'vi-VN',
      title: 'Reviewed resource',
      summary: 'Reviewed summary',
      contentVersion: '4',
      contentBody: 'Reviewed body',
      externalUrl: null,
      sourceOrganization: 'NHS',
      sourceTitle: 'Reviewed source',
      sourceUrl: 'https://www.nhs.uk/mental-health/',
      sourceReviewNote: 'Internal review note',
      status: 'PUBLISHED',
      reviewedAt: '2026-09-23T00:00:00Z',
      effectiveAt: '2026-09-23T00:00:00Z',
      expiresAt: null,
      createdAt: '2026-09-23T00:00:00Z',
      updatedAt: '2026-09-23T00:00:00Z',
    }
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }))

    await expect(getResourceDetail(resourceId, '4')).resolves.toEqual(detail)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/resources/${resourceId}?contentVersion=4`,
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )
  })
})

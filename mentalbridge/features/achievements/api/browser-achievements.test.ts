import { beforeEach, describe, expect, it, vi } from 'vitest'

import { endMamAwardSession } from '@/features/mam/mam-award-session'
import { MAM_AWARD_READ_EVENT } from '@/features/mam/mam-celebrations'

const client = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))
import { getAchievements } from './browser-achievements'

const collection = (visibilityState: 'VISIBLE' | 'HIDDEN' = 'VISIBLE') => ({
  visibilityState,
  sources: [
    { domain: 'JOURNAL', availability: 'AVAILABLE', asOfLocalDate: null },
    { domain: 'RESOURCE', availability: 'AVAILABLE', asOfLocalDate: null },
  ],
  items: [
    {
      definitionId: 'journal.first-entry',
      domain: 'JOURNAL',
      status: 'EARNED',
      unlockedAt: '2026-10-27T01:00:00.000Z',
      title: 'Bước đầu viết nhật ký',
    },
  ],
})

describe('MB-774 achievements read feeds the Mầm director', () => {
  const reads: unknown[] = []
  const listen = (event: Event) => reads.push((event as CustomEvent).detail)
  beforeEach(() => {
    vi.clearAllMocks()
    reads.length = 0
    window.addEventListener(MAM_AWARD_READ_EVENT, listen)
    return () => window.removeEventListener(MAM_AWARD_READ_EVENT, listen)
  })

  it('dispatches one mapped read per source domain after a good response', async () => {
    client.get.mockResolvedValue({
      data: collection(),
      headers: { etag: '"3"' },
    })
    const result = await getAchievements('Asia/Ho_Chi_Minh')
    expect(result.etag).toBe('"3"')
    expect(reads).toMatchObject([
      {
        scope: 'achievements:JOURNAL',
        available: true,
        visible: true,
        awards: [{ kind: 'achievement', title: 'Bước đầu viết nhật ký' }],
      },
      { scope: 'achievements:RESOURCE', available: true, awards: [] },
    ])
  })

  it('reports a hidden collection as not visible', async () => {
    client.get.mockResolvedValue({
      data: collection('HIDDEN'),
      headers: { etag: '"3"' },
    })
    await getAchievements('Asia/Ho_Chi_Minh')
    expect(reads).toMatchObject([
      { available: false, visible: false, awards: [] },
      { available: false, visible: false, awards: [] },
    ])
  })

  it('dispatches nothing when the dock session ends before the response arrives', async () => {
    let resolve!: (value: unknown) => void
    client.get.mockReturnValue(new Promise((done) => (resolve = done)))
    const pending = getAchievements('Asia/Ho_Chi_Minh')
    endMamAwardSession()
    resolve({ data: collection(), headers: { etag: '"3"' } })
    // The page still gets its response.
    await expect(pending).resolves.toMatchObject({ etag: '"3"' })
    expect(reads).toEqual([])
  })

  it('dispatches nothing when the request fails', async () => {
    client.get.mockRejectedValue(new Error('503'))
    await expect(getAchievements('Asia/Ho_Chi_Minh')).rejects.toThrow('503')
    expect(reads).toEqual([])
  })

  it.each([undefined, 'W/"1"'])(
    'dispatches nothing for an unusable ETag %s',
    async (etag) => {
      client.get.mockResolvedValue({ data: collection(), headers: { etag } })
      await expect(getAchievements('Asia/Ho_Chi_Minh')).rejects.toMatchObject({
        code: 'CONTENT_MALFORMED_RESPONSE',
      })
      expect(reads).toEqual([])
    },
  )
})

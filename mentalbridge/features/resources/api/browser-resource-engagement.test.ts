import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))
import { endMamAwardSession } from '@/features/mam/mam-award-session'
import { MAM_AWARD_READ_EVENT } from '@/features/mam/mam-celebrations'
import {
  getResourceBingo,
  syncResourceBingoWithPlan,
  setResourceBingoSelfConfirmation,
} from './browser-resource-engagement'

describe('MB-670 browser plan Bingo transport', () => {
  beforeEach(() => vi.clearAllMocks())
  it('asks Content to sync from Care authority using only the board timezone', async () => {
    const board = { items: [] }
    client.put.mockResolvedValue({ data: board, headers: { etag: '"1"' } })
    expect(
      await syncResourceBingoWithPlan('2026-10-19', 'Asia/Ho_Chi_Minh'),
    ).toEqual({ board, etag: '"1"' })
    expect(client.put).toHaveBeenCalledWith(
      '/resources/bingo/2026-10-19/plan-sync',
      { timeZone: 'Asia/Ho_Chi_Minh' },
    )
  })
  it.each([undefined, 'W/"1"', '1'])(
    'rejects unusable board concurrency version %s',
    async (etag) => {
      client.put.mockResolvedValue({ data: { items: [] }, headers: { etag } })
      await expect(
        syncResourceBingoWithPlan('2026-10-19', 'Asia/Ho_Chi_Minh'),
      ).rejects.toMatchObject({
        status: 502,
        code: 'CONTENT_MALFORMED_RESPONSE',
      })
    },
  )
  it('keeps self-confirmation and undo entirely in Content using the exact board ETag', async () => {
    client.put.mockResolvedValue({
      data: { items: [] },
      headers: { etag: '"2"' },
    })
    await setResourceBingoSelfConfirmation('2026-10-19', 2, false, '"1"')
    expect(client.put).toHaveBeenCalledWith(
      '/resources/bingo/2026-10-19/items/2',
      { selfConfirmed: false },
      { headers: { 'If-Match': '"1"' } },
    )
  })
})

describe('MB-774 Bingo reads feed the Mầm director', () => {
  const reads: unknown[] = []
  const listen = (event: Event) => reads.push((event as CustomEvent).detail)
  const board = {
    weekStart: '2026-10-26',
    timeZone: 'Asia/Ho_Chi_Minh',
    items: [
      {
        position: 0,
        resourceId: 'res-1',
        contentVersion: 'v1',
        evidence: 'CONTENT_VERIFIED',
        verifiedAt: '2026-10-27T01:00:00.000Z',
      },
      {
        position: 1,
        resourceId: 'res-2',
        contentVersion: 'v1',
        evidence: 'SELF_CONFIRMED',
        verifiedAt: null,
      },
    ],
  }
  beforeEach(() => {
    vi.clearAllMocks()
    reads.length = 0
    window.addEventListener(MAM_AWARD_READ_EVENT, listen)
    return () => window.removeEventListener(MAM_AWARD_READ_EVENT, listen)
  })

  it.each([
    ['get', () => getResourceBingo('2026-10-26')],
    ['put', () => syncResourceBingoWithPlan('2026-10-26', 'Asia/Ho_Chi_Minh')],
    [
      'put',
      () => setResourceBingoSelfConfirmation('2026-10-26', 1, true, '"1"'),
    ],
  ] as const)(
    'dispatches the verified items of a good %s response',
    async (verb, call) => {
      client[verb].mockResolvedValue({ data: board, headers: { etag: '"2"' } })
      await call()
      expect(reads).toHaveLength(1)
      expect(reads[0]).toMatchObject({
        scope: 'bingo:2026-10-26:Asia/Ho_Chi_Minh',
        available: true,
        visible: true,
      })
      expect((reads[0] as { awards: unknown[] }).awards).toHaveLength(1)
    },
  )

  it.each([
    ['get', () => getResourceBingo('2026-10-26')],
    ['put', () => syncResourceBingoWithPlan('2026-10-26', 'Asia/Ho_Chi_Minh')],
    [
      'put',
      () => setResourceBingoSelfConfirmation('2026-10-26', 1, true, '"1"'),
    ],
  ] as const)(
    'dispatches nothing when the dock session ends before a %s response arrives',
    async (verb, call) => {
      let resolve!: (value: unknown) => void
      client[verb].mockReturnValue(new Promise((done) => (resolve = done)))
      const pending = call()
      endMamAwardSession()
      resolve({ data: board, headers: { etag: '"2"' } })
      // The page still gets its response.
      await expect(pending).resolves.toMatchObject({ board })
      expect(reads).toEqual([])
    },
  )

  it('dispatches nothing when the request fails or the ETag is unusable', async () => {
    client.put.mockRejectedValue(new Error('412'))
    await expect(
      setResourceBingoSelfConfirmation('2026-10-26', 1, true, '"1"'),
    ).rejects.toThrow('412')
    client.get.mockResolvedValue({ data: board, headers: {} })
    await expect(getResourceBingo('2026-10-26')).rejects.toMatchObject({
      status: 502,
    })
    expect(reads).toEqual([])
  })
})

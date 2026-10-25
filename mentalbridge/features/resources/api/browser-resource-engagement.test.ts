import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))
import {
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

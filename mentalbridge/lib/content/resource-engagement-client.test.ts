import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  contentResourceEngagementClient,
  type ContentServiceError,
} from './content-client'

const resourceId = '00000000-0000-4000-8000-000000000201'
const otherResourceId = '00000000-0000-4000-8000-000000000202'
const weekStart = '2026-09-28'

const bookmark = {
  resourceId,
  contentVersion: '7',
  savedAt: '2026-09-29T02:15:00.000Z',
  version: '0',
}

const board = {
  weekStart,
  timeZone: 'Asia/Ho_Chi_Minh',
  version: '0',
  updatedAt: '2026-09-29T02:15:00.000Z',
  items: [
    {
      position: 1,
      resourceId,
      contentVersion: '7',
      actionId: null,
      retired: false,
      label: 'Thở chậm',
      evidence: 'NONE',
      selfConfirmedAt: null,
      verifiedAt: null,
      verificationSource: null,
    },
  ],
}

function upstream(body: unknown, etag?: string) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...(etag ? { ETag: etag } : {}),
    },
  })
}

describe('content resource engagement identity binding', () => {
  beforeEach(() => {
    process.env.CONTENT_SERVICE_URL = 'http://content.local:3003'
    process.env.CONTENT_SERVICE_TIMEOUT_MS = '5000'
  })

  afterEach(() => vi.unstubAllGlobals())

  it('fails closed when a bookmark save returns another resource', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          upstream({ ...bookmark, resourceId: otherResourceId }),
        ),
    )

    await expect(
      contentResourceEngagementClient.saveBookmark(
        'owner-token',
        resourceId,
        'correlation',
      ),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })

  it.each([
    ['another week', { ...board, weekStart: '2026-09-21' }, '"0"'],
    ['no strong ETag', board, undefined],
    ['a malformed ETag', board, 'W/"0"'],
    ['a mismatched ETag', board, '"1"'],
  ])('fails closed when Bingo returns %s', async (_case, response, etag) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(response, etag)))

    await expect(
      contentResourceEngagementClient.getBingo(
        'owner-token',
        weekStart,
        'correlation',
      ),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })

  it('binds the mutation target and forwards the exact ETag', async () => {
    const updatedBoard = { ...board, version: '1' }
    const fetchMock = vi.fn().mockResolvedValue(upstream(updatedBoard, '"1"'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      contentResourceEngagementClient.setBingoSelfConfirmation(
        'owner-token',
        weekStart,
        1,
        { selfConfirmed: true },
        '"0"',
        'correlation',
      ),
    ).resolves.toEqual({ board: updatedBoard, etag: '"1"' })

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.pathname).toBe(
      '/api/v1/resource-bingo/2026-09-28/items/1/self-confirmation',
    )
    expect(init.headers).toMatchObject({ 'If-Match': '"0"' })
  })

  it('syncs the current plan through the bounded Content endpoint', async () => {
    const synced = {
      ...board,
      unavailableActions: [],
      items: [{ ...board.items[0], actionId: 'action-670', retired: false }],
    }
    const fetchMock = vi.fn().mockResolvedValue(upstream(synced, '"0"'))
    vi.stubGlobal('fetch', fetchMock)
    expect(
      await contentResourceEngagementClient.syncBingoWithPlan(
        'owner-token',
        weekStart,
        board.timeZone,
        'correlation',
      ),
    ).toEqual({ board: synced, etag: '"0"' })
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.pathname).toBe(`/api/v1/resource-bingo/${weekStart}/plan-sync`)
    expect(JSON.parse(String(init.body))).toEqual({ timeZone: board.timeZone })
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer owner-token',
      'X-Correlation-Id': 'correlation',
    })
  })
})

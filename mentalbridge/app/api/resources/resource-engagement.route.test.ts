import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const contentMocks = vi.hoisted(() => ({
  listBookmarks: vi.fn(),
  saveBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  getBingo: vi.fn(),
  setBingoSelfConfirmation: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentResourceEngagementClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET as getBookmarks } from './bookmarks/route'
import { PUT as setBingo } from './bingo/[weekStart]/items/[position]/route'
import { GET as getBingo } from './bingo/[weekStart]/route'

const weekStart = '2026-09-28'
const board = {
  weekStart,
  timeZone: 'Asia/Ho_Chi_Minh',
  version: '0',
  updatedAt: '2026-09-29T02:15:00.000Z',
  items: [],
}

function request(
  path: string,
  method: 'GET' | 'PUT',
  body?: unknown,
  etag?: string,
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(etag ? { 'If-Match': etag } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('/api/resources bookmark and Bingo BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('loads owner bookmarks and Bingo while preserving the strong ETag', async () => {
    contentMocks.listBookmarks.mockResolvedValue({ items: [] })
    contentMocks.getBingo.mockResolvedValue({ board, etag: '"0"' })

    const bookmarks = await getBookmarks(
      request('/api/resources/bookmarks', 'GET'),
    )
    const bingo = await getBingo(
      request(`/api/resources/bingo/${weekStart}`, 'GET'),
      { params: Promise.resolve({ weekStart }) },
    )

    expect(bookmarks.status).toBe(200)
    expect(await bookmarks.json()).toEqual({ items: [] })
    expect(bingo.status).toBe(200)
    expect(bingo.headers.get('etag')).toBe('"0"')
    expect(contentMocks.getBingo).toHaveBeenCalledWith(
      'identity-access-secret',
      weekStart,
      expect.any(String),
    )
  })

  it('forwards an exact self-confirmation replacement and version', async () => {
    contentMocks.setBingoSelfConfirmation.mockResolvedValue({
      board: { ...board, version: '1' },
      etag: '"1"',
    })
    const response = await setBingo(
      request(
        `/api/resources/bingo/${weekStart}/items/2`,
        'PUT',
        { selfConfirmed: false },
        '"0"',
      ),
      { params: Promise.resolve({ weekStart, position: '2' }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(contentMocks.setBingoSelfConfirmation).toHaveBeenCalledWith(
      'identity-access-secret',
      weekStart,
      2,
      { selfConfirmed: false },
      '"0"',
      expect.any(String),
    )
  })

  it.each([
    ['2026-09-29', '2', { selfConfirmed: true }, '"0"'],
    [weekStart, '0', { selfConfirmed: true }, '"0"'],
    [weekStart, '2', { selfConfirmed: 'yes' }, '"0"'],
    [weekStart, '2', { selfConfirmed: true }, 'W/"0"'],
  ])(
    'rejects invalid week, position, body, or version before Content is called',
    async (date, position, body, etag) => {
      const response = await setBingo(
        request(
          `/api/resources/bingo/${date}/items/${position}`,
          'PUT',
          body,
          etag,
        ),
        { params: Promise.resolve({ weekStart: date, position }) },
      )
      expect(response.status).toBe(400)
      expect(contentMocks.setBingoSelfConfirmation).not.toHaveBeenCalled()
    },
  )
})

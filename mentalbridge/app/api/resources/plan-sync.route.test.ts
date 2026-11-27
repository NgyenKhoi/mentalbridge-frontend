import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ syncBingoWithPlan: vi.fn() }))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/content/content-client', () => ({
  contentResourceEngagementClient: client,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class extends Error {},
  ...session,
}))
import { PUT } from './bingo/[weekStart]/plan-sync/route'

const weekStart = '2026-10-19'
const timeZone = 'Asia/Ho_Chi_Minh'
function request(body: unknown, origin = 'http://localhost') {
  return new NextRequest(
    'http://localhost/api/resources/bingo/2026-10-19/plan-sync',
    {
      method: 'PUT',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=server-token`,
        origin,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}
describe('MB-670 plan Bingo sync BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.resolveSession.mockResolvedValue({ account: { roles: ['USER'] } })
  })
  it('sends only the timezone and preserves the board ETag', async () => {
    const board = {
      weekStart,
      timeZone,
      version: '2',
      items: [],
      unavailableActions: [],
    }
    client.syncBingoWithPlan.mockResolvedValue({ board, etag: '"2"' })
    const response = await PUT(request({ timeZone }), {
      params: Promise.resolve({ weekStart }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(await response.json()).toEqual(board)
    expect(client.syncBingoWithPlan).toHaveBeenCalledWith(
      'server-token',
      weekStart,
      timeZone,
      expect.any(String),
    )
    expect(session.ensureRole).toHaveBeenCalledWith(expect.anything(), ['USER'])
  })
  it('uses the public Host case-insensitively behind a proxy', async () => {
    client.syncBingoWithPlan.mockResolvedValue({ board: {}, etag: '"2"' })
    const response = await PUT(
      new NextRequest('https://0.0.0.0:3000/api/resources/bingo/plan-sync', {
        method: 'PUT',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=server-token`,
          host: 'STAGING.MENTALBRIDGE.ONLINE',
          origin: 'https://staging.mentalbridge.online',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ timeZone }),
      }),
      { params: Promise.resolve({ weekStart }) },
    )
    expect(response.status).toBe(200)
    expect(client.syncBingoWithPlan).toHaveBeenCalledOnce()
  })
  it.each([
    undefined,
    'null',
    'not-a-url',
    'http://localhost/path',
    'http://user@localhost',
  ])('rejects a missing or malformed origin: %s', async (origin) => {
    const incoming = request({ timeZone })
    if (origin === undefined) incoming.headers.delete('origin')
    else incoming.headers.set('origin', origin)
    const response = await PUT(incoming, {
      params: Promise.resolve({ weekStart }),
    })
    expect(response.status).toBe(403)
    expect(client.syncBingoWithPlan).not.toHaveBeenCalled()
  })
  it.each([
    ['2026-10-20', { timeZone }, 'http://localhost', 400],
    [weekStart, { timeZone: 'invalid' }, 'http://localhost', 400],
    [weekStart, { timeZone, planId: 'untrusted' }, 'http://localhost', 400],
    [weekStart, { timeZone }, 'http://foreign.test', 403],
  ])(
    'rejects invalid target, input or origin before Content',
    async (week, body, origin, status) => {
      const response = await PUT(request(body, String(origin)), {
        params: Promise.resolve({ weekStart: String(week) }),
      })
      expect(response.status).toBe(status)
      expect(client.syncBingoWithPlan).not.toHaveBeenCalled()
    },
  )
})

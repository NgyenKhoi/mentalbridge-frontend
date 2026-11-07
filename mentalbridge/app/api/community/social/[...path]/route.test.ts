import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const upstream = vi.hoisted(() => vi.fn())
const authenticate = vi.hoisted(() => vi.fn())
vi.mock('@/features/community-chat/server/community-chat-client', () => ({
  communityChatRequest: upstream,
}))
vi.mock('@/lib/community/authenticated-user', () => ({
  authenticatedCommunityUser: authenticate,
  carryCommunitySession: (response: Response) => response,
  communityAuthenticationFailure: () =>
    NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
}))
import { GET, POST, PUT, DELETE } from './route'

const profile = '10000000-0000-4000-8000-000000000001'
const friendship = '20000000-0000-4000-8000-000000000001'
const context = (path: string[]) => ({ params: Promise.resolve({ path }) })
const request = (
  path: string,
  method: string,
  body?: string,
  origin = 'http://localhost',
) =>
  new NextRequest(`http://localhost/api/community/social/${path}`, {
    method,
    headers: { origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body }),
  })

describe('Community social BFF', () => {
  beforeEach(() => {
    upstream.mockReset()
    authenticate.mockReset()
    authenticate.mockResolvedValue({ accessToken: 'synthetic-token' })
    upstream.mockResolvedValue({
      data: { items: [], nextCursor: null },
      status: 200,
    })
  })
  it('authenticates before reading the owner-scoped friend list', async () => {
    authenticate.mockRejectedValue(new Error('role denied'))
    expect(
      (await GET(request('friends', 'GET'), context(['friends']))).status,
    ).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('rejects foreign-origin friendship mutations', async () => {
    expect(
      (
        await PUT(
          request(`friends/${profile}`, 'PUT', '{}', 'https://foreign.test'),
          context(['friends', profile]),
        )
      ).status,
    ).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('forwards only exact recipient and request selectors', async () => {
    expect(
      (
        await PUT(
          request(`friends/${profile}`, 'PUT', '{}'),
          context(['friends', profile]),
        )
      ).status,
    ).toBe(200)
    expect(upstream).toHaveBeenCalledWith(
      `api/v1/community/chat/friends/${profile}`,
      'synthetic-token',
      expect.any(String),
      expect.any(Function),
      { method: 'PUT', body: {} },
    )
    expect(
      (
        await POST(
          request(`friendships/${friendship}/accept`, 'POST', '{}'),
          context(['friendships', friendship, 'accept']),
        )
      ).status,
    ).toBe(200)
  })
  it('rejects actor injection, oversized streams and duplicate query parameters', async () => {
    for (const body of [`{"actor":"${profile}"}`, ' '.repeat(33) + '{}'])
      expect(
        (
          await PUT(
            request(`friends/${profile}`, 'PUT', body),
            context(['friends', profile]),
          )
        ).status,
      ).toBe(400)
    expect(
      (
        await GET(
          request('friends?view=accepted&view=incoming', 'GET'),
          context(['friends']),
        )
      ).status,
    ).toBe(400)
    expect(
      (await GET(request('members?q=a', 'GET'), context(['members']))).status,
    ).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('maps removal to an owner-authorized 204 operation', async () => {
    upstream.mockResolvedValue({ data: null, status: 204 })
    expect(
      (
        await DELETE(
          request(`friendships/${friendship}`, 'DELETE'),
          context(['friendships', friendship]),
        )
      ).status,
    ).toBe(204)
  })
})
